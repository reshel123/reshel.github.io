// 房间聊天功能的主要实现
let chatCurrentUser = null;
let chatRoomId = null;
let conversationInstance = null;
let realtime = null;
let client = null;
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
        showDebugInfo('正在初始化SDK和通信组件');
        
        // 检查跨设备通信桥
        if (window.crossDevicesBridge) {
            console.log('检测到跨设备通信桥，设备ID:', window.crossDevicesBridge.deviceId);
            addSystemMessage('已启用跨设备通信功能（仅支持同一网络下的设备）');
            
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
            updateOnlineStatus(true, '本地模式（同网络设备）');
        }
        
        // 检查LeanCloud SDK可用性
        if (typeof AV !== 'undefined' && typeof LC_CONFIG !== 'undefined') {
            console.log('初始化LeanCloud SDK，配置:', LC_CONFIG);
            
            try {
                // 显示SDK版本信息
                if (AV.version) {
                    console.log('LeanCloud SDK版本:', AV.version);
                    showDebugInfo(`SDK版本: ${AV.version}`);
                }
                
                // 初始化LeanCloud存储SDK
                AV.init({
                    appId: LC_CONFIG.appId,
                    appKey: LC_CONFIG.appKey,
                    serverURL: LC_CONFIG.serverURL
                });
                
                console.log('存储SDK初始化成功');
                
                // 检查实时通信SDK
                if (typeof Realtime !== 'undefined') {
                    console.log('找到实时通信SDK，准备初始化');
                    
                    // 检查类型化消息插件
                    const hasTypedMessagesPlugin = typeof TypedMessagesPlugin !== 'undefined';
                    if (hasTypedMessagesPlugin) {
                        console.log('找到类型化消息插件');
                    } else {
                        console.warn('未找到类型化消息插件，部分高级消息功能可能不可用');
                    }
                    
                    // 创建实时通信实例
                    realtime = new Realtime({
                        appId: LC_CONFIG.appId,
                        appKey: LC_CONFIG.appKey,
                        server: LC_CONFIG.serverURL ? LC_CONFIG.serverURL.replace('https://', 'wss://') + '/1.2/ws' : null,
                        plugins: hasTypedMessagesPlugin ? [TypedMessagesPlugin] : []
                    });
                    
                    console.log('LeanCloud SDK初始化成功（使用真实SDK）');
                    
                    // 检查连接性
                    setTimeout(checkLeancloudConnection, 1000);
                    
                    isOnline = true;
                    updateOnlineStatus(true, '在线模式（支持跨设备）');
                } else {
                    console.error('未找到实时通信SDK，可能影响跨设备消息传递');
                    showDebugInfo('警告：未找到实时通信SDK，跨设备功能受限');
                    
                    setTimeout(checkLeancloudConnection, 1000);
                }
            } catch (error) {
                console.error('初始化LeanCloud SDK失败:', error);
                addSystemMessage('初始化在线服务失败: ' + error.message);
                setupMockSDK(); // 如果失败则回退到模拟SDK
            }
        } else {
            if (!window.AV) {
                console.warn('LeanCloud AV对象不可用，SDK可能未正确加载');
                showDebugInfo('错误：LeanCloud SDK未正确加载');
            }
            if (!LC_CONFIG) {
                console.warn('LC_CONFIG不可用，配置可能未正确加载');
                showDebugInfo('错误：LeanCloud配置未加载');
            }
            
            console.warn('LeanCloud SDK不可用或配置缺失，使用离线模式');
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
    
    // 创建调试按钮
    createDebugButtons();
}

