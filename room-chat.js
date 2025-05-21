document.addEventListener('DOMContentLoaded', function() {
    // 立即记录日志，确认脚本正在运行
    console.log('房间聊天脚本已加载');
    
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
    
    // 验证DOM元素加载情况
    console.log('DOM元素加载状态:');
    console.log('返回按钮:', backButton ? '已找到' : '未找到');
    console.log('加入房间按钮:', joinRoomButton ? '已找到' : '未找到');
    
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
    let peer = null;
    let connections = {};
    let selectedFile = null;
    
    // 跟踪连接计数
    let connectionCount = 0;
    function updateConnectionCount() {
        let count = 0;
        for (let id in connections) {
            if (connections[id] && connections[id].open) {
                count++;
            }
        }
        connectionCount = count;
        
        // 更新状态显示
        if (count === 0 && currentRoom) {
            updateConnectionStatus('connecting', '正在等待其他用户');
        } else if (count > 0) {
            updateConnectionStatus('online', `已连接 (${count})`);
        }
    }
    
    // 定期更新连接状态
    setInterval(updateConnectionCount, 5000);
    
    // 添加音效功能 - 使用系统声音
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
            // 不阻止事件传播
        });
    });
    
    // 返回主页 - 修改事件处理以确保其运行
    backButton.addEventListener('click', function(e) {
        console.log('返回按钮被点击');
        e.stopPropagation(); // 阻止事件冒泡
        
        // 关闭所有连接
        disconnect();
        
        // 重定向到主页
        window.location.href = 'index.html';
    });
    
    // 断开所有连接
    function disconnect() {
        // 关闭所有对等连接
        for (let id in connections) {
            if (connections[id]) {
                connections[id].close();
            }
        }
        connections = {};
        
        // 销毁Peer对象
        if (peer) {
            peer.destroy();
            peer = null;
        }
    }
    
    // 打开房间选择弹窗 - 修改事件处理以确保其运行
    joinRoomButton.addEventListener('click', function(e) {
        console.log('加入房间按钮被点击');
        e.stopPropagation(); // 阻止事件冒泡
        
        roomModal.classList.remove('hidden');
        roomCodeInput.focus();
        roomError.style.display = 'none';
    });
    
    // 确认进入房间
    confirmJoinButton.addEventListener('click', function() {
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
        
        // 连接到P2P网络
        connectToPeerNetwork(roomCode, name);
        
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
    
    // 连接到P2P网络
    async function connectToPeerNetwork(roomCode, userName) {
        // 显示连接消息
        addSystemMessage('正在连接聊天网络...');
        
        try {
            // 加载PeerJS库
            await loadPeerJS();
            
            // 生成唯一的PeerID（基于房间码和用户名）
            const peerId = `r${roomCode}-${userName.replace(/\s+/g, '_')}-${Math.random().toString(36).substr(2, 5)}`;
            
            // 初始化Peer - 使用更可靠的配置
            peer = new Peer(peerId, {
                debug: 2,
                // 使用多个备用服务器选项，增加连接成功率
                // 选项1: 官方PeerJS云服务器
                host: 'peerjs-server.herokuapp.com',
                secure: true,
                port: 443,
                // 选项2: 如果官方服务器失败，将自动使用以下备用服务器
                // host: '0.peerjs.com',
                // secure: true,
                // port: 443,
                config: {
                    'iceServers': [
                        // Google STUN服务器
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        // 免费TURN服务器 - 尝试多个选项以提高NAT穿透成功率
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        // Twilio STUN服务器，提供更好的全球覆盖
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });
            
            // 每个房间使用一个共享的连接密钥，这样可以找到同一房间的用户
            window.roomKey = `room-${roomCode}`;
            console.log(`房间密钥: ${window.roomKey}`);
            
            peer.on('open', function(id) {
                console.log(`已连接到PeerJS服务器，ID: ${id}`);
                addSystemMessage(`已成功连接到聊天网络`);
                roomInfo.textContent = `房间: ${roomCode} | 用户: ${userName}`;
                
                // 更新连接状态
                updateConnectionStatus('connecting', '正在连接房间');
                
                // 保存到localStorage，方便同一设备上的其他标签页发现
                try {
                    let roomUsers = JSON.parse(localStorage.getItem(window.roomKey) || '[]');
                    if (!roomUsers.includes(id)) {
                        roomUsers.push(id);
                        localStorage.setItem(window.roomKey, JSON.stringify(roomUsers));
                    }
                    console.log(`已保存到本地存储: ${window.roomKey} = ${JSON.stringify(roomUsers)}`);
                } catch (e) {
                    console.error('保存房间信息到localStorage失败:', e);
                }
                
                // 启用聊天输入
                enableChatInput();
                
                // 隐藏加入房间按钮，已经加入了
                joinRoomButton.classList.add('hidden');
                
                // 使用新的房间发现机制
                discoverRoomPeers(roomCode);
                
                // 显示加入消息（本地）
                addSystemMessage(`${userName} 已加入房间`);
            });
            
            peer.on('connection', function(conn) {
                console.log(`收到新连接请求，来自: ${conn.peer}`);
                handleNewConnection(conn);
            });
            
            peer.on('error', function(err) {
                console.error('Peer错误:', err);
                
                // 优化错误提示
                if (err.type === 'peer-unavailable') {
                    console.log('连接对方失败，可能尚未上线');
                    return; // 这不是致命错误
                } else if (err.type === 'network' || err.type === 'server-error') {
                    addSystemMessage(`网络连接不稳定，可能影响聊天体验`);
                    playSound('errorSound');
                } else {
                    addSystemMessage(`连接出现问题: ${err.type}`);
                    console.error('详细错误:', err);
                    playSound('errorSound');
                    
                    if (err.type === 'browser-incompatible') {
                        addSystemMessage('您的浏览器可能不支持WebRTC，请尝试使用Chrome、Firefox或Edge最新版本');
                    }
                }
            });
            
            peer.on('disconnected', function() {
                addSystemMessage('网络连接已断开，正在尝试重新连接...');
                updateConnectionStatus('connecting', '重新连接中...');
                playSound('errorSound');
                
                // 尝试重新连接
                setTimeout(() => {
                    if (!peer) return;
                    
                    if (peer.destroyed) {
                        connectToPeerNetwork(currentRoom, userName);
                    } else {
                        console.log('尝试重新连接...');
                        peer.reconnect();
                    }
                }, 3000);
            });
            
            peer.on('close', function() {
                addSystemMessage('聊天连接已关闭');
                updateConnectionStatus('offline', '未连接');
                disableChatInput();
                joinRoomButton.classList.remove('hidden');
                currentRoom = null;
                userName = null;
                roomInfo.textContent = '未加入房间';
            });
            
        } catch (error) {
            addSystemMessage('无法连接到聊天网络: ' + error.message);
            console.error('P2P连接错误:', error);
            playSound('errorSound');
        }
    }
    
    // 发现同一房间的其他用户
    function discoverRoomPeers(roomCode) {
        console.log(`开始发现房间 ${roomCode} 的其他用户...`);
        
        // 使用更新后的发现策略
        
        // 1. 直接连接到房间集中节点 - 固定roomId
        const roomMasterID = `room-master-${roomCode}`;
        console.log(`尝试连接到房间主节点: ${roomMasterID}`);
        
        const masterConn = peer.connect(roomMasterID, {
            reliable: true,
            metadata: {
                type: 'join',
                roomId: roomCode,
                userName: userName,
                peerId: peer.id
            }
        });
        
        masterConn.on('open', function() {
            console.log('已连接到房间主节点，正在同步成员...');
            masterConn.send({
                type: 'get_members',
                roomId: roomCode
            });
        });
        
        masterConn.on('data', function(data) {
            console.log('从房间主节点收到数据:', data);
            if (data.type === 'members' && data.roomId === roomCode) {
                console.log(`收到房间成员列表: ${JSON.stringify(data.members)}`);
                // 连接到所有成员
                if (Array.isArray(data.members)) {
                    data.members.forEach(memberId => {
                        if (memberId !== peer.id && !connections[memberId]) {
                            setTimeout(() => connectToPeer(memberId), 500);
                        }
                    });
                }
            }
        });
        
        masterConn.on('error', function(err) {
            console.log('连接到房间主节点失败，尝试自己成为主节点');
            becomeMasterNode(roomCode);
        });
        
        // 2. 尝试从localStorage获取同一房间的用户 (本地设备的其他标签页)
        try {
            let roomUsers = JSON.parse(localStorage.getItem(window.roomKey) || '[]');
            console.log(`从localStorage找到的用户: ${JSON.stringify(roomUsers)}`);
            
            // 连接到每个用户，除了自己
            roomUsers.forEach(userId => {
                if (userId !== peer.id) {
                    console.log(`尝试连接到本地存储中的用户: ${userId}`);
                    setTimeout(() => connectToPeer(userId), 1000);
                }
            });
        } catch (e) {
            console.error('读取localStorage失败:', e);
        }
    }
    
    // 成为房间主节点 - 负责帮助新成员发现已有成员
    function becomeMasterNode(roomCode) {
        const roomMasterID = `room-master-${roomCode}`;
        console.log(`尝试成为房间主节点: ${roomMasterID}`);
        
        // 尝试注册成为指定ID的节点
        const masterPeer = new Peer(roomMasterID, {
            debug: 2,
            host: 'peerjs-server.herokuapp.com',
            secure: true,
            port: 443
        });
        
        // 维护房间成员列表
        let roomMembers = [peer.id];
        
        masterPeer.on('open', function() {
            console.log(`成功注册为房间主节点: ${roomMasterID}`);
            addSystemMessage('成功创建房间连接点，其他用户现在可以加入');
            
            masterPeer.on('connection', function(conn) {
                console.log(`主节点收到新连接: ${conn.peer}`);
                
                conn.on('open', function() {
                    conn.on('data', function(data) {
                        console.log('主节点收到数据:', data);
                        
                        if (data.type === 'join') {
                            // 新成员加入
                            if (!roomMembers.includes(data.peerId)) {
                                roomMembers.push(data.peerId);
                                console.log(`新成员加入房间: ${data.peerId}`);
                                
                                // 通知所有成员有新成员加入
                                broadcastMemberUpdate();
                            }
                        } else if (data.type === 'get_members') {
                            // 请求获取成员列表
                            conn.send({
                                type: 'members',
                                roomId: roomCode,
                                members: roomMembers
                            });
                        }
                    });
                    
                    // 当连接关闭时移除成员
                    conn.on('close', function() {
                        const index = roomMembers.indexOf(conn.peer);
                        if (index > -1) {
                            roomMembers.splice(index, 1);
                            console.log(`成员离开房间: ${conn.peer}`);
                            broadcastMemberUpdate();
                        }
                    });
                });
            });
            
            // 广播成员更新
            function broadcastMemberUpdate() {
                masterPeer.connections.forEach(conns => {
                    conns.forEach(conn => {
                        if (conn.open) {
                            conn.send({
                                type: 'members',
                                roomId: roomCode,
                                members: roomMembers
                            });
                        }
                    });
                });
            }
        });
        
        masterPeer.on('error', function(err) {
            console.log('注册为主节点失败，可能已有其他主节点:', err);
            // 错误处理：可能已经有一个主节点，直接连接到它
            if (err.type === 'unavailable-id') {
                console.log('ID已被占用，尝试连接到已存在的主节点');
                
                // 重新尝试作为普通节点连接到主节点
                setTimeout(() => {
                    const masterConn = peer.connect(roomMasterID, {
                        reliable: true,
                        metadata: {
                            type: 'join',
                            roomId: roomCode,
                            userName: userName,
                            peerId: peer.id
                        }
                    });
                    
                    masterConn.on('open', function() {
                        console.log('成功连接到已存在的主节点');
                        masterConn.send({
                            type: 'get_members',
                            roomId: roomCode
                        });
                    });
                    
                    masterConn.on('data', handleMasterNodeData);
                    
                    function handleMasterNodeData(data) {
                        if (data.type === 'members' && data.roomId === roomCode) {
                            console.log(`收到房间成员列表: ${JSON.stringify(data.members)}`);
                            // 连接到所有成员
                            if (Array.isArray(data.members)) {
                                data.members.forEach(memberId => {
                                    if (memberId !== peer.id && !connections[memberId]) {
                                        setTimeout(() => connectToPeer(memberId), 500);
                                    }
                                });
                            }
                        }
                    }
                }, 1000);
            }
        });
    }
    
    // 连接到特定的对等点
    function connectToPeer(peerId) {
        if (!peer || peer.destroyed || connections[peerId]) {
            console.log(`跳过连接 - 无效的peer或已存在连接: ${peerId}`);
            return;
        }
        
        console.log(`尝试连接到对等点: ${peerId}`);
        
        try {
            // 添加连接尝试次数限制和重试逻辑
            const maxRetries = 3;
            let retryCount = 0;
            
            function attemptConnection() {
                retryCount++;
                console.log(`尝试连接到 ${peerId} (第${retryCount}次尝试)`);
                
                const conn = peer.connect(peerId, {
                    reliable: true,
                    serialization: 'json', // 确保使用JSON序列化
                    metadata: {
                        type: 'chat',
                        roomId: currentRoom,
                        userName: userName,
                        timestamp: new Date().toISOString()
                    }
                });
                
                if (!conn) {
                    console.error(`创建到 ${peerId} 的连接失败`);
                    retryIfNeeded();
                    return;
                }
                
                // 设置连接超时
                const connectionTimeout = setTimeout(() => {
                    console.log(`连接到 ${peerId} 超时`);
                    if (!connections[peerId]) {
                        retryIfNeeded();
                    }
                }, 10000); // 10秒超时
                
                conn.on('open', function() {
                    clearTimeout(connectionTimeout);
                    console.log(`已成功连接到对等点: ${peerId}`);
                    
                    // 保存连接
                    connections[peerId] = conn;
                    
                    // 发送加入消息
                    conn.send({
                        type: 'join',
                        roomId: currentRoom,
                        userName: userName,
                        timestamp: new Date().toISOString()
                    });
                    
                    // 设置心跳以保持连接活跃
                    const heartbeatInterval = setInterval(() => {
                        if (conn.open) {
                            try {
                                conn.send({ type: 'heartbeat', timestamp: new Date().getTime() });
                            } catch (e) {
                                console.log(`发送心跳到 ${peerId} 失败:`, e);
                                clearInterval(heartbeatInterval);
                            }
                        } else {
                            clearInterval(heartbeatInterval);
                        }
                    }, 30000); // 30秒发送一次心跳
                    
                    // 收到数据时
                    conn.on('data', function(data) {
                        // 忽略心跳消息的日志
                        if (data.type !== 'heartbeat') {
                            console.log(`从 ${peerId} 收到数据:`, data);
                        }
                        
                        // 处理成员列表消息
                        if (data.type === 'members' && data.roomId === currentRoom) {
                            console.log(`收到成员列表: ${JSON.stringify(data.members)}`);
                            // 连接到所有成员
                            if (Array.isArray(data.members)) {
                                data.members.forEach(memberId => {
                                    if (memberId !== peer.id && !connections[memberId]) {
                                        console.log(`从成员列表中发现新成员: ${memberId}`);
                                        connectToPeer(memberId);
                                    }
                                });
                            }
                            return;
                        }
                        
                        // 处理常规消息
                        handleIncomingMessage(data, conn.peer);
                    });
                    
                    // 连接关闭时
                    conn.on('close', function() {
                        console.log(`连接已关闭: ${peerId}`);
                        delete connections[peerId];
                        clearInterval(heartbeatInterval);
                    });
                    
                    // 连接出错时
                    conn.on('error', function(err) {
                        console.error(`连接错误 (${peerId}):`, err);
                        delete connections[peerId];
                        clearInterval(heartbeatInterval);
                    });
                });
                
                conn.on('error', function(err) {
                    clearTimeout(connectionTimeout);
                    console.error(`连接错误 (${peerId}):`, err);
                    delete connections[peerId];
                    retryIfNeeded();
                });
            }
            
            function retryIfNeeded() {
                if (retryCount < maxRetries) {
                    console.log(`将在 ${retryCount * 2} 秒后重试连接到 ${peerId}`);
                    setTimeout(attemptConnection, retryCount * 2000);
                } else {
                    console.log(`已达到最大重试次数 (${maxRetries})，放弃连接到 ${peerId}`);
                }
            }
            
            // 开始第一次连接尝试
            attemptConnection();
            
        } catch (e) {
            console.error(`尝试连接到 ${peerId} 时发生异常:`, e);
        }
    }
    
    // 修改handleIncomingMessage函数添加更多调试信息
    function handleIncomingMessage(data, peerId) {
        console.log(`处理来自 ${peerId} 的消息:`, data);
        
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'chat':
                // 如果不是自己发送的消息，则显示
                if (data.userName !== userName) {
                    addMessage('other', data.userName, data.message, new Date(data.timestamp));
                    // 播放接收消息音效
                    playSound('receiveSound');
                    console.log(`显示来自 ${data.userName} 的聊天消息`);
                } else {
                    console.log('收到自己的消息回显，忽略');
                }
                break;
                
            case 'file':
                // 如果不是自己发送的消息，则显示
                if (data.userName !== userName) {
                    // 创建文件对象
                    const fileObj = {
                        name: data.fileName,
                        size: data.fileSize,
                        type: data.fileType
                    };
                    
                    console.log(`收到来自 ${data.userName} 的文件: ${data.fileName}`);
                    
                    // 添加文件消息
                    addFileMessage('other', data.userName, fileObj, new Date(data.timestamp), data.fileData);
                    // 播放接收文件音效
                    playSound('fileSound');
                } else {
                    console.log('收到自己的文件回显，忽略');
                }
                break;
                
            case 'join':
                if (data.userName !== userName) {
                    console.log(`用户 ${data.userName} 已加入房间`);
                    addSystemMessage(`${data.userName} 已加入房间`);
                    // 播放加入房间音效
                    playSound('joinSound');
                    
                    // 将对等点的用户名保存在连接元数据中
                    if (connections[peerId]) {
                        connections[peerId].metadata = connections[peerId].metadata || {};
                        connections[peerId].metadata.userName = data.userName;
                    }
                } else {
                    console.log('收到自己的加入消息回显，忽略');
                }
                break;
                
            case 'leave':
                console.log(`用户 ${data.userName} 已离开房间`);
                addSystemMessage(`${data.userName} 已离开房间`);
                break;
                
            default:
                console.log('收到未知类型消息:', data);
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
    
    // 修改发送按钮点击事件，添加音效
    sendButton.addEventListener('click', function() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // 播放发送消息音效
        playSound('sendSound');
        
        // 创建消息对象
        const messageData = {
            type: 'chat',
            roomId: currentRoom,
            userName: userName,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        // 发送消息给所有连接的对等点
        broadcastToPeers(messageData);
        
        // 添加到自己的聊天界面
        addMessage('user', userName, message, new Date());
        
        // 清空输入框
        userInput.value = '';
        userInput.focus();
    });
    
    // 广播消息给所有连接的对等点
    function broadcastToPeers(data) {
        if (!peer) return;
        
        let count = 0;
        for (let id in connections) {
            const conn = connections[id];
            if (conn && conn.open) {
                conn.send(data);
                count++;
            }
        }
        
        // 更新连接数量
        if (connectionCount !== count) {
            connectionCount = count;
            updateConnectionCount();
        }
        
        if (count === 0) {
            console.log('没有活跃的连接，消息只在本地显示');
        } else {
            console.log(`消息已广播给 ${count} 个对等点`);
        }
    }
    
    // 修改文件按钮点击事件，添加音效
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
        // 读取文件作为Base64编码的字符串
        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                type: 'file',
                roomId: currentRoom,
                userName: userName,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                fileData: e.target.result, // Base64编码的文件数据
                timestamp: new Date().toISOString()
            };
            
            // 广播文件数据给所有连接的对等点
            broadcastToPeers(fileData);
            
            // 添加到自己的聊天界面（不包含文件数据以节省内存）
            addFileMessage('user', userName, file, new Date(), e.target.result);
            
            // 清除文件选择
            filePreviewContainer.classList.add('hidden');
            filePreviewContainer.innerHTML = '';
            fileInput.value = '';
            selectedFile = null;
        };
        
        reader.onerror = function(err) {
            addSystemMessage('读取文件时出错: ' + err);
        };
        
        // 开始读取文件
        reader.readAsDataURL(file);
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
    function addFileMessage(sender, name, file, time, fileData) {
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
        
        // 如果有文件数据，创建下载链接
        if (fileData) {
            downloadButton.addEventListener('click', function() {
                // 创建下载链接
                const link = document.createElement('a');
                link.href = fileData;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        } else {
            downloadButton.disabled = true;
            downloadButton.title = '文件数据不可用';
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
        disconnect();
    });
    
    // 添加回动态加载PeerJS库的功能
    function loadPeerJS() {
        return new Promise((resolve, reject) => {
            if (window.Peer) {
                resolve(window.Peer);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
            script.onload = () => resolve(window.Peer);
            script.onerror = () => reject(new Error('无法加载PeerJS库'));
            document.head.appendChild(script);
        });
    }
}); 