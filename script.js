document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const modelSelect = document.getElementById('modelSelect');
    
    // 替换为您的Gemini API密钥
    const API_KEY = 'AIzaSyCtdqns8YIxYimV_2inarnGNF6fwR6pag0';
    
    // 发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);
    
    // 检测Enter键（但Shift+Enter允许换行）
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 模型选择下拉菜单添加change事件监听器
    modelSelect.addEventListener('change', function() {
        // 播放模型选择音效
        playSound('modelSound');
    });
    
    // 方法4: 模拟选项悬停 - 在select上设置自定义属性来存储最后的位置
    modelSelect.addEventListener('mousemove', function(e) {
        // 获取鼠标在select上的相对位置
        const rect = this.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        
        // 计算近似的选项索引
        const optionHeight = rect.height / this.options.length;
        const approxIndex = Math.floor(relativeY / optionHeight);
        
        // 如果移动到新的选项，播放声音
        if (this.dataset.lastHoverIndex !== approxIndex.toString() && 
            approxIndex >= 0 && 
            approxIndex < this.options.length) {
            this.dataset.lastHoverIndex = approxIndex;
            playSound('hoverSound');
        }
    });
    
    // 音效功能 - 使用系统声音
    function playSound(type) {
        // 使用Web Audio API创建系统声音
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // 连接节点
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 设置音量
        gainNode.gain.value = 0.1;
        
        // 根据类型设置不同的音调
        if (type === 'sendSound') {
            // 发送消息音效 - 较高音调
            oscillator.type = 'sine';
            oscillator.frequency.value = 880; // A5音
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } else if (type === 'receiveSound') {
            // 接收消息音效 - 较低音调，双声
            oscillator.type = 'sine';
            oscillator.frequency.value = 440; // A4音
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            
            // 添加第二个音调，稍微延迟
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.type = 'sine';
                osc2.frequency.value = 523.25; // C5音
                gain2.gain.setValueAtTime(0.1, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.3);
            }, 150);
        } else if (type === 'modelSound') {
            // 模型选择音效 - 三连音
            oscillator.type = 'triangle';
            oscillator.frequency.value = 659.25; // E5音
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            
            // 添加第二个和第三个音调，形成切换旋律
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.type = 'triangle';
                osc2.frequency.value = 783.99; // G5音
                gain2.gain.setValueAtTime(0.1, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.2);
                
                setTimeout(() => {
                    const osc3 = audioContext.createOscillator();
                    const gain3 = audioContext.createGain();
                    osc3.connect(gain3);
                    gain3.connect(audioContext.destination);
                    
                    osc3.type = 'triangle';
                    osc3.frequency.value = 987.77; // B5音
                    gain3.gain.setValueAtTime(0.1, audioContext.currentTime);
                    gain3.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
                    osc3.start();
                    osc3.stop(audioContext.currentTime + 0.3);
                }, 100);
            }, 100);
        }
    }
    
    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // 播放发送消息音效
        playSound('sendSound');
        
        // 添加用户消息到聊天界面
        addMessageToChat('user', message);
        
        // 清空输入框
        userInput.value = '';
        
        // 显示加载指示器
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message loading';
        loadingDiv.textContent = '思考中...';
        chatContainer.appendChild(loadingDiv);
        
        // 自动滚动到底部
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // 获取当前选择的模型
        const selectedModel = modelSelect.value;
        const [modelPath, method] = selectedModel.split(':');
        
        // 构建API URL
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:${method}`;
        
        // 调用Gemini API
        fetchGeminiResponse(message, API_URL)
            .then(response => {
                // 移除加载指示器
                chatContainer.removeChild(loadingDiv);
                
                // 获取响应后播放接收音效
                playSound('receiveSound');
                
                // 添加AI回复到聊天界面
                addMessageToChat('ai', response);
                
                // 自动滚动到底部
                chatContainer.scrollTop = chatContainer.scrollHeight;
            })
            .catch(error => {
                // 移除加载指示器
                chatContainer.removeChild(loadingDiv);
                
                // 显示错误信息
                addMessageToChat('ai', '抱歉，发生了错误：' + error.message);
                
                // 自动滚动到底部
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });
    }
    
    function addMessageToChat(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'message user-message' : 'message ai-message';
        
        // 处理换行
        const formattedText = text.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedText;
        
        chatContainer.appendChild(messageDiv);
    }
    
    async function fetchGeminiResponse(prompt, apiUrl) {
        try {
            const response = await fetch(`${apiUrl}?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024
                    }
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('未收到有效回复');
            }
            
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('API调用失败:', error);
            throw error;
        }
    }
}); 