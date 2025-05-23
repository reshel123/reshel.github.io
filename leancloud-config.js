// LeanCloud配置信息
window.LC_CONFIG = {
    appId: 'rGkLYcDc4ZlH34K4IOxKvoB7-gzGzoHsz',
    appKey: 'TO2k9emGcnlvIqkjePAM0nz7',
    serverURL: 'https://rg-serve.onrender.com'
}; 

// 确保配置已正确加载
console.log('[LeanCloud] 配置已加载:', window.LC_CONFIG);

// 添加配置有效性检查函数
window.checkLeanCloudConfig = function() {
    if (!window.LC_CONFIG) {
        console.error('[LeanCloud] 配置未正确加载');
        return false;
    }
    
    if (!window.LC_CONFIG.appId || !window.LC_CONFIG.appKey) {
        console.error('[LeanCloud] 应用ID或Key未设置');
        return false;
    }
    
    if (!window.LC_CONFIG.serverURL) {
        console.warn('[LeanCloud] 未设置serverURL，可能影响连接性');
    }
    
    // 检查SDK是否已加载
    if (typeof AV === 'undefined') {
        console.error('[LeanCloud] SDK未正确加载，AV对象不可用');
        return false;
    }
    
    console.log('[LeanCloud] 配置检查通过');
    return true;
};

// 在加载完成后自动检查
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(window.checkLeanCloudConfig, 500);
} else {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(window.checkLeanCloudConfig, 500);
    });
} 