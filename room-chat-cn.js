document.addEventListener('DOMContentLoaded', function() {
    // 检查是否存在加载窗口的隐藏函数
    if (typeof window.hideLoadingOverlay === 'function') {
        // 由于页面可能在hideLoadingOverlay前加载完成，确保加载窗口正确隐藏
        setTimeout(function() {
            window.hideLoadingOverlay();
        }, 2000);
    }
    
    // DOM元素
    const chatContainer = document.getElementById('chatContainer');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const fileButton = document.getElementById('fileButton');
    const fileInput = document.getElementById('fileInput');
    const joinRoomButton = document.getElementById('joinRoomButton');
    const backButton = document.getElementById('backButton');
    const roomModal = document.getElementById('roomModal');
    const confirmJoinButton = document.getElementById('confirmJoinButton');
    const roomCodeInput = document.getElementById('roomCode');
    const userNameInput = document.getElementById('userName');
    const roomError = document.getElementById('roomError');
    const roomInfo = document.getElementById('roomInfo');
    const filePreviewContainer = document.getElementById('filePreviewContainer');
    
    // 创建连接状态指示器
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'connectionStatus';
    statusIndicator.className = 'connection-status offline';
    statusIndicator.innerHTML = '<span class="status-dot"></span><span class="status-text">未连接</span>';
    document.querySelector('.chat-header').appendChild(statusIndicator);
    
    // 添加指示器CSS样式
    const style = document.createElement('style');
    style.textContent = `
        .connection-status {
            display: flex;
            align-items: center;
            font-size: 12px;
            margin-left: 10px;
            padding: 4px 8px;
            border-radius: 12px;
            background-color: rgba(0,0,0,0.1);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .offline .status-dot {
            background-color: #ff3b30;
        }
        .connecting .status-dot {
            background-color: #ffcc00;
            animation: blink 1s infinite;
        }
        .online .status-dot {
            background-color: #34c759;
        }
        @keyframes blink {
            0% { opacity: 0.4; }
            50% { opacity: 1; }
            100% { opacity: 0.4; }
        }
    `;
    document.head.appendChild(style);
    
    // 更新连接状态
    function updateConnectionStatus(status, message) {
        const statusEl = document.getElementById('connectionStatus');
        if (!statusEl) return;
        
        statusEl.className = 'connection-status ' + status;
        statusEl.querySelector('.status-text').textContent = message;
    }
    
    // 检查SDK是否完全加载
    function checkSDKLoaded() {
        if (!window.AV) {
            addSystemMessage('LeanCloud SDK未加载，请刷新页面重试');
            updateConnectionStatus('offline', 'SDK未加载');
            return false;
        }
        
        if (!window.Realtime) {
            addSystemMessage('LeanCloud Realtime SDK未加载，请刷新页面重试');
            updateConnectionStatus('offline', 'Realtime未加载');
            return false;
        }
        
        if (!window.TextMessage || !window.FileMessage) {
            addSystemMessage('LeanCloud 消息类型未定义，请刷新页面重试');
            updateConnectionStatus('offline', '消息插件未加载');
            return false;
        }
        
        return true;
    }
    
    // 房间状态
    let currentRoom = null;
    let userName = null;
    let selectedFile = null;
    let client = null;
    let conversation = null;
    
    // LeanCloud配置
    const lcConfig = {
        appId: 'rGkLYcDc4ZlH34K4IOxKvoB7-gzGzoHsz', // 您的AppID
        appKey: 'Iq7QBHZnrJ5hn9oPapjvbdeZ',         // 您的AppKey
        serverURLs: 'https://rgklycdc.lc-cn-n1-shared.com' // 您的API服务器地址
    };
    
    // 系统消息功能提前定义，以便在初始化时可以显示错误
    function addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.textContent = text;
        
        chatContainer.appendChild(messageDiv);
        if (chatContainer.scrollTo) {
            chatContainer.scrollTo(0, chatContainer.scrollHeight);
        } else {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    // 尝试初始化LeanCloud SDK
    function initSDK() {
        // 检查SDK加载
        if (!checkSDKLoaded()) {
            addSystemMessage('SDK未正确加载，请刷新页面重试');
            return;
        }
        
        // 初始化LeanCloud
        try {
            // 确保SDK已经加载且没有初始化过
            if (!AV._config) {
                AV.init(lcConfig);
                addSystemMessage('聊天服务初始化成功！');
                updateConnectionStatus('offline', '已就绪');
            }
            
            // 启用UI
            joinRoomButton.disabled = false;
            joinRoomButton.textContent = '加入聊天';
            
        } catch (e) {
            addSystemMessage('消息服务初始化失败: ' + e.message);
            updateConnectionStatus('offline', '初始化失败');
        }
    }
    
    // 显示欢迎消息
    addSystemMessage('正在初始化聊天服务...');
    updateConnectionStatus('connecting', '正在加载');
    
    // 初始化SDK
    initSDK();
    
    // 添加音效功能
    function playSound(type) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        gainNode.gain.value = 0.1;
        
        if (type === 'sendSound') {
            oscillator.type = 'sine';
            oscillator.frequency.value = 880;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } else if (type === 'receiveSound') {
            oscillator.type = 'sine';
            oscillator.frequency.value = 440;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.type = 'sine';
                osc2.frequency.value = 523.25;
                gain2.gain.setValueAtTime(0.1, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.3);
            }, 150);
        } else if (type === 'joinSound') {
            oscillator.type = 'triangle';
            oscillator.frequency.value = 659.25;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.type = 'triangle';
                osc2.frequency.value = 783.99;
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
                    osc3.frequency.value = 987.77;
                    gain3.gain.setValueAtTime(0.1, audioContext.currentTime);
                    gain3.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
                    osc3.start();
                    osc3.stop(audioContext.currentTime + 0.3);
                }, 100);
            }, 100);
        } else if (type === 'errorSound') {
            oscillator.type = 'square';
            oscillator.frequency.value = 220;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
        } else if (type === 'fileSound') {
            oscillator.type = 'sine';
            oscillator.frequency.value = 587.33;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.4);
            
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.type = 'sine';
                osc2.frequency.value = 698.46;
                gain2.gain.setValueAtTime(0.1, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.2);
            }, 200);
        } else if (type === 'buttonSound') {
            oscillator.type = 'sine';
            oscillator.frequency.value = 600;
            gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.15);
        }
    }
    
    // 修改波纹效果函数，添加音效
    function addRippleEffect(button, e) {
        playSound('buttonSound');
        
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        button.appendChild(ripple);
        
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size/2}px`;
        ripple.style.top = `${e.clientY - rect.top - size/2}px`;
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    // 添加波纹效果到所有按钮
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            addRippleEffect(this, e);
        });
    });
    
    // 尝试加入房间的功能
    function attemptJoinRoom(roomCode, name) {
        // 如果没有传参，则从输入框获取
        if (!roomCode || !name) {
            roomCode = roomCodeInput.value.trim();
            name = userNameInput.value.trim();
        }
        
        console.log("尝试加入房间:", roomCode, name);
        
        // 验证输入
        if (!/^\d{4}$/.test(roomCode)) {
            roomError.textContent = '房间码必须是4位数字';
            roomError.style.display = 'block';
            playSound('errorSound');
            roomCodeInput.focus();
            return;
        }
        
        if (!name || name.length < 2) {
            roomError.textContent = '昵称至少需要2个字符';
            roomError.style.display = 'block';
            playSound('errorSound');
            userNameInput.focus();
            return;
        }
        
        // 保存房间信息
        currentRoom = roomCode;
        userName = name;
        
        // 连接到LeanCloud
        connectToLeanCloud(roomCode, name);
        
        // 播放加入房间音效
        playSound('joinSound');
        
        // 关闭弹窗
        roomModal.classList.add('hidden');
    }
    
    // 监听join-chat-room事件，从HTML中直接调用
    document.addEventListener('join-chat-room', function(e) {
        console.log("收到加入房间事件:", e.detail);
        attemptJoinRoom(e.detail.roomCode, e.detail.userName);
    });
    
    // 确认按钮点击处理
    confirmJoinButton.addEventListener('click', function() {
        console.log("确认按钮被点击");
        attemptJoinRoom();
    });
    
    // 加入聊天按钮点击处理
    joinRoomButton.addEventListener('click', function() {
        console.log('加入聊天按钮被点击');
        document.getElementById('roomModal').classList.remove('hidden');
        document.getElementById('roomCode').focus();
    });
    
    // 处理回车键
    roomCodeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            userNameInput.focus();
        }
    });
    
    userNameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmJoinButton.click();
        }
    });
    
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        }
    });
    
    // 连接到LeanCloud
    async function connectToLeanCloud(roomCode, userName) {
        try {
            // 显示连接消息
            addSystemMessage('正在连接聊天服务器...');
            updateConnectionStatus('connecting', '正在连接');
            
            // 创建Realtime客户端
            client = new AV.Realtime({
                appId: lcConfig.appId,
                appKey: lcConfig.appKey,
                server: lcConfig.serverURLs,
                plugins: [AV.TypedMessagesPlugin] // 注册消息类型插件
            });
            
            // 创建一个唯一ID
            const clientId = `user_${roomCode}_${Date.now().toString(36)}`;
            
            // 连接到Realtime服务
            const currentClient = await client.createIMClient(clientId);
            
            // 获取或创建对话
            const conversationId = `room_${roomCode}`;
            
            // 查询现有对话
            const query = currentClient.getQuery();
            query.equalTo('name', conversationId);
            const conversations = await query.find();
            
            if (conversations && conversations.length > 0) {
                // 加入现有对话
                conversation = conversations[0];
                await conversation.join();
            } else {
                // 创建新对话
                conversation = await currentClient.createConversation({
                    name: conversationId,
                    transient: false, // 非暂态对话，会保存消息记录
                    unique: true,
                    members: [clientId]
                });
            }
            
            // 设置用户名属性
            conversation.setAttribute('myName', userName);
            
            // 设置成功连接状态
            updateConnectionStatus('online', '已连接');
            roomInfo.textContent = `房间: ${roomCode} | 用户: ${userName}`;
            addSystemMessage(`已成功连接到聊天服务器`);
            enableChatInput();
            joinRoomButton.classList.add('hidden');
            
            // 监听用户加入
            conversation.on('membersjoined', function(payload) {
                payload.members.forEach(memberId => {
                    // 获取用户名
                    const member = conversation.members.find(m => m.id === memberId);
                    const memberName = member ? member.getAttribute('myName') || '用户' : '用户';
                    
                    if (member && member.id !== clientId) {
                        addSystemMessage(`${memberName} 已加入房间`);
                        playSound('joinSound');
                    }
                });
                
                updateOnlineUsersCount();
            });
            
            // 监听用户离开
            conversation.on('membersleft', function(payload) {
                payload.members.forEach(memberId => {
                    // 获取用户名
                    const member = conversation.members.find(m => m.id === memberId);
                    const memberName = member ? member.getAttribute('myName') || '用户' : '用户';
                    
                    if (member && member.id !== clientId) {
                        addSystemMessage(`${memberName} 已离开房间`);
                    }
                });
                
                updateOnlineUsersCount();
            });
            
            // 显示自己的加入消息
            addSystemMessage(`${userName} 已加入房间`);
            
            // 发送系统消息通知其他用户
            await conversation.send(new TextMessage(`${userName} 已加入房间`));
            
            // 监听消息
            conversation.on('message', (message) => {
                if (message.from !== clientId) {
                    handleIncomingMessage(message);
                }
            });
            
            updateOnlineUsersCount();
        } catch (error) {
            addSystemMessage('无法连接到聊天服务器: ' + error.message);
            updateConnectionStatus('offline', '连接失败');
            playSound('errorSound');
        }
    }
    
    // 处理收到的消息
    function handleIncomingMessage(message) {
        try {
            if (message instanceof TextMessage) {
                // 文本消息
                const senderName = message.getAttributes().fromName || '用户';
                addMessage('other', senderName, message.text, new Date(message.timestamp));
                playSound('receiveSound');
            } else if (message instanceof FileMessage) {
                // 文件消息
                const senderName = message.getAttributes().fromName || '用户';
                const fileInfo = {
                    name: message.getAttributes().fileName || '文件',
                    size: message.getAttributes().fileSize || 0,
                    type: message.getAttributes().fileType || 'application/octet-stream'
                };
                
                let fileUrl;
                if (message.getFile && typeof message.getFile === 'function') {
                    const file = message.getFile();
                    fileUrl = typeof file.url === 'function' ? file.url() : file.url;
                } else if (message.file && message.file.url) {
                    fileUrl = message.file.url;
                }
                
                addFileMessage('other', senderName, fileInfo, new Date(message.timestamp), fileUrl);
                playSound('fileSound');
            }
        } catch (e) {
            // 处理消息失败
            console.error('处理消息失败:', e);
            addSystemMessage('收到消息但处理失败');
        }
    }
    
    // 更新在线用户数量
    function updateOnlineUsersCount() {
        if (conversation) {
            const count = conversation.members ? conversation.members.length : 1;
            updateConnectionStatus('online', `已连接 (${count}人)`);
        }
    }
    
    // 启用聊天输入
    function enableChatInput() {
        userInput.disabled = false;
        sendButton.disabled = false;
        fileButton.disabled = false;
        userInput.placeholder = '在这里输入你的消息...';
        userInput.focus();
    }
    
    // 禁用聊天输入
    function disableChatInput() {
        userInput.disabled = true;
        sendButton.disabled = true;
        fileButton.disabled = true;
        userInput.placeholder = '请先加入房间...';
    }
    
    // 发送按钮点击事件
    sendButton.addEventListener('click', async function() {
        const message = userInput.value.trim();
        if (!message || !conversation) return;
        
        try {
            // 播放发送消息音效
            playSound('sendSound');
            
            // 创建文本消息
            const textMessage = new AV.TextMessage(message);
            textMessage.setAttributes({
                fromName: userName
            });
            
            // 发送消息
            await conversation.send(textMessage);
            
            // 显示在自己的界面上
            addMessage('user', userName, message, new Date());
            
            // 清空输入框
            userInput.value = '';
            userInput.focus();
        } catch (error) {
            addSystemMessage('发送消息失败，请重试');
            playSound('errorSound');
        }
    });
    
    // 文件按钮点击事件
    fileButton.addEventListener('click', function() {
        if (selectedFile) {
            sendFile(selectedFile);
            playSound('fileSound');
        } else {
            fileInput.click();
        }
    });
    
    // 监听文件选择
    fileInput.addEventListener('change', function(e) {
        if (this.files.length > 0) {
            const file = this.files[0];
            // 限制文件大小（10MB）
            if (file.size > 10 * 1024 * 1024) {
                addSystemMessage('文件过大，请选择小于10MB的文件');
                playSound('errorSound');
                this.value = '';
                return;
            }
            
            selectedFile = file;
            showFilePreview(file);
            playSound('buttonSound');
        }
    });
    
    // 显示文件预览
    function showFilePreview(file) {
        filePreviewContainer.innerHTML = '';
        filePreviewContainer.classList.remove('hidden');
        
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        
        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = formatFileSize(file.size);
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'file-cancel';
        cancelButton.textContent = '×';
        cancelButton.addEventListener('click', function() {
            filePreviewContainer.classList.add('hidden');
            filePreviewContainer.innerHTML = '';
            fileInput.value = '';
            selectedFile = null;
        });
        
        preview.appendChild(fileName);
        preview.appendChild(fileSize);
        preview.appendChild(cancelButton);
        filePreviewContainer.appendChild(preview);
        
        // 更改文件按钮文本
        fileButton.textContent = '发送此文件';
    }
    
    // 发送文件
    async function sendFile(file) {
        if (!conversation) return;
        
        try {
            // 显示上传状态
            addSystemMessage(`正在上传文件: ${file.name}`);
            
            // 创建LeanCloud文件对象
            const lcFile = new AV.File(file.name, file);
            
            // 上传文件
            await lcFile.save();
            
            // 创建文件消息
            const fileMessage = new AV.FileMessage(lcFile);
            fileMessage.setAttributes({
                fromName: userName,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type
            });
            
            // 发送消息
            await conversation.send(fileMessage);
            
            // 显示上传完成消息
            addSystemMessage(`文件 ${file.name} 上传完成`);
            
            // 显示在自己的界面上
            const fileUrl = lcFile.url();
            
            addFileMessage('user', userName, file, new Date(), fileUrl);
            
            // 清除文件选择
            filePreviewContainer.classList.add('hidden');
            filePreviewContainer.innerHTML = '';
            fileInput.value = '';
            selectedFile = null;
            fileButton.textContent = '选择文件';
        } catch (error) {
            addSystemMessage('文件上传失败: ' + error.message);
            playSound('errorSound');
        }
    }
    
    // 添加消息到聊天界面
    function addMessage(sender, name, text, time) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'message user-message' : 'message other-user-message';
        
        // 如果不是自己的消息，添加发送者名称
        if (sender !== 'user') {
            const senderName = document.createElement('div');
            senderName.className = 'message-sender';
            senderName.textContent = name;
            messageDiv.appendChild(senderName);
        }
        
        // 消息内容
        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = text.replace(/\n/g, '<br>');
        messageDiv.appendChild(content);
        
        // 时间戳
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(time);
        messageDiv.appendChild(timeSpan);
        
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // 添加文件消息
    function addFileMessage(sender, name, file, time, fileUrl) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'message user-message' : 'message other-user-message';
        
        // 如果不是自己的消息，添加发送者名称
        if (sender !== 'user') {
            const senderName = document.createElement('div');
            senderName.className = 'message-sender';
            senderName.textContent = name;
            messageDiv.appendChild(senderName);
        }
        
        // 文件消息内容
        const fileContent = document.createElement('div');
        fileContent.className = 'file-message';
        
        // 文件图标
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        fileIcon.innerHTML = '📎';
        fileContent.appendChild(fileIcon);
        
        // 文件信息
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        fileInfo.appendChild(fileName);
        
        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = formatFileSize(file.size);
        fileInfo.appendChild(fileSize);
        
        fileContent.appendChild(fileInfo);
        
        // 下载按钮
        const downloadButton = document.createElement('button');
        downloadButton.className = 'file-download';
        downloadButton.textContent = '下载';
        
        // 如果有文件URL，创建下载链接
        if (fileUrl) {
            downloadButton.addEventListener('click', function() {
                window.open(fileUrl, '_blank');
            });
        } else {
            downloadButton.disabled = true;
            downloadButton.title = '文件不可用';
        }
        
        fileContent.appendChild(downloadButton);
        messageDiv.appendChild(fileContent);
        
        // 时间戳
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        timeSpan.textContent = formatTime(time);
        messageDiv.appendChild(timeSpan);
        
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    }
    
    // 自动滚动到底部
    function scrollToBottom() {
        if (chatContainer.scrollTo) {
            chatContainer.scrollTo(0, chatContainer.scrollHeight);
        } else {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
    
    // 格式化时间
    function formatTime(date) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes < 1024) {
            return bytes + ' B';
        } else if (bytes < 1024 * 1024) {
            return (bytes / 1024).toFixed(1) + ' KB';
        } else {
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    }
    
    // 窗口关闭前清理连接
    window.addEventListener('beforeunload', function() {
        if (conversation) {
            conversation.quit();
        }
        
        if (client) {
            client.close();
        }
    });
}); 