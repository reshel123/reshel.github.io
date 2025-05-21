document.addEventListener('DOMContentLoaded', function() {
    console.log('房间聊天(Firebase版)脚本已加载');
    
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
    
    // 房间状态
    let currentRoom = null;
    let userName = null;
    let selectedFile = null;
    let roomRef = null;
    let roomUsersRef = null;
    let storageRef = null;
    let userPresenceRef = null;
    let onlineUsers = {};
    
    // Firebase配置
    const firebaseConfig = {
        apiKey: "AIzaSyBKTbhvL9Cy0SFQ8ury9kj0Tm-HqPNkUYA",
        authDomain: "deepseek-chat-demo.firebaseapp.com",
        projectId: "deepseek-chat-demo",
        storageBucket: "deepseek-chat-demo.appspot.com",
        messagingSenderId: "109453596181",
        appId: "1:109453596181:web:44a02495b22c34d1f4e19e",
        databaseURL: "https://deepseek-chat-demo-default-rtdb.firebaseio.com"
    };
    
    // 初始化Firebase
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase已初始化');
    } catch (e) {
        console.error('Firebase初始化错误:', e);
        addSystemMessage('Firebase初始化失败，请检查网络连接');
    }
    
    // 添加音效功能
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
        } else if (type === 'joinSound') {
            // 加入房间音效 - 三连音
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
        } else if (type === 'fileSound') {
            // 文件相关音效 - 较独特的声音
            oscillator.type = 'sine';
            oscillator.frequency.value = 587.33; // D5音
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.4);
            
            // 添加第二个音调
            setTimeout(() => {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                
                osc2.type = 'sine';
                osc2.frequency.value = 698.46; // F5音
                gain2.gain.setValueAtTime(0.1, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
                osc2.start();
                osc2.stop(audioContext.currentTime + 0.2);
            }, 200);
        } else if (type === 'buttonSound') {
            // 普通按钮点击音效
            oscillator.type = 'sine';
            oscillator.frequency.value = 600; // 约D5音
            gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.15);
        }
    }
    
    // 修改波纹效果函数，添加音效
    function addRippleEffect(button, e) {
        // 播放按钮点击音效
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
    
    // 确认进入房间
    confirmJoinButton.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const roomCode = roomCodeInput.value.trim();
        const name = userNameInput.value.trim();
        
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
        
        // 连接到Firebase
        connectToFirebase(roomCode, name);
        
        // 播放加入房间音效
        playSound('joinSound');
        
        // 关闭弹窗
        roomModal.classList.add('hidden');
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
    
    // 连接到Firebase
    function connectToFirebase(roomCode, userName) {
        try {
            // 显示连接消息
            addSystemMessage('正在连接聊天服务器...');
            updateConnectionStatus('connecting', '正在连接');
            
            // 引用房间数据
            roomRef = firebase.database().ref('rooms/' + roomCode);
            
            // 引用房间用户
            roomUsersRef = firebase.database().ref('room-users/' + roomCode);
            
            // 存储引用
            storageRef = firebase.storage().ref('rooms/' + roomCode);
            
            // 更新用户状态
            const userId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            userPresenceRef = roomUsersRef.child(userId);
            
            // 设置用户信息
            userPresenceRef.set({
                userName: userName,
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            
            // 设置用户离线时自动移除
            userPresenceRef.onDisconnect().remove();
            
            // 监听在线用户变化
            roomUsersRef.on('child_added', function(snapshot) {
                const userData = snapshot.val();
                if (userData.userName !== userName) {
                    onlineUsers[snapshot.key] = userData;
                    addSystemMessage(`${userData.userName} 已加入房间`);
                    playSound('joinSound');
                }
                updateOnlineUsersCount();
            });
            
            roomUsersRef.on('child_removed', function(snapshot) {
                const userData = snapshot.val();
                if (userData && userData.userName !== userName) {
                    delete onlineUsers[snapshot.key];
                    addSystemMessage(`${userData.userName} 已离开房间`);
                }
                updateOnlineUsersCount();
            });
            
            // 监听消息
            roomRef.on('child_added', function(snapshot) {
                const data = snapshot.val();
                
                // 忽略旧消息
                const messageTime = new Date(data.timestamp);
                const joinTime = new Date();
                const timeDiff = joinTime - messageTime;
                
                // 只显示最近5分钟内的消息或加入后的新消息
                if (timeDiff < 5 * 60 * 1000 || messageTime > joinTime) {
                    if (data.type === 'chat') {
                        // 文本消息
                        const isUser = data.userName === userName;
                        addMessage(isUser ? 'user' : 'other', data.userName, data.message, new Date(data.timestamp));
                        if (!isUser) {
                            playSound('receiveSound');
                        }
                    } else if (data.type === 'file') {
                        // 文件消息
                        const isUser = data.userName === userName;
                        if (!isUser) {
                            addFileMessage('other', data.userName, {
                                name: data.fileName,
                                size: data.fileSize,
                                type: data.fileType
                            }, new Date(data.timestamp), data.fileUrl);
                            playSound('fileSound');
                        }
                    }
                }
            });
            
            // 监听连接状态
            const connectedRef = firebase.database().ref('.info/connected');
            connectedRef.on('value', function(snap) {
                if (snap.val() === true) {
                    updateConnectionStatus('online', '已连接');
                    roomInfo.textContent = `房间: ${roomCode} | 用户: ${userName}`;
                    addSystemMessage(`已成功连接到聊天服务器`);
                    
                    // 启用聊天输入
                    enableChatInput();
                    
                    // 隐藏加入房间按钮
                    joinRoomButton.classList.add('hidden');
                    
                    // 显示自己的加入消息
                    addSystemMessage(`${userName} 已加入房间`);
                } else {
                    updateConnectionStatus('connecting', '正在重连...');
                }
            });
        } catch (error) {
            console.error('连接Firebase错误:', error);
            addSystemMessage('无法连接到聊天服务器: ' + error.message);
            updateConnectionStatus('offline', '连接失败');
            playSound('errorSound');
        }
    }
    
    // 更新在线用户数量
    function updateOnlineUsersCount() {
        const count = Object.keys(onlineUsers).length;
        updateConnectionStatus('online', `已连接 (${count + 1}人)`);
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
    sendButton.addEventListener('click', function() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // 播放发送消息音效
        playSound('sendSound');
        
        // 创建消息对象
        const messageData = {
            type: 'chat',
            userName: userName,
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        // 发送消息到Firebase
        roomRef.push(messageData).then(() => {
            console.log('消息已发送');
        }).catch(error => {
            console.error('发送消息失败:', error);
            addSystemMessage('发送消息失败，请重试');
            playSound('errorSound');
        });
        
        // 添加到自己的聊天界面 - 但在收到Firebase事件后也会显示
        // addMessage('user', userName, message, new Date());
        
        // 清空输入框
        userInput.value = '';
        userInput.focus();
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
        fileButton.textContent = '发送文件';
    }
    
    // 发送文件
    function sendFile(file) {
        // 显示上传状态
        addSystemMessage(`正在上传文件: ${file.name}`);
        
        // 创建唯一的文件名
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExtension}`;
        
        // 创建上传任务
        const uploadTask = storageRef.child(uniqueFileName).put(file);
        
        // 监控上传进度
        uploadTask.on('state_changed', 
            (snapshot) => {
                // 显示进度
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('上传进度: ' + progress.toFixed(0) + '%');
            }, 
            (error) => {
                // 处理错误
                console.error('文件上传失败:', error);
                addSystemMessage('文件上传失败，请重试');
                playSound('errorSound');
            }, 
            () => {
                // 上传完成
                addSystemMessage(`文件 ${file.name} 上传完成`);
                
                // 获取下载URL
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log('文件可下载地址:', downloadURL);
                    
                    // 发送文件消息
                    const fileMessage = {
                        type: 'file',
                        userName: userName,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        fileUrl: downloadURL,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    };
                    
                    // 发送到Firebase
                    roomRef.push(fileMessage);
                    
                    // 在本地显示
                    addFileMessage('user', userName, file, new Date(), downloadURL);
                    
                    // 清除文件选择
                    filePreviewContainer.classList.add('hidden');
                    filePreviewContainer.innerHTML = '';
                    fileInput.value = '';
                    selectedFile = null;
                    fileButton.textContent = '发送文件';
                });
            }
        );
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
    
    // 添加系统消息
    function addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.textContent = text;
        
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
        chatContainer.scrollTop = chatContainer.scrollHeight;
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
        if (userPresenceRef) {
            userPresenceRef.remove();
        }
        
        if (roomRef) {
            roomRef.off();
        }
        
        if (roomUsersRef) {
            roomUsersRef.off();
        }
    });
}); 