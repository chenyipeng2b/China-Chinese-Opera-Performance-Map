/**
 * 地图渲染核心模块
 * 使用 ECharts + 中国地图 GeoJSON 渲染演出地图
 */
const MapRenderer = {
  chart: null,
  geoJson: null,
  tooltip: null,
  
  /**
   * 初始化地图
   */
  async init() {
    // 创建提示卡片
    this.createTooltip();
    
    // 加载 GeoJSON 数据
    await this.loadGeoJson();
    
    // 初始化 ECharts
    this.chart = echarts.init(document.getElementById('mapContainer'));
    
    // 配置地图
    const option = this.buildOption();
    this.chart.setOption(option);
    
    // 绑定事件
    this.bindEvents();
    
    // 响应式处理
    window.addEventListener('resize', () => this.chart.resize());
    
    console.log('[地图] 初始化完成');
  },

  /**
   * 创建悬浮提示卡片
   */
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'info-tooltip';
    this.tooltip.innerHTML = `
      <div class="tooltip-content"></div>
    `;
    document.body.appendChild(this.tooltip);
  },

  /**
   * 加载中国地图 GeoJSON
   */
  async loadGeoJson() {
    try {
      // 先尝试本地文件
      const response = await fetch('data/china.json');
      if (response.ok) {
        this.geoJson = await response.json();
        console.log('[地图] 从本地加载 GeoJSON');
        return;
      }
    } catch (e) {
      console.log('[地图] 本地 GeoJSON 未找到，从 CDN 加载');
    }

    try {
      const response = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json');
      this.geoJson = await response.json();
      console.log('[地图] 从 CDN 加载 GeoJSON');
    } catch (e) {
      console.error('[地图] GeoJSON 加载失败:', e);
    }
  },

  /**
   * 构建 ECharts 配置
   */
  buildOption() {
    const self = this;
    return {
      backgroundColor: 'transparent',
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [104.5, 36],
        aspectScale: 0.85,
        label: {
          show: true,
          color: 'rgba(201, 169, 110, 0.6)',
          fontSize: 10,
          fontFamily: 'PingFang SC, Microsoft YaHei'
        },
        itemStyle: {
          areaColor: '#16213e',
          borderColor: 'rgba(201, 169, 110, 0.3)',
          borderWidth: 1,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowBlur: 10
        },
        emphasis: {
          label: {
            color: '#FFFFFF',
            fontSize: 12
          },
          itemStyle: {
            areaColor: '#1a3a5c',
            borderColor: '#C9A96E',
            borderWidth: 2
          }
        },
        regions: [
          {
            name: '南海诸岛',
            itemStyle: {
              areaColor: '#16213e',
              borderColor: 'rgba(201, 169, 110, 0.3)'
            }
          }
        ]
      },
      series: [
        {
          name: '正在演出',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: [],
          symbolSize: 8,
          showEffectOn: 'render',
          rippleEffect: {
            brushType: 'stroke',
            scale: 2.2,
            period: 5,
            color: '#E53935'
          },
          itemStyle: {
            color: '#E53935',
            shadowBlur: 8,
            shadowColor: 'rgba(229, 57, 53, 0.5)'
          },
          label: {
            show: false
          },
          zlevel: 1
        },
        {
          name: '即将演出',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: [],
          symbolSize: 7,
          showEffectOn: 'render',
          rippleEffect: {
            brushType: 'stroke',
            scale: 2,
            period: 5,
            color: '#00ACC1'
          },
          itemStyle: {
            color: '#00ACC1',
            shadowBlur: 6,
            shadowColor: 'rgba(0, 172, 193, 0.4)'
          },
          label: {
            show: false
          },
          zlevel: 1
        },
        {
          name: '已结束',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: [],
          symbolSize: 6,
          itemStyle: {
            color: '#8D6E63',
            shadowBlur: 3,
            shadowColor: 'rgba(141, 110, 99, 0.25)',
            opacity: 0.75
          },
          label: {
            show: false
          },
          zlevel: 1
        }
      ]
    };
  },

  /**
   * 绑定交互事件
   */
  bindEvents() {
    const self = this;
    
    // 地图点击事件（省份）
    this.chart.on('click', 'geo', function(params) {
      if (params.region) {
        self.onProvinceClick(params.region);
      }
    });

    // 散点悬浮事件
    this.chart.on('mouseover', 'series', function(params) {
      if (params.data && params.data.perf) {
        self.showTooltip(params.data.perf, params.event.event);
      }
    });

    this.chart.on('mouseout', 'series', function() {
      self.hideTooltip();
    });

    // 鼠标移动时更新提示位置
    document.addEventListener('mousemove', function(e) {
      if (self.tooltip.classList.contains('visible')) {
        self.positionTooltip(e.clientX, e.clientY);
      }
    });
  },

  /**
   * 省份点击处理
   */
  onProvinceClick(provinceName) {
    // 高亮该省份的演出
    console.log('[地图] 点击省份:', provinceName);
    // TODO: 可以展示该省份的演出列表
  },

  /**
   * 更新地图数据
   */
  updateData(performances) {
    if (!this.chart) return;

    const liveData = [];
    const upcomingData = [];
    const endedData = [];

    performances.forEach(perf => {
      const point = {
        name: perf.name,
        value: [perf.lng, perf.lat],
        perf: perf
      };

      if (perf.status === 'live') {
        liveData.push(point);
      } else if (perf.status === 'upcoming') {
        upcomingData.push(point);
      } else if (perf.status === 'ended') {
        endedData.push(point);
      }
    });

    this.chart.setOption({
      series: [
        { data: liveData },
        { data: upcomingData },
        { data: endedData }
      ]
    });
  },

  /**
   * 显示提示卡片
   */
  showTooltip(perf, event) {
    const statusMap = {
      live: { text: '正在演出', cls: 'live' },
      upcoming: { text: '即将演出', cls: 'upcoming' },
      ended: { text: '已结束', cls: 'ended' }
    };
    const st = statusMap[perf.status] || statusMap.upcoming;

    this.tooltip.querySelector('.tooltip-content').innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-status ${st.cls}"></span>
        <span class="tooltip-name">${perf.name}</span>
        <span class="tooltip-genre">${perf.genre}</span>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-row">
          <span class="icon">📍</span>
          <span>${perf.province} ${perf.city} · ${perf.address}</span>
        </div>
        <div class="tooltip-row">
          <span class="icon">📅</span>
          <span>${perf.startDate} ~ ${perf.endDate}</span>
        </div>
        <div class="tooltip-row">
          <span class="icon">🎭</span>
          <span>${perf.troupe || '未知剧团'}</span>
        </div>
        ${perf.description ? `
        <div class="tooltip-description">${perf.description}</div>
        ` : ''}
      </div>
    `;

    this.tooltip.classList.add('visible');
    if (event) {
      this.positionTooltip(event.clientX, event.clientY);
    }
  },

  /**
   * 隐藏提示卡片
   */
  hideTooltip() {
    this.tooltip.classList.remove('visible');
  },

  /**
   * 定位提示卡片
   */
  positionTooltip(x, y) {
    const rect = this.tooltip.getBoundingClientRect();
    let left = x + 20;
    let top = y - rect.height / 2;

    // 边界检测
    if (left + rect.width > window.innerWidth - 20) {
      left = x - rect.width - 20;
    }
    if (top < 80) top = 80;
    if (top + rect.height > window.innerHeight - 20) {
      top = window.innerHeight - rect.height - 20;
    }

    this.tooltip.style.left = left + 'px';
    this.tooltip.style.top = top + 'px';
  },

  /**
   * 销毁地图实例
   */
  destroy() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
};
