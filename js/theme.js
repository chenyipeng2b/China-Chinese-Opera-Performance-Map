/**
 * 主题控制器 - 自动/手动切换白天/夜晚模式
 * 支持三种模式：auto（跟随系统）、light（亮色）、dark（暗色）
 * 用户偏好通过 localStorage 持久化，优先级高于系统偏好
 */
(function() {
    'use strict';

    var STORAGE_KEY = 'opera-map-theme';
    var THEME_ATTR = 'data-theme';

    // 当前主题模式：'auto' | 'light' | 'dark'
    var currentMode = localStorage.getItem(STORAGE_KEY) || 'auto';

    // 系统暗色模式媒体查询
    var systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    /**
     * 判断当前实际显示主题是否为暗色
     */
    function isDark() {
        if (currentMode === 'dark') return true;
        if (currentMode === 'light') return false;
        return systemDarkQuery.matches;
    }

    /**
     * 应用主题到 DOM
     */
    function applyTheme() {
        if (isDark()) {
            document.documentElement.setAttribute(THEME_ATTR, 'dark');
        } else {
            document.documentElement.removeAttribute(THEME_ATTR);
        }

        updateThemeBtn();

        // 触发自定义事件，通知 ECharts 等模块
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { mode: currentMode, isDark: isDark() }
        }));
    }

    /**
     * 更新主题按钮图标
     */
    function updateThemeBtn() {
        var btn = document.getElementById('themeBtn');
        if (!btn) return;
        var icons = { auto: '\uD83D\uDDA5\uFE0F', light: '\u2600\uFE0F', dark: '\uD83C\uDF19' };
        var titles = { auto: '自动模式（跟随系统）', light: '亮色模式', dark: '暗色模式' };
        btn.textContent = icons[currentMode];
        btn.title = titles[currentMode];
    }

    /**
     * 切换主题模式（循环：auto -> light -> dark -> auto）
     */
    function toggleTheme() {
        var modes = ['auto', 'light', 'dark'];
        var idx = modes.indexOf(currentMode);
        currentMode = modes[(idx + 1) % modes.length];
        localStorage.setItem(STORAGE_KEY, currentMode);
        applyTheme();
    }

    /**
     * 获取当前实际主题
     * @returns {'dark' | 'light'}
     */
    function getCurrentTheme() {
        return isDark() ? 'dark' : 'light';
    }

    /**
     * 获取当前模式
     * @returns {'auto' | 'light' | 'dark'}
     */
    function getCurrentMode() {
        return currentMode;
    }

    // 监听系统主题变化（仅在 auto 模式下生效）
    systemDarkQuery.addEventListener('change', function() {
        if (currentMode === 'auto') {
            applyTheme();
        }
    });

    /**
     * 初始化
     */
    function init() {
        applyTheme();
        function bindBtn() {
            var btn = document.getElementById('themeBtn');
            if (btn) {
                btn.addEventListener('click', toggleTheme);
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindBtn);
        } else {
            bindBtn();
        }
    }

    // 暴露 API
    window.ThemeManager = {
        init: init,
        toggle: toggleTheme,
        getCurrentTheme: getCurrentTheme,
        getCurrentMode: getCurrentMode,
        isDark: isDark
    };

})();
