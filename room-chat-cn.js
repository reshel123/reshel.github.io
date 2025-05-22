// 房间聊天功能的主要实现
let currentUser = null;
let currentRoomId = null;
let conversationInstance = null;
let realtime = null;
let client = null;
let isOnline = false;

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
        // 初始化LeanCloud
        if (window.AV && typeof LC_CONFIG !== 'undefined') {
            AV.init({
                appId: LC_CONFIG.appId,
                appKey: LC_CONFIG.appKey,
                serverURL: LC_CONFIG.serverURL
            });
            
            // 创建实时通信实例
            realtime = new window.Realtime({
                appId: LC_CONFIG.appId,
                appKey: LC_CONFIG.appKey,
                server: LC_CONFIG.serverURL.replace('https://', 'wss://') + '/1.2/ws',
                plugins: [window.TypedMessagesPlugin]
            });
            
            isOnline = true;
            updateOnlineStatus(true);
        } else {
            addSystemMessage('当前处于离线模式，仅支持模拟聊天');
            isOnline = false;
            updateOnlineStatus(false);
        }
    } catch (error) {
        addSystemMessage('初始化聊天服务失败，使用离线模式');
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
}

// 更新在线状态显示
function updateOnlineStatus(online) {
    if (onlineStatus) {
        if (online) {
            onlineStatus.textContent = '在线模式';
            onlineStatus.style.color = '#4caf50';
        } else {
            onlineStatus.textContent = '离线模式';
            onlineStatus.style.color = '#ff9800';
        }
    }
}

// 加入房间
function joinRoom(roomCode, username) {
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
    
    if (isOnline) {
        // 在线模式：连接到LeanCloud实时通信服务
        connectToLeanCloud(username, roomCode);
    } else {
        // 离线模式：模拟消息
        setTimeout(() => {
            addSystemMessage('连接成功，现在可以发送消息了！');
            setTimeout(() => {
                addMessage('系统', '欢迎使用聊天室功能！此版本为离线演示版。', false);
            }, 1500);
        }, 1000);
    }
}

// 连接到LeanCloud服务
function connectToLeanCloud(username, roomCode) {
    addSystemMessage('正在连接到聊天服务器...');
    
    // 释放之前的客户端连接
    if (client) {
        client.close();
        client = null;
        conversationInstance = null;
    }
    
    // 创建客户端实例
    realtime.createIMClient(username)
        .then(function(c) {
            client = c;
            addSystemMessage('已连接到服务器');
            updateOnlineStatus(true);
            
            // 查找或创建对话
            return client.getConversation('ROOM_' + roomCode)
                .catch(() => {
                    // 如果对话不存在，则创建一个新对话
                    return client.createConversation({
                        name: 'ROOM_' + roomCode,
                        unique: true,
                        members: []
                    });
                });
        })
        .then(function(conversation) {
            conversationInstance = conversation;
            
            // 监听消息
            conversation.on('message', function(message) {
                receiveMessage(message);
            });
            
            // 监听成员加入
            conversation.on('membersjoined', function(payload) {
                addSystemMessage(`用户 ${payload.members.join(', ')} 加入了房间`);
            });
            
            // 监听成员离开
            conversation.on('membersleft', function(payload) {
                addSystemMessage(`用户 ${payload.members.join(', ')} 离开了房间`);
            });
            
            // 查询在线成员与历史消息 - 修复API兼容性问题
            try {
                // 尝试使用 conversation.queryMessages (新版API)
                if (typeof conversation.queryMessages === 'function') {
                    conversation.queryMessages({
                        limit: 10,
                        type: 'text'
                    }).then(function(messages) {
                        // 显示最近的消息
                        if (messages.length > 0) {
                            addSystemMessage('加载最近的消息');
                            messages.reverse().forEach(function(message) {
                                receiveMessage(message);
                            });
                        }
                    }).catch(function(error) {
                        addSystemMessage('无法加载历史消息');
                    });
                } 
                // 尝试使用 conversation.query (旧版API)
                else if (typeof conversation.query === 'function') {
                    conversation.query({
                        limit: 10
                    }).then(function(messages) {
                        // 显示最近的消息
                        if (messages.length > 0) {
                            addSystemMessage('加载最近的消息');
                            messages.reverse().forEach(function(message) {
                                receiveMessage(message);
                            });
                        }
                    }).catch(function(error) {
                        addSystemMessage('无法加载历史消息');
                    });
                }
                // 无法查询历史消息
                else {
                    addSystemMessage('无法加载历史消息，但可以发送新消息');
                }
            } catch (error) {
                addSystemMessage('加载历史消息失败');
            }
            
            // 尝试加入对话，处理API兼容性问题
            try {
                if (typeof conversation.join === 'function') {
                    // 新版API支持join方法
                    return conversation.join();
                } else {
                    // 旧版API可能不需要显式join或使用其他方式
                    return Promise.resolve(conversation);
                }
            } catch (error) {
                return Promise.resolve(conversation);
            }
        })
        .then(function() {
            addSystemMessage('连接成功，现在可以发送消息了！');
        })
        .catch(function(error) {
            addSystemMessage('连接聊天服务器失败: ' + error.message);
            
            // 回退到离线模式
            isOnline = false;
            updateOnlineStatus(false);
            addSystemMessage('已切换到离线模式');
            
            setTimeout(() => {
                addMessage('系统', '当前处于离线模式，消息不会发送到其他用户。', false);
            }, 1000);
        });
}

