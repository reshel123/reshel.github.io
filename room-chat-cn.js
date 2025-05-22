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
    console.log(`尝试加入房间: ${roomCode}, 用户名: ${username}`);
    
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
    
    // 重置聊天元素引用，确保使用正确的DOM元素
    const chatInputElement = document.getElementById('userInput');
    const messageInput = document.getElementById('messageInput');
    if (!messageInput && chatInputElement) {
        window.messageInput = chatInputElement; // 全局保存引用，便于其他函数使用
    }
    
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
    
    // 显示详细的连接状态
    addSystemMessage(`连接信息: 用户=${username}, 房间=${roomCode}`);
    console.log('连接LeanCloud:', { user: username, room: roomCode });
    
    // 创建客户端实例
    realtime.createIMClient(username)
        .then(function(c) {
            client = c;
            addSystemMessage('已连接到服务器');
            console.log('已创建客户端:', client.id);
            updateOnlineStatus(true);
            
            // 统一房间ID格式：确保所有设备创建相同的会话ID
            // 使用固定前缀和统一的房间码格式
            var convId = 'ROOM_' + roomCode.padStart(4, '0');
            addSystemMessage(`尝试加入房间ID: ${convId}`);
            console.log('尝试加入对话:', convId);
            
            // 查找或创建对话
            return client.getConversation(convId)
                .catch(() => {
                    // 如果对话不存在，则创建一个新对话，确保唯一性
                    console.log('对话不存在，创建新对话:', convId);
                    return client.createConversation({
                        name: convId,
                        unique: true,
                        members: [username] // 强制添加自己为成员
                    });
                });
        })
        .then(function(conversation) {
            conversationInstance = conversation;
            
            // 显示会话ID信息便于调试
            addSystemMessage(`已加入房间，会话ID: ${conversation.id}`);
            console.log('已获取对话:', conversation.id);
            
            // 尝试加入对话作为成员
            if (conversation.members && conversation.members.indexOf(username) === -1) {
                console.log('用户不在成员列表中，尝试加入');
                // 确保用户在会话成员列表中
                return conversation.add([username])
                    .then(() => conversation)
                    .catch(err => {
                        console.warn('添加成员失败，但继续使用对话:', err);
                        return conversation;
                    });
            }
            
            return conversation;
        })
        .then(function(conversation) {
            console.log('设置消息监听');
            
            // 监听消息
            conversation.on('message', function(message) {
                addSystemMessage(`收到消息，来自: ${message.from}`);
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
                            addSystemMessage(`加载最近的消息: ${messages.length}条`);
                            messages.reverse().forEach(function(message) {
                                receiveMessage(message);
                            });
                        } else {
                            addSystemMessage('没有历史消息');
                        }
                    }).catch(function(error) {
                        addSystemMessage('无法加载历史消息: ' + error.message);
                    });
                } 
                // 尝试使用 conversation.query (旧版API)
                else if (typeof conversation.query === 'function') {
                    conversation.query({
                        limit: 10
                    }).then(function(messages) {
                        // 显示最近的消息
                        if (messages.length > 0) {
                            addSystemMessage(`加载最近的消息: ${messages.length}条`);
                            messages.reverse().forEach(function(message) {
                                receiveMessage(message);
                            });
                        } else {
                            addSystemMessage('没有历史消息');
                        }
                    }).catch(function(error) {
                        addSystemMessage('无法加载历史消息: ' + error.message);
                    });
                }
                // 无法查询历史消息
                else {
                    addSystemMessage('无法加载历史消息，但可以发送新消息');
                }
            } catch (error) {
                addSystemMessage('加载历史消息失败: ' + error.message);
            }
            
            // 尝试加入对话，处理API兼容性问题
            try {
                if (typeof conversation.join === 'function') {
                    // 新版API支持join方法
                    console.log('使用join方法加入对话');
                    return conversation.join();
                } else {
                    // 旧版API可能不需要显式join或使用其他方式
                    console.log('对话不支持join方法，跳过');
                    return Promise.resolve(conversation);
                }
            } catch (error) {
                addSystemMessage('加入房间时出错: ' + error.message);
                return Promise.resolve(conversation);
            }
        })
        .then(function() {
            addSystemMessage('连接成功，现在可以发送消息了！');
        })
        .catch(function(error) {
            console.error('连接聊天服务器失败:', error);
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
    // 消息调试信息
    console.log('收到消息对象:', message);
    
    try {
        // 检查消息来源
        if (!message || !message.from) {
            console.warn('收到无效消息或无发送者信息');
            return;
        }
        
        // 不处理自己发的消息（因为已经显示在UI上了）
        if (message.from === currentUser) {
            console.log('跳过自己发送的消息');
            return;
        }
        
        // 添加调试信息
        console.log(`接收消息: 发送者=${message.from}, 当前用户=${currentUser}`);
        
        // 处理文本消息
        if (message.text || (message instanceof AV.Realtime.TextMessage)) {
            // 提取消息文本 - 兼容不同SDK版本
            let messageText = message.text;
            if (typeof messageText === 'undefined' && message._lctext) {
                messageText = message._lctext;
            }
            
            if (messageText) {
                console.log(`显示文本消息: ${messageText}`);
                addMessage(message.from, messageText, false);
            }
        }
        // 处理文件消息
        else if (message.file || (message instanceof AV.Realtime.FileMessage) || message._lcfile) {
            // 提取文件信息 - 兼容不同SDK版本
            const file = message._lcfile || message.file || {};
            console.log('接收到文件消息:', file);
            
            addMessage(
                message.from,
                `发送了文件: ${file.name || '未命名文件'} (下载)`,
                false,
                file
            );
        }
        // 未知消息类型
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
    
    // 检查消息是否为空
    if (message === '') {
        addSystemMessage('消息不能为空');
        return;
    }
    
    // 检查连接状态
    if (!isOnline || !conversationInstance) {
        addSystemMessage('未连接到服务器，无法发送消息');
        addMessage(currentUser, message, true);
        messageInput.value = '';
        return;
    }
    
    try {
        // 创建文本消息
        addSystemMessage(`正在发送消息...`);
        console.log('发送消息到会话:', conversationInstance.id);
        
        conversationInstance.send(new AV.Realtime.TextMessage(message))
            .then(function(messageInstance) {
                console.log('消息发送成功:', messageInstance);
                // 在聊天界面添加消息
                addMessage(currentUser, message, true);
                // 清空输入框
                messageInput.value = '';
            })
            .catch(function(error) {
                console.error('发送消息失败:', error);
                addSystemMessage('消息发送失败: ' + error.message);
                // 尝试重新连接
                addSystemMessage('正在尝试重新连接...');
                
                // 保存消息以便重新连接后发送
                const pendingMessage = message;
                
                // 重新连接
                reconnectToLeanCloud().then(() => {
                    // 重新连接成功后再次尝试发送
                    if (conversationInstance) {
                        console.log('重新连接成功，尝试重发消息');
                        conversationInstance.send(new AV.Realtime.TextMessage(pendingMessage))
                            .then(() => {
                                addMessage(currentUser, pendingMessage, true);
                                messageInput.value = '';
                            })
                            .catch(err => {
                                console.error('重发消息失败:', err);
                                addSystemMessage('消息发送失败，请重试');
                            });
                    }
                });
            });
    } catch (error) {
        console.error('发送消息时出错:', error);
        addSystemMessage('发送消息过程出错: ' + error.message);
    }
}

// 重新连接函数
function reconnectToLeanCloud() {
    addSystemMessage('正在重新连接...');
    
    return new Promise((resolve, reject) => {
        // 释放之前的客户端连接
        if (client) {
            client.close();
            client = null;
            conversationInstance = null;
        }
        
        console.log('尝试重新连接，用户：', currentUser);
        
        // 重新创建客户端实例
        realtime.createIMClient(currentUser)
            .then(function(c) {
                client = c;
                addSystemMessage('已重新连接到服务器');
                updateOnlineStatus(true);
                
                // 获取当前房间ID - 使用存储的值而不是从DOM获取
                const roomCode = currentRoomId;
                if (!roomCode) {
                    throw new Error('无法恢复房间ID');
                }
                
                console.log('重新加入房间:', roomCode);
                const convId = 'ROOM_' + roomCode.padStart(4, '0');
                
                // 重新加入对话
                return client.getConversation(convId);
            })
            .then(function(conversation) {
                conversationInstance = conversation;
                addSystemMessage('已重新加入房间');
                console.log('已重新加入会话:', conversation.id);
                
                // 重新设置消息监听
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
                
                resolve();
            })
            .catch(function(error) {
                console.error('重新连接失败:', error);
                addSystemMessage('重新连接失败: ' + error.message);
                updateOnlineStatus(false);
                reject(error);
            });
    });
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
