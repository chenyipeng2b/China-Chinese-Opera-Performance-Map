/* ============================================
   戏曲地图 - 讨论区模块
   功能：发言发布、敏感词过滤、点赞点踩、分页渲染、管理员删除
   数据存储：localStorage
   ============================================ */
(function() {
  'use strict';

  var STORAGE_KEY = 'opera_discussion_posts';
  var FINGERPRINT_KEY = 'opera_discuss_fingerprint';
  var PAGE_SIZE = 10;
  var MAX_POSTS = 500;
  var ADMIN_PASSWORD = 'opera2024';

  // 当前分页
  var currentPage = 0;
  var allPosts = [];

  // ========== 用户指纹 ==========
  function getFingerprint() {
    var fp = localStorage.getItem(FINGERPRINT_KEY);
    if (!fp) {
      fp = 'fp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(FINGERPRINT_KEY, fp);
    }
    return fp;
  }

  // ========== 敏感词库（60+ 词，含谐音/拼音/形近字三层检测） ==========
  var sensitiveWords = [
    // 直接辱骂
    '傻逼', '傻b', 'sb', '傻比', '傻杯', '傻叉', '傻X', '傻x',
    '弱智', '脑残', '白痴', '智障',
    '草泥马', 'cnm', '草尼玛', '操你妈', '艹你妈',
    'tmd', '特么的', '他妈', '你妈', '尼玛', '你麻痹',
    '法克', 'fuck', 'fck', 'fk',
    '狗日', '狗屎', '垃圾', '废物',
    '滚蛋', '滚开', '滚远点',
    '去死', '去死吧', '死开',
    '变态', '恶心',
    '贱人', '贱货', '婊子',
    '杂种', '畜生',
    // 谐音变体
    '煞笔', '煞比', '沙比', '沙币', '沙雕', '傻雕',
    '草你妈', '草拟吗', '草尼玛',
    '踏马的', '他妈的', '特妈的',
    '萨比', '洒比',
    // 拼音缩写
    'nmsl', 'nm$l', 'n m s l',
    'sb', 's b', 's.b',
    'cnm', 'c n m',
    // 英文
    'stupid', 'idiot', 'dumb', 'retard',
    'shit', 'crap', 'damn',
    // 形近字
    '傻通', '傻币', '傻必',
    '草你妈', '草泥码', '草拟妈'
  ];

  function normalizeText(text) {
    // 去除空格、特殊符号、统一大小写
    return text.replace(/[\s~!@#$%^&*()_+\-=\[\]{}|;':",./<>?`]/g, '').toLowerCase();
  }

  function containsSensitiveWord(text) {
    var norm = normalizeText(text);
    // 先检查原始文本中的匹配
    for (var i = 0; i < sensitiveWords.length; i++) {
      if (norm.indexOf(normalizeText(sensitiveWords[i])) !== -1) {
        return true;
      }
    }
    return false;
  }

  function filterSensitiveWord(text) {
    var filtered = text;
    for (var i = 0; i < sensitiveWords.length; i++) {
      var word = sensitiveWords[i];
      var idx = filtered.toLowerCase().indexOf(word.toLowerCase());
      if (idx !== -1) {
        filtered = filtered.substring(0, idx) + '***' + filtered.substring(idx + word.length);
      }
    }
    return filtered;
  }

  // ========== 数据读写 ==========
  function loadPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      allPosts = raw ? JSON.parse(raw) : [];
      // 按热度排序（点赞数降序，次按时间降序）
      allPosts.sort(function(a, b) {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return b.time.localeCompare(a.time);
      });
    } catch (e) {
      allPosts = [];
    }
  }

  function savePosts() {
    // 最多保留 500 条
    if (allPosts.length > MAX_POSTS) {
      allPosts = allPosts.slice(0, MAX_POSTS);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPosts));
    } catch (e) {
      // localStorage 满了，删除最旧的 100 条
      allPosts = allPosts.slice(0, allPosts.length - 100);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allPosts)); } catch (e2) {}
    }
  }

  function generateId() {
    return 'disc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function formatTime(isoStr) {
    var d = new Date(isoStr);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ========== 发布发言 ==========
  function postDiscussion(nickname, content) {
    // 去首尾空格
    nickname = (nickname || '').trim();
    content = (content || '').trim();

    if (!nickname) nickname = '戏迷';

    if (nickname.length > 20) nickname = nickname.substring(0, 20);
    if (content.length > 500) content = content.substring(0, 500);

    if (!content) return { success: false, error: '请输入发言内容' };

    // 敏感词检测 - 昵称
    if (containsSensitiveWord(nickname)) {
      return { success: false, error: '昵称含有不当词汇，请修改' };
    }

    // 敏感词检测 - 内容
    if (containsSensitiveWord(content)) {
      return { success: false, error: '发言含有不当词汇，请修改后发送' };
    }

    var post = {
      id: generateId(),
      nickname: nickname,
      content: content,
      time: new Date().toISOString(),
      likes: 0,
      dislikes: 0,
      voters: {},
      deleted: false
    };

    allPosts.unshift(post);
    savePosts();
    return { success: true, post: post };
  }

  // ========== 点赞/点踩 ==========
  function votePost(postId, voteType) {
    var fp = getFingerprint();
    var post = null;
    for (var i = 0; i < allPosts.length; i++) {
      if (allPosts[i].id === postId) { post = allPosts[i]; break; }
    }
    if (!post) return null;

    if (!post.voters) post.voters = {};

    var currentVote = post.voters[fp];

    if (currentVote === voteType) {
      // 再次点击相同类型 → 取消投票
      delete post.voters[fp];
      if (voteType === 'like') post.likes = Math.max(0, post.likes - 1);
      else post.dislikes = Math.max(0, post.dislikes - 1);
    } else {
      // 不同类型或首次投票 → 设置/切换
      if (currentVote === 'like') post.likes = Math.max(0, post.likes - 1);
      else if (currentVote === 'dislike') post.dislikes = Math.max(0, post.dislikes - 1);

      post.voters[fp] = voteType;
      if (voteType === 'like') post.likes += 1;
      else post.dislikes += 1;
    }

    savePosts();
    return post;
  }

  // ========== 管理员删除 ==========
  function deletePost(postId, password) {
    if (password !== ADMIN_PASSWORD) return { success: false, error: '密码错误' };

    for (var i = 0; i < allPosts.length; i++) {
      if (allPosts[i].id === postId) {
        allPosts[i].deleted = true;
        allPosts[i].content = '[该评论已被管理员删除]';
        savePosts();
        return { success: true };
      }
    }
    return { success: false, error: '未找到该评论' };
  }

  // ========== 分页渲染 ==========
  function renderPage(page) {
    currentPage = page;
    var listEl = document.getElementById('discList');
    if (!listEl) return;

    var fp = getFingerprint();
    var startIdx = page * PAGE_SIZE;
    var endIdx = startIdx + PAGE_SIZE;
    var visiblePosts = [];

    // 收集可见帖子（排除删除标记但保留 deleted=true 的作为占位）
    for (var i = 0; i < allPosts.length; i++) {
      var p = allPosts[i];
      if (p.deleted) {
        // 跳过已删除的（不显示）
        continue;
      }
      visiblePosts.push(p);
    }

    var pagePosts = visiblePosts.slice(startIdx, endIdx);
    var totalPages = Math.ceil(visiblePosts.length / PAGE_SIZE);

    if (visiblePosts.length === 0) {
      listEl.innerHTML = '<div class="disc-empty">暂无评论，快来抢沙发吧~</div>';
      updatePager(0, 0);
      return;
    }

    var html = '';
    for (var j = 0; j < pagePosts.length; j++) {
      var post = pagePosts[j];
      var userVote = post.voters && post.voters[fp] ? post.voters[fp] : null;

      html += '<div class="disc-item" data-id="' + post.id + '">';
      html += '<div class="disc-item-header">';
      html += '<span class="disc-item-nickname">' + escapeHtml(post.nickname) + '</span>';
      html += '<span class="disc-item-time">' + formatTime(post.time) + '</span>';
      html += '</div>';
      html += '<div class="disc-item-content">' + escapeHtml(post.content) + '</div>';
      html += '<div class="disc-item-actions">';
      // 点赞 - 戏曲"赞"字印章风格
      html += '<button class="disc-vote-btn disc-like-btn' + (userVote === 'like' ? ' voted' : '') + '" data-vote="like" data-id="' + post.id + '" title="赞">';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h12.4a2 2 0 0 0 1.94-1.52l2.1-8.4A2 2 0 0 0 18.5 10H14V5a3 3 0 0 0-3-3l-4 9"/></svg>';
      html += '<span class="disc-vote-count">' + post.likes + '</span>';
      html += '</button>';
      // 点踩 - 水墨点墨风格
      html += '<button class="disc-vote-btn disc-dislike-btn' + (userVote === 'dislike' ? ' voted' : '') + '" data-vote="dislike" data-id="' + post.id + '" title="踩">';
      html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2v11m5-2v-7a2 2 0 0 0-2-2H7.6a2 2 0 0 0-1.94 1.52l-2.1 8.4A2 2 0 0 0 5.5 14H10v5a3 3 0 0 0 3 3l4-9"/></svg>';
      html += '<span class="disc-vote-count">' + post.dislikes + '</span>';
      html += '</button>';
      // 管理员删除
      html += '<button class="disc-delete-btn" data-id="' + post.id + '" title="管理员删除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
      html += '</div>';
      html += '</div>';
    }

    listEl.innerHTML = html;
    updatePager(currentPage, totalPages);

    // 事件委托：投票
    listEl.onclick = function(e) {
      var btn = e.target.closest('.disc-vote-btn');
      if (!btn) return;
      var postId = btn.getAttribute('data-id');
      var voteType = btn.getAttribute('data-vote');
      var result = votePost(postId, voteType);
      if (result) {
        renderPage(currentPage);
      }
    };

    // 事件委托：管理员删除
    listEl.onclick = function(e) {
      var btn = e.target.closest('.disc-delete-btn');
      if (!btn) return;
      var postId = btn.getAttribute('data-id');
      var pwd = prompt('请输入管理员密码：');
      if (!pwd) return;
      var result = deletePost(postId, pwd);
      if (result.success) {
        loadPosts();
        renderPage(0);
        alert('评论已删除');
      } else {
        alert(result.error);
      }
    };
  }

  function updatePager(page, totalPages) {
    var pagerEl = document.getElementById('discPager');
    if (!pagerEl) return;
    if (totalPages <= 1) {
      pagerEl.innerHTML = '';
      return;
    }
    var html = '';
    html += '<button class="disc-pager-btn" ' + (page === 0 ? 'disabled' : '') + ' data-page="0">首页</button>';
    html += '<button class="disc-pager-btn" ' + (page === 0 ? 'disabled' : '') + ' data-page="' + (page - 1) + '">上一页</button>';
    html += '<span class="disc-pager-info">' + (page + 1) + ' / ' + totalPages + '</span>';
    html += '<button class="disc-pager-btn" ' + (page >= totalPages - 1 ? 'disabled' : '') + ' data-page="' + (page + 1) + '">下一页</button>';
    html += '<button class="disc-pager-btn" ' + (page >= totalPages - 1 ? 'disabled' : '') + ' data-page="' + (totalPages - 1) + '">末页</button>';
    pagerEl.innerHTML = html;

    pagerEl.onclick = function(e) {
      var btn = e.target.closest('.disc-pager-btn');
      if (!btn || btn.disabled) return;
      var p = parseInt(btn.getAttribute('data-page'));
      if (!isNaN(p) && p >= 0) {
        renderPage(p);
        // 滚动到讨论区顶部
        var panel = document.getElementById('discussionPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }

  // ========== HTML 转义 ==========
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ========== 折叠面板控制 ==========
  function toggleDiscussPanel() {
    var panel = document.getElementById('discussionPanel');
    if (!panel) return;
    var isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
    } else {
      panel.classList.add('open');
      loadPosts();
      renderPage(0);
    }
  }

  // ========== 初始化 ==========
  function init() {
    loadPosts();

    // 讨论区折叠标题点击事件
    var header = document.getElementById('discussionHeader');
    if (header) {
      header.addEventListener('click', toggleDiscussPanel);
    }

    // 发布按钮事件
    var postBtn = document.getElementById('discPostBtn');
    if (postBtn) {
      postBtn.addEventListener('click', function() {
        var nickname = document.getElementById('discNickname').value;
        var content = document.getElementById('discContent').value;
        var result = postDiscussion(nickname, content);

        if (result.success) {
          document.getElementById('discNickname').value = '';
          document.getElementById('discContent').value = '';
          document.getElementById('discContentCount').textContent = '0/500';
          document.getElementById('discPostBtn').disabled = true;
          document.getElementById('discFilterHint').classList.add('hidden');
          loadPosts();
          renderPage(0);
        } else {
          document.getElementById('discFilterHint').textContent = result.error;
          document.getElementById('discFilterHint').classList.remove('hidden');
        }
      });
    }

    // 内容输入实时检测
    var contentInput = document.getElementById('discContent');
    if (contentInput) {
      contentInput.addEventListener('input', function() {
        var val = this.value;
        var count = val.length;
        document.getElementById('discContentCount').textContent = count + '/500';
        var nickname = document.getElementById('discNickname').value.trim();
        var hasContent = val.trim().length > 0;
        var hasNickname = nickname.length > 0;
        var hasSensitive = containsSensitiveWord(val) || containsSensitiveWord(nickname);

        document.getElementById('discPostBtn').disabled = !hasContent || !hasNickname || hasSensitive;

        if (hasSensitive) {
          document.getElementById('discFilterHint').textContent = '含有敏感词，请修改后发送';
          document.getElementById('discFilterHint').classList.remove('hidden');
        } else {
          document.getElementById('discFilterHint').classList.add('hidden');
        }
      });
    }

    // 昵称输入实时检测
    var nicknameInput = document.getElementById('discNickname');
    if (nicknameInput) {
      nicknameInput.addEventListener('input', function() {
        var val = this.value;
        document.getElementById('discNicknameCount').textContent = val.length + '/20';
        var content = document.getElementById('discContent').value.trim();
        var hasContent = content.length > 0;
        var hasNickname = val.trim().length > 0;
        var hasSensitive = containsSensitiveWord(val) || containsSensitiveWord(content);

        document.getElementById('discPostBtn').disabled = !hasContent || !hasNickname || hasSensitive;

        if (containsSensitiveWord(val)) {
          document.getElementById('discFilterHint').textContent = '昵称含有敏感词';
          document.getElementById('discFilterHint').classList.remove('hidden');
        } else if (!containsSensitiveWord(content)) {
          document.getElementById('discFilterHint').classList.add('hidden');
        }
      });
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