// 设置模拟SDK，在LeanCloud不可用时提供基本功能
function setupMockSDK() {
    console.log('设置模拟SDK以提供基本功能');
    
    // 如果全局对象不存在，创建它们
    if (!window.AV) window.AV = {};
    if (!window.Realtime) window.Realtime = function() { 
        this.createIMClient = createMockIMClient; 
    };
    
    // 创建模拟客户端
    function createMockIMClient(clientId) {
        console.log('创建模拟客户端:', clientId);
        return Promise.resolve({
            id: clientId,
            // 确保on方法存在，解决client.on不是函数的问题
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
                // 确保transient选项被正确处理
                const isTransient = options.transient === true;
                const convId = options.id || ('mock_conv_' + Date.now());
                const conv = createMockConversation(convId, clientId);
                conv.transient = isTransient;
                conv.name = options.name || convId;
                
                if (options.members && options.members.length > 0) {
                    conv.members = options.members.slice();
                }
                
                return Promise.resolve(conv);
            },
            // 添加createChatRoom方法，以便测试
            createChatRoom: function(options) {
                console.log('模拟创建聊天室:', options);
                const convId = options.id || ('mock_chatroom_' + Date.now());
                const conv = createMockConversation(convId, clientId);
                conv.transient = true; // 聊天室强制为transient
                conv.name = options.name || convId;
                conv.isChatRoom = true; // 标记为聊天室
                
                if (options.members && options.members.length > 0) {
                    conv.members = options.members.slice();
                }
                
                return Promise.resolve(conv);
            }
        });
    }
    
    // 创建模拟会话
    function createMockConversation(convId, clientId) {
        return {
            id: convId,
            name: convId,
            members: [clientId],
            transient: false,
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
                return this; // 支持链式调用
            },
            send: function(message) {
                console.log('模拟发送消息:', message);
                
                // 设置消息发送者
                message.from = clientId;
                message.cid = this.id;
                message.timestamp = Date.now();
                message.id = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                
                // 这里通过广播方式，尝试将消息发送到其他页面
                if (window.crossDevicesBridge) {
                    console.log('通过跨设备桥发送消息', message);
                    try {
                        window.crossDevicesBridge.sendMessage(message);
                    } catch (e) {
                        console.error('跨设备桥发送失败:', e);
                    }
                }
                
                if (window.chatBridge) {
                    console.log('通过本地通信桥发送消息');
                    try {
                        window.chatBridge.sendMessage(message);
                    } catch (e) {
                        console.error('本地通信桥发送失败:', e);
                    }
                }
                
                // 模拟成功，返回消息
                return Promise.resolve(message);
            },
            join: function() {
                console.log('模拟加入会话');
                return Promise.resolve(this);
            },
            add: function(members) {
                console.log('模拟添加成员:', members);
                this.members = this.members.concat(members);
                return Promise.resolve(this);
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
        // 添加一个唯一的ID，帮助调试
        this.id = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
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
    
    // 服务端房间ID格式 - 与全局通信保持一致
    const formattedRoomId = 'GLOBAL_ROOM_' + roomCode;
    
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
                
                // 设置客户端断线监听
                if (typeof client.on === 'function') {
                    try {
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
                            setupOfflineMode(username, roomCode);
                        });
                    } catch (e) {
                        console.warn('设置断线监听器失败:', e);
                    }
                }
                
                // 确保从标准化的房间ID创建会话 - 所有设备使用相同ID
                var convId = 'GLOBAL_ROOM_' + roomCode;  // 使用一致的全局ID格式
                addSystemMessage(`尝试加入全局房间: ${convId}`);
                console.log('[重要]尝试加入全局对话:', convId);
                
                // 打印房间ID和用户ID信息，方便调试
                console.log(`[重要]当前房间和用户信息: roomID=${convId}, userID=${username}`);
                
                // 直接使用createConversation并设置transient=true来创建聊天室
                return client.createConversation({
                    name: 'Global_' + roomCode,
                    transient: true,  // 设置为聊天室模式，不需要维护成员，所有人可加入
                    id: convId,       // 明确指定ID
                    unique: false,    // 允许重复创建
                }).then(chatRoom => {
                    console.log('成功创建/获取全局聊天室:', chatRoom.id);
                    showDebugInfo(`聊天室ID: ${chatRoom.id}, 成员数: ${chatRoom.members ? chatRoom.members.length : '未知'}`);
                    
                    return chatRoom;
                }).catch(error => {
                    console.warn('创建聊天室失败，尝试获取已有会话:', error);
                    
                    // 如果创建失败，尝试获取已有会话
                    return client.getConversation(convId)
                        .then(conversation => {
                            console.log('找到现有对话:', conversation.id);
                            return conversation;
                        })
                        .catch(() => {
                            // 最后尝试创建普通会话，但设置为transient
                            console.log('创建通用会话，设为公开:', convId);
                            return client.createConversation({
                                name: 'Room_' + roomCode,
                                unique: true,  // 确保唯一
                                id: convId,
                                transient: true,  // 尝试设置为聊天室模式
                                members: [username]  // 添加当前用户作为成员
                            });
                        });
                });
            })
            .then(function(conversation) {
                conversationInstance = conversation;
                
                // 显示会话ID信息
                addSystemMessage(`已获取全局房间，会话ID: ${conversation.id}`);
                console.log('[重要]已获取对话，确认ID:', conversation.id);
                
                // 加入会话
                if (typeof conversation.join === 'function') {
                    return conversation.join()
                        .then(() => {
                            addSystemMessage('已加入全局会话');
                            return conversation;
                        })
                        .catch(err => {
                            console.warn('join方法失败:', err);
                            return conversation;
                        });
                }
                
                return conversation;
            })
            .then(function(conversation) {
                // 设置消息监听
                try {
                    // 清除旧监听器
                    if (typeof conversation.off === 'function') {
                        conversation.off('message');
                    }
                    
                    // 添加新监听器
                    const messageHandler = function(message) {
                        console.log('[重要]收到服务器消息:', message);
                        if (message) {
                            // 确保消息有来源信息
                            if (!message.from && message.fromPeerId) {
                                message.from = message.fromPeerId;
                            }
                            showDebugInfo(`服务器收到消息: ${message.from}, 类型: ${message.type || '未知'}`);
                            receiveMessage(message);
                        }
                    };
                    
                    if (typeof conversation.on === 'function') {
                        conversation.on('message', messageHandler);
                        console.log('成功注册消息监听器');
                        showDebugInfo('成功设置了消息监听器');
                        
                        // 监听成员加入/离开
                        conversation.on('membersjoined', function(payload) {
                            addSystemMessage(`用户 ${payload.members.join(', ')} 加入了房间`);
                        });
                        
                        conversation.on('membersleft', function(payload) {
                            addSystemMessage(`用户 ${payload.members.join(', ')} 离开了房间`);
                        });
                    } else {
                        console.error('会话对象不支持on方法，消息接收可能不工作');
                        showDebugInfo('警告：无法注册消息监听器，消息接收可能不可用');
                    }
                } catch (e) {
                    console.error('设置消息监听器失败:', e);
                    showDebugInfo('设置消息监听器失败: ' + e.message);
                }
                
                return conversation;
            })
            .then(conversation => {
                // 查询历史消息
                return queryHistoryMessages(conversation);
            })
            .then(() => {
                // 发送加入通知
                addSystemMessage('全局通信连接成功，现在可以与其他设备通信！');
                
                // 延时发送加入通知
                setTimeout(() => {
                    broadcastTestMessage(`${username} 已加入全球聊天`);
                }, 1000);
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
    const formattedRoomId = 'GLOBAL_ROOM_' + roomCode;
    
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
    showDebugInfo(`收到消息: ${message.from}, 类型: ${message.type || '未知'}, ID: ${message.id || '无ID'}`);
    
    try {
        // 忽略系统测试消息
        if (message._lctext === '__system_test__') {
            console.log('跳过系统测试消息');
            return;
        }
        
        // 增加对消息源的详细记录
        console.log('消息来源详情:', {
            from: message.from || '未知',
            currentUser: chatCurrentUser,
            messageType: message.type || (message._lctext ? 'text' : message._lcfile ? 'file' : '未知类型'),
            hasText: !!message.text || !!message._lctext,
            convId: message.cid || (conversationInstance ? conversationInstance.id : '未知会话'),
        });
        
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
                addSystemMessage(`[调试] 收到来自 ${message.from} 的消息: ${messageText}`);
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
    showDebugInfo(`尝试发送消息: "${message}", 当前用户: ${chatCurrentUser}, 房间ID: ${chatRoomId}`);
    
    // 检查消息是否为空
    if (message === '') {
        addSystemMessage('消息不能为空');
        return;
    }
    
    // 清空输入框
    messageInput.value = '';
    
    // 在UI中显示消息
    addMessage(chatCurrentUser, message, true);
    
    // 通过LeanCloud发送消息（跨设备通信）
    let leanCloudSent = false;
    if (isOnline && conversationInstance) {
        try {
            console.log('通过LeanCloud发送消息:', message);
            showDebugInfo(`开始通过LeanCloud发送(会话ID: ${conversationInstance.id})`);
            
            // 创建简单的消息对象
            let textMsg = {
                text: message,
                _lctext: message,
                _lctype: -1, // 标准文本消息类型
                from: chatCurrentUser
            };
            
            // 发送消息
            if (typeof conversationInstance.send === 'function') {
                conversationInstance.send(textMsg)
                    .then(function(msgInstance) {
                        console.log('LeanCloud消息发送成功:', msgInstance);
                        showDebugInfo(`LeanCloud消息发送成功: ID=${msgInstance.id || '未知'}`);
                        leanCloudSent = true;
                    })
                    .catch(function(error) {
                        console.error('LeanCloud发送消息失败:', error);
                        showDebugInfo(`LeanCloud发送失败: ${error.message}`);
                        addSystemMessage('跨设备消息发送失败: ' + error.message);
                        
                        // 如果LeanCloud发送失败，尝试通过本地桥发送
                        sendViaLocalBridges(message);
                    });
            } else {
                throw new Error('会话对象不支持send方法');
            }
        } catch (error) {
            console.error('发送LeanCloud消息时出错:', error);
            showDebugInfo(`LeanCloud发送异常: ${error.message}`);
            addSystemMessage(`跨设备发送出错: ${error.message}`);
            
            // 如果出现异常，尝试通过本地桥发送
            sendViaLocalBridges(message);
        }
    } else {
        console.warn('LeanCloud未连接，尝试通过本地通信桥发送');
        showDebugInfo('LeanCloud未连接，尝试通过本地桥发送');
        
        // 通过本地桥发送
        sendViaLocalBridges(message);
    }
}

// 通过本地通信桥发送消息
function sendViaLocalBridges(text) {
    let localSent = false;
    
    // 通过跨设备通信桥发送（同一浏览器不同标签页）
    if (window.crossDevicesBridge) {
        try {
            localSent = window.crossDevicesBridge.sendText(text);
            console.log('[调试] 通过跨设备通信桥发送消息:', localSent);
        } catch (e) {
            console.error('跨设备通信桥发送失败:', e);
        }
    }
    
    // 通过本地通信桥发送
    if (window.chatBridge) {
        try {
            const bridgeSent = window.chatBridge.sendText(text);
            localSent = localSent || bridgeSent;
            console.log('[调试] 通过本地通信桥发送消息:', bridgeSent);
        } catch (e) {
            console.error('本地通信桥发送失败:', e);
        }
    }
    
    // 如果所有方式都失败，显示错误
    if (!localSent) {
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
                const convId = 'GLOBAL_ROOM_' + roomCode;
                console.log('重新加入房间:', convId);
                
                // 使用与主连接函数相同的逻辑
                return client.createConversation({
                    name: 'Global_' + roomCode,
                    transient: true,
                    id: convId,
                    unique: false
                }).then(chatRoom => {
                    console.log('重连成功创建/获取聊天室:', chatRoom.id);
                    return chatRoom;
                }).catch(err => {
                    console.warn('重连创建聊天室失败，尝试常规会话:', err);
                    // 尝试获取会话
                    return client.getConversation(convId)
                        .catch(err => {
                            console.error('尝试获取会话失败，创建新会话:', err);
                            return client.createConversation({
                                name: 'Room_' + roomCode,
                                unique: true,
                                id: convId,
                                transient: true,
                                members: [chatCurrentUser]
                            });
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
                    console.log('[重要]重连后收到消息:', message);
                    showDebugInfo(`重连后收到消息: ${message.from || message.fromPeerId}`);
                    receiveMessage(message);
                };
                
                if (typeof conversation.on === 'function') {
                    conversation.on('message', messageHandler);
                    
                    // 监听成员加入/离开
                    conversation.on('membersjoined', function(payload) {
                        addSystemMessage(`用户 ${payload.members.join(', ')} 加入了房间`);
                    });
                    
                    conversation.on('membersleft', function(payload) {
                        addSystemMessage(`用户 ${payload.members.join(', ')} 离开了房间`);
                    });
                    
                    showDebugInfo('重新设置了消息监听器');
                } else {
                    console.error('会话对象不支持on方法，消息接收可能不工作');
                }
                
                return conversation;
            })
            .then(conversation => {
                // 2. 查询历史消息
                return queryHistoryMessages(conversation);
            })
            .then(() => {
                // 4. 发送加入通知
                addSystemMessage('全局通信连接成功，现在可以与其他设备通信！');
                
                // 延时发送加入通知
                setTimeout(() => {
                    broadcastTestMessage(`${username} 已加入全球聊天`);
                }, 1000);
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

// 创建调试按钮，方便测试
function createDebugButtons() {
    try {
        // 创建广播测试按钮
        const broadcastBtn = document.createElement('button');
        broadcastBtn.innerHTML = '发送广播';
        broadcastBtn.className = 'debug-button';
        broadcastBtn.style.position = 'fixed';
        broadcastBtn.style.top = '10px';
        broadcastBtn.style.right = '10px';
        broadcastBtn.style.zIndex = '9999';
        broadcastBtn.style.background = '#ff5722';
        broadcastBtn.style.color = 'white';
        broadcastBtn.style.padding = '5px 10px';
        broadcastBtn.style.border = 'none';
        broadcastBtn.style.borderRadius = '4px';
        broadcastBtn.style.cursor = 'pointer';
        
        // 点击发送广播测试消息
        broadcastBtn.addEventListener('click', function() {
            broadcastTestMessage();
        });
        
        document.body.appendChild(broadcastBtn);
        
        // 创建连接信息按钮
        const infoBtn = document.createElement('button');
        infoBtn.innerHTML = '连接信息';
        infoBtn.className = 'debug-button';
        infoBtn.style.position = 'fixed';
        infoBtn.style.top = '10px';
        infoBtn.style.right = '90px';
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

// 发送广播测试消息
function broadcastTestMessage(testMessage) {
    if (!testMessage) {
        testMessage = `测试广播消息 (时间:${new Date().toLocaleTimeString()})`;
    }
    
    // 在界面显示
    addSystemMessage(`正在发送广播测试消息...`);
    showDebugInfo(`广播内容: ${testMessage}, 会话ID: ${conversationInstance ? conversationInstance.id : '未知'}`);
    
    // 尝试使用LeanCloud发送
    if (isOnline && conversationInstance && typeof conversationInstance.send === 'function') {
        try {
            // 创建简单的消息对象，不依赖特定的TextMessage类
            const textMsg = {
                _lctype: -1,
                _lctext: testMessage,
                text: testMessage,
                from: chatCurrentUser
            };
            
            conversationInstance.send(textMsg)
                .then(function(msg) {
                    console.log('广播消息发送成功:', msg);
                    addSystemMessage('广播消息发送成功！请检查其他设备是否收到');
                })
                .catch(function(error) {
                    console.error('广播消息发送失败:', error);
                    addSystemMessage('广播消息发送失败: ' + error.message);
                });
        } catch (e) {
            console.error('发送广播消息出错:', e);
            addSystemMessage('发送广播消息出错: ' + e.message);
        }
    } else {
        addSystemMessage('LeanCloud未连接，无法发送广播消息');
    }
    
    // 同时尝试使用本地通信方式
    if (window.crossDevicesBridge) {
        window.crossDevicesBridge.sendText(testMessage);
    }
    
    if (window.chatBridge) {
        window.chatBridge.sendText(testMessage);
    }
}

// 显示连接信息
function showConnectionInfo() {
    let info = '连接信息：\n';
    info += `房间ID: ${chatRoomId || '未加入'}\n`;
    info += `用户名: ${chatCurrentUser || '未设置'}\n`;
    info += `在线状态: ${isOnline ? '在线' : '离线'}\n`;
    
    if (conversationInstance) {
        info += `会话ID: ${conversationInstance.id || '未知'}\n`;
        info += `会话成员: ${(conversationInstance.members || []).join(', ') || '未知'}\n`;
    }
    
    if (client) {
        info += `客户端ID: ${client.id || '未知'}\n`;
    }
    
    if (window.crossDevicesBridge) {
        info += `设备ID: ${window.crossDevicesBridge.deviceId || '未知'}\n`;
    }
    
    info += `SDK可用: ${window.AV ? '是' : '否'}\n`;
    
    if (window.LC_CONFIG) {
        info += `AppID: ${window.LC_CONFIG.appId.substring(0, 8)}...\n`;
    }
    
    alert(info);
    
    // 同时在控制台输出更详细信息
    console.log('========== 连接详细信息 ==========');
    console.log('房间ID:', chatRoomId);
    console.log('用户名:', chatCurrentUser);
    console.log('在线状态:', isOnline);
    console.log('会话实例:', conversationInstance);
    console.log('客户端实例:', client);
    console.log('LeanCloud配置:', window.LC_CONFIG);
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
