/**
 * 管理页面逻辑模块
 * 负责演出信息录入、编辑、删除
 */
const AdminManager = {
  performances: [],
  editingId: null,

  /**
   * 初始化
   */
  async init() {
    await this.loadData();
    this.bindFormEvents();
    this.renderList();
    this.setupToggle();
    console.log('[管理] 初始化完成');
  },

  /**
   * 加载数据
   */
  async loadData() {
    try {
      const response = await fetch('data/performances.json');
      if (!response.ok) throw new Error('加载失败');
      this.performances = await response.json();
    } catch (e) {
      console.error('[管理] 数据加载失败:', e);
    }
  },

  /**
   * 设置手动数据开关
   */
  setupToggle() {
    const toggle = document.getElementById('manualToggle');
    if (!toggle) return;
    
    const saved = localStorage.getItem('opera_manual_enabled');
    toggle.checked = saved !== 'false';

    toggle.addEventListener('change', (e) => {
      localStorage.setItem('opera_manual_enabled', e.target.checked);
      console.log('[管理] 手动数据开关:', e.target.checked ? '开' : '关');
    });
  },

  /**
   * 绑定表单事件
   */
  bindFormEvents() {
    const form = document.getElementById('perfForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePerformance();
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.resetForm();
    });
  },

  /**
   * 保存演出信息
   */
  savePerformance() {
    const form = document.getElementById('perfForm');
    const formData = new FormData(form);

    const perf = {
      id: this.editingId || 'manual_' + Date.now(),
      name: formData.get('name'),
      genre: formData.get('genre'),
      province: formData.get('province'),
      city: formData.get('city'),
      address: formData.get('address'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      troupe: formData.get('troupe') || '',
      description: formData.get('description') || '',
      lng: parseFloat(formData.get('lng')),
      lat: parseFloat(formData.get('lat')),
      source: 'manual'
    };

    // 验证必填字段
    if (!perf.name || !perf.genre || !perf.province || !perf.city || 
        !perf.startDate || !perf.endDate || isNaN(perf.lng) || isNaN(perf.lat)) {
      alert('请填写所有必填字段，包括经纬度坐标！');
      return;
    }

    if (this.editingId) {
      // 编辑模式
      const index = this.performances.findIndex(p => p.id === this.editingId);
      if (index !== -1) {
        this.performances[index] = perf;
      }
    } else {
      // 新增模式
      this.performances.push(perf);
    }

    this.saveToJson();
    this.resetForm();
    this.renderList();
    this.showToast('保存成功！请手动 commit 到 GitHub');
  },

  /**
   * 编辑演出
   */
  editPerformance(id) {
    const perf = this.performances.find(p => p.id === id);
    if (!perf) return;

    this.editingId = id;
    const form = document.getElementById('perfForm');
    form.querySelector('[name="name"]').value = perf.name;
    form.querySelector('[name="genre"]').value = perf.genre;
    form.querySelector('[name="province"]').value = perf.province;
    form.querySelector('[name="city"]').value = perf.city;
    form.querySelector('[name="address"]').value = perf.address;
    form.querySelector('[name="startDate"]').value = perf.startDate;
    form.querySelector('[name="endDate"]').value = perf.endDate;
    form.querySelector('[name="troupe"]').value = perf.troupe || '';
    form.querySelector('[name="description"]').value = perf.description || '';
    form.querySelector('[name="lng"]').value = perf.lng;
    form.querySelector('[name="lat"]').value = perf.lat;

    document.getElementById('submitBtn').textContent = '更新演出';
    document.getElementById('formTitle').textContent = '编辑演出信息';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * 删除演出
   */
  deletePerformance(id) {
    if (!confirm('确定要删除这条演出信息吗？')) return;
    
    this.performances = this.performances.filter(p => p.id !== id);
    this.saveToJson();
    this.renderList();
    this.showToast('已删除！请手动 commit 到 GitHub');
  },

  /**
   * 保存到 JSON（本地文件 - GitHub Pages 环境需要通过 GitHub API）
   * 这里先保存到 localStorage 作为备份，实际更新需要 commit
   */
  saveToJson() {
    // 保存到 localStorage 作为临时备份
    localStorage.setItem('opera_performances_backup', JSON.stringify(this.performances));
    
    // 创建下载链接，让用户下载更新后的 JSON
    const blob = new Blob([JSON.stringify(this.performances, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'performances.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 重置表单
   */
  resetForm() {
    const form = document.getElementById('perfForm');
    form.reset();
    this.editingId = null;
    document.getElementById('submitBtn').textContent = '保存演出';
    document.getElementById('formTitle').textContent = '添加演出信息';
  },

  /**
   * 渲染演出列表
   */
  renderList() {
    const container = document.getElementById('perfList');
    if (!container) return;

    if (this.performances.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🎭</div>
          <p>还没有演出信息，快来添加第一条吧！</p>
        </div>
      `;
      return;
    }

    // 按日期排序
    const sorted = [...this.performances].sort((a, b) => 
      new Date(a.startDate) - new Date(b.startDate)
    );

    container.innerHTML = sorted.map(perf => {
      const status = this.getDisplayStatus(perf);
      return `
        <div class="perf-item" onclick="AdminManager.editPerformance('${perf.id}')">
          <div class="perf-item-left">
            <span class="perf-status-dot ${status}"></span>
            <div class="perf-info">
              <h3>${this.escapeHtml(perf.name)} <span class="btn-source-tag ${perf.source === 'manual' ? '' : 'crawled'}">${perf.source === 'manual' ? '手动' : '爬取'}</span></h3>
              <p>${perf.genre} · ${perf.province}${perf.city} · ${perf.startDate}~${perf.endDate}</p>
            </div>
          </div>
          <div class="perf-item-right" onclick="event.stopPropagation()">
            <button class="btn-small btn-edit" onclick="AdminManager.editPerformance('${perf.id}')">编辑</button>
            <button class="btn-small btn-delete" onclick="AdminManager.deletePerformance('${perf.id}')">删除</button>
          </div>
        </div>
      `;
    }).join('');

    // 更新计数
    var countEl = document.getElementById('perfCount');
    if (countEl) countEl.textContent = '共 ' + this.performances.length + ' 条';
  },

  escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  /**
   * 获取显示状态
   */
  getDisplayStatus(perf) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(perf.startDate + 'T00:00:00');
    const end = new Date(perf.endDate + 'T23:59:59');
    
    if (today >= start && today <= end) return 'live';
    if (today < start) return 'upcoming';
    return 'ended';
  },

  /**
   * Toast 提示
   */
  showToast(message) {
    const existing = document.querySelector('.custom-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(201, 169, 110, 0.95);
      color: #1a1a2e;
      padding: 12px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      animation: fadeIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  AdminManager.init();
});
