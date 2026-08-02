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

    // ========== 加载 GeoJSON ==========
    async function loadGeoJson() {
        // 多源回退：本地优先，再尝试多个在线CDN
        var sources = [
            { url: 'data/china.json', name: '本地' },
            { url: 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json', name: '阿里DataV' },
            { url: 'https://geojson.cn/api/data/china-geojson/china.json', name: 'GeoJSON.cn' }
        ];

        for (var i = 0; i < sources.length; i++) {
            var src = sources[i];
            try {
                var resp = await fetch(src.url);
                if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
                var text = await resp.text();
                geoJson = JSON.parse(text);
                console.log('[地图] ' + src.name + ' 加载成功 (' + geoJson.features.length + '个区域)');
                return true;
            } catch(e) {
                console.warn('[地图] ' + src.name + ' 源失败 (' + src.url + '):', e.message);
            }
        }

        console.error('[地图] 所有源均加载失败，地图不可用');
        return false;
    }

    // ========== 加载演出数据 ==========
    async function loadPerformances() {
        try {
            var resp = await fetch('data/performances.json');
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            allPerformances = await resp.json();
            console.log('[数据] 加载 ' + allPerformances.length + ' 条演出');
        } catch(e) {
            console.warn('[数据] 加载失败:', e);
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

        var option = {
            backgroundColor: 'transparent',
            geo: {
                map: 'china',
                roam: true,
                zoom: 1.15,
                center: [104.5, 35.5],
                aspectScale: 0.85,
                label: {
                    show: true,
                    color: 'rgba(201,169,110,0.5)',
                    fontSize: 10,
                    fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif',
                    textBorderColor: 'rgba(10,14,23,0.8)',
                    textBorderWidth: 2
                },
                itemStyle: {
                    areaColor: '#16213e',
                    borderColor: 'rgba(201,169,110,0.25)',
                    borderWidth: 1,
                    shadowColor: 'rgba(0,0,0,0.3)',
                    shadowBlur: 8
                },
                emphasis: {
                    label: {
                        color: '#fff',
                        fontSize: 12,
                        fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif'
                    },
                    itemStyle: {
                        areaColor: '#1a3a5c',
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

        // 事件
        chart.on('mouseover', 'series', function(params) {
            if (params.data && params.data._perf) {
                showTooltip(params.data._perf, params.event.event);
            }
        });
        chart.on('mouseout', 'series', function() {
            tooltip.classList.remove('visible');
        });

        window.addEventListener('resize', function() { chart.resize(); });

        document.addEventListener('mousemove', function(e) {
            if (tooltip.classList.contains('visible')) {
                positionTooltip(e.clientX, e.clientY);
            }
        });

        console.log('[地图] 初始化完成');
    }

    // ========== 更新地图数据 ==========
    function updateMapData() {
        if (!chart) return;
        var active = getActivePerformances();
        var liveData = [], upcomingData = [], endedData = [];

        active.forEach(function(p) {
            var pt = { name: p.name, value: [p.lng, p.lat], _perf: p };
            if (p._status === 'live') liveData.push(pt);
            else if (p._status === 'upcoming') upcomingData.push(pt);
            else if (p._status === 'ended') endedData.push(pt);
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
        var sorted = active.sort(function(a, b) {
            var order = { live: 0, upcoming: 1, ended: 2 };
            return order[a._status] - order[b._status];
        }).slice(0, 20);

        list.innerHTML = sorted.map(function(p) {
            var color = p._status === 'live' ? '#ff4444' : p._status === 'upcoming' ? '#f5c518' : '#666';
            return '<div class="perf-card" onclick="window._flyTo(' + p.lng + ',' + p.lat + ')" style="cursor:pointer">' +
                '<span style="color:' + color + ';margin-right:4px;">●</span>' +
                '<span class="pc-name">' + escapeHtml(p.name) + '</span>' +
                '<div class="pc-info">' + escapeHtml(p.city) + ' · ' + p.startDate + '</div>' +
                '</div>';
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
    function showTooltip(perf, event) {
        var stMap = {
            live: ['正在演出','live','#ff4444'],
            upcoming: ['即将演出','upcoming','#f5c518'],
            ended: ['已结束','ended','#666']
        };
        var st = stMap[perf._status || 'upcoming'];
        tooltip.innerHTML =
            '<span class="tt-status ' + st[1] + '" style="background:' + st[2] + '"></span>' +
            '<span style="color:' + st[2] + ';font-size:11px;">' + st[0] + '</span>' +
            '<span class="tt-name">' + escapeHtml(perf.name) + '</span>' +
            '<span class="tt-genre">' + escapeHtml(perf.genre || '戏曲') + '</span>' +
            '<div class="tt-row">📍 ' + escapeHtml(perf.province) + ' ' + escapeHtml(perf.city) + ' · ' + escapeHtml(perf.address) + '</div>' +
            '<div class="tt-row">📅 ' + perf.startDate + ' ~ ' + perf.endDate + '</div>' +
            '<div class="tt-row">🎭 ' + escapeHtml(perf.troupe || '未知剧团') + '</div>' +
            (perf.description ? '<div class="tt-desc">' + escapeHtml(perf.description) + '</div>' : '');
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

    // ========== 主初始化 ==========
    async function main() {
        // 并行加载 GeoJSON 和演出数据，不相互阻塞
        var geoOk = await loadGeoJson();
        await loadPerformances();

        if (geoOk) {
            initChart();
            updateMapData();
        } else {
            // 渐进式降级：地图不可用但演出数据正常展示
            document.getElementById('error').style.display = 'flex';
            document.getElementById('errorMsg').textContent = '地图数据加载失败，请刷新页面重试。演出数据已正常加载。';
            updateStats();
            updatePerfList(getActivePerformances());
        }

        document.getElementById('loading').style.display = 'none';
        console.log('[系统] 中国戏曲演出地图启动完成 (地图:' + (geoOk ? '可用' : '降级') + ', 演出:' + allPerformances.length + '条)');
    }

    main();
})();
