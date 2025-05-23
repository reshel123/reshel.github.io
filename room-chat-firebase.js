// Firebase房间聊天功能实现
(function() {
    // 使用函数作用域变量避免全局冲突
    let currentUser = null;
    let currentRoomId = null;
    let isOnline = false;
    
    // 调试模式 - 设置为true以显示更多日志
    window.DEBUG_MODE = true;
    
    // DOM元素引用
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const joinRoomButton = document.getElementById('joinRoomButton');
    const fileButton = document.getElementById('fileButton');
    const fileInput = document.getElementById('fileInput');
    const roomInfo = document.getElementById('roomInfo');
    const onlineStatus = document.getElementById('onlineStatus');
    
    // 初始化
    function initialize() {
        try {
            console.log('开始初始化聊天功能...');
            showDebugInfo('正在初始化Firebase和通信组件');
            
            // 检查Firebase聊天桥
            if (window.firebaseChatBridge) {
                console.log('检测到Firebase聊天桥，设备ID:', window.firebaseChatBridge.deviceId);
                addSystemMessage('已启用Firebase实时数据库聊天功能');
                
                // 添加消息处理器
                window.firebaseChatBridge.addMessageHandler(function(message) {
                    console.log('收到Firebase消息:', message);
                    receiveMessage(message);
                });
                
                // 添加在线状态处理器
                window.firebaseChatBridge.addPresenceHandler(function(presence) {
                    console.log('收到Firebase在线状态:', presence);
                    if (presence.type === 'join') {
                        addSystemMessage(`用户 ${presence.user} 加入了房间`);
                    } else if (presence.type === 'leave') {
                        addSystemMessage(`用户 ${presence.user} 离开了房间`);
                    }
                });
                
                isOnline = window.firebaseChatBridge.isConnected();
                updateOnlineStatus(isOnline, window.firebaseChatBridge.isMockMode() ? '本地模式' : '在线模式（支持跨设备）');
            } else {
                console.error('Firebase聊天桥未找到，聊天功能将不可用');
                addSystemMessage('初始化聊天服务失败，Firebase聊天桥未找到');
                isOnline = false;
                updateOnlineStatus(false);
            }
            
            // 检查跨设备通信桥
            if (window.crossDevicesBridge) {
                console.log('检测到跨设备通信桥，设备ID:', window.crossDevicesBridge.deviceId);
                addSystemMessage('已启用跨设备通信功能（同一浏览器多标签页）');
                
                // 添加消息处理器
                window.crossDevicesBridge.addMessageHandler(function(message) {
                    console.log('收到跨设备消息:', message);
                    receiveMessage(message);
                });
                
                // 添加在线状态处理器
                window.crossDevicesBridge.addPresenceHandler(function(presence) {
                    console.log('收到跨设备在线状态:', presence);
                    if (presence.type === 'join') {
                        addSystemMessage(`用户 ${presence.user} 加入了房间`);
                    } else if (presence.type === 'leave') {
                        addSystemMessage(`用户 ${presence.user} 离开了房间`);
                    }
                });
                
                if (!isOnline) {
                    isOnline = true;
                    updateOnlineStatus(true, '本地模式（同网络设备）');
                }
            }
            
            // 配置本地聊天桥（用于同一浏览器不同标签页）
            if (window.chatBridge) {
                // 添加消息处理器
                window.chatBridge.addMessageHandler(function(message) {
                    console.log('收到本地通信桥消息:', message);
                    // 处理消息
                    receiveMessage(message);
                });
                
                // 添加在线状态处理器
                window.chatBridge.addPresenceHandler(function(presence) {
                    console.log('收到通信桥在线状态:', presence);
                    
                    if (presence.type === 'join') {
                        addSystemMessage(`用户 ${presence.user} 加入了房间`);
                    } else if (presence.type === 'leave') {
                        addSystemMessage(`用户 ${presence.user} 离开了房间`);
                    }
                });
                
                // 初始化本地通信桥
                if (typeof window.chatBridge.init === 'function') {
                    window.chatBridge.init();
                    console.log('本地通信桥已初始化');
                }
            }
        } catch (error) {
            console.error('初始化聊天服务失败:', error);
            addSystemMessage('初始化聊天服务失败: ' + error.message);
            isOnline = false;
            updateOnlineStatus(false);
        }
        
        // 启用加入房间按钮
        joinRoomButton.disabled = false;
        
        // 绑定发送消息事件
        sendButton.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // 绑定文件按钮事件
        fileButton.addEventListener('click', function() {
            fileInput.click();
        });
        
        // 文件选择改变时
        fileInput.addEventListener('change', handleFileSelection);
        
        // 监听房间加入事件
        document.addEventListener('join-chat-room', function(e) {
            joinRoom(e.detail.roomCode, e.detail.userName);
        });
        
        // 创建调试按钮
        createDebugButtons();
    }
    
    // 更新在线状态显示
    function updateOnlineStatus(online, mode) {
        if (onlineStatus) {
            if (online) {
                onlineStatus.textContent = mode || '在线模式';
                onlineStatus.style.color = '#4caf50';
            } else {
                onlineStatus.textContent = '离线模式';
                onlineStatus.style.color = '#ff9800';
            }
        }
    }
    
    // 加入房间
    function joinRoom(roomCode, username) {
        console.log(`[调试] 尝试加入房间: ${roomCode}, 用户名: ${username}`);
        
        // 存储当前用户信息
        currentUser = username;
        currentRoomId = roomCode;
        
        // 更新UI
        roomInfo.textContent = `房间: ${roomCode} | 用户: ${username}`;
        userInput.disabled = false;
        sendButton.disabled = false;
        fileButton.disabled = false;
        joinRoomButton.textContent = '更换房间';
        
        // 清除旧消息
        while (chatContainer.firstChild) {
            if (chatContainer.firstChild.className === 'welcome-message') {
                break;
            }
            chatContainer.removeChild(chatContainer.firstChild);
        }
        
        // 添加系统消息
        addSystemMessage(`欢迎 ${username} 加入房间 ${roomCode}`);
        
        // 使用Firebase聊天桥加入房间
        if (window.firebaseChatBridge) {
            const success = window.firebaseChatBridge.joinRoom(roomCode, username);
            console.log('Firebase聊天桥加入结果:', success);
            
            if (success) {
                addSystemMessage('已连接到Firebase实时数据库，支持跨设备通信');
            } else {
                addSystemMessage('连接Firebase失败，使用本地通信模式');
            }
        } else {
            addSystemMessage('Firebase聊天桥不可用，使用本地通信模式');
        }
        
        // 也通过本地通信桥和跨设备桥加入
        if (window.crossDevicesBridge) {
            window.crossDevicesBridge.join(roomCode, username);
        }
        
        if (window.chatBridge) {
            window.chatBridge.join(roomCode, username);
        }
    }
    
    // 接收消息处理
    function receiveMessage(message) {
        // 消息调试信息
        console.log('收到消息对象:', message);
        showDebugInfo(`收到消息: ${message.from}, 类型: ${message.type || '未知'}, ID: ${message.id || '无ID'}`);
        
        try {
            // 检查消息来源
            if (!message || !message.from) {
                console.warn('收到无效消息或无发送者信息');
                return;
            }
            
            // 不处理自己发的消息（已在UI中显示）
            if (message.deviceId === window.firebaseChatBridge?.deviceId) {
                console.log('跳过自己发送的消息');
                return;
            }
            
            // 添加调试信息
            console.log(`接收消息: 发送者=${message.from}, 当前用户=${currentUser}`);
            
            // 处理不同类型的消息
            if (message.type === 'text' || message.text) {
                // 文本消息
                addMessage(message.from, message.text, false);
            }
            else if (message.type === 'file' || message.fileName) {
                // 文件消息
                addMessage(
                    message.from,
                    `发送了文件: ${message.fileName || '未命名文件'} (下载)`,
                    false,
                    {
                        name: message.fileName,
                        size: message.fileSize,
                        url: message.fileUrl,
                        type: message.fileType
                    }
                );
            }
            else if (message.type === 'system' || message.type === 'join' || message.type === 'leave') {
                // 系统消息，不需额外处理，已由presence handler处理
            }
            else {
                console.warn('收到未知类型消息:', message);
                addSystemMessage(`收到来自 ${message.from} 的未知类型消息`);
            }
        } catch (error) {
            console.error('处理接收消息时出错:', error);
            addSystemMessage('处理收到的消息时出错: ' + error.message);
        }
    }
    
    // 发送消息
    function sendMessage() {
        // 获取正确的消息输入元素
        var messageInput = document.getElementById('userInput');
        if (!messageInput) {
            console.error('无法找到消息输入元素');
            addSystemMessage('发送消息失败：无法找到输入框');
            return;
        }
        
        var message = messageInput.value.trim();
        console.log(`尝试发送消息: "${message}"`);
        showDebugInfo(`尝试发送消息: "${message}", 当前用户: ${currentUser}, 房间ID: ${currentRoomId}`);
        
        // 检查消息是否为空
        if (message === '') {
            addSystemMessage('消息不能为空');
            return;
        }
        
        // 清空输入框
        messageInput.value = '';
        
        // 在UI中显示消息
        addMessage(currentUser, message, true);
        
        // 通过Firebase发送消息
        let firebaseSent = false;
        if (window.firebaseChatBridge) {
            firebaseSent = window.firebaseChatBridge.sendText(message);
            console.log('Firebase发送结果:', firebaseSent);
        }
        
        // 通过本地通信桥发送
        let localSent = false;
        if (window.crossDevicesBridge) {
            localSent = window.crossDevicesBridge.sendText(message);
        }
        
        if (window.chatBridge) {
            localSent = window.chatBridge.sendText(message) || localSent;
        }
        
        // 如果所有方式都失败，显示错误
        if (!firebaseSent && !localSent) {
            addSystemMessage('消息发送失败：所有通信方式均不可用');
        }
    }
    
    // 处理文件选择
    function handleFileSelection() {
        if (!fileInput.files || fileInput.files.length === 0) return;
        
        const file = fileInput.files[0];
        
        // 在UI中显示文件消息
        addMessage(currentUser, `发送了文件: ${file.name} (${formatFileSize(file.size)})`, true);
        
        // 通过Firebase上传文件
        if (window.firebaseChatBridge && typeof window.firebaseChatBridge.uploadFile === 'function') {
            // 创建进度条
            const progressContainer = document.createElement('div');
            progressContainer.className = 'upload-progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'upload-progress-bar';
            progressContainer.appendChild(progressBar);
            chatContainer.appendChild(progressContainer);
            
            // 上传到Firebase Storage
            window.firebaseChatBridge.uploadFile(file)
                .then(function(fileInfo) {
                    // 移除进度条
                    chatContainer.removeChild(progressContainer);
                    console.log('文件上传成功:', fileInfo);
                })
                .catch(function(error) {
                    // 移除进度条
                    chatContainer.removeChild(progressContainer);
                    console.error('上传文件失败:', error);
                    addSystemMessage('上传文件失败: ' + error.message);
                });
        } else {
            addSystemMessage('文件上传功能不可用');
        }
        
        // 清除选择
        fileInput.value = null;
    }
    
    // 添加消息到聊天窗口
    function addMessage(sender, message, isCurrentUser, fileData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isCurrentUser ? 'user-message' : 'other-user-message'}`;
        
        const nameSpan = document.createElement('div');
        nameSpan.className = 'message-sender';
        nameSpan.textContent = sender;
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(nameSpan);
        
        // 如果是文件消息
        if (fileData) {
            const fileElem = document.createElement('div');
            fileElem.className = 'file-message';
            
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = '📎';
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = fileData.name || '未命名文件';
            
            const fileSize = document.createElement('div');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(fileData.size || 0);
            
            const fileDownload = document.createElement('a');
            fileDownload.className = 'file-download';
            fileDownload.href = fileData.url || '#';
            fileDownload.target = '_blank';
            fileDownload.textContent = '下载';
            
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);
            
            fileElem.appendChild(fileIcon);
            fileElem.appendChild(fileInfo);
            fileElem.appendChild(fileDownload);
            
            messageDiv.appendChild(fileElem);
        } else {
            // 文本消息
            const contentDiv = document.createElement('div');
            contentDiv.textContent = message;
            messageDiv.appendChild(contentDiv);
        }
        
        messageDiv.appendChild(timeSpan);
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // 添加系统消息，带文本颜色
    function addSystemMessage(message, color) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = message;
        
        if (color) {
            messageDiv.style.color = color;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    // 创建调试按钮
    function createDebugButtons() {
        try {
            // 创建连接信息按钮
            const infoBtn = document.createElement('button');
            infoBtn.innerHTML = '连接信息';
            infoBtn.className = 'debug-button';
            infoBtn.style.position = 'fixed';
            infoBtn.style.top = '10px';
            infoBtn.style.right = '10px';
            infoBtn.style.zIndex = '9999';
            infoBtn.style.background = '#2196f3';
            infoBtn.style.color = 'white';
            infoBtn.style.padding = '5px 10px';
            infoBtn.style.border = 'none';
            infoBtn.style.borderRadius = '4px';
            infoBtn.style.cursor = 'pointer';
            
            // 点击显示连接信息
            infoBtn.addEventListener('click', function() {
                showConnectionInfo();
            });
            
            document.body.appendChild(infoBtn);
        } catch (e) {
            console.warn('创建调试按钮失败:', e);
        }
    }
    
    // 显示连接信息
    function showConnectionInfo() {
        let info = '连接信息：\n';
        info += `房间ID: ${currentRoomId || '未加入'}\n`;
        info += `用户名: ${currentUser || '未设置'}\n`;
        info += `在线状态: ${isOnline ? '在线' : '离线'}\n`;
        
        if (window.firebaseChatBridge) {
            info += `Firebase设备ID: ${window.firebaseChatBridge.deviceId || '未知'}\n`;
            info += `Firebase模拟模式: ${window.firebaseChatBridge.isMockMode() ? '是' : '否'}\n`;
        }
        
        if (window.crossDevicesBridge) {
            info += `跨设备桥设备ID: ${window.crossDevicesBridge.deviceId || '未知'}\n`;
        }
        
        alert(info);
        
        // 同时在控制台输出更详细信息
        console.log('========== 连接详细信息 ==========');
        console.log('房间ID:', currentRoomId);
        console.log('用户名:', currentUser);
        console.log('在线状态:', isOnline);
        console.log('Firebase聊天桥:', window.firebaseChatBridge);
        console.log('跨设备通信桥:', window.crossDevicesBridge);
        console.log('本地通信桥:', window.chatBridge);
        console.log('==================================');
    }
    
    // 显示详细的调试信息
    function showDebugInfo(message) {
        if (window.DEBUG_MODE) {
            console.log('[调试]', message);
            addSystemMessage(`[调试] ${message}`, '#2196f3');
        }
    }
    
    // 初始化
    initialize();
    
    // 隐藏加载窗口
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 1000);
})(); 