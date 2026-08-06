/* ============================================
   戏曲地图 - 讨论区模块（Giscus 版）
   功能：讨论区面板折叠/展开、Giscus 加载控制、管理员密码验证（CI 注入）
   数据存储：GitHub Discussions（Giscus）
   ============================================ */
(function() {
  'use strict';

  // ========== 管理员密码（从 CI 注入配置读取） ==========
  function getAdminPasswordHash() {
    var config = window.__OPERA_CONFIG__ || {};
    var hash = config.adminPasswordHash || '__ADMIN_PASSWORD_HASH_PLACEHOLDER__';
    // 如果还是占位符，说明未配置，使用默认 hash（opera2024 的 SHA256）
    if (hash === '__ADMIN_PASSWORD_HASH_PLACEHOLDER__') {
      return 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'; // opera2024
    }
    return hash;
  }

  // ========== SHA256 实现（纯 JS，无依赖） ==========
  function sha256(str) {
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    function ch(x, y, z) { return (x & y) ^ (~x & z); }
    function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
    function bsig0(x) { return rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22); }
    function bsig1(x) { return rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25); }
    function ssig0(x) { return rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3); }
    function ssig1(x) { return rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10); }

    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];

    // UTF-8 encode
    var msg = unescape(encodeURIComponent(str));
    var msgLen = msg.length;
    var words = [];
    for (var i = 0; i < msgLen; i++) {
      words[i >> 2] |= msg.charCodeAt(i) << (24 - (i % 4) * 8);
    }
    words[msgLen >> 2] |= 0x80 << (24 - (msgLen % 4) * 8);
    words[((msgLen + 8) >> 6) * 16 + 15] = msgLen * 8;

    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var w = new Array(64);

    for (var i = 0; i < words.length; i += 16) {
      for (var j = 0; j < 16; j++) w[j] = words[i + j] || 0;
      for (var j = 16; j < 64; j++) {
        w[j] = (ssig1(w[j-2]) + w[j-7] + ssig0(w[j-15]) + w[j-16]) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var j = 0; j < 64; j++) {
        var t1 = (h + bsig1(e) + ch(e,f,g) + K[j] + w[j]) >>> 0;
        var t2 = (bsig0(a) + maj(a,b,c)) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    var hex = '';
    for (var i = 0; i < 8; i++) {
      hex += ('0000000' + H[i].toString(16)).slice(-8);
    }
    return hex;
  }

  // ========== 管理员密码验证 ==========
  function verifyAdminPassword(password) {
    if (!password) return false;
    var hash = sha256(password);
    return hash === getAdminPasswordHash();
  }

  // 暴露到全局
  window._verifyAdminPassword = verifyAdminPassword;

  // ========== 折叠面板控制 ==========
  function toggleDiscussPanel() {
    var panel = document.getElementById('discussionPanel');
    if (!panel) return;
    var isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
    } else {
      panel.classList.add('open');
      // 触发 Giscus 加载
      if (window._loadDiscussGiscus) {
        window._loadDiscussGiscus();
      }
    }
  }

  // ========== 初始化 ==========
  function init() {
    // 讨论区折叠标题点击事件
    var header = document.getElementById('discussionHeader');
    if (header) {
      header.addEventListener('click', toggleDiscussPanel);
    }

    // 保留管理员密码验证的全局入口（用于需要密码的地方）
    console.log('[讨论区] Giscus 模式已启用，评论存储在 GitHub Discussions');
    console.log('[讨论区] 管理员密码 hash 已从配置加载');
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
