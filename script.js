document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const modelSelect = document.getElementById('modelSelect');
    
    // DeepSeek API密钥
    const API_KEY = 'sk-e46299984c8249bdbfd89d6bcd0cc07f';
    
    // 添加聊天状态标志，防止用户在回答未完成时提问
    let isChatInProgress = false;
    
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
    
    // 禁用聊天输入
    function disableChatInput() {
        userInput.disabled = true;
        sendButton.disabled = true;
        userInput.style.opacity = '0.6';
        sendButton.style.opacity = '0.6';
        isChatInProgress = true;
    }
    
    // 启用聊天输入
    function enableChatInput() {
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.style.opacity = '1';
        sendButton.style.opacity = '1';
        isChatInProgress = false;
        userInput.focus(); // 重新聚焦输入框
    }
    
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
        } else if (type === 'errorSound') {
            // 错误提示音效
            oscillator.type = 'square';
            oscillator.frequency.value = 220; // A3音
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    }
    
    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // 检查是否有正在进行的聊天
        if (isChatInProgress) {
            // 播放错误提示音
            playSound('errorSound');
            
            // 显示提示消息
            const warningDiv = document.createElement('div');
            warningDiv.className = 'message system-message warning';
            warningDiv.textContent = '请等待当前问题回答完成后再提问！';
            chatContainer.appendChild(warningDiv);
            
            // 自动滚动到底部
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // 提示消息自动消失
            setTimeout(() => {
                chatContainer.removeChild(warningDiv);
            }, 3000);
            
            return;
        }
        
        // 禁用聊天输入
        disableChatInput();
        
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
        
        // 调用DeepSeek API
        fetchDeepSeekResponse(message)
            .then(response => {
                // 移除加载指示器
                chatContainer.removeChild(loadingDiv);
                
                // 获取响应后播放接收音效
                playSound('receiveSound');
                
                // 处理R1模型的思考过程
                if (typeof response === 'object' && response.reasoning) {
                    addThinkingProcess(response.reasoning);
                    addMessageToChat('ai', response.content);
                } else {
                    // 普通模型只添加回复
                    addMessageToChat('ai', response);
                }
                
                // 自动滚动到底部
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                // 重新启用聊天输入
                enableChatInput();
            })
            .catch(error => {
                // 移除加载指示器
                chatContainer.removeChild(loadingDiv);
                
                // 显示错误信息
                addMessageToChat('ai', '抱歉，发生了错误：' + error.message);
                
                // 自动滚动到底部
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                // 重新启用聊天输入
                enableChatInput();
            });
    }
    
    function addThinkingProcess(reasoning) {
        // 创建思考过程容器
        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message ai-thinking';
        
        // 创建思考标题
        const thinkingTitle = document.createElement('div');
        thinkingTitle.className = 'thinking-title';
        thinkingTitle.textContent = '思考过程：';
        thinkingDiv.appendChild(thinkingTitle);
        
        // 添加思考内容
        const thinkingContent = document.createElement('div');
        thinkingContent.className = 'thinking-content';
        thinkingContent.innerHTML = reasoning.replace(/\n/g, '<br>');
        thinkingDiv.appendChild(thinkingContent);
        
        // 添加到聊天容器
        chatContainer.appendChild(thinkingDiv);
    }
    
    function addMessageToChat(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'message user-message' : 'message ai-message';
        
        // 处理换行
        const formattedText = text.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedText;
        
        chatContainer.appendChild(messageDiv);
    }
    
    async function fetchDeepSeekResponse(prompt) {
        try {
            // 获取当前选择的模型
            const selectedModel = modelSelect.value;
            
            // 准备API请求参数
            let requestBody = {
                model: selectedModel, // 使用用户选择的模型
                messages: [
                    {role: 'system', content: '你是一个有用的AI助手，提供准确、有帮助的回答。'},
                    {role: 'user', content: prompt}
                ],
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            };
            
            // 为了调试，使用完整的选项
            console.log('发送请求:', requestBody);
            
            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            // 调试: 在控制台输出完整响应
            console.log('API响应:', data);
            
            if (data.error) {
                throw new Error(data.error.message || data.error);
            }
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error('未收到有效回复');
            }
            
            // 检查是否是R1模型，并且API返回了reasoning_content字段
            if (selectedModel === 'deepseek-reasoner' && data.choices[0].message.reasoning_content) {
                // 使用模型原生的思考过程
                return {
                    content: data.choices[0].message.content,
                    reasoning: data.choices[0].message.reasoning_content
                };
            }
            
            // 如果没有返回reasoning_content字段，返回普通内容
            return data.choices[0].message.content;
        } catch (error) {
            console.error('API调用失败:', error);
            throw error;
        }
    }
});
