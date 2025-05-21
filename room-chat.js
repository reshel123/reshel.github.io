document.addEventListener('DOMContentLoaded', function() {
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
    
    // 房间状态
    let currentRoom = null;
    let userName = null;
    let peer = null;
    let connections = {};
    let selectedFile = null;
    
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
        });
    });
    
    // 返回主页
    backButton.addEventListener('click', function() {
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
    
    // 打开房间选择弹窗
    joinRoomButton.addEventListener('click', function() {
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
            const peerId = `room-${roomCode}-${userName}-${Date.now().toString().slice(-5)}`;
            
            // 初始化Peer
            peer = new Peer(peerId, {
                debug: 2
            });
            
            peer.on('open', function(id) {
                // 连接成功，开始寻找房间内的其他用户
                addSystemMessage(`已成功连接到聊天网络`);
                roomInfo.textContent = `房间: ${roomCode} | 用户: ${userName}`;
                
                // 启用聊天输入
                enableChatInput();
                
                // 隐藏加入房间按钮，已经加入了
                joinRoomButton.classList.add('hidden');
                
                // 查找同一房间内的其他端点
                findPeersInRoom(roomCode);
                
                // 显示加入消息（本地）
                addSystemMessage(`${userName} 已加入房间`);
            });
            
            peer.on('connection', function(conn) {
                handleNewConnection(conn);
            });
            
            peer.on('error', function(err) {
                console.error('Peer错误:', err);
                
                // 优化错误提示
                if (err.type === 'peer-unavailable') {
                    // 这是正常的发现过程，不显示错误
                    console.log('尝试发现房间成员，这不是实际错误');
                    return;
                } else if (err.type === 'network' || err.type === 'server-error') {
                    addSystemMessage(`网络连接不稳定，可能影响聊天体验`);
                    playSound('errorSound');
                } else {
                    addSystemMessage(`连接出现问题，可能需要重新加入房间`);
                    playSound('errorSound');
                    
                    // 严重错误，需要重置
                    disconnect();
                    disableChatInput();
                    joinRoomButton.classList.remove('hidden');
                }
            });
            
            peer.on('disconnected', function() {
                addSystemMessage('网络连接已断开，正在尝试重新连接...');
                playSound('errorSound');
                
                // 尝试重新连接
                setTimeout(() => {
                    if (peer && peer.destroyed) {
                        connectToPeerNetwork(currentRoom, userName);
                    } else if (peer) {
                        peer.reconnect();
                    }
                }, 3000);
            });
            
            peer.on('close', function() {
                addSystemMessage('聊天连接已关闭');
                disableChatInput();
                joinRoomButton.classList.remove('hidden');
                currentRoom = null;
                userName = null;
                roomInfo.textContent = '未加入房间';
            });
            
        } catch (error) {
            addSystemMessage('无法连接到聊天网络，请检查您的网络连接');
            playSound('errorSound');
            console.error('P2P连接错误:', error);
        }
    }
    
    // 查找同一房间内的其他端点
    function findPeersInRoom(roomCode) {
        // 这里可以实现一个简单的发现机制
        // 在真实应用中，我们需要一个信令服务器或使用公共数据库来发现对等点
        // 但为了演示，我们可以尝试直接连接到一些可能在线的对等点
        
        // 在没有真正的信令服务器的情况下，我们可以尝试连接到可能已在房间里的peer
        // 使用一些常见的ID格式
        
        // 指数退避重试
        let retryCount = 0;
        const maxRetry = 5;
        const startDelay = 2000;
        
        function attemptConnection() {
            // 如果我们不再在房间里，停止尝试
            if (!currentRoom || !peer || peer.destroyed) return;
            
            // 每次尝试连接到一个随机的潜在对等点
            const targetId = `room-${roomCode}-discoveryProbe-${retryCount}`;
            
            console.log(`尝试寻找房间 ${roomCode} 中的其他成员 (尝试 ${retryCount+1}/${maxRetry})...`);
            
            // 如果成功连接，对方会向我们发送房间内所有成员的列表
            // 如果失败，我们可能是第一个加入房间的人
            const conn = peer.connect(targetId, {
                reliable: true,
                metadata: {
                    type: 'discovery',
                    roomId: roomCode,
                    userName: userName,
                    timestamp: new Date().toISOString()
                }
            });
            
            conn.on('open', function() {
                console.log('成功发现已有房间，请求成员列表');
                
                // 发送发现请求
                conn.send({
                    type: 'discovery',
                    roomId: roomCode,
                    action: 'requestPeers',
                    userName: userName,
                    peerId: peer.id,
                    timestamp: new Date().toISOString()
                });
            });
            
            conn.on('error', function(err) {
                // 不向用户显示这种错误，这是预期行为
                console.log('未找到现有房间，可能是第一个加入的用户', err);
                
                // 增加重试计数
                retryCount++;
                
                // 如果还没有达到最大重试次数，继续尝试
                if (retryCount < maxRetry) {
                    // 指数退避
                    const delay = startDelay * Math.pow(1.5, retryCount);
                    setTimeout(attemptConnection, delay);
                } else {
                    console.log('已完成房间搜索，您可能是第一个加入的用户');
                    
                    // 创建一个发现点，以便后来者能找到这个房间
                    becomeDiscoveryPoint(roomCode);
                }
            });
        }
        
        // 开始发现过程
        attemptConnection();
    }
    
    // 成为一个发现点，使后来的用户能够发现该房间
    function becomeDiscoveryPoint(roomCode) {
        // 创建一个专用的发现连接点
        const discoveryId = `room-${roomCode}-discoveryProbe-0`;
        
        try {
            // 如果可能，创建一个次要Peer作为发现点
            // 实际应用中，你可能需要使用一个持久的信令服务器或数据库
            const discoveryPeer = new Peer(discoveryId, {
                debug: 1
            });
            
            discoveryPeer.on('open', function(id) {
                console.log(`已创建房间 ${roomCode} 的发现点: ${id}`);
                
                // 将这个发现点的Peer ID保存在本地存储中
                try {
                    const roomData = JSON.parse(localStorage.getItem('roomPeers') || '{}');
                    roomData[roomCode] = roomData[roomCode] || [];
                    roomData[roomCode].push(peer.id);
                    localStorage.setItem('roomPeers', JSON.stringify(roomData));
                } catch (e) {
                    console.error('无法保存房间数据到本地存储:', e);
                }
                
                // 监听连接请求
                discoveryPeer.on('connection', function(conn) {
                    console.log('收到房间发现请求:', conn.metadata);
                    
                    conn.on('open', function() {
                        console.log('发现连接已打开，准备发送房间成员列表');
                        
                        // 监听发现请求
                        conn.on('data', function(data) {
                            if (data.type === 'discovery' && data.action === 'requestPeers') {
                                // 从本地存储中获取房间内的对等点列表
                                try {
                                    const roomData = JSON.parse(localStorage.getItem('roomPeers') || '{}');
                                    const peersList = roomData[roomCode] || [];
                                    
                                    // 发送房间内的对等点列表
                                    conn.send({
                                        type: 'discovery',
                                        roomId: roomCode,
                                        action: 'peersList',
                                        peers: peersList,
                                        timestamp: new Date().toISOString()
                                    });
                                } catch (e) {
                                    console.error('无法从本地存储获取房间数据:', e);
                                    conn.send({
                                        type: 'discovery',
                                        roomId: roomCode,
                                        action: 'peersList',
                                        peers: [peer.id], // 至少包含自己
                                        timestamp: new Date().toISOString()
                                    });
                                }
                            }
                        });
                    });
                });
            });
            
            discoveryPeer.on('error', function(err) {
                console.error('创建发现点时发生错误:', err);
                // 如果无法创建发现点，我们可以尝试其他方法
                // 例如，将自己的ID存储在localStorage中，以便同一浏览器的其他标签可以发现我们
                try {
                    const roomData = JSON.parse(localStorage.getItem('roomPeers') || '{}');
                    roomData[roomCode] = roomData[roomCode] || [];
                    roomData[roomCode].push(peer.id);
                    localStorage.setItem('roomPeers', JSON.stringify(roomData));
                } catch (e) {
                    console.error('无法保存房间数据到本地存储:', e);
                }
            });
        } catch (error) {
            console.error('创建发现点失败:', error);
        }
    }
    
    // 处理新连接
    function handleNewConnection(conn) {
        console.log('收到新连接:', conn.metadata);
        
        // 保存连接
        connections[conn.peer] = conn;
        
        conn.on('open', function() {
            console.log('连接已打开:', conn.peer);
            
            // 如果这是发现连接
            if (conn.metadata && conn.metadata.type === 'discovery') {
                // 处理发现请求
                handleDiscoveryConnection(conn);
                return;
            }
            
            // 发送欢迎消息
            conn.send({
                type: 'join',
                roomId: currentRoom,
                userName: userName,
                timestamp: new Date().toISOString()
            });
            
            // 收到数据时
            conn.on('data', function(data) {
                console.log('收到数据:', data);
                handleIncomingMessage(data, conn.peer);
            });
            
            // 连接关闭时
            conn.on('close', function() {
                console.log('连接已关闭:', conn.peer);
                delete connections[conn.peer];
                
                // 通知用户对方已离开，如果我们知道对方的用户名
                if (conn.metadata && conn.metadata.userName) {
                    addSystemMessage(`${conn.metadata.userName} 已离开房间`);
                }
            });
            
            // 连接出错时
            conn.on('error', function(err) {
                console.error('连接错误:', err);
                delete connections[conn.peer];
            });
        });
    }
    
    // 处理发现连接
    function handleDiscoveryConnection(conn) {
        conn.on('data', function(data) {
            if (data.type === 'discovery') {
                if (data.action === 'requestPeers') {
                    // 发送当前已知的对等点列表
                    const peersList = Object.keys(connections);
                    
                    // 确保自己的ID在列表中
                    if (peer && peer.id && !peersList.includes(peer.id)) {
                        peersList.push(peer.id);
                    }
                    
                    conn.send({
                        type: 'discovery',
                        roomId: currentRoom,
                        action: 'peersList',
                        peers: peersList,
                        timestamp: new Date().toISOString()
                    });
                } else if (data.action === 'peersList') {
                    // 收到对等点列表，尝试连接到其中的每一个
                    if (Array.isArray(data.peers)) {
                        data.peers.forEach(peerId => {
                            // 不要连接到自己
                            if (peerId !== peer.id && !connections[peerId]) {
                                connectToPeer(peerId);
                            }
                        });
                    }
                }
            }
        });
    }
    
    // 连接到特定的对等点
    function connectToPeer(peerId) {
        if (!peer || peer.destroyed || connections[peerId]) return;
        
        console.log('连接到对等点:', peerId);
        
        const conn = peer.connect(peerId, {
            reliable: true,
            metadata: {
                type: 'chat',
                roomId: currentRoom,
                userName: userName,
                timestamp: new Date().toISOString()
            }
        });
        
        // 保存连接
        connections[peerId] = conn;
        
        conn.on('open', function() {
            console.log('已连接到对等点:', peerId);
            
            // 发送加入消息
            conn.send({
                type: 'join',
                roomId: currentRoom,
                userName: userName,
                timestamp: new Date().toISOString()
            });
            
            // 收到数据时
            conn.on('data', function(data) {
                handleIncomingMessage(data, conn.peer);
            });
            
            // 连接关闭时
            conn.on('close', function() {
                console.log('连接已关闭:', peerId);
                delete connections[peerId];
            });
            
            // 连接出错时
            conn.on('error', function(err) {
                console.error('连接错误:', err);
                delete connections[peerId];
            });
        });
        
        conn.on('error', function(err) {
            console.error('连接错误:', err);
            delete connections[peerId];
        });
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
        
        let connectionCount = 0;
        for (let id in connections) {
            const conn = connections[id];
            if (conn && conn.open) {
                conn.send(data);
                connectionCount++;
            }
        }
        
        if (connectionCount === 0) {
            console.log('没有活跃的连接，消息只在本地显示');
        } else {
            console.log(`消息已广播给 ${connectionCount} 个对等点`);
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
    
    // 修改处理收到的消息函数，添加音效
    function handleIncomingMessage(data, peerId) {
        console.log('处理消息:', data);
        
        if (!data || !data.type) return;
        
        switch (data.type) {
            case 'chat':
                // 如果不是自己发送的消息，则显示
                if (data.userName !== userName) {
                    addMessage('other', data.userName, data.message, new Date(data.timestamp));
                    // 播放接收消息音效
                    playSound('receiveSound');
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
                    
                    // 添加文件消息
                    addFileMessage('other', data.userName, fileObj, new Date(data.timestamp), data.fileData);
                    // 播放接收文件音效
                    playSound('fileSound');
                }
                break;
                
            case 'join':
                if (data.userName !== userName) {
                    addSystemMessage(`${data.userName} 已加入房间`);
                    // 播放加入房间音效
                    playSound('joinSound');
                    
                    // 将对等点的用户名保存在连接元数据中
                    if (connections[peerId]) {
                        connections[peerId].metadata = connections[peerId].metadata || {};
                        connections[peerId].metadata.userName = data.userName;
                    }
                }
                break;
                
            case 'leave':
                addSystemMessage(`${data.userName} 已离开房间`);
                break;
                
            default:
                console.log('未知消息类型:', data);
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