// 接收消息处理
function receiveMessage(message) {
    // 不处理自己发的消息（因为已经显示在UI上了）
    if (message.from === currentUser) {
        return;
    }
    
    // 处理文本消息
    if (message instanceof AV.Realtime.TextMessage) {
        addMessage(message.from, message.text, false);
    }
    // 处理文件消息
    else if (message instanceof AV.Realtime.FileMessage) {
        const file = message._lcfile;
        addMessage(
            message.from,
            `发送了文件: ${file.name || '未命名文件'} (下载)`,
            false,
            file
        );
    }
}

// 发送消息
function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    addMessage(currentUser, text, true);
    
    // 清空输入框
    userInput.value = '';
    
    if (isOnline && conversationInstance) {
        // 在线模式：发送到LeanCloud
        const message = new AV.Realtime.TextMessage(text);
        conversationInstance.send(message)
            .catch(function(error) {
                addSystemMessage('发送失败: ' + error.message);
            });
    } else {
        // 离线模式：模拟回复
        if (Math.random() > 0.5) {
            setTimeout(() => {
                addMessage('AI助手', '这是一条自动回复消息。实际环境中，这里会显示其他用户发送的消息。', false);
            }, 1000 + Math.random() * 2000);
        }
    }
}

// 处理文件选择
function handleFileSelection() {
    if (!fileInput.files || fileInput.files.length === 0) return;
    
    const file = fileInput.files[0];
    
    if (isOnline && conversationInstance) {
        // 在线模式：上传文件到LeanCloud
        addSystemMessage(`正在上传文件: ${file.name}...`);
        
        // 创建进度条
        const progressContainer = document.createElement('div');
        progressContainer.className = 'upload-progress';
        const progressBar = document.createElement('div');
        progressBar.className = 'upload-progress-bar';
        progressContainer.appendChild(progressBar);
        chatContainer.appendChild(progressContainer);
        
        // 上传到LeanCloud
        new AV.File(file.name, file).save({
            onprogress: function(progress) {
                progressBar.style.width = Math.floor(progress.percent) + '%';
            }
        }).then(function(savedFile) {
            // 移除进度条
            chatContainer.removeChild(progressContainer);
            
            // 发送文件消息
            const message = new AV.Realtime.FileMessage(savedFile);
            addMessage(currentUser, `发送了文件: ${file.name} (${formatFileSize(file.size)})`, true);
            return conversationInstance.send(message);
        }).catch(function(error) {
            // 移除进度条
            chatContainer.removeChild(progressContainer);
            
            addSystemMessage('上传文件失败: ' + error.message);
        });
    } else {
        // 离线模式：模拟文件发送
        addMessage(currentUser, `发送了文件: ${file.name} (${formatFileSize(file.size)})`, true);
        addSystemMessage('文件处理功能在离线版本中不可用');
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

// 添加系统消息
function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// 初始化
initialize();

// 隐藏加载窗口
setTimeout(() => {
    document.getElementById('loadingOverlay').classList.add('hidden');
}, 1000);
