// 图片优化脚本 - 用于所有页面的背景图片懒加载

// 页面加载优化
document.addEventListener('DOMContentLoaded', function() {
    // 预加载背景图片
    preloadBackgroundImage();
});

// 探测是否支持 WebP（一次简单探测）
function supportsWebp() {
    try {
        const canvas = document.createElement('canvas');
        if (!!(canvas.getContext && canvas.getContext('2d'))) {
            // toDataURL 返回值中包含 'image/webp' 代表支持
            return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
        }
        return false;
    } catch (_) {
        return false;
    }
}

// 预加载背景图片（优先 WebP，失败回退 JPG）
function preloadBackgroundImage() {
    // 根据当前页面确定背景图片
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    let backgroundImage = '';
    
    // 根据页面确定背景图片
    switch(currentPage) {
        case 'index.html':
        case '':
            backgroundImage = 'erd.jpg';
            break;
        case 'ai-chat.html':
            backgroundImage = 'aiph.jpg';
            break;
        case 'software-library.html':
        case 'game-page.html':
        case 'snake-game.html':
        case 'tetris-game.html':
        case 'flappy-game.html':
        case 'puzzle-game.html':
        case 'memory-game.html':
        case 'breakout-game.html':
        case 'secret-page.html':
            backgroundImage = 'dow.jpg';
            break;
        default:
            backgroundImage = 'erd.jpg';
    }
    
    if (backgroundImage) {
        const tryLoad = (src, onFail) => {
            const img = new Image();
            img.onload = function() {
                document.body.classList.add('loaded');
                console.log('背景图片加载完成:', src);
            };
            img.onerror = function() {
                if (typeof onFail === 'function') {
                    onFail();
                } else {
                    console.log('背景图片加载失败，使用默认渐变背景:', src);
                }
            };
            img.src = src;
        };

        // 计算候选地址：优先同名 .webp（如 erd.webp），失败回退原 JPG
        const isWebpSupported = supportsWebp();
        const webpCandidate = backgroundImage.replace(/\.[^.]+$/, '.webp');

        if (isWebpSupported) {
            tryLoad(webpCandidate, () => tryLoad(backgroundImage));
        } else {
            tryLoad(backgroundImage);
        }
    }
}

// 显示加载动画
function showLoadingAnimation() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingScreen';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载...</div>
        </div>
    `;
    document.body.appendChild(loadingDiv);
    
    // 添加加载动画样式
    const style = document.createElement('style');
    style.textContent = `
        #loadingScreen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            transition: opacity 0.5s ease;
        }
        
        .loading-content {
            text-align: center;
            color: white;
        }
        
        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid #ffffff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        
        .loading-text {
            font-size: 18px;
            font-weight: 500;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// 隐藏加载动画
function hideLoadingAnimation() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.remove();
        }, 500);
    }
}

// 图片压缩和优化建议
function optimizeImages() {
    // 建议将图片压缩到合适大小
    // 背景图片建议尺寸: 1920x1080 或更小
    // 格式: WebP > JPEG > PNG
    console.log('图片优化建议:');
    console.log('1. 将背景图片压缩到 1920x1080 或更小');
    console.log('2. 使用 WebP 格式以获得更好的压缩率');
    console.log('3. 考虑使用 CDN 加速图片加载');
    console.log('4. 实现渐进式加载');
}

// 导出函数供其他页面使用
window.ImageOptimizer = {
    preloadBackgroundImage,
    showLoadingAnimation,
    hideLoadingAnimation,
    optimizeImages
}; 