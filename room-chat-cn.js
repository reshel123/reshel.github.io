// 房间聊天功能的主要实现
let chatCurrentUser = null;
let chatRoomId = null;
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
        // 检查是否有跨设备通信桥
        if (window.crossDevicesBridge) {
            console.log('检测到跨设备通信桥，设备ID:', window.crossDevicesBridge.deviceId);
            addSystemMessage('已启用跨设备通信功能（仅支持同一浏览器不同标签页）');
            
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
            
            isOnline = true;
            updateOnlineStatus(true, '本地模式（同浏览器）');
        }
        
        // 始终尝试初始化LeanCloud，用于真正的跨设备通信
        if (window.AV && typeof LC_CONFIG !== 'undefined') {
            console.log('初始化LeanCloud SDK，配置:', LC_CONFIG);
            
            try {
                // 确保清除任何旧的初始化
                if (window.AV._appId) {
                    console.warn('检测到AV已初始化，尝试重置SDK状态');
                }
                
                AV.init({
                    appId: LC_CONFIG.appId,
                    appKey: LC_CONFIG.appKey,
                    serverURL: LC_CONFIG.serverURL
                });
                
                // 创建实时通信实例
                realtime = new window.Realtime({
                    appId: LC_CONFIG.appId,
                    appKey: LC_CONFIG.appKey,
                    server: LC_CONFIG.serverURL ? LC_CONFIG.serverURL.replace('https://', 'wss://') + '/1.2/ws' : null,
                    plugins: [window.TypedMessagesPlugin]
                });
                
                console.log('LeanCloud实时通信SDK已初始化（用于真正的跨设备通信）');
                
                // 检查连接性
                setTimeout(checkLeancloudConnection, 1000);
                
                isOnline = true;
                updateOnlineStatus(true, '在线模式（支持跨设备）');
            } catch (error) {
                console.error('初始化LeanCloud SDK失败:', error);
                addSystemMessage('初始化在线服务失败: ' + error.message);
                setupMockSDK(); // 设置模拟SDK
            }
        } else {
            console.warn('LeanCloud SDK不可用，使用离线模式');
            if (!window.crossDevicesBridge) {
                addSystemMessage('当前处于完全离线模式，仅支持单设备聊天');
                isOnline = false;
                updateOnlineStatus(false);
            }
            setupMockSDK(); // 设置模拟SDK
        }
    } catch (error) {
        console.error('初始化聊天服务失败:', error);
        addSystemMessage('初始化聊天服务失败，使用离线模式');
        isOnline = false;
        updateOnlineStatus(false);
        setupMockSDK(); // 设置模拟SDK
    }
    
    // 配置本地聊天桥（用于同一浏览器不同标签页）
    if (window.chatBridge) {
        // 添加消息处理器
        window.chatBridge.addMessageHandler(function(message) {
            console.log('收到通信桥消息:', message);
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

// 设置模拟SDK，在LeanCloud不可用时提供基本功能
function setupMockSDK() {
    console.log('设置模拟SDK以提供基本功能');
    
    // 如果全局对象不存在，创建它们
    if (!window.AV) window.AV = {};
    if (!window.Realtime) window.Realtime = function() { this.createIMClient = createMockIMClient; };
    
    // 创建模拟客户端
    function createMockIMClient(clientId) {
        console.log('创建模拟客户端:', clientId);
        return Promise.resolve({
            id: clientId,
            on: function(event, callback) {
                console.log('模拟客户端注册事件:', event);
                // 存储事件回调，可能需要时触发
                if (!this._eventCallbacks) this._eventCallbacks = {};
                if (!this._eventCallbacks[event]) this._eventCallbacks[event] = [];
                this._eventCallbacks[event].push(callback);
            },
            getConversation: function(convId) {
                console.log('模拟获取会话:', convId);
                // 返回一个模拟会话对象
                return Promise.resolve(createMockConversation(convId, clientId));
            },
            createConversation: function(options) {
                console.log('模拟创建会话:', options);
                return Promise.resolve(createMockConversation(options.id || 'mock_conv_' + Date.now(), clientId));
            }
        });
    }
    
    // 创建模拟会话
    function createMockConversation(convId, clientId) {
        return {
            id: convId,
            name: convId,
            members: [clientId],
            _messageListeners: [],
            on: function(event, callback) {
                console.log('模拟会话注册事件:', event);
                if (event === 'message') {
                    this._messageListeners.push(callback);
                }
                // 存储其他事件回调
                if (!this._eventCallbacks) this._eventCallbacks = {};
                if (!this._eventCallbacks[event]) this._eventCallbacks[event] = [];
                this._eventCallbacks[event].push(callback);
            },
            send: function(message) {
                console.log('模拟发送消息:', message);
                // 这里只模拟成功，实际不会发送到其他客户端
                return Promise.resolve(message);
            },
            join: function() {
                console.log('模拟加入会话');
                return Promise.resolve();
            },
            add: function(members) {
                console.log('模拟添加成员:', members);
                this.members = this.members.concat(members);
                return Promise.resolve();
            },
            queryMessages: function() {
                console.log('模拟查询消息');
                return Promise.resolve([]);
            }
        };
    }
    
    // 创建模拟TextMessage类
    if (!window.AV.Realtime) window.AV.Realtime = {};
    window.AV.Realtime.TextMessage = function(text) {
        this._lctext = text;
        this.text = text;
        this.from = chatCurrentUser || 'unknown';
        this.timestamp = Date.now();
    };
    
    // 设置模拟Realtime实例
    realtime = new window.Realtime();
    console.log('模拟SDK设置完成');
}

// 检查LeanCloud连接状态
function checkLeancloudConnection() {
    if (!window.AV || !realtime) {
        console.warn('LeanCloud SDK未初始化，无法检查连接');
        isOnline = false;
        updateOnlineStatus(false);
        return;
    }
    
    // 创建一个临时客户端检查连接
    realtime.createIMClient('connection_test_' + Date.now())
        .then(tempClient => {
            console.log('LeanCloud连接检查成功');
            tempClient.close();
            isOnline = true;
            updateOnlineStatus(true);
        })
        .catch(err => {
            console.error('LeanCloud连接检查失败:', err);
            addSystemMessage('与聊天服务器连接失败，切换到离线模式');
            isOnline = false;
            updateOnlineStatus(false);
        });
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
    chatCurrentUser = username;
    chatRoomId = roomCode;
    
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
    
    // 服务端房间ID格式
    const formattedRoomId = 'ROOM_' + roomCode.padStart(4, '0');
    
    // 首先尝试加入跨设备通信桥（仅同一浏览器不同标签页有效）
    if (window.crossDevicesBridge) {
        console.log('[调试] 检测到跨设备通信桥可用');
        console.log('[调试] 尝试通过跨设备通信桥加入房间:', formattedRoomId);
        
        try {
            const success = window.crossDevicesBridge.join(formattedRoomId, username);
            console.log('[调试] 跨设备通信桥加入结果:', success);
            
            if (success) {
                console.log('[调试] 已加入跨设备通信房间:', formattedRoomId);
                addSystemMessage('已启用同一浏览器多标签页通信');
                
                // 也加入本地通信桥，同时支持两种模式
                if (window.chatBridge) {
                    window.chatBridge.join(formattedRoomId, username);
                    console.log('[调试] 同时加入本地通信桥');
                }
            } else {
                console.warn('[调试] 跨设备通信桥加入房间失败，切换到LeanCloud模式');
            }
        } catch (e) {
            console.error('[调试] 加入跨设备通信桥出错:', e);
        }
    } else {
        console.warn('[调试] 跨设备通信桥不可用');
    }
    
    // 使用本地聊天桥加入房间（同一浏览器不同标签）
    if (window.chatBridge) {
        console.log('[调试] 尝试通过本地通信桥加入房间:', formattedRoomId);
        
        try {
            const success = window.chatBridge.join(formattedRoomId, username);
            console.log('[调试] 本地通信桥加入结果:', success);
        } catch (e) {
            console.error('[调试] 加入本地通信桥出错:', e);
        }
    } else {
        console.warn('[调试] 本地通信桥不可用');
    }
    
    // 始终尝试使用LeanCloud连接（真正跨设备通信）
    if (window.AV && realtime) {
        // 在线模式：连接到LeanCloud实时通信服务
        addSystemMessage('正在连接跨设备服务器，请稍候...');
        connectToLeanCloud(username, roomCode);
    } else {
        // 离线模式：模拟消息
        setTimeout(() => {
            addSystemMessage('警告：未能连接到跨设备服务器，跨设备通信可能不可用');
            setTimeout(() => {
                addMessage('系统', '当前仅支持同一浏览器内的聊天。跨设备通信需要配置LeanCloud服务。', false);
            }, 1500);
        }, 1000);
    }
}

// 连接到LeanCloud服务
function connectToLeanCloud(username, roomCode) {
    addSystemMessage('正在连接到跨设备通信服务器...');
    
    // 释放之前的客户端连接
    if (client) {
        try {
            client.close();
        } catch (e) {
            console.warn('关闭旧连接时出错:', e);
        }
        client = null;
        conversationInstance = null;
    }
    
    // 显示详细的连接状态
    addSystemMessage(`连接信息: 用户=${username}, 房间=${roomCode}`);
    console.log('连接LeanCloud:', { user: username, room: roomCode });
    
    // 设置连接超时
    let connectionTimeout = setTimeout(() => {
        addSystemMessage('连接超时，已切换到离线模式');
        updateOnlineStatus(false, '连接超时');
        setupOfflineMode(username, roomCode);
    }, 15000);
    
    // 尝试创建客户端实例
    try {
        // 检查SDK可用性
        if (!window.AV || !realtime || !window.Realtime) {
            clearTimeout(connectionTimeout);
            throw new Error('聊天SDK未正确加载');
        }
        
        realtime.createIMClient(username)
            .then(function(c) {
                clearTimeout(connectionTimeout);
                client = c;
                addSystemMessage('已连接到跨设备通信服务器');
                console.log('已创建客户端:', client.id);
                updateOnlineStatus(true, '在线（跨设备模式）');
                
                // 设置客户端断线监听 - 使用安全的方式
                try {
                    // 检查on方法是否存在
                    if (typeof client.on === 'function') {
                        client.on('disconnect', function() {
                            console.warn('客户端连接已断开');
                            addSystemMessage('与跨设备服务器连接断开，尝试重连...');
                            updateOnlineStatus(false, '连接断开');
                        });
                        
                        client.on('reconnect', function() {
                            console.log('客户端已重连接');
                            addSystemMessage('已重新连接到跨设备服务器');
                            updateOnlineStatus(true, '在线（跨设备模式）');
                        });
                        
                        client.on('reconnecterror', function(error) {
                            console.error('客户端重连失败:', error);
                            addSystemMessage('重连失败: ' + error.message);
                            updateOnlineStatus(false, '重连失败');
                            
                            // 切换到离线模式
                            setupOfflineMode(username, roomCode);
                        });
                    } else {
                        console.warn('客户端不支持事件监听 (client.on 方法不存在)');
                        addSystemMessage('已切换到简单模式，某些自动重连功能可能不可用');
                    }
                } catch (error) {
                    console.error('设置事件监听器时出错:', error);
                }
                
                // 统一房间ID格式：确保所有设备创建相同的会话ID
                var convId = 'ROOM_' + roomCode.padStart(4, '0');
                addSystemMessage(`尝试加入跨设备房间: ${convId}`);
                console.log('尝试加入对话:', convId);
                
                // 查找对话
                return client.getConversation(convId)
                    .then(conversation => {
                        console.log('找到现有对话:', conversation.id);
                        return conversation;
                    })
                    .catch(() => {
                        // 对话不存在，创建新对话
                        console.log('对话不存在，创建新对话:', convId);
                        return client.createConversation({
                            name: roomCode,
                            unique: true,
                            id: convId,
                            members: [username]
                        });
                    });
            })
            .then(function(conversation) {
                conversationInstance = conversation;
                
                // 显示会话ID信息便于调试
                addSystemMessage(`已获取跨设备房间，会话ID: ${conversation.id}`);
                console.log('已获取对话:', conversation.id);
                
                // 确认自己是否在成员列表中
                const isMember = conversation.members && 
                                 conversation.members.indexOf(username) !== -1;
                
                // 如果不是成员，尝试加入
                if (!isMember && typeof conversation.add === 'function') {
                    console.log('用户不在成员列表中，尝试加入');
                    return conversation.add([username])
                        .then(() => {
                            addSystemMessage('已加入跨设备房间成员列表');
                            return conversation;
                        })
                        .catch(err => {
                            console.warn('添加成员失败，但继续使用对话:', err);
                            return conversation;
                        });
                }
                
                return conversation;
            })
            .then(function(conversation) {
                // 设置消息监听
                console.log('设置消息监听');
                
                // 移除已有监听器避免重复
                if (conversation._messageListeners) {
                    for (let listener of conversation._messageListeners) {
                        conversation.off('message', listener);
                    }
                } else {
                    conversation._messageListeners = [];
                }
                
                // 监听消息
                const messageHandler = function(message) {
                    console.log('收到跨设备消息事件:', message);
                    receiveMessage(message);
                };
                conversation._messageListeners.push(messageHandler);
                conversation.on('message', messageHandler);
                
                // 监听成员加入
                conversation.on('membersjoined', function(payload) {
                    console.log('成员加入事件:', payload);
                    addSystemMessage(`用户 ${payload.members.join(', ')} 加入了跨设备房间`);
                });
                
                // 监听成员离开
                conversation.on('membersleft', function(payload) {
                    console.log('成员离开事件:', payload);
                    addSystemMessage(`用户 ${payload.members.join(', ')} 离开了跨设备房间`);
                });
                
                // 尝试主动加入对话，如果支持join方法
                if (typeof conversation.join === 'function') {
                    console.log('使用join方法加入对话');
                    return conversation.join()
                        .then(() => {
                            addSystemMessage('正式加入跨设备房间成功');
                            // 发送一条测试消息，确保连接正常
                            return sendTestMessage(conversation)
                                .then(() => queryHistoryMessages(conversation));
                        })
                        .catch(err => {
                            console.warn('join方法失败:', err);
                            return queryHistoryMessages(conversation);
                        });
                } else {
                    console.log('对话不支持join方法，查询历史消息');
                    return queryHistoryMessages(conversation);
                }
            })
            .then(function() {
                addSystemMessage('跨设备通信连接成功，现在可以与其他设备通信！');
            })
            .catch(function(error) {
                clearTimeout(connectionTimeout);
                console.error('连接跨设备通信服务器失败:', error);
                addSystemMessage('连接跨设备通信服务器失败: ' + error.message);
                
                // 切换到离线模式
                setupOfflineMode(username, roomCode);
            });
    } catch (error) {
        clearTimeout(connectionTimeout);
        console.error('创建LeanCloud客户端时出错:', error);
        addSystemMessage('创建客户端出错: ' + error.message);
        
        // 切换到离线模式
        setupOfflineMode(username, roomCode);
    }
}

// 设置离线模式
function setupOfflineMode(username, roomCode) {
    isOnline = false;
    updateOnlineStatus(false, '离线模式');
    addSystemMessage('已切换到离线模式，只能在同一浏览器内通信');
    
    // 确保跨设备通信桥和本地通信桥已初始化
    const formattedRoomId = 'ROOM_' + roomCode.padStart(4, '0');
    
    if (window.crossDevicesBridge) {
        try {
            window.crossDevicesBridge.join(formattedRoomId, username);
            addSystemMessage('已启用同一浏览器多标签页通信');
        } catch (e) {
            console.error('加入跨设备通信桥出错:', e);
        }
    }
    
    if (window.chatBridge) {
        try {
            window.chatBridge.join(formattedRoomId, username);
            addSystemMessage('已启用本地通信功能');
        } catch (e) {
            console.error('加入本地通信桥出错:', e);
        }
    }
    
    // 20秒后自动重试连接
    setTimeout(() => {
        addSystemMessage('20秒后自动尝试重新连接服务器...');
        connectToLeanCloud(username, roomCode);
    }, 20000);
}

// 发送测试消息确认连接
function sendTestMessage(conversation) {
    console.log('发送测试消息以确认连接');
    
    try {
        if (!conversation || typeof conversation.send !== 'function') {
            return Promise.resolve();
        }
        
        // 创建特殊系统消息
        return conversation.send(new AV.Realtime.TextMessage('__system_test__'))
            .then(function() {
                console.log('测试消息发送成功');
                return Promise.resolve();
            })
            .catch(function(error) {
                console.warn('测试消息发送失败:', error);
                return Promise.resolve();
            });
    } catch (e) {
        console.error('发送测试消息出错:', e);
        return Promise.resolve();
    }
}

// 查询历史消息
function queryHistoryMessages(conversation) {
    console.log('查询历史消息');
    
    try {
        // 尝试使用 conversation.queryMessages (新版API)
        if (typeof conversation.queryMessages === 'function') {
            return conversation.queryMessages({
                limit: 10,
                type: 'text'
            }).then(function(messages) {
                // 显示最近的消息
                if (messages && messages.length > 0) {
                    addSystemMessage(`加载最近的消息: ${messages.length}条`);
                    messages.reverse().forEach(function(message) {
                        // 忽略系统测试消息
                        if (message._lctext === '__system_test__') {
                            return;
                        }
                        receiveMessage(message);
                    });
                } else {
                    addSystemMessage('没有历史消息');
                }
                return conversation;
            }).catch(function(error) {
                addSystemMessage('无法加载历史消息: ' + error.message);
                return conversation;
            });
        } 
        // 尝试使用 conversation.query (旧版API)
        else if (typeof conversation.query === 'function') {
            return conversation.query({
                limit: 10
            }).then(function(messages) {
                // 显示最近的消息
                if (messages && messages.length > 0) {
                    addSystemMessage(`加载最近的消息: ${messages.length}条`);
                    messages.reverse().forEach(function(message) {
                        // 忽略系统测试消息
                        if (message._lctext === '__system_test__') {
                            return;
                        }
                        receiveMessage(message);
                    });
                } else {
                    addSystemMessage('没有历史消息');
                }
                return conversation;
            }).catch(function(error) {
                addSystemMessage('无法加载历史消息: ' + error.message);
                return conversation;
            });
        }
        // 无法查询历史消息
        else {
            addSystemMessage('无法加载历史消息，但可以发送新消息');
            return Promise.resolve(conversation);
        }
    } catch (error) {
        addSystemMessage('加载历史消息失败: ' + error.message);
        return Promise.resolve(conversation);
    }
}

// 接收消息处理
function receiveMessage(message) {
    // 消息调试信息
    console.log('收到消息对象:', message);
    
    try {
        // 忽略系统测试消息
        if (message._lctext === '__system_test__') {
            console.log('跳过系统测试消息');
            return;
        }
        
        // 检查消息来源
        if (!message || !message.from) {
            console.warn('收到无效消息或无发送者信息');
            return;
        }
        
        // 不处理自己发的消息（因为已经显示在UI上了）
        if (message.from === chatCurrentUser) {
            console.log('跳过自己发送的消息');
            return;
        }
        
        // 添加调试信息
        console.log(`接收消息: 发送者=${message.from}, 当前用户=${chatCurrentUser}`);
        
        // 处理文本消息
        if (message.text || (message.type === 'text') || message._lctext) {
            // 提取消息文本 - 兼容不同消息格式
            let messageText = message.text || message._lctext;
            
            if (messageText) {
                console.log(`显示文本消息: ${messageText}`);
                addMessage(message.from, messageText, false);
            }
        }
        // 处理文件消息
        else if (message.file || (message.type === 'file') || message._lcfile) {
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
    
    // 清空输入框
    messageInput.value = '';
    
    // 在UI中显示消息
    addMessage(chatCurrentUser, message, true);
    
    // 优先通过LeanCloud发送消息（真正的跨设备通信）
    let leanCloudSent = false;
    if (isOnline && conversationInstance) {
        try {
            console.log('通过LeanCloud发送消息:', message);
            
            // 安全检查SDK可用性
            if (window.AV && window.AV.Realtime) {
                // 安全检查TextMessage构造函数
                let textMsg;
                if (window.AV.Realtime.TextMessage) {
                    textMsg = new AV.Realtime.TextMessage(message);
                } else if (AV.TextMessage) {
                    textMsg = new AV.TextMessage(message);
                } else {
                    throw new Error('TextMessage构造函数不可用');
                }
                
                // 安全检查send方法
                if (typeof conversationInstance.send === 'function') {
                    conversationInstance.send(textMsg)
                        .then(function(msgInstance) {
                            console.log('LeanCloud消息发送成功:', msgInstance);
                            leanCloudSent = true;
                        })
                        .catch(function(error) {
                            console.error('LeanCloud发送消息失败:', error);
                            addSystemMessage('跨设备消息发送失败');
                        });
                } else {
                    throw new Error('conversation.send 方法不可用');
                }
            } else {
                throw new Error('AV SDK不完整');
            }
        } catch (error) {
            console.error('发送LeanCloud消息时出错:', error);
            addSystemMessage(`跨设备发送出错: ${error.message}`);
        }
    } else {
        console.warn('LeanCloud未连接，无法进行跨设备通信');
    }
    
    // 同时通过跨设备通信桥发送（同一浏览器不同标签页）
    let crossDeviceSent = false;
    if (window.crossDevicesBridge) {
        try {
            crossDeviceSent = window.crossDevicesBridge.sendText(message);
            console.log('[调试] 通过跨设备通信桥发送消息:', crossDeviceSent);
        } catch (e) {
            console.error('跨设备通信桥发送失败:', e);
        }
    } else {
        console.warn('[调试] crossDevicesBridge不可用');
    }
    
    // 然后尝试通过本地通信桥发送
    let localBridgeSent = false;
    if (window.chatBridge) {
        try {
            localBridgeSent = window.chatBridge.sendText(message);
            console.log('[调试] 通过本地通信桥发送消息:', localBridgeSent);
        } catch (e) {
            console.error('本地通信桥发送失败:', e);
        }
    } else {
        console.warn('[调试] chatBridge不可用');
    }
    
    // 如果所有方式都失败，显示错误
    if (!localBridgeSent && !crossDeviceSent && !isOnline) {
        addSystemMessage('消息发送失败：所有通信方式均不可用');
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
        
        console.log('尝试重新连接，用户：', chatCurrentUser);
        
        // 如果没有用户信息或房间信息，无法重连
        if (!chatCurrentUser || !chatRoomId) {
            console.error('缺少用户信息或房间信息，无法重连');
            addSystemMessage('重连失败：房间信息不完整');
            updateOnlineStatus(false);
            reject(new Error('缺少重连所需信息'));
            return;
        }
        
        // 重新创建客户端实例
        realtime.createIMClient(chatCurrentUser)
            .then(function(c) {
                client = c;
                addSystemMessage('已重新连接到服务器');
                updateOnlineStatus(true);
                
                // 设置客户端断线监听
                client.on('disconnect', function() {
                    console.warn('客户端连接已断开');
                    addSystemMessage('与服务器连接断开');
                    updateOnlineStatus(false);
                });
                
                client.on('reconnect', function() {
                    console.log('客户端已重连接');
                    addSystemMessage('已重新连接到服务器');
                    updateOnlineStatus(true);
                });
                
                // 获取当前房间ID - 使用存储的值
                const roomCode = chatRoomId;
                const convId = 'ROOM_' + roomCode.padStart(4, '0');
                console.log('重新加入房间:', convId);
                
                // 重新加入对话
                return client.getConversation(convId)
                    .catch(err => {
                        console.error('尝试获取会话失败，创建新会话:', err);
                        return client.createConversation({
                            name: roomCode,
                            unique: true,
                            id: convId,
                            members: [chatCurrentUser]
                        });
                    });
            })
            .then(function(conversation) {
                conversationInstance = conversation;
                addSystemMessage('已重新加入房间');
                console.log('已重新加入会话:', conversation.id);
                
                // 移除已有监听器避免重复
                if (conversation._messageListeners) {
                    for (let listener of conversation._messageListeners) {
                        conversation.off('message', listener);
                    }
                } else {
                    conversation._messageListeners = [];
                }
                
                // 重新设置消息监听
                const messageHandler = function(message) {
                    receiveMessage(message);
                };
                conversation._messageListeners.push(messageHandler);
                conversation.on('message', messageHandler);
                
                // 监听成员加入
                conversation.on('membersjoined', function(payload) {
                    addSystemMessage(`用户 ${payload.members.join(', ')} 加入了房间`);
                });
                
                // 监听成员离开
                conversation.on('membersleft', function(payload) {
                    addSystemMessage(`用户 ${payload.members.join(', ')} 离开了房间`);
                });
                
                // 发送测试消息确认连接
                return sendTestMessage(conversation)
                    .then(() => {
                        resolve(conversation);
                    });
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
            addMessage(chatCurrentUser, `发送了文件: ${file.name} (${formatFileSize(file.size)})`, true);
            return conversationInstance.send(message);
        }).catch(function(error) {
            // 移除进度条
            chatContainer.removeChild(progressContainer);
            
            addSystemMessage('上传文件失败: ' + error.message);
        });
    } else {
        // 离线模式：模拟文件发送
        addMessage(chatCurrentUser, `发送了文件: ${file.name} (${formatFileSize(file.size)})`, true);
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
