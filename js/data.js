/**
 * 数据加载与处理模块
 * 负责加载演出数据、计算状态、坐标转换
 */
const DataManager = {
  performances: [],
  manualEnabled: true,

  /**
   * 从 JSON 文件加载演出数据
   */
  async load() {
    try {
      const response = await fetch('data/performances.json');
      if (!response.ok) throw new Error('数据加载失败');
      this.performances = await response.json();
      
      // 读取本地存储的开关状态
      const saved = localStorage.getItem('opera_manual_enabled');
      if (saved !== null) {
        this.manualEnabled = saved === 'true';
      }
      
      console.log(`[数据] 已加载 ${this.performances.length} 条演出数据`);
      return this.performances;
    } catch (error) {
      console.error('[数据] 加载失败:', error);
      this.performances = [];
      return [];
    }
  },

  /**
   * 获取演出状态
   * @returns {'live'|'upcoming'|'ended'|null}
   */
  getStatus(perf) {
    const now = new Date();
    // 设置为当天 00:00:00 以便比较日期
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(perf.startDate + 'T00:00:00');
    const end = new Date(perf.endDate + 'T23:59:59');
    const threeDaysAfter = new Date(end.getTime() + 3 * 24 * 60 * 60 * 1000);

    if (today >= start && today <= end) return 'live';
    if (today < start) return 'upcoming';
    if (today > end && today <= threeDaysAfter) return 'ended';
    return null; // 超过3天，不显示
  },

  /**
   * 获取过滤后的有效演出列表
   */
  getActivePerformances() {
    return this.performances.filter(perf => {
      // 手动数据开关控制
      if (perf.source === 'manual' && !this.manualEnabled) return false;
      
      const status = this.getStatus(perf);
      return status !== null; // 排除已过期超过3天的
    }).map(perf => ({
      ...perf,
      status: this.getStatus(perf)
    }));
  },

  /**
   * 按状态分组
   */
  getGroupedPerformances() {
    const active = this.getActivePerformances();
    return {
      live: active.filter(p => p.status === 'live'),
      upcoming: active.filter(p => p.status === 'upcoming'),
      ended: active.filter(p => p.status === 'ended')
    };
  },

  /**
   * 获取统计信息
   */
  getStats() {
    const grouped = this.getGroupedPerformances();
    return {
      total: grouped.live.length + grouped.upcoming.length + grouped.ended.length,
      live: grouped.live.length,
      upcoming: grouped.upcoming.length,
      ended: grouped.ended.length,
      lastUpdate: new Date().toLocaleString('zh-CN')
    };
  },

  /**
   * 设置手动数据开关
   */
  setManualEnabled(enabled) {
    this.manualEnabled = enabled;
    localStorage.setItem('opera_manual_enabled', enabled);
  }
};
