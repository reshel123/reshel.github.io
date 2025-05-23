/**
 * Firebase配置文件
 * 用于存储Firebase项目的配置信息
 */

// 使用立即执行函数避免全局变量冲突
(function() {
    // Firebase配置对象
    const config = {
        apiKey: "AIzaSyA5Z9yy3SbMnB5Ln1Kz5NU89pFyxFz9YBA",
        authDomain: "deepseek-chat-demo.firebaseapp.com",
        projectId: "deepseek-chat-demo",
        storageBucket: "deepseek-chat-demo.appspot.com",
        messagingSenderId: "248156139325", 
        appId: "1:248156139325:web:f7a38157d8a7f81c34ef70",
        databaseURL: "https://deepseek-chat-demo-default-rtdb.firebaseio.com"
    };
    
    // 检查配置有效性
    function checkFirebaseConfig() {
        console.log('[Firebase] 开始检查配置...');
        let configValid = true;
        
        // 检查必要字段
        const requiredFields = ['apiKey', 'authDomain', 'projectId', 'databaseURL'];
        for (const field of requiredFields) {
            if (!config[field]) {
                console.error(`[Firebase] 错误: 缺少必要配置字段 ${field}`);
                configValid = false;
            }
        }
        
        if (configValid) {
            console.log('[Firebase] 配置检查通过');
        } else {
            console.error('[Firebase] 配置检查失败，请更新配置');
        }
        
        return configValid;
    }
    
    // 导出配置到全局变量
    console.log('[Firebase] 配置已加载:', config);
    window.FIREBASE_CONFIG = config;
    
    // 自动检查配置
    checkFirebaseConfig();
})(); 