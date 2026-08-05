/**
 * 中国戏曲演出地图 - 主逻辑
 * ECharts 地图渲染 + 三色亮点 + 数据加载
 */
(function() {
    'use strict';

    var chart = null;
    var geoJson = null;
    var allPerformances = [];
    var tooltip = document.getElementById('tooltip');
    var mapSection = document.getElementById('mapSection');
    var zoomHint = document.getElementById('zoomHint');
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // ========== 演出详情浮层（提前定义，避免 onclick 找不到函数） ==========
    window._closePerfDetail = function() {
        var overlay = document.getElementById('perfDetailOverlay');
        if (overlay) overlay.classList.remove('visible');
        document.body.style.overflow = '';
    };

    // ========== 加载 GeoJSON ==========
    async function loadGeoJson() {
        // 多源回退：本地优先，再尝试多个在线CDN
        var sources = [
            { url: 'data/china.json', name: '本地' },
            { url: 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json', name: '阿里DataV' },
            { url: 'https://geojson.cn/api/data/china-geojson/china.json', name: 'GeoJSON.cn' }
        ];

        var failures = [];

        for (var i = 0; i < sources.length; i++) {
            var src = sources[i];
            try {
                var resp = await fetch(src.url);
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                var text = await resp.text();
                geoJson = JSON.parse(text);
                return true;
            } catch(e) {
                failures.push({ name: src.name, url: src.url, error: e.message });
            }
        }
        console.error('[地图] GeoJSON 加载失败:', failures);
        return false;
    }

    // ========== 加载演出数据 ==========
    async function loadPerformances() {
        try {
            var resp = await fetch('data/performances.json');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            allPerformances = await resp.json();
        } catch(e) {
            console.error('[数据] 演出数据加载失败:', e.message);
            allPerformances = [];
        }
    }

    // ========== 判断演出状态 ==========
    function getStatus(perf) {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var start = new Date(perf.startDate + 'T00:00:00');
        var end = new Date(perf.endDate + 'T23:59:59');
        var threeDaysLater = new Date(end.getTime() + 3 * 86400000);

        if (today >= start && today <= end) return 'live';
        if (today < start) return 'upcoming';
        if (today > end && today <= threeDaysLater) return 'ended';
        return null;
    }

    // ========== 剧种颜色映射（基于哈希） ==========
    var genreColors = {};
    var genrePalette = ['#C41E3A','#E8383B','#D4A00A','#4CAF50','#2196F3','#9C27B0','#FF9800','#00BCD4','#795548','#607D8B','#E91E63','#3F51B5','#009688','#CDDC39','#FF5722','#673AB7'];
    function getGenreColor(genre) {
        if (!genreColors[genre]) {
            var hash = 0;
            for (var i = 0; i < genre.length; i++) { hash = genre.charCodeAt(i) + ((hash << 5) - hash); }
            genreColors[genre] = genrePalette[Math.abs(hash) % genrePalette.length];
        }
        return genreColors[genre];
    }

    // ========== 计算倒计时 ==========
    function getCountdown(p) {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var start = new Date(p.startDate + 'T00:00:00');
        var end = new Date(p.endDate + 'T23:59:59');
        var diffStart = Math.ceil((start - today) / 86400000);
        var diffEnd = Math.ceil((end - today) / 86400000);
        if (today >= start && today <= end) return { text: '进行中 · 距结束 ' + diffEnd + ' 天', cls: 'live' };
        if (today < start) return { text: '距开始 ' + diffStart + ' 天', cls: 'upcoming' };
        return { text: '已结束', cls: 'ended' };
    }

    // ========== 获取活跃演出 ==========
    function getActivePerformances() {
        var keyword = (searchKeyword || '').trim().toLowerCase();
        return allPerformances
            .filter(function(p) {
                var s = getStatus(p);
                if (!s) return false;
                if (filters[s] === false) return false;
                if (filters.manual && p.source !== 'manual') return false;
                // 剧种筛选
                if (activeGenres.length > 0 && activeGenres.indexOf(p.genre) === -1) return false;
                // 搜索关键词
                if (keyword && (p.name || '').toLowerCase().indexOf(keyword) === -1) return false;
                return true;
            })
            .map(function(p) {
                p._status = getStatus(p);
                return p;
            });
    }

    // ========== 获取 ECharts 主题配色 ==========
    function getChartColors() {
var isDark = window.ThemeManager && window.ThemeManager.isDark ? window.ThemeManager.isDark() : false;
        return {
            paperAreaColor: isDark ? '#1e2030' : '#F5EDE0',
            paperHoverColor: isDark ? '#2a2d3e' : '#EBE0CC',
            labelColor: isDark ? 'rgba(180,170,150,0.45)' : 'rgba(80,60,40,0.55)',
            labelBorderColor: isDark ? 'rgba(30,30,40,0.85)' : 'rgba(254,249,242,0.85)',
            borderColor: isDark ? 'rgba(201,169,110,0.25)' : 'rgba(184,148,62,0.35)',
            shadowColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(139,115,85,0.1)',
            emphasisLabelColor: isDark ? '#e0d8c8' : '#2C2416',
            emphasisBorderColor: isDark ? '#C9A96E' : '#B8943E'
        };
    }

    // ========== 初始化地图 ==========
    function initChart() {
        var dom = document.getElementById('mapChart');
chart = echarts.init(dom, null, { devicePixelRatio: window.devicePixelRatio || 1 });
        echarts.registerMap('china', geoJson);

        var colors = getChartColors();

        var option = {
            backgroundColor: 'transparent',
            animation: true,
            animationDuration: 800,
            animationEasing: 'cubicInOut',
            geo: {
                map: 'china',
                roam: !isMobile,
                zoom: 1.15,
                center: [104.5, 35.5],
                aspectScale: 0.85,
                scaleLimit: { min: 0.8, max: 8 },
                silent: false,
                label: {
                    show: true,
                    color: colors.labelColor,
                    fontSize: 10,
                    fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif',
                    textBorderColor: colors.labelBorderColor,
                    textBorderWidth: 2
                },
                itemStyle: {
                    areaColor: colors.paperAreaColor,
                    borderColor: colors.borderColor,
                    borderWidth: 1,
                    shadowColor: colors.shadowColor,
                    shadowBlur: 8
                },
                emphasis: {
                    label: {
                        show: true,
                        color: colors.emphasisLabelColor,
                        fontSize: 13,
                        fontWeight: 'bold',
                        fontFamily: '"STKaiti","KaiTi","楷体","Noto Sans SC","Microsoft YaHei",sans-serif'
                    },
                    itemStyle: {
                        areaColor: colors.paperHoverColor,
                        borderColor: colors.emphasisBorderColor,
                        borderWidth: 2,
                        shadowBlur: 16,
                        shadowColor: 'rgba(184,148,62,0.3)'
                    },
                    scale: 1.02
                },
                regions: [{
                    name: '南海诸岛',
                    itemStyle: { areaColor: colors.paperAreaColor },
                    label: { show: false }
                }]
            },
            series: [
                {
                    name: '正在演出',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: function(val) { return val && val[2] > 1 ? 13 : 9; },
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 2.5, period: 4.5, color: '#E53935' },
                    itemStyle: { color: '#E53935', shadowBlur: 10, shadowColor: 'rgba(229,57,53,0.55)' },
                    emphasis: { scale: 2.0, itemStyle: { shadowBlur: 24, shadowColor: 'rgba(229,57,53,0.8)' } },
                    zlevel: 1
                },
                {
                    name: '即将演出',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: function(val) { return val && val[2] > 1 ? 11 : 7; },
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 2.2, period: 5, color: '#00ACC1' },
                    itemStyle: { color: '#00ACC1', shadowBlur: 8, shadowColor: 'rgba(0,172,193,0.45)' },
                    emphasis: { scale: 2.0, itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,172,193,0.65)' } },
                    zlevel: 1
                },
                {
                    name: '已结束',
                    type: 'scatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: function(val) { return val && val[2] > 1 ? 10 : 6; },
                    itemStyle: { color: '#8D6E63', shadowBlur: 4, shadowColor: 'rgba(141,110,99,0.3)', opacity: 0.8 },
                    emphasis: { scale: 2.0, itemStyle: { opacity: 1, shadowBlur: 14 } },
                    zlevel: 1
                },
                {
                    name: '个人添加',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: function(val) { return val && val[2] > 1 ? 13 : 9; },
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 2, period: 4, color: '#4CAF50' },
                    itemStyle: { color: '#4CAF50', shadowBlur: 12, shadowColor: 'rgba(76,175,80,0.5)' },
                    emphasis: { scale: 2.0, itemStyle: { shadowBlur: 22, shadowColor: 'rgba(76,175,80,0.7)' } },
                    zlevel: 1
                }
            ]
        };

        chart.setOption(option);

        // ========== 地图 hover 滚轮缩放控制 ==========
        var mapDom = document.getElementById('mapChart');

        function enableRoam() {
            if (chart) {
                chart.setOption({ geo: { roam: true } });
                mapDom.classList.add('zoom-active');
                if (zoomHint) zoomHint.classList.add('visible');
            }
        }

        function disableRoam() {
            if (chart) {
                chart.setOption({ geo: { roam: false } });
                mapDom.classList.remove('zoom-active');
                if (zoomHint) zoomHint.classList.remove('visible');
            }
        }

        if (!isMobile) {
            // 桌面端：hover 地图区域时才启用滚轮缩放
            mapSection.addEventListener('mouseenter', function() {
                enableRoam();
            });
            mapSection.addEventListener('mouseleave', function() {
                disableRoam();
            });
            // 初始状态禁用
            disableRoam();
        } else {
            // 移动端：始终开启 roam 支持触摸手势
            enableRoam();
            if (zoomHint) {
                zoomHint.textContent = '👆 双指缩放 · 单指拖拽';
                zoomHint.classList.add('visible');
            }
        }

        // ===== 事件处理 =====
        // 悬停标记点 → 显示信息卡片
        chart.on('mouseover', 'series', function(params) {
            if (params.data && params.data._perfs) {
                showTooltip(params.data._perfs, params.data._address, params.event.event);
            } else if (params.data && params.data._perf) {
                showTooltip([params.data._perf], params.data._perf.address, params.event.event);
            }
        });
        // 鼠标移出标记点 → 桌面端隐藏卡片
        chart.on('mouseout', 'series', function() {
            if (!isMobile) {
                tooltip.classList.remove('visible');
            }
        });

        // 点击标记点 → 固定显示信息卡片（移动端）/ 桌面端触发详情
        chart.on('click', 'series', function(params) {
            if (params.data && params.data._perfs) {
                if (isMobile) {
                    // 移动端点击标记点固定卡片
                    showTooltip(params.data._perfs, params.data._address, params.event.event);
                }
            }
        });

        // 点击省份 → 显示该省剧种统计
        var lastClickedProvince = null;
        chart.on('click', 'geo', function(params) {
            if (!params.region) {
                tooltip.classList.remove('visible');
                lastClickedProvince = null;
                return;
            }
            var provinceName = params.region;
            // 再次点击同一省份 → 关闭
            if (lastClickedProvince === provinceName && tooltip.classList.contains('visible')) {
                tooltip.classList.remove('visible');
                lastClickedProvince = null;
                return;
            }
            lastClickedProvince = provinceName;
            showProvinceGenres(provinceName, params.event.event);
        });

        // 点击地图外部 → 关闭 tooltip
        document.addEventListener('click', function(e) {
            if (!tooltip.classList.contains('visible')) return;
            var isTooltip = tooltip.contains(e.target);
            var isChart = document.getElementById('mapChart').contains(e.target);
            if (!isTooltip && !isChart) {
                tooltip.classList.remove('visible');
            }
        });

        window.addEventListener('resize', function() {
            chart.resize();
            isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        });

        // 监听主题切换，动态更新地图配色
        window.addEventListener('themechange', function() {
            if (!chart) return;
            var colors = getChartColors();
            chart.setOption({
                geo: {
                    label: { color: colors.labelColor, textBorderColor: colors.labelBorderColor },
                    itemStyle: { areaColor: colors.paperAreaColor, borderColor: colors.borderColor, shadowColor: colors.shadowColor },
                    emphasis: {
                        label: { color: colors.emphasisLabelColor },
                        itemStyle: { areaColor: colors.paperHoverColor, borderColor: colors.emphasisBorderColor }
                    }
                }
            });
        });

        document.addEventListener('mousemove', function(e) {
            if (tooltip.classList.contains('visible') && !isMobile) {
                positionTooltip(e.clientX, e.clientY);
            }
        });

        console.log('[地图] ECharts 初始化完成, 区域数:', geoJson ? geoJson.features.length : 0);

        // 地图回中按钮
        var resetBtn = document.getElementById('mapResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                chart.dispatchAction({ type: 'restore' });
                tooltip.classList.remove('visible');
            });
        }
    }

    // ========== 按坐标合并同一剧院的多场演出 ==========
    function groupPerformancesByVenue(perfs) {
        var groups = {};
        perfs.forEach(function(p) {
            var key = p.lng.toFixed(6) + ',' + p.lat.toFixed(6);
            if (!groups[key]) {
                groups[key] = { lng: p.lng, lat: p.lat, address: p.address, city: p.city, province: p.province, performances: [], bestStatus: null };
            }
            groups[key].performances.push(p);
        });
        // 确定每个组的"最佳状态"用于散点颜色（live > upcoming > ended）
        // 同时标记是否为个人添加（所有演出都是 manual 才算个人添加组）
        Object.values(groups).forEach(function(g) {
            var allManual = g.performances.every(function(p) { return p.source === 'manual'; });
            if (allManual) { g.bestStatus = 'manual'; return; }
            var statuses = g.performances.map(function(p) { return p._status; });
            if (statuses.indexOf('live') !== -1) g.bestStatus = 'live';
            else if (statuses.indexOf('upcoming') !== -1) g.bestStatus = 'upcoming';
            else g.bestStatus = 'ended';
        });
        return Object.values(groups);
    }

    // ========== 更新地图数据 ==========
    function updateMapData() {
        var active = getActivePerformances();

        // 更新统计和 UI（不依赖 chart 也能更新）
        var groups = groupPerformancesByVenue(active);

        if (chart) {
            var liveData = [], upcomingData = [], endedData = [], manualData = [];

            groups.forEach(function(g) {
                var count = g.performances.length;
                var pt = {
                    name: count > 1 ? (g.address + ' (' + count + '场)') : g.address,
                    value: [g.lng, g.lat, count],
                    _perfs: g.performances,
                    _count: count,
                    _address: g.address,
                    _city: g.city,
                    _province: g.province,
                    symbolSize: count > 1 ? 13 : undefined
                };
                if (g.bestStatus === 'live') liveData.push(pt);
                else if (g.bestStatus === 'upcoming') upcomingData.push(pt);
                else if (g.bestStatus === 'manual') manualData.push(pt);
                else endedData.push(pt);
            });

            chart.setOption({
                series: [
                    { data: liveData },
                    { data: upcomingData },
                    { data: endedData },
                    { data: manualData }
                ]
            });

            document.getElementById('sLive').textContent = liveData.length;
            document.getElementById('sUpcoming').textContent = upcomingData.length;
            document.getElementById('sEnded').textContent = endedData.length;
            document.getElementById('sTotal').textContent = active.length;
        }

        updatePerfList(active);
        buildGenreTags();
    }

    // ========== 剧种图标映射 ==========
    var genreIcons = {
        '京剧': '🎭', '昆曲': '🌸', '越剧': '🌙', '豫剧': '🦁', '川剧': '🔥',
        '黄梅戏': '💛', '评剧': '🎵', '秦腔': '🏔️', '晋剧': '⛩️', '粤剧': '🐲',
        '汉剧': '🏯', '湘剧': '🌿', '徽剧': '⛰️', '赣剧': '🏞️', '滇剧': '🌈',
        '沪剧': '🌊', '锡剧': '🎋', '扬剧': '🌾', '淮剧': '🏠', '吕剧': '🕊️',
        '柳子戏': '🍃', '河北梆子': '🏛️', '河南曲剧': '🪕', '二人台': '💃',
        '花鼓戏': '🥁', '皮影戏': '👥', '木偶戏': '🪆', '高甲戏': '⚔️',
        '歌仔戏': '🎶', '莆仙戏': '🏮', '梨园戏': '🍐', '潮剧': '🌺',
        '瓯剧': '🦅', '绍剧': '🎪', '婺剧': '🦋', '甬剧': '🕯️',
        '折子戏': '📜', '傩戏': '👹', '藏戏': '🏔️', '壮剧': '🌴',
        '侗戏': '🎋', '苗剧': '🏕️', '白剧': '❄️', '傣剧': '🌴'
    };
    function getGenreIcon(genre) {
        return genreIcons[genre] || '🎬';
    }

    // ========== 演出状态计算辅助 ==========
    function getPerfStatus(perf) {
        var now = new Date();
        var start = new Date(perf.startDate + 'T00:00:00');
        var end = new Date(perf.endDate + 'T23:59:59');
        if (start <= now && now <= end) return 'live';
        if (now < start) return 'upcoming';
        return 'ended';
    }
    function getStatusLabel(status) {
        if (status === 'live') return '演出中';
        if (status === 'upcoming') return '即将演出';
        return '已结束';
    }

    // ========== 去重：同城市同场馆同日期去重 ==========
    function deduplicatePerformances(perfs) {
        var seen = {};
        return perfs.filter(function(p) {
            var key = (p.city || '') + '|' + (p.address || p.venue || '') + '|' + (p.startDate || '') + '|' + (p.name || '');
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    // ========== 构建演出详情数据JSON ==========
    function buildPerfDataJSON(p) {
        return JSON.stringify({
            name: p.name, city: p.city, startDate: p.startDate, endDate: p.endDate,
            genre: p.genre, actors: p.actors || '', venue: p.address || p.venue || '',
            lng: p.lng, lat: p.lat, troupe: p.troupe || '',
            duration: p.duration || '', description: p.description || '',
            price: p.price || '', transport: p.transport || ''
        }).replace(/"/g, '&quot;').replace(/'/g, "\\'");
    }

    // ========== 底部演出列表（V2重构版） ==========
    var currentTimeTab = 'today';
    var currentView = 'group';
    var calYear, calMonth;

    function updatePerfList(active) {
        // 去重
        var deduped = deduplicatePerformances(active);

        // 计算各演出状态
        deduped.forEach(function(p) {
            p._status = getPerfStatus(p);
        });

        // 按日期升序排序
        deduped.sort(function(a, b) { return a.startDate.localeCompare(b.startDate); });

        // 时间筛选
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var weekEnd = new Date(today.getTime() + 7 * 86400000);
        var monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        var filtered;
        switch (currentTimeTab) {
            case 'today':
                filtered = deduped.filter(function(p) {
                    var s = new Date(p.startDate + 'T00:00:00');
                    var e = new Date(p.endDate + 'T23:59:59');
                    return s <= today && today <= e;
                });
                break;
            case 'week':
                filtered = deduped.filter(function(p) {
                    var s = new Date(p.startDate + 'T00:00:00');
                    return s >= today && s <= weekEnd;
                });
                break;
            case 'month':
                filtered = deduped.filter(function(p) {
                    var s = new Date(p.startDate + 'T00:00:00');
                    return s >= today && s <= monthEnd;
                });
                break;
            default: // all
                filtered = deduped;
        }

        // 渲染各视图
        renderGroupView(filtered);
        renderTableView(filtered);
        renderCalendarView(deduped);
        renderStats(filtered, deduped);

        // 设置默认显示视图
        switchView(currentView);
    }

    // ===== 分组视图（按城市分组，每组内按日期升序） =====
    function renderGroupView(perfs) {
        var container = document.getElementById('pbtViewGroupContent');
        if (!container) return;

        // 按城市分组
        var cityGroups = {};
        perfs.forEach(function(p) {
            var city = p.city || '未知城市';
            if (!cityGroups[city]) cityGroups[city] = [];
            cityGroups[city].push(p);
        });

        // 城市名排序
        var sortedCities = Object.keys(cityGroups).sort();

        var html = '';
        sortedCities.forEach(function(city) {
            var items = cityGroups[city];
            // 组内按日期升序
            items.sort(function(a, b) { return a.startDate.localeCompare(b.startDate); });

            html += '<div class="pbt-city-group">' +
                '<div class="pbt-city-header" onclick="var b=this.nextElementSibling;this.classList.toggle(\'collapsed\');b.classList.toggle(\'collapsed\')">' +
                '<span class="pbt-city-arrow">▼</span>' +
                '<span class="pbt-city-name">' + escapeHtml(city) + '</span>' +
                '<span class="pbt-city-count">' + items.length + '场</span>' +
                '</div>' +
                '<div class="pbt-city-body">';

            items.forEach(function(p) {
                var genreIcon = getGenreIcon(p.genre);
                var statusLabel = getStatusLabel(p._status);
                var statusClass = p._status;
                var venueName = p.address || p.venue || '';
                var actorsStr = p.actors || '';
                var durationStr = p.duration || '';
                var transportStr = p.transport || '';
                var perfData = buildPerfDataJSON(p);

                html += '<div class="pbt-item" onclick="window._openPerfDetail(\'' + perfData + '\')">' +
                    '<div class="pbt-item-genre-icon" title="' + escapeHtml(p.genre) + '">' + genreIcon + '</div>' +
                    '<div class="pbt-item-info">' +
                    '<div class="pbt-item-name">' + escapeHtml(p.name) + '</div>' +
                    '<div class="pbt-item-meta">' +
                    '<span class="pbt-item-date">' + p.startDate + ' ~ ' + p.endDate + '</span>' +
                    '<span class="pbt-item-venue">' + escapeHtml(venueName) + '</span>';
                if (durationStr) {
                    html += '<span class="pbt-item-duration">⏱ ' + escapeHtml(durationStr) + '</span>';
                }
                if (actorsStr) {
                    html += '<span class="pbt-item-actors">👤 ' + escapeHtml(actorsStr) + '</span>';
                }
                if (transportStr) {
                    html += '<span class="pbt-item-address">🚇 ' + escapeHtml(transportStr) + '</span>';
                }
                html += '</div></div>' +
                    '<div class="pbt-item-status">' +
                    '<span class="pbt-status-badge ' + statusClass + '">' + statusLabel + '</span>' +
                    '</div>' +
                    '<button class="pbt-buy-btn" onclick="event.stopPropagation();window.open(\'https://www.baidu.com/s?wd=' + encodeURIComponent(p.name + ' ' + venueName + ' 购票') + '\', \'_blank\')">购票</button>' +
                    '</div>';
            });

            html += '</div></div>';
        });

        if (sortedCities.length === 0) {
            html = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">暂无符合条件的演出</div>';
        }

        container.innerHTML = html;
    }

    // ===== 表格视图（电子表格） =====
    function renderTableView(perfs) {
        var container = document.getElementById('pbtViewTableContent');
        if (!container) return;

        if (perfs.length === 0) {
            container.innerHTML = '<div class="pbt-table-wrapper"><table class="pbt-table"><tr><td class="pbt-td-empty" colspan="9">暂无数据</td></tr></table></div>';
            return;
        }

        var html = '<div class="pbt-table-wrapper"><table class="pbt-table">' +
            '<thead><tr>' +
            '<th>剧目</th><th>剧种</th><th>城市</th><th>场馆</th>' +
            '<th>开始日期</th><th>结束日期</th><th>状态</th><th>票价</th><th>购票</th>' +
            '</tr></thead><tbody>';

        perfs.forEach(function(p) {
            var statusLabel = getStatusLabel(p._status);
            var statusClass = p._status;
            var priceStr = p.price || '';
            var perfData = buildPerfDataJSON(p);
            var venueName = p.address || p.venue || '';

            html += '<tr onclick="window._openPerfDetail(\'' + perfData + '\')" style="cursor:pointer">' +
                '<td class="pbt-td-name" title="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</td>' +
                '<td>' + escapeHtml(p.genre || '') + '</td>' +
                '<td>' + escapeHtml(p.city || '') + '</td>' +
                '<td title="' + escapeHtml(venueName) + '">' + escapeHtml(venueName) + '</td>' +
                '<td>' + (p.startDate || '') + '</td>' +
                '<td>' + (p.endDate || '') + '</td>' +
                '<td class="pbt-td-status"><span class="pbt-status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
                '<td>' + (priceStr ? escapeHtml(priceStr) : '待定') + '</td>' +
                '<td class="pbt-td-actions"><button class="pbt-td-buy" onclick="event.stopPropagation();window.open(\'https://www.baidu.com/s?wd=' + encodeURIComponent(p.name + ' ' + venueName + ' 购票') + '\', \'_blank\')">购票</button></td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    // ===== 日历视图 =====
    function renderCalendarView(allPerfs) {
        var container = document.getElementById('pbtViewCalContent');
        if (!container) return;

        var now = new Date();
        if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }

        var firstDay = new Date(calYear, calMonth, 1);
        var lastDay = new Date(calYear, calMonth + 1, 0);
        var startDayOfWeek = firstDay.getDay(); // 0=周日
        var daysInMonth = lastDay.getDate();

        // 构建日期->演出映射
        var datePerfs = {};
        allPerfs.forEach(function(p) {
            var start = new Date(p.startDate + 'T00:00:00');
            var end = new Date(p.endDate + 'T23:59:59');
            for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
                if (!datePerfs[key]) datePerfs[key] = [];
                if (datePerfs[key].length < 3) { // 每天最多显示3个
                    datePerfs[key].push(p);
                }
            }
        });

        var today = new Date();
        var todayKey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();

        var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        var html = '<div class="pbt-cal-nav">' +
            '<button class="pbt-cal-nav-btn" onclick="window._calPrevMonth()">◀</button>' +
            '<span class="pbt-cal-nav-title">' + calYear + '年 ' + (calMonth + 1) + '月</span>' +
            '<button class="pbt-cal-nav-btn" onclick="window._calNextMonth()">▶</button>' +
            '</div>' +
            '<div class="pbt-cal-grid">';

        // 星期头
        for (var w = 0; w < 7; w++) {
            html += '<div class="pbt-cal-weekday">' + weekdays[w] + '</div>';
        }

        // 上月填充
        for (var i = 0; i < startDayOfWeek; i++) {
            html += '<div class="pbt-cal-day other-month"></div>';
        }

        // 本月日期
        for (var d = 1; d <= daysInMonth; d++) {
            var dateKey = calYear + '-' + (calMonth + 1) + '-' + d;
            var isToday = dateKey === todayKey;
            var events = datePerfs[dateKey] || [];

            html += '<div class="pbt-cal-day' + (isToday ? ' today' : '') + '">' +
                '<div class="pbt-cal-day-num">' + d + '</div>';

            for (var e = 0; e < events.length; e++) {
                var evt = events[e];
                var evtStatus = evt._status || getPerfStatus(evt);
                var perfData = buildPerfDataJSON(evt);
                html += '<div class="pbt-cal-event ' + evtStatus + '" onclick="event.stopPropagation();window._openPerfDetail(\'' + perfData + '\')" title="' + escapeHtml(evt.name) + '">' +
                    escapeHtml(evt.name.substring(0, 6)) + (evt.name.length > 6 ? '…' : '') +
                    '</div>';
            }

            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    window._calPrevMonth = function() {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        updatePerfList(getActivePerformances());
    };
    window._calNextMonth = function() {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        updatePerfList(getActivePerformances());
    };

    // ===== 底部统计条 =====
    function renderStats(filtered, allPerfs) {
        var container = document.getElementById('perfBarV2Stats');
        if (!container) return;

        var liveCount = filtered.filter(function(p) { return p._status === 'live'; }).length;
        var upcomingCount = filtered.filter(function(p) { return p._status === 'upcoming'; }).length;
        var endedCount = filtered.filter(function(p) { return p._status === 'ended'; }).length;
        var cityCount = new Set(filtered.map(function(p) { return p.city; })).size;
        var genreCount = new Set(filtered.map(function(p) { return p.genre; })).size;

        container.innerHTML =
            '<span class="pbt-stat-item">共 <span class="pbt-stat-val">' + filtered.length + '</span> 场演出</span>' +
            '<span class="pbt-stat-item"><span class="pbt-stat-dot" style="background:var(--live-red)"></span>演出中 <span class="pbt-stat-val">' + liveCount + '</span></span>' +
            '<span class="pbt-stat-item"><span class="pbt-stat-dot" style="background:var(--upcoming-teal)"></span>即将演出 <span class="pbt-stat-val">' + upcomingCount + '</span></span>' +
            '<span class="pbt-stat-item"><span class="pbt-stat-dot" style="background:var(--ended-brown)"></span>已结束 <span class="pbt-stat-val">' + endedCount + '</span></span>' +
            '<span class="pbt-stat-item">城市 <span class="pbt-stat-val">' + cityCount + '</span></span>' +
            '<span class="pbt-stat-item">剧种 <span class="pbt-stat-val">' + genreCount + '</span></span>';
    }

    // ===== 视图切换 =====
    function switchView(view) {
        currentView = view;
        var groupView = document.getElementById('pbtViewGroupContent');
        var tableView = document.getElementById('pbtViewTableContent');
        var calView = document.getElementById('pbtViewCalContent');
        var btnGroup = document.getElementById('pbtViewGroup');
        var btnTable = document.getElementById('pbtViewTable');
        var btnCal = document.getElementById('pbtViewCal');

        if (groupView) groupView.style.display = view === 'group' ? '' : 'none';
        if (tableView) tableView.style.display = view === 'table' ? '' : 'none';
        if (calView) calView.style.display = view === 'calendar' ? '' : 'none';
        if (btnGroup) { btnGroup.classList.toggle('active', view === 'group'); }
        if (btnTable) { btnTable.classList.toggle('active', view === 'table'); }
        if (btnCal) { btnCal.classList.toggle('active', view === 'calendar'); }
    }

    // ===== 时间筛选器绑定 =====
    function bindPerfBarV2() {
        var tabs = document.getElementById('perfTimeTabs');
        if (tabs) {
            tabs.addEventListener('click', function(e) {
                var tab = e.target.closest('.pbt-tab');
                if (!tab) return;
                var allTabs = tabs.querySelectorAll('.pbt-tab');
                allTabs.forEach(function(t) { t.classList.remove('active'); });
                tab.classList.add('active');
                currentTimeTab = tab.getAttribute('data-tab') || 'today';
                updatePerfList(getActivePerformances());
            });
        }

        var btnGroup = document.getElementById('pbtViewGroup');
        var btnTable = document.getElementById('pbtViewTable');
        var btnCal = document.getElementById('pbtViewCal');
        if (btnGroup) btnGroup.addEventListener('click', function() { switchView('group'); });
        if (btnTable) btnTable.addEventListener('click', function() { switchView('table'); });
        if (btnCal) btnCal.addEventListener('click', function() { switchView('calendar'); });
    }

    // ========== 旧版底部演出列表（保留兼容，但不再使用） ==========
    function updatePerfListOld(active) {
        var list = document.getElementById('perfList');
        if (!list) return;
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var tomorrow = new Date(today.getTime() + 86400000);
        var weekEnd = new Date(today.getTime() + 7 * 86400000);
        var monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        var groups = groupPerformancesByVenue(active);

        var dateGroups = [
            { key: 'today', label: '📌 今天', filter: function(p) { var s = new Date(p.startDate + 'T00:00:00'); return s <= today && today <= new Date(p.endDate + 'T23:59:59'); }, collapsed: false },
            { key: 'tomorrow', label: '📅 明天', filter: function(p) { var s = new Date(p.startDate + 'T00:00:00'); return s.getTime() === tomorrow.getTime(); }, collapsed: false },
            { key: 'week', label: '📆 本周', filter: function(p) { var s = new Date(p.startDate + 'T00:00:00'); return s > tomorrow && s <= weekEnd; }, collapsed: true },
            { key: 'month', label: '🗓️ 本月', filter: function(p) { var s = new Date(p.startDate + 'T00:00:00'); return s > weekEnd && s <= monthEnd; }, collapsed: true },
            { key: 'later', label: '📋 更晚', filter: function(p) { var s = new Date(p.startDate + 'T00:00:00'); return s > monthEnd || isNaN(s.getTime()); }, collapsed: true }
        ];

        var html = '';

        dateGroups.forEach(function(dg) {
            var groupItems = [];
            groups.forEach(function(g) {
                var hasMatch = g.performances.some(function(p) { return dg.filter(p); });
                if (hasMatch) {
                    var matched = g.performances.filter(function(p) { return dg.filter(p); });
                    groupItems.push({ group: g, matched: matched });
                }
            });

            if (groupItems.length === 0) return;

            html += '<div class="perf-group-header' + (dg.collapsed ? ' collapsed' : '') + '" data-group="' + dg.key + '" onclick="var h=this;var b=this.nextElementSibling;h.classList.toggle(\'collapsed\');b.classList.toggle(\'collapsed\')">' +
                '<span class="group-arrow">▼</span> ' + dg.label +
                ' <span class="group-count">(' + groupItems.length + ')</span>' +
                '</div>';

            html += '<div class="perf-group-body' + (dg.collapsed ? ' collapsed' : '') + '">';

            groupItems.forEach(function(item) {
                var g = item.group;
                var matched = item.matched;
                var bestColor = g.bestStatus === 'live' ? '#E53935' : g.bestStatus === 'upcoming' ? '#00ACC1' : '#8D6E63';

                if (g.performances.length === 1) {
                    var p = g.performances[0];
                    var perfData = JSON.stringify({
                        name: p.name, city: p.city, startDate: p.startDate, endDate: p.endDate,
                        genre: p.genre, actors: p.actors || '', venue: p.venue || '', lng: g.lng, lat: g.lat
                    }).replace(/'/g, "\\'");
                    html += '<div class="perf-card" onclick="window._openPerfDetail(\'' + perfData + '\')" style="cursor:pointer">' +
                        '<span style="color:' + bestColor + ';margin-right:4px;">●</span>' +
                        '<span class="pc-name">' + escapeHtml(p.name) + '</span>' +
                        '<div class="pc-info">' + escapeHtml(p.city) + ' · ' + p.startDate + '</div>' +
                        '</div>';
                } else {
                    html += '<div class="perf-card perf-group" style="cursor:default">' +
                        '<span style="color:' + bestColor + ';margin-right:4px;">●</span>' +
                        '<span class="pc-name">' + escapeHtml(g.address) + '</span>' +
                        '<span class="pc-count">' + g.performances.length + '场演出</span>' +
                        '<div class="pc-info">' + escapeHtml(g.city) + '</div>';

                    g.performances.sort(function(a, b) { return a.startDate.localeCompare(b.startDate); })
                        .forEach(function(p) {
                            var pColor = p._status === 'live' ? '#E53935' : p._status === 'upcoming' ? '#00ACC1' : '#8D6E63';
                            var subData = JSON.stringify({
                                name: p.name, city: p.city, startDate: p.startDate, endDate: p.endDate,
                                genre: p.genre, actors: p.actors || '', venue: p.venue || '', lng: g.lng, lat: g.lat
                            }).replace(/'/g, "\\'");
                            html += '<div class="pc-sub-item" onclick="event.stopPropagation();window._openPerfDetail(\'' + subData + '\')" style="cursor:pointer">' +
                                '<span style="color:' + pColor + ';font-size:10px;">●</span> ' +
                                escapeHtml(p.name) + ' <span class="pc-sub-date">' + p.startDate + '~' + p.endDate + '</span>' +
                                '</div>';
                        });
                    html += '</div>';
                }
            });

            html += '</div>';
        });

        list.innerHTML = html;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 飞到指定坐标
    window._flyTo = function(lng, lat) {
        if (chart) {
            chart.setOption({ geo: { center: [lng, lat], zoom: 2.5 } });
            setTimeout(function() { chart.setOption({ geo: { center: [104.5, 35.5], zoom: 1.15 } }); }, 2000);
        }
    };

    // 打开演出详情浮层
    window._openPerfDetail = function(jsonStr) {
        var data;
        try { data = JSON.parse(jsonStr.replace(/&quot;/g, '"')); } catch(e) { return; }

        var overlay = document.getElementById('perfDetailOverlay');
        if (!overlay) return;

        document.getElementById('pdName').textContent = data.name || '未知演出';

        var statusText = '';
        var statusColor = '#8D6E63';
        var today = new Date();
        var start = new Date(data.startDate + 'T00:00:00');
        var end = new Date(data.endDate + 'T23:59:59');
        if (start <= today && today <= end) { statusText = '演出中'; statusColor = '#E53935'; }
        else if (today < start) { statusText = '即将演出'; statusColor = '#00ACC1'; }
        else { statusText = '已结束'; statusColor = '#8D6E63'; }

        var bodyHtml = '';
        // 剧种
        if (data.genre) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' +
                '<span class="pd-genre-tag">' + escapeHtml(data.genre) + '</span>' +
                '</div>';
        }
        // 状态
        bodyHtml += '<div class="pd-info-row">' +
            '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '<span class="pd-info-label">状态</span>' +
            '<span class="pd-info-value" style="color:' + statusColor + ';">' + statusText + '</span>' +
            '</div>';
        // 日期
        bodyHtml += '<div class="pd-info-row">' +
            '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
            '<span class="pd-info-label">日期</span>' +
            '<span class="pd-info-value">' + (data.startDate || '') + ' ~ ' + (data.endDate || '') + '</span>' +
            '</div>';
        // 场馆
        if (data.venue) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '<span class="pd-info-label">场馆</span>' +
                '<span class="pd-info-value">' + escapeHtml(data.venue) + '</span>' +
                '</div>';
        }
        // 城市
        if (data.city) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' +
                '<span class="pd-info-label">城市</span>' +
                '<span class="pd-info-value">' + escapeHtml(data.city) + '</span>' +
                '</div>';
        }
        // 演员
        if (data.actors) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
                '<span class="pd-info-label">演员</span>' +
                '<span class="pd-info-value">' + escapeHtml(data.actors) + '</span>' +
                '</div>';
        }
        // 时长
        if (data.duration) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
                '<span class="pd-info-label">时长</span>' +
                '<span class="pd-info-value">' + escapeHtml(data.duration) + '</span>' +
                '</div>';
        }
        // 票价
        if (data.price) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
                '<span class="pd-info-label">票价</span>' +
                '<span class="pd-info-value">' + escapeHtml(data.price) + '</span>' +
                '</div>';
        }
        // 交通
        if (data.transport) {
            bodyHtml += '<div class="pd-info-row">' +
                '<svg class="pd-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
                '<span class="pd-info-label">交通</span>' +
                '<span class="pd-info-value">' + escapeHtml(data.transport) + '</span>' +
                '</div>';
        }
        bodyHtml += '<hr class="pd-divider">';
        // 演出简介
        bodyHtml += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.7;">' +
            escapeHtml(data.name) + '，将于 ' + (data.startDate || '') + ' 至 ' + (data.endDate || '') + ' 在' +
            escapeHtml(data.city || '') + (data.venue ? escapeHtml(data.venue) : '') + '上演。' +
            '</div>';

        document.getElementById('pdBody').innerHTML = bodyHtml;

        // 按钮事件
        var locateBtn = document.getElementById('pdBtnLocate');
        locateBtn.onclick = function() {
            window._closePerfDetail();
            if (data.lng && data.lat) window._flyTo(data.lng, data.lat);
        };

        var searchBtn = document.getElementById('pdBtnSearch');
        searchBtn.onclick = function() {
            var query = encodeURIComponent(data.name + (data.genre ? ' ' + data.genre : '') + ' 演出');
            window.open('https://www.baidu.com/s?wd=' + query, '_blank');
        };

        overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
    };

    // 绑定浮层关闭按钮事件
    (function bindPerfDetailButtons() {
        var closeBtn = document.getElementById('pdCloseBtn');
        var closeBtn2 = document.getElementById('pdBtnClose');
        var overlay = document.getElementById('perfDetailOverlay');
        if (closeBtn) closeBtn.addEventListener('click', window._closePerfDetail);
        if (closeBtn2) closeBtn2.addEventListener('click', window._closePerfDetail);
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) window._closePerfDetail();
            });
        }
    })();

    // ========== 悬浮提示 ==========
    function showTooltip(perfs, venueName, event) {
        var stMap = {
            live: ['演出中','live','#E53935'],
            upcoming: ['即将演出','upcoming','#00ACC1'],
            ended: ['已结束','ended','#8D6E63']
        };

        // 按日期排序
        var sorted = perfs.slice().sort(function(a, b) {
            return a.startDate.localeCompare(b.startDate);
        });

        // 计算整体状态
        var bestStatus = 'ended';
        var hasLive = false, hasUpcoming = false;
        sorted.forEach(function(p) {
            if (p._status === 'live') hasLive = true;
            else if (p._status === 'upcoming') hasUpcoming = true;
        });
        if (hasLive) bestStatus = 'live';
        else if (hasUpcoming) bestStatus = 'upcoming';

        var st = stMap[bestStatus];
        var countBadge = sorted.length > 1 ? '<span class="tt-count-badge">共 ' + sorted.length + ' 场</span>' : '';
        var cityName = sorted[0].city || '';
        var genreIcon = getGenreIcon(sorted[0].genre || '');

        var html = '';
        if (isMobile) {
            html += '<button class="tt-close-btn" onclick="document.getElementById(\'tooltip\').classList.remove(\'visible\')">✕</button>';
        }
        // 头部：状态 + 城市 + 数量
        html += '<div style="padding:8px 16px 4px">' +
            '<span class="tt-status ' + st[1] + '" style="background:' + st[2] + '"></span>' +
            '<span style="color:' + st[2] + ';font-size:12px;font-weight:600;">' + st[0] + '</span>' +
            (cityName ? '<span style="color:var(--text-muted);font-size:11px;margin-left:8px;">' + escapeHtml(cityName) + '</span>' : '') +
            countBadge +
            '</div>' +
            '<div class="tt-venue">' + escapeHtml(venueName || sorted[0].address || sorted[0].venue || '') + '</div>';

        html += '<div class="tt-perf-list">';
        sorted.forEach(function(p) {
            var pst = stMap[p._status || 'upcoming'];
            var cd = getCountdown(p);
            var genreClr = getGenreColor(p.genre || '戏曲');
            var perfData = JSON.stringify({
                name: p.name, city: p.city, startDate: p.startDate, endDate: p.endDate,
                genre: p.genre, actors: p.actors || '', venue: p.address || p.venue || '',
                lng: p.lng, lat: p.lat, troupe: p.troupe || '',
                duration: p.duration || '', description: p.description || '',
                price: p.price || '', transport: p.transport || ''
            }).replace(/"/g, '&quot;').replace(/'/g, "\\'");
            html += '<div class="tt-perf-item" onclick="window._openPerfDetail(\'' + perfData + '\')">' +
                '<span class="tt-dot" style="background:' + pst[2] + '"></span>' +
                '<div class="tt-perf-body">' +
                '<span class="tt-perf-name">' + escapeHtml(p.name) + '</span>' +
                '<span class="tt-perf-meta">' +
                '<span style="display:inline-block;background:' + genreClr + ';color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;">' + escapeHtml(p.genre || '戏曲') + '</span>' +
                escapeHtml(p.troupe || '') +
                '</span>' +
                '<span class="tt-perf-date">' + p.startDate + ' ~ ' + p.endDate + '</span>' +
                (cd.text !== '已结束' ? '<span class="tt-countdown ' + cd.cls + '">' + cd.text + '</span>' : '') +
                (p.actors ? '<span class="tt-perf-actors">' + escapeHtml(p.actors) + '</span>' : '') +
                '</div></div>';
        });
        html += '</div>';

        // 如果只有一场且有描述，显示描述
        if (sorted.length === 1 && sorted[0].description) {
            html += '<div class="tt-desc">' + escapeHtml(sorted[0].description) + '</div>';
        }

        html += '<div class="tt-close-hint">点击演出查看详情 · 点击空白关闭</div>';

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');
        if (event) positionTooltip(event.clientX, event.clientY);
    }

    function positionTooltip(x, y) {
        var w = tooltip.offsetWidth || 200;
        var h = tooltip.offsetHeight || 100;
        var left = Math.min(x + 20, window.innerWidth - w - 20);
        var top = Math.max(60, Math.min(y - h / 2, window.innerHeight - h - 20));
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    // ========== 省份剧种展示 ==========
    function showProvinceGenres(provinceName, event) {
        // 标准化省份名（处理"北京"→"北京市"等映射）
        var provinceMap = {
            '北京': '北京市', '天津': '天津市', '上海': '上海市', '重庆': '重庆市',
            '内蒙古': '内蒙古自治区', '广西': '广西壮族自治区', '西藏': '西藏自治区',
            '宁夏': '宁夏回族自治区', '新疆': '新疆维吾尔自治区',
            '香港': '香港特别行政区', '澳门': '澳门特别行政区'
        };
        var normalized = provinceMap[provinceName] || provinceName;

        // 筛选该省份的演出（精确匹配 + 简称全称互查）
        var provincePerfs = allPerformances.filter(function(p) {
            if (!p.province) return false;
            if (p.province === normalized) return true;
            // 处理 ECharts 返回的省份名与数据中名称的差异（如"内蒙古"vs"内蒙古自治区"）
            if (provinceName.length >= 2 && p.province.indexOf(provinceName) === 0) return true;
            if (normalized.length >= 2 && provinceName.indexOf(p.province) === 0) return true;
            return false;
        });

        if (provincePerfs.length === 0) {
            tooltip.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px;">' + escapeHtml(provinceName) + '<br>暂无演出数据</div>';
            tooltip.classList.add('visible');
            if (event) positionTooltip(event.clientX, event.clientY);
            return;
        }

        // 统计该省剧种
        var genreFreq = {};
        provincePerfs.forEach(function(p) {
            if (p.genre) { genreFreq[p.genre] = (genreFreq[p.genre] || 0) + 1; }
        });
        var sortedGenres = Object.keys(genreFreq).sort(function(a, b) { return genreFreq[b] - genreFreq[a]; });

        // 统计状态
        var liveCount = 0, upcomingCount = 0, endedCount = 0;
        provincePerfs.forEach(function(p) {
            if (p._status === 'live') liveCount++;
            else if (p._status === 'upcoming') upcomingCount++;
            else if (p._status === 'ended') endedCount++;
        });

        var html = '';
        html += '<button class="tt-close-btn" onclick="document.getElementById(\'tooltip\').classList.remove(\'visible\')">✕</button>';
        html += '<div style="font-size:16px;font-weight:bold;color:var(--gold);margin-bottom:8px;">📍 ' + escapeHtml(provinceName) + '</div>';
        html += '<div style="display:flex;gap:12px;margin-bottom:10px;font-size:12px;">';
        html += '<span style="color:#E53935;">● 演出中 ' + liveCount + '</span>';
        html += '<span style="color:#00ACC1;">● 即将 ' + upcomingCount + '</span>';
        html += '<span style="color:#8D6E63;">● 已结束 ' + endedCount + '</span>';
        html += '</div>';
        html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">🎭 共 ' + sortedGenres.length + ' 个剧种 · ' + provincePerfs.length + ' 场演出</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        sortedGenres.forEach(function(genre) {
            var clr = getGenreColor(genre);
            html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border:1px solid rgba(201,169,110,0.3);border-radius:14px;font-size:12px;color:var(--text-primary);">' +
                '<span style="width:6px;height:6px;border-radius:50%;background:' + clr + ';"></span>' +
                escapeHtml(genre) +
                '<span style="font-size:10px;color:var(--text-muted);">' + genreFreq[genre] + '</span>' +
                '</span>';
        });
        html += '</div>';

        tooltip.innerHTML = html;
        tooltip.classList.add('visible');
        if (event) positionTooltip(event.clientX, event.clientY);
    }

    // ========== 筛选器 ==========
    var filters = { live: true, upcoming: true, ended: true, manual: false };
    var activeGenres = [];
    var searchKeyword = '';
    var searchTimer = null;

    document.querySelectorAll('.filter-tag input').forEach(function(cb) {
        cb.addEventListener('change', function() {
            cb.parentElement.classList.toggle('active', cb.checked);
            var f = cb.dataset.filter;
            if (f === 'all') {
                filters.live = cb.checked;
                filters.upcoming = cb.checked;
                filters.ended = cb.checked;
                document.querySelectorAll('.panel-card .filter-tag:not(.source-tag) input').forEach(function(c) {
                    c.checked = cb.checked;
                    c.parentElement.classList.toggle('active', cb.checked);
                });
            } else if (f === 'manual') {
                filters.manual = cb.checked;
            } else {
                filters[f] = cb.checked;
            }
            updateMapData();
        });
    });

    // ========== 搜索框 ==========
    var searchInput = document.getElementById('searchInput');
    var searchClear = document.getElementById('searchClear');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                searchKeyword = searchInput.value;
                searchClear.style.display = searchKeyword ? 'block' : 'none';
                updateMapData();
            }, 300);
        });
    }
    if (searchClear) {
        searchClear.addEventListener('click', function() {
            searchInput.value = '';
            searchKeyword = '';
            searchClear.style.display = 'none';
            updateMapData();
            searchInput.focus();
        });
    }

    // ========== 剧种标签构建 ==========
    function buildGenreTags() {
        var container = document.getElementById('genreTags');
        if (!container) return;
        var countEl = document.getElementById('genreCount');

        // 兜底：数据未加载或为空
        if (!allPerformances || allPerformances.length === 0) {
            if (countEl) countEl.textContent = '(0)';
            container.innerHTML = '<span style="color:#999;font-size:11px;padding:8px;">暂无数据</span>';
            return;
        }

        // 统计剧种频次
        var genreFreq = {};
        for (var i = 0; i < allPerformances.length; i++) {
            var p = allPerformances[i];
            var g = p && p.genre;
            if (g) {
                genreFreq[g] = (genreFreq[g] || 0) + 1;
            }
        }

        // 按频次降序排列
        var sortedKeys = [];
        for (var k in genreFreq) {
            if (Object.prototype.hasOwnProperty.call(genreFreq, k)) sortedKeys.push(k);
        }
        sortedKeys.sort(function(a, b) { return genreFreq[b] - genreFreq[a]; });

        if (countEl) countEl.textContent = '(' + sortedKeys.length + ')';

        // 用 innerHTML 一次性生成所有标签，避免循环 appendChild 可能的兼容性问题
        var html = '';
        for (var j = 0; j < sortedKeys.length; j++) {
            var genre = sortedKeys[j];
            var cnt = genreFreq[genre];
            var clr = getGenreColor(genre);
            html += '<span class="genre-tag" data-genre="' + genre + '" style="cursor:pointer;">';
            html += '<span class="genre-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + clr + ';margin-right:4px;"></span>';
            html += escapeHtml(genre);
            html += '<span class="genre-count">' + cnt + '</span>';
            html += '</span>';
        }
        container.innerHTML = html;

        // 事件委托：用一个监听器处理所有标签点击
        container.onclick = function(e) {
            var tag = e.target.closest('.genre-tag');
            if (!tag) return;
            var genre = tag.getAttribute('data-genre');
            if (!genre) return;
            var idx = activeGenres.indexOf(genre);
            if (idx === -1) {
                activeGenres.push(genre);
                tag.classList.add('active');
            } else {
                activeGenres.splice(idx, 1);
                tag.classList.remove('active');
            }
            updateMapData();
        };
    }

    // ========== 更新统计数据（不含地图） ==========
    function updateStats() {
        var active = getActivePerformances();
        var liveCount = 0, upcomingCount = 0, endedCount = 0;
        active.forEach(function(p) {
            if (p._status === 'live') liveCount++;
            else if (p._status === 'upcoming') upcomingCount++;
            else if (p._status === 'ended') endedCount++;
        });
        document.getElementById('sLive').textContent = liveCount;
        document.getElementById('sUpcoming').textContent = upcomingCount;
        document.getElementById('sEnded').textContent = endedCount;
        document.getElementById('sTotal').textContent = active.length;
    }

    // ========== 移动端面板切换 ==========
    var mobilePanelBtn = document.getElementById('mobilePanelBtn');
    var sidePanel = document.getElementById('sidePanel');
    var panelOverlay = document.getElementById('panelOverlay');

    function togglePanel() {
        var isOpen = sidePanel.classList.contains('open');
        if (isOpen) {
            sidePanel.classList.remove('open');
            if (panelOverlay) panelOverlay.classList.remove('show');
        } else {
            sidePanel.classList.add('open');
            if (panelOverlay) panelOverlay.classList.add('show');
        }
    }

    function closePanel() {
        sidePanel.classList.remove('open');
        if (panelOverlay) panelOverlay.classList.remove('show');
    }

    if (mobilePanelBtn) {
        mobilePanelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePanel();
        });
    }

    var panelCloseBtn = document.getElementById('panelCloseBtn');
    if (panelCloseBtn) {
        panelCloseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closePanel();
        });
    }

    if (panelOverlay) {
        panelOverlay.addEventListener('click', closePanel);
    }

    // ========== 主初始化 ==========
    async function main() {
        console.log('[系统] 开始初始化');
        var initStartTime = performance.now();

        try {
            var [geoOk] = await Promise.all([loadGeoJson(), loadPerformances()]);

            if (geoOk) {
                try {
                    initChart();
                    updateMapData();
                } catch(e) {
                    console.error('[地图] 初始化失败:', e.message);
                    document.getElementById('error').style.display = 'flex';
                    document.getElementById('errorMsg').textContent = '地图渲染失败: ' + e.message;
                    updateStats();
                    updatePerfList(getActivePerformances());
                    buildGenreTags();
                }
            } else {
                // 渐进式降级：地图不可用但演出数据正常展示
                document.getElementById('error').style.display = 'flex';
                document.getElementById('errorMsg').textContent = '地图数据加载失败，请刷新页面重试。演出数据已正常加载。';
                updateStats();
                updatePerfList(getActivePerformances());
                buildGenreTags();
            }
        } catch(e) {
            console.error('[系统] 启动失败:', e.message, e.stack);
            document.getElementById('error').style.display = 'flex';
            document.getElementById('errorMsg').textContent = '系统初始化失败: ' + e.message;
        }

        document.getElementById('loading').style.display = 'none';
        var totalElapsed = Math.round(performance.now() - initStartTime);
        console.log('[系统] 启动完成, 耗时:', totalElapsed + 'ms, 地图:', geoOk, '演出数:', allPerformances.length);
    }

    main();
    // 绑定 V2 底部演出栏事件
    bindPerfBarV2();

    // ========== 日志面板 ==========
    (function initLogPanel() {
        var logBtn = document.getElementById('logBtn');
        var logPanel = document.getElementById('logPanel');
        var logOverlay = document.getElementById('logOverlay');
        var logList = document.getElementById('logList');
        var logStats = document.getElementById('logStats');
        var logExport = document.getElementById('logExport');
        var logClear = document.getElementById('logClear');
        var logClose = document.getElementById('logClose');

        if (!logBtn || !logPanel) return;

        function openLogPanel() {
            logPanel.classList.add('open');
            if (logOverlay) logOverlay.classList.add('show');
            refreshLogPanel();
        }

        function closeLogPanel() {
            logPanel.classList.remove('open');
            if (logOverlay) logOverlay.classList.remove('show');
        }

        function refreshLogPanel() {
            if (!logList || !logStats) return;
            var logs = window.OperaLog ? window.OperaLog.getAll() : [];
            var stats = window.OperaLog ? window.OperaLog.getLogStats() : { total: 0, errors: 0, warnings: 0, infos: 0 };

            logStats.innerHTML = '共 <b>' + stats.total + '</b> 条 | ' +
                '<span style="color:#E8383B">错误 ' + stats.errors + '</span> | ' +
                '<span style="color:#D4A00A">警告 ' + stats.warnings + '</span> | ' +
                '<span style="color:#4CAF50">信息 ' + stats.infos + '</span>';

            var html = '';
            var colors = { error: '#E8383B', warn: '#D4A00A', info: '#888' };
            var icons = { error: '❌', warn: '⚠️', info: 'ℹ️' };

            for (var i = logs.length - 1; i >= 0; i--) {
                var log = logs[i];
                var color = colors[log.level] || '#888';
                var icon = icons[log.level] || '📝';
                var time = new Date(log.timestamp).toLocaleTimeString('zh-CN');
                html += '<div class="log-entry" style="border-left: 3px solid ' + color + '">' +
                    '<span class="log-time">' + time + '</span>' +
                    '<span class="log-level" style="color:' + color + '">' + icon + ' ' + (log.category || '') + '</span>' +
                    '<span class="log-msg">' + escapeHtml(log.message || '') + '</span>' +
                    '</div>';
            }

            if (logs.length === 0) {
                html = '<div class="log-empty">暂无日志记录</div>';
            }

            logList.innerHTML = html;
        }

        logBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (logPanel.classList.contains('open')) {
                closeLogPanel();
            } else {
                openLogPanel();
            }
        });

        if (logClose) logClose.addEventListener('click', closeLogPanel);
        if (logOverlay) logOverlay.addEventListener('click', closeLogPanel);

        if (logClear) {
            logClear.addEventListener('click', function() {
                if (window.OperaLog) window.OperaLog.clearLogs();
                refreshLogPanel();
            });
        }

        if (logExport) {
            logExport.addEventListener('click', function() {
                if (window.OperaLog) {
                    var text = window.OperaLog.exportLogsAsText();
                    var blob = new Blob([text], { type: 'text/plain' });
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'opera-map-logs-' + new Date().toISOString().slice(0,10) + '.txt';
                    a.click();
                }
            });
        }
    })();
})();
