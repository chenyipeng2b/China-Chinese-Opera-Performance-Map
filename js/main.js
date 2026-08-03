/**
 * 中国戏曲演出地图 - 主逻辑
 * ECharts 地图渲染 + 三色亮点 + 数据加载
 */
(function() {
    'use strict';

    var chart = null;
    var geoJson = null;
    var allPerformances = [];
    var filters = { live: true, upcoming: true, ended: true };
    var tooltip = document.getElementById('tooltip');
    var mapSection = document.getElementById('mapSection');
    var zoomHint = document.getElementById('zoomHint');
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

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
                var startTime = performance.now();
                var resp = await fetch(src.url);
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
                var text = await resp.text();
                geoJson = JSON.parse(text);
                var elapsed = Math.round(performance.now() - startTime);
                OperaLog.info('地图', 'GeoJSON 从 ' + src.name + ' 加载成功', {
                    source: src.url,
                    regions: geoJson.features.length,
                    dataSize: text.length,
                    loadTimeMs: elapsed
                });
                return true;
            } catch(e) {
                failures.push({ name: src.name, url: src.url, error: e.message });
                OperaLog.warn('地图', 'GeoJSON 源 ' + src.name + ' 加载失败', {
                    url: src.url,
                    errorMessage: e.message,
                    attemptIndex: i + 1,
                    totalAttempts: sources.length
                });
            }
        }

        OperaLog.error('地图', '所有 GeoJSON 源均加载失败', {
            totalSources: sources.length,
            allFailures: failures
        });
        return false;
    }

    // ========== 加载演出数据 ==========
    async function loadPerformances() {
        try {
            var startTime = performance.now();
            var resp = await fetch('data/performances.json');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            allPerformances = await resp.json();
            var elapsed = Math.round(performance.now() - startTime);
            OperaLog.info('数据', '演出数据加载成功', {
                count: allPerformances.length,
                loadTimeMs: elapsed,
                genres: allPerformances.map(function(p) { return p.genre; }).filter(function(v, i, a) { return a.indexOf(v) === i; })
            });
        } catch(e) {
            OperaLog.error('数据', '演出数据加载失败', {
                errorMessage: e.message,
                url: 'data/performances.json'
            });
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

    // ========== 获取活跃演出 ==========
    function getActivePerformances() {
        return allPerformances
            .filter(function(p) {
                var s = getStatus(p);
                if (!s) return false;
                return filters[s] !== false;
            })
            .map(function(p) {
                p._status = getStatus(p);
                return p;
            });
    }

    // ========== 初始化地图 ==========
    function initChart() {
        var dom = document.getElementById('mapChart');
        chart = echarts.init(dom, null, { renderer: 'svg' });
        echarts.registerMap('china', geoJson);

        // 地图区域色改为仿古宣纸暖色调
        var paperAreaColor = '#1e1a14';

        var option = {
            backgroundColor: 'transparent',
            geo: {
                map: 'china',
                roam: !isMobile,  // 桌面端默认开启 roam，移动端默认关闭（使用手势）
                zoom: 1.15,
                center: [104.5, 35.5],
                aspectScale: 0.85,
                scaleLimit: { min: 0.8, max: 8 },
                label: {
                    show: true,
                    color: 'rgba(201,169,110,0.45)',
                    fontSize: 10,
                    fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif',
                    textBorderColor: 'rgba(10,14,23,0.8)',
                    textBorderWidth: 2
                },
                itemStyle: {
                    areaColor: paperAreaColor,
                    borderColor: 'rgba(201,169,110,0.3)',
                    borderWidth: 1,
                    shadowColor: 'rgba(0,0,0,0.4)',
                    shadowBlur: 10
                },
                emphasis: {
                    label: {
                        color: '#fff',
                        fontSize: 12,
                        fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif'
                    },
                    itemStyle: {
                        areaColor: '#2a2218',
                        borderColor: '#c9a96e',
                        borderWidth: 2
                    }
                }
            },
            series: [
                {
                    name: '正在演出',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: 14,
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 3, period: 4, color: '#ff4444' },
                    itemStyle: { color: '#ff4444', shadowBlur: 15, shadowColor: 'rgba(255,68,68,0.6)' },
                    zlevel: 1
                },
                {
                    name: '即将演出',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: 12,
                    showEffectOn: 'render',
                    rippleEffect: { brushType: 'stroke', scale: 2.5, period: 6, color: '#f5c518' },
                    itemStyle: { color: '#f5c518', shadowBlur: 10, shadowColor: 'rgba(245,197,24,0.4)' },
                    zlevel: 1
                },
                {
                    name: '已结束',
                    type: 'scatter',
                    coordinateSystem: 'geo',
                    data: [],
                    symbolSize: 10,
                    itemStyle: { color: '#666', shadowBlur: 5, shadowColor: 'rgba(102,102,102,0.3)', opacity: 0.7 },
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

        // 事件
        chart.on('mouseover', 'series', function(params) {
            if (params.data && params.data._perfs) {
                showTooltip(params.data._perfs, params.data._address, params.event.event);
            } else if (params.data && params.data._perf) {
                // 向后兼容单个演出数据
                showTooltip([params.data._perf], params.data._perf.address, params.event.event);
            }
        });
        chart.on('mouseout', 'series', function() {
            if (!isMobile) {
                tooltip.classList.remove('visible');
            }
        });

        window.addEventListener('resize', function() {
            chart.resize();
            isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        });

        document.addEventListener('mousemove', function(e) {
            if (tooltip.classList.contains('visible') && !isMobile) {
                positionTooltip(e.clientX, e.clientY);
            }
        });

        OperaLog.info('地图', 'ECharts 初始化完成', {
            renderer: 'svg',
            regions: geoJson ? geoJson.features.length : 0
        });
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
        Object.values(groups).forEach(function(g) {
            var statuses = g.performances.map(function(p) { return p._status; });
            if (statuses.indexOf('live') !== -1) g.bestStatus = 'live';
            else if (statuses.indexOf('upcoming') !== -1) g.bestStatus = 'upcoming';
            else g.bestStatus = 'ended';
        });
        return Object.values(groups);
    }

    // ========== 更新地图数据 ==========
    function updateMapData() {
        if (!chart) return;
        var active = getActivePerformances();
        var groups = groupPerformancesByVenue(active);
        var liveData = [], upcomingData = [], endedData = [];

        groups.forEach(function(g) {
            var pt = {
                name: g.performances.length > 1 ? (g.address + ' (' + g.performances.length + '场)') : g.address,
                value: [g.lng, g.lat],
                _perfs: g.performances,
                _count: g.performances.length,
                _address: g.address,
                _city: g.city,
                _province: g.province,
                symbolSize: g.performances.length > 1 ? 18 : undefined
            };
            if (g.bestStatus === 'live') liveData.push(pt);
            else if (g.bestStatus === 'upcoming') upcomingData.push(pt);
            else endedData.push(pt);
        });

        chart.setOption({
            series: [
                { data: liveData },
                { data: upcomingData },
                { data: endedData }
            ]
        });

        document.getElementById('sLive').textContent = liveData.length;
        document.getElementById('sUpcoming').textContent = upcomingData.length;
        document.getElementById('sEnded').textContent = endedData.length;
        document.getElementById('sTotal').textContent = active.length;

        updatePerfList(active);
    }

    // ========== 底部演出列表 ==========
    function updatePerfList(active) {
        var list = document.getElementById('perfList');

        // 按坐标分组
        var groups = groupPerformancesByVenue(active);

        // 按状态排序组
        var orderMap = { live: 0, upcoming: 1, ended: 2 };
        groups.sort(function(a, b) {
            return orderMap[a.bestStatus] - orderMap[b.bestStatus];
        });

        list.innerHTML = groups.map(function(g) {
            var bestColor = g.bestStatus === 'live' ? '#ff4444' : g.bestStatus === 'upcoming' ? '#f5c518' : '#666';
            var perfsHtml = '';

            if (g.performances.length === 1) {
                // 单场演出：简单卡片
                var p = g.performances[0];
                perfsHtml = '<div class="perf-card" onclick="window._flyTo(' + g.lng + ',' + g.lat + ')" style="cursor:pointer">' +
                    '<span style="color:' + bestColor + ';margin-right:4px;">●</span>' +
                    '<span class="pc-name">' + escapeHtml(p.name) + '</span>' +
                    '<div class="pc-info">' + escapeHtml(p.city) + ' · ' + p.startDate + '</div>' +
                    '</div>';
            } else {
                // 多场演出：分组卡片，可展开
                var venueLabel = escapeHtml(g.address) + ' · ' + escapeHtml(g.city);
                perfsHtml = '<div class="perf-card perf-group" onclick="window._flyTo(' + g.lng + ',' + g.lat + ')" style="cursor:pointer">' +
                    '<span style="color:' + bestColor + ';margin-right:4px;">●</span>' +
                    '<span class="pc-name">' + escapeHtml(g.address) + '</span>' +
                    '<span class="pc-count">' + g.performances.length + '场演出</span>' +
                    '<div class="pc-info">' + escapeHtml(g.city) + '</div>';

                g.performances.sort(function(a, b) {
                    return a.startDate.localeCompare(b.startDate);
                }).forEach(function(p) {
                    var pColor = p._status === 'live' ? '#ff4444' : p._status === 'upcoming' ? '#f5c518' : '#666';
                    perfsHtml += '<div class="pc-sub-item">' +
                        '<span style="color:' + pColor + ';font-size:10px;">●</span> ' +
                        escapeHtml(p.name) + ' <span class="pc-sub-date">' + p.startDate + '~' + p.endDate + '</span>' +
                        '</div>';
                });

                perfsHtml += '</div>';
            }
            return perfsHtml;
        }).join('');
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

    // ========== 悬浮提示 ==========
    function showTooltip(perfs, venueName, event) {
        var stMap = {
            live: ['正在演出','live','#ff4444'],
            upcoming: ['即将演出','upcoming','#f5c518'],
            ended: ['已结束','ended','#666']
        };

        // 按日期排序：先开始的在前
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
        var countBadge = sorted.length > 1 ? '<span class="tt-count-badge">共 ' + sorted.length + ' 场演出</span>' : '';

        // 构建 HTML
        var html = '';
        // 移动端添加关闭按钮
        if (isMobile) {
            html += '<button class="tt-close-btn" onclick="document.getElementById(\'tooltip\').classList.remove(\'visible\')">✕</button>';
        }
        html += '<span class="tt-status ' + st[1] + '" style="background:' + st[2] + '"></span>' +
            '<span style="color:' + st[2] + ';font-size:11px;">' + st[0] + '</span>' + countBadge +
            '<div class="tt-venue">📍 ' + escapeHtml(venueName || sorted[0].address) + '</div>';

        // 逐条列出每场演出
        html += '<div class="tt-perf-list">';
        sorted.forEach(function(p) {
            var pst = stMap[p._status || 'upcoming'];
            html += '<div class="tt-perf-item">' +
                '<span class="tt-dot" style="background:' + pst[2] + '"></span>' +
                '<div class="tt-perf-body">' +
                '<span class="tt-perf-name">' + escapeHtml(p.name) + '</span>' +
                '<span class="tt-perf-meta">' + escapeHtml(p.genre || '戏曲') + ' · ' + escapeHtml(p.troupe || '未知剧团') + '</span>' +
                '<span class="tt-perf-date">📅 ' + p.startDate + ' ~ ' + p.endDate + '</span>' +
                (p.actors ? '<span class="tt-perf-actors">👤 ' + escapeHtml(p.actors) + '</span>' : '') +
                '</div></div>';
        });
        html += '</div>';

        // 如果只有一场且有描述，显示描述
        if (sorted.length === 1 && sorted[0].description) {
            html += '<div class="tt-desc">' + escapeHtml(sorted[0].description) + '</div>';
        }

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

    // ========== 筛选器 ==========
    document.querySelectorAll('.filter-tag input').forEach(function(cb) {
        cb.addEventListener('change', function() {
            cb.parentElement.classList.toggle('active', cb.checked);
            var f = cb.dataset.filter;
            if (f === 'all') {
                filters = { live: cb.checked, upcoming: cb.checked, ended: cb.checked };
                document.querySelectorAll('.filter-tag input').forEach(function(c) {
                    c.checked = cb.checked;
                    c.parentElement.classList.toggle('active', cb.checked);
                });
            } else {
                filters[f] = cb.checked;
            }
            updateMapData();
        });
    });

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

    if (panelOverlay) {
        panelOverlay.addEventListener('click', closePanel);
    }

    // ========== 主初始化 ==========
    async function main() {
        OperaLog.info('系统', '开始初始化');
        var initStartTime = performance.now();

        try {
            var geoOk = await loadGeoJson();
            await loadPerformances();

            if (geoOk) {
                try {
                    initChart();
                    updateMapData();
                } catch(e) {
                    OperaLog.error('地图', '地图初始化失败', {
                        errorMessage: e.message,
                        errorName: e.name,
                        geoOk: geoOk
                    });
                    document.getElementById('error').style.display = 'flex';
                    document.getElementById('errorMsg').textContent = '地图渲染失败: ' + e.message;
                    updateStats();
                    updatePerfList(getActivePerformances());
                }
            } else {
                // 渐进式降级：地图不可用但演出数据正常展示
                document.getElementById('error').style.display = 'flex';
                document.getElementById('errorMsg').textContent = '地图数据加载失败，请刷新页面重试。演出数据已正常加载。';
                updateStats();
                updatePerfList(getActivePerformances());
            }
        } catch(e) {
            OperaLog.error('系统', '启动过程致命错误', {
                errorMessage: e.message,
                errorName: e.name,
                errorStack: e.stack
            });
            document.getElementById('error').style.display = 'flex';
            document.getElementById('errorMsg').textContent = '系统初始化失败: ' + e.message;
        }

        document.getElementById('loading').style.display = 'none';
        var totalElapsed = Math.round(performance.now() - initStartTime);
        OperaLog.info('系统', '启动完成', {
            mapAvailable: geoOk,
            performanceCount: allPerformances.length,
            totalInitTimeMs: totalElapsed
        });
    }

    main();
})();
