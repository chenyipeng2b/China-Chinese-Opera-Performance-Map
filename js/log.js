/**
 * 中国戏曲演出地图 - 日志工具模块
 * 收集并持久化错误信息，支持 localforage 存储和导出
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'opera_map_error_logs';
  var MAX_LOGS = 200;
  var sessionId = generateSessionId();
  var logs = [];

  // ========== 生成会话ID ==========
  function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  // ========== 获取浏览器信息 ==========
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var info = {
      userAgent: ua,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenResolution: screen.width + 'x' + screen.height,
      viewportSize: window.innerWidth + 'x' + window.innerHeight,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
      pageUrl: window.location.href,
      referrer: document.referrer || '(none)'
    };

    // 检测浏览器类型
    if (ua.indexOf('Edg') > -1) info.browser = 'Edge';
    else if (ua.indexOf('Chrome') > -1) info.browser = 'Chrome';
    else if (ua.indexOf('Firefox') > -1) info.browser = 'Firefox';
    else if (ua.indexOf('Safari') > -1) info.browser = 'Safari';
    else info.browser = 'Other';

    return info;
  }

  // ========== 获取当前状态快照 ==========
  function getStateSnapshot() {
    var snap = {
      performanceCount: (typeof allPerformances !== 'undefined') ? allPerformances.length : 'unknown',
      chartExists: (typeof chart !== 'undefined' && chart !== null),
      geoJsonExists: (typeof geoJson !== 'undefined' && geoJson !== null),
      filters: (typeof filters !== 'undefined') ? JSON.parse(JSON.stringify(filters)) : 'unknown'
    };

    // 收集演出数据摘要（仅元信息，不含具体内容）
    if (typeof allPerformances !== 'undefined' && allPerformances.length > 0) {
      try {
        snap.performanceSummary = allPerformances.slice(0, 3).map(function(p) {
          return { name: p.name, genre: p.genre, city: p.city, status: p._status };
        });
        snap.performanceTotal = allPerformances.length;
      } catch(e) {
        snap.performanceSummary = '(error reading)';
      }
    }

    return snap;
  }

  // ========== 收集当前网络/资源状态 ==========
  function getResourceTiming() {
    try {
      var entries = performance.getEntriesByType('resource');
      var failed = [];
      var summary = { total: entries.length, failed: 0, details: [] };

      entries.forEach(function(e) {
        // 检查 fetch 或 XMLHttpRequest 资源
        if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest') {
          summary.details.push({
            name: e.name,
            duration: Math.round(e.duration),
            transferSize: e.transferSize,
            initiatorType: e.initiatorType
          });
        }
      });

      return summary;
    } catch(e) {
      return { error: 'performance API not available' };
    }
  }

  // ========== 构建完整日志条目 ==========
  function buildLogEntry(level, source, message, extra) {
    var entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      level: level,
      source: source,
      message: message,
      browser: getBrowserInfo(),
      state: getStateSnapshot(),
      resources: getResourceTiming(),
      extra: extra || {}
    };

    // 捕获堆栈跟踪
    try {
      var stackErr = new Error();
      if (stackErr.stack) {
        entry.stackTrace = stackErr.stack;
      }
    } catch(e) {
      entry.stackTrace = '(stack unavailable)';
    }

    return entry;
  }

  // ========== 保存日志到 localStorage ==========
  function persistLogs() {
    try {
      var data = JSON.stringify(logs);
      localStorage.setItem(STORAGE_KEY, data);
    } catch(e) {
      // localStorage 满或其他异常：尝试清理旧日志
      try {
        var trimmed = logs.slice(-50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch(e2) {
        // 静默失败
      }
    }
  }

  // ========== 从 localStorage 恢复日志 ==========
  function loadLogs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          logs = parsed;
          // 清理超量日志
          if (logs.length > MAX_LOGS) {
            logs = logs.slice(-MAX_LOGS);
          }
        }
      }
    } catch(e) {
      logs = [];
    }
  }

  // ========== 核心 API ==========

  /**
   * 记录错误日志
   * @param {string} source - 错误来源模块
   * @param {string|Error} message - 错误信息或 Error 对象
   * @param {object} [extra] - 额外上下文信息
   */
  function logError(source, message, extra) {
    var msg = message;
    if (message instanceof Error) {
      extra = extra || {};
      extra.errorName = message.name;
      extra.errorStack = message.stack;
      msg = message.message;
    }
    var entry = buildLogEntry('error', source, msg, extra);
    logs.push(entry);
    console.error('[日志] ' + source + ' 错误:', msg, extra || '');
    persistLogs();
    return entry;
  }

  /**
   * 记录警告日志
   * @param {string} source - 来源模块
   * @param {string} message - 警告信息
   * @param {object} [extra] - 额外上下文
   */
  function logWarn(source, message, extra) {
    var entry = buildLogEntry('warn', source, message, extra);
    logs.push(entry);
    console.warn('[日志] ' + source + ' 警告:', message, extra || '');
    persistLogs();
    return entry;
  }

  /**
   * 记录信息日志
   * @param {string} source - 来源模块
   * @param {string} message - 信息
   * @param {object} [extra] - 额外上下文
   */
  function logInfo(source, message, extra) {
    var entry = buildLogEntry('info', source, message, extra);
    logs.push(entry);
    persistLogs();
    return entry;
  }

  /**
   * 获取所有日志（筛选用）
   * @param {string} [level] - 按级别筛选：error/warn/info
   * @param {string} [source] - 按来源筛选
   * @param {number} [limit] - 限制条数
   * @returns {Array}
   */
  function getLogs(level, source, limit) {
    var result = logs.slice();
    if (level) {
      result = result.filter(function(l) { return l.level === level; });
    }
    if (source) {
      result = result.filter(function(l) { return l.source === source; });
    }
    if (limit && limit > 0) {
      result = result.slice(-limit);
    }
    return result;
  }

  /**
   * 导出日志为 JSON 文件下载
   * @param {string} [level] - 可选筛选级别
   */
  function exportLogs(level) {
    var data = getLogs(level);
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'opera-map-logs_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 导出日志为可读文本文件
   */
  function exportLogsAsText() {
    var text = '';
    logs.forEach(function(entry, i) {
      text += '[' + (i + 1) + '] ' + entry.timestamp + ' [' + entry.level.toUpperCase() + '] ' + entry.source + '\n';
      text += '    消息: ' + entry.message + '\n';
      text += '    会话: ' + entry.sessionId + '\n';
      text += '    浏览器: ' + entry.browser.browser + ' | ' + entry.browser.userAgent + '\n';
      text += '    页面: ' + entry.browser.pageUrl + '\n';
      text += '    分辨率: ' + entry.browser.viewportSize + ' | 在线: ' + entry.browser.onLine + '\n';
      text += '    演出数: ' + entry.state.performanceCount + ' | 地图: ' + entry.state.chartExists + ' | GeoJSON: ' + entry.state.geoJsonExists + '\n';
      if (entry.extra && Object.keys(entry.extra).length > 0) {
        text += '    附加信息: ' + JSON.stringify(entry.extra) + '\n';
      }
      if (entry.stackTrace) {
        text += '    堆栈: ' + entry.stackTrace.replace(/\n/g, '\n          ') + '\n';
      }
      text += '    ---\n';
    });

    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'opera-map-logs_' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 清空日志
   */
  function clearLogs() {
    logs = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch(e) {}
  }

  /**
   * 获取日志统计
   */
  function getLogStats() {
    var stats = { total: logs.length, errors: 0, warns: 0, infos: 0, sources: {}, firstLog: null, lastLog: null };
    logs.forEach(function(l) {
      if (l.level === 'error') stats.errors++;
      else if (l.level === 'warn') stats.warns++;
      else stats.infos++;
      stats.sources[l.source] = (stats.sources[l.source] || 0) + 1;
      if (!stats.firstLog || l.timestamp < stats.firstLog) stats.firstLog = l.timestamp;
      if (!stats.lastLog || l.timestamp > stats.lastLog) stats.lastLog = l.timestamp;
    });
    return stats;
  }

  // ========== 全局异常捕获 ==========
  window.addEventListener('error', function(event) {
    var extra = {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: event.type
    };
    if (event.error) {
      extra.errorName = event.error.name;
      extra.errorStack = event.error.stack;
    }
    logError('全局异常', event.message || '未知错误', extra);
  });

  window.addEventListener('unhandledrejection', function(event) {
    var extra = { type: 'PromiseRejection' };
    if (event.reason) {
      if (event.reason instanceof Error) {
        extra.errorName = event.reason.name;
        extra.errorStack = event.reason.stack;
        extra.errorMessage = event.reason.message;
      } else {
        extra.reason = String(event.reason);
      }
    }
    logError('Promise异常', '未处理的 Promise 拒绝', extra);
  });

  // ========== 资源加载错误 ==========
  document.addEventListener('error', function(event) {
    var target = event.target;
    if (target && target.tagName) {
      var extra = {
        tagName: target.tagName,
        src: target.src || target.href || '(none)',
        outerHTML: target.outerHTML ? target.outerHTML.substring(0, 200) : '(none)'
      };
      logError('资源加载', target.tagName + ' 加载失败: ' + extra.src, extra);
    }
  }, true);

  // ========== 初始化 ==========
  loadLogs();

  // 启动日志（记录页面加载）
  logInfo('系统', '页面加载完成', { sessionId: sessionId });

  // ========== 暴露 API ==========
  window.OperaLog = {
    error: logError,
    warn: logWarn,
    info: logInfo,
    getLogs: getLogs,
    exportLogs: exportLogs,
    exportLogsAsText: exportLogsAsText,
    clearLogs: clearLogs,
    getLogStats: getLogStats,
    sessionId: sessionId,
    getAll: function() { return logs; }
  };

  console.log('[日志系统] 初始化完成, 会话ID: ' + sessionId + ', 历史日志: ' + logs.length + ' 条');
})();
