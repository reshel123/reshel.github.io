/**
 * Firebase聊天桥接
 * 实现基于Firebase实时数据库的跨设备聊天功能
 */

// 使用立即执行函数避免全局变量冲突
(function() {
    // Firebase实例
    let firebaseApp;
    let database;
    let storage;
    let auth;
    
    // 聊天状态
    let currentRoomRef;
    let currentUser = null;
    let currentRoomId = null;
    let messageCallbacks = [];
    let presenceCallbacks = [];
    let deviceId = generateDeviceId();
    let isInitialized = false;
    let isMockMode = false;
    
    // 消息类型
    const MESSAGE_TYPES = {
        TEXT: 'text',
        FILE: 'file',
        SYSTEM: 'system',
        JOIN: 'join',
        LEAVE: 'leave'
    };
    
    /**
     * 初始化Firebase
     */
    function init() {
        console.log('[Firebase] 初始化聊天桥接...');
        
        if (isInitialized) {
            console.warn('[Firebase] 已经初始化，跳过');
            return;
        }
        
        try {
            // 检查Firebase SDK是否可用
            if (typeof firebase === 'undefined') {
                console.error('[Firebase] Firebase SDK未加载，启用模拟模式');
                setupMockMode();
                return;
            }
            
            // 检查配置
            if (!window.FIREBASE_CONFIG) {
                console.error('[Firebase] 配置未找到，启用模拟模式');
                setupMockMode();
                return;
            }
            
            // 初始化Firebase
            if (firebase.apps.length === 0) {
                firebaseApp = firebase.initializeApp(window.FIREBASE_CONFIG);
            } else {
                firebaseApp = firebase.apps[0];
            }
            
            // 初始化服务
            database = firebase.database();
            auth = firebase.auth();
            if (firebase.storage) {
                storage = firebase.storage();
            }
            
            console.log('[Firebase] 初始化成功');
            isInitialized = true;
            
            // 设置在线状态处理
            setupOnlinePresence();
            
        } catch (error) {
            console.error('[Firebase] 初始化失败:', error);
            setupMockMode();
        }
    }

    /**
     * 设置在线状态处理
     */
    function setupOnlinePresence() {
        const connectedRef = database.ref('.info/connected');
        
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                console.log('[Firebase] 已连接到服务器');
                
                // 如果已经在房间中，更新在线状态
                if (currentRoomRef && currentUser) {
                    const presenceRef = currentRoomRef.child('presence').child(deviceId);
                    
                    // 在断开连接时自动移除在线状态
                    presenceRef.onDisconnect().remove();
                    
                    // 设置在线状态
                    presenceRef.set({
                        user: currentUser,
                        online: true,
                        lastActive: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            } else {
                console.log('[Firebase] 与服务器断开连接');
            }
        });
    }

    /**
     * 配置模拟模式
     */
    function setupMockMode() {
        console.log('[Firebase] 配置模拟模式');
        isMockMode = true;
        
        // 模拟Firebase对象
        if (typeof firebase === 'undefined') {
            window.firebase = {
                apps: [],
                initializeApp: function() {
                    console.log('[模拟] 初始化Firebase应用');
                    return {};
                },
                database: function() {
                    return createMockDatabase();
                }
            };
        }
        
        isInitialized = true;
    }

    /**
     * 创建模拟数据库
     */
    function createMockDatabase() {
        console.log('[模拟] 创建模拟数据库');
        
        return {
            ref: function(path) {
                console.log(`[模拟] 获取引用: ${path}`);
                return createMockRef(path);
            }
        };
    }

    /**
     * 创建模拟引用
     */
    function createMockRef(path) {
        const mockData = {};
        let listeners = {};
        
        return {
            path: path,
            push: function() {
                const id = 'mock_' + Date.now();
                const childRef = createMockRef(path + '/' + id);
                childRef.id = id;
                childRef.set = function(data) {
                    mockData[id] = data;
                    if (listeners['child_added']) {
                        listeners['child_added'].forEach(callback => {
                            callback({
                                key: id,
                                val: function() { return data; }
                            });
                        });
                    }
                    return Promise.resolve();
                };
                return childRef;
            },
            set: function(data) {
                mockData[path] = data;
                return Promise.resolve();
            },
            on: function(event, callback) {
                console.log(`[模拟] 监听事件: ${event} 在路径: ${path}`);
                if (!listeners[event]) {
                    listeners[event] = [];
                }
                listeners[event].push(callback);
                
                // 当使用本地存储或跨设备桥时通知回调
                if (window.chatBridge || window.crossDevicesBridge) {
                    if (event === 'child_added' && path.includes('messages')) {
                        // 添加一个监听器来桥接两个系统
                        if (window.crossDevicesBridge) {
                            window.crossDevicesBridge.addMessageHandler((message) => {
                                callback({
                                    key: message.id || 'msg_' + Date.now(),
                                    val: function() { return message; }
                                });
                            });
                        }
                        
                        if (window.chatBridge) {
                            window.chatBridge.addMessageHandler((message) => {
                                callback({
                                    key: message.id || 'msg_' + Date.now(),
                                    val: function() { return message; }
                                });
                            });
                        }
                    }
                }
            },
            off: function() {
                listeners = {};
            },
            child: function(childPath) {
                return createMockRef(path + '/' + childPath);
            },
            update: function(data) {
                return Promise.resolve();
            },
            remove: function() {
                return Promise.resolve();
            },
            onDisconnect: function() {
                return {
                    remove: function() {},
                    set: function() {}
                };
            }
        };
    }

    /**
     * 生成设备ID
     */
    function generateDeviceId() {
        // 尝试从 sessionStorage 获取持久的会话标识
        let id = sessionStorage.getItem('firebase_device_id');
        if (!id) {
            id = 'device_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
            sessionStorage.setItem('firebase_device_id', id);
        }
        return id;
    }

    /**
     * 加入聊天室
     */
    function joinRoom(roomId, username) {
        console.log(`[Firebase] 加入房间: ${roomId}, 用户: ${username}`);
        
        // 确保Firebase已初始化
        if (!isInitialized) {
            init();
        }
        
        // 离开之前的房间
        leaveCurrentRoom();
        
        // 保存当前用户和房间ID
        currentUser = username;
        currentRoomId = roomId;
        
        // 格式化房间ID
        const formattedRoomId = 'room_' + roomId.replace(/[.#$/\\[\]]/g, '_');
        
        try {
            // 获取房间引用
            currentRoomRef = database.ref(`rooms/${formattedRoomId}`);
            
            // 创建房间信息（如果不存在）
            currentRoomRef.child('info').update({
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastActive: firebase.database.ServerValue.TIMESTAMP,
                name: `Room ${roomId}`
            });
            
            // 设置用户在线状态
            const presenceRef = currentRoomRef.child('presence').child(deviceId);
            presenceRef.set({
                user: username,
                online: true,
                joined: firebase.database.ServerValue.TIMESTAMP,
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
            
            // 设置离线时自动移除状态
            presenceRef.onDisconnect().remove();
            
            // 监听消息
            const messagesRef = currentRoomRef.child('messages');
            messagesRef.on('child_added', handleNewMessage);
            
            // 监听在线状态变化
            const presenceListRef = currentRoomRef.child('presence');
            presenceListRef.on('child_added', handlePresenceChange);
            presenceListRef.on('child_removed', handlePresenceRemoved);
            
            // 发送加入消息
            sendSystemMessage(`${username} 加入了房间`, MESSAGE_TYPES.JOIN);
            
            // 也通过本地通信桥和跨设备桥发送
            if (window.chatBridge) {
                window.chatBridge.join(formattedRoomId, username);
            }
            
            if (window.crossDevicesBridge) {
                window.crossDevicesBridge.join(formattedRoomId, username);
            }
            
            console.log(`[Firebase] 成功加入房间: ${formattedRoomId}`);
            return true;
        } catch (error) {
            console.error('[Firebase] 加入房间失败:', error);
            return false;
        }
    }

    /**
     * 离开当前房间
     */
    function leaveCurrentRoom() {
        if (currentRoomRef && currentUser) {
            try {
                // 发送离开消息
                sendSystemMessage(`${currentUser} 离开了房间`, MESSAGE_TYPES.LEAVE);
                
                // 移除监听器
                currentRoomRef.child('messages').off('child_added', handleNewMessage);
                currentRoomRef.child('presence').off('child_added', handlePresenceChange);
                currentRoomRef.child('presence').off('child_removed', handlePresenceRemoved);
                
                // 移除在线状态
                currentRoomRef.child('presence').child(deviceId).remove();
                
                // 清除本地和跨设备桥
                if (window.chatBridge) {
                    window.chatBridge.leave();
                }
                
                if (window.crossDevicesBridge) {
                    window.crossDevicesBridge.leave();
                }
                
                console.log('[Firebase] 已离开房间');
            } catch (error) {
                console.error('[Firebase] 离开房间出错:', error);
            }
            
            currentRoomRef = null;
        }
    }

    /**
     * 处理新消息
     */
    function handleNewMessage(snapshot) {
        try {
            const message = snapshot.val();
            const messageId = snapshot.key;
            
            console.log(`[Firebase] 收到新消息 ID: ${messageId}`, message);
            
            // 添加消息ID
            message.id = messageId;
            
            // 忽略自己发送的消息（已在UI中显示）
            if (message.deviceId === deviceId) {
                return;
            }
            
            // 通知所有注册的回调
            notifyMessageHandlers(message);
        } catch (error) {
            console.error('[Firebase] 处理消息出错:', error);
        }
    }

    /**
     * 处理在线状态变化
     */
    function handlePresenceChange(snapshot) {
        try {
            const presence = snapshot.val();
            const userId = snapshot.key;
            
            console.log(`[Firebase] 用户在线状态变化: ${userId}`, presence);
            
            // 忽略自己的状态变化
            if (userId === deviceId) {
                return;
            }
            
            // 通知所有状态处理器
            notifyPresenceHandlers({
                type: 'join',
                user: presence.user,
                timestamp: presence.joined || Date.now()
            });
        } catch (error) {
            console.error('[Firebase] 处理在线状态出错:', error);
        }
    }

    /**
     * 处理用户离线
     */
    function handlePresenceRemoved(snapshot) {
        try {
            const presence = snapshot.val();
            const userId = snapshot.key;
            
            // 忽略自己的状态变化
            if (userId === deviceId) {
                return;
            }
            
            console.log(`[Firebase] 用户离线: ${userId}`, presence);
            
            // 通知所有状态处理器
            notifyPresenceHandlers({
                type: 'leave',
                user: presence.user,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[Firebase] 处理离线状态出错:', error);
        }
    }

    /**
     * 发送文本消息
     */
    function sendTextMessage(text) {
        if (!currentRoomRef || !currentUser) {
            console.warn('[Firebase] 未加入房间，无法发送消息');
            return false;
        }
        
        try {
            const messagesRef = currentRoomRef.child('messages');
            const newMessageRef = messagesRef.push();
            
            const message = {
                type: MESSAGE_TYPES.TEXT,
                text: text,
                from: currentUser,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                deviceId: deviceId
            };
            
            newMessageRef.set(message);
            console.log('[Firebase] 文本消息发送成功');
            
            // 更新房间最后活动时间
            currentRoomRef.child('info').update({
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
            
            // 同时也发送给本地通信桥和跨设备通信桥
            if (window.chatBridge) {
                window.chatBridge.sendText(text);
            }
            
            if (window.crossDevicesBridge) {
                window.crossDevicesBridge.sendText(text);
            }
            
            return true;
        } catch (error) {
            console.error('[Firebase] 发送消息失败:', error);
            return false;
        }
    }

    /**
     * 发送系统消息
     */
    function sendSystemMessage(text, type = MESSAGE_TYPES.SYSTEM) {
        if (!currentRoomRef) {
            console.warn('[Firebase] 未加入房间，无法发送系统消息');
            return false;
        }
        
        try {
            const messagesRef = currentRoomRef.child('messages');
            const newMessageRef = messagesRef.push();
            
            const message = {
                type: type,
                text: text,
                from: 'system',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                deviceId: deviceId
            };
            
            newMessageRef.set(message);
            console.log('[Firebase] 系统消息发送成功');
            return true;
        } catch (error) {
            console.error('[Firebase] 发送系统消息失败:', error);
            return false;
        }
    }

    /**
     * 发送消息对象
     */
    function sendMessage(messageObj) {
        if (!currentRoomRef || !currentUser) {
            console.warn('[Firebase] 未加入房间，无法发送消息');
            return false;
        }
        
        try {
            const messagesRef = currentRoomRef.child('messages');
            const newMessageRef = messagesRef.push();
            
            // 添加必要的字段
            const message = Object.assign({}, messageObj, {
                deviceId: deviceId,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                from: messageObj.from || currentUser
            });
            
            newMessageRef.set(message);
            console.log('[Firebase] 消息对象发送成功');
            
            // 更新房间最后活动时间
            currentRoomRef.child('info').update({
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
            
            return true;
        } catch (error) {
            console.error('[Firebase] 发送消息对象失败:', error);
            return false;
        }
    }

    /**
     * 通知所有消息处理器
     */
    function notifyMessageHandlers(message) {
        messageCallbacks.forEach(function(handler) {
            try {
                handler(message);
            } catch (e) {
                console.error('[Firebase] 调用消息处理器出错:', e);
            }
        });
    }

    /**
     * 通知所有在线状态处理器
     */
    function notifyPresenceHandlers(presence) {
        presenceCallbacks.forEach(function(handler) {
            try {
                handler(presence);
            } catch (e) {
                console.error('[Firebase] 调用状态处理器出错:', e);
            }
        });
    }

    /**
     * 添加消息处理器
     */
    function addMessageHandler(handler) {
        if (typeof handler === 'function') {
            messageCallbacks.push(handler);
        }
    }

    /**
     * 添加在线状态处理器
     */
    function addPresenceHandler(handler) {
        if (typeof handler === 'function') {
            presenceCallbacks.push(handler);
        }
    }

    /**
     * 上传文件
     */
    function uploadFile(file) {
        if (!currentRoomRef || !currentUser || !storage) {
            console.warn('[Firebase] 未加入房间或存储不可用，无法上传文件');
            return Promise.reject(new Error('未加入房间或存储不可用'));
        }
        
        return new Promise((resolve, reject) => {
            try {
                // 创建文件引用
                const storageRef = storage.ref();
                const fileRef = storageRef.child(`rooms/${currentRoomId}/files/${Date.now()}_${file.name}`);
                
                // 上传文件
                const uploadTask = fileRef.put(file);
                
                // 监听上传进度
                uploadTask.on('state_changed', 
                    // 进度回调
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`[Firebase] 上传进度: ${progress.toFixed(2)}%`);
                    },
                    // 错误回调
                    (error) => {
                        console.error('[Firebase] 上传文件失败:', error);
                        reject(error);
                    },
                    // 完成回调
                    () => {
                        // 获取下载链接
                        uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                            console.log('[Firebase] 文件上传成功，下载URL:', downloadURL);
                            
                            // 发送文件消息
                            const messagesRef = currentRoomRef.child('messages');
                            const newMessageRef = messagesRef.push();
                            
                            const fileMessage = {
                                type: MESSAGE_TYPES.FILE,
                                from: currentUser,
                                fileName: file.name,
                                fileSize: file.size,
                                fileType: file.type,
                                fileUrl: downloadURL,
                                timestamp: firebase.database.ServerValue.TIMESTAMP,
                                deviceId: deviceId
                            };
                            
                            newMessageRef.set(fileMessage);
                            
                            // 更新房间最后活动时间
                            currentRoomRef.child('info').update({
                                lastActive: firebase.database.ServerValue.TIMESTAMP
                            });
                            
                            resolve({
                                url: downloadURL,
                                name: file.name,
                                size: file.size,
                                type: file.type
                            });
                        });
                    }
                );
            } catch (error) {
                console.error('[Firebase] 处理文件上传异常:', error);
                reject(error);
            }
        });
    }

    // 导出API到全局对象
    window.firebaseChatBridge = {
        init: init,
        joinRoom: joinRoom,
        leaveRoom: leaveCurrentRoom,
        sendText: sendTextMessage,
        sendMessage: sendMessage,
        sendSystemMessage: sendSystemMessage,
        uploadFile: uploadFile,
        addMessageHandler: addMessageHandler,
        addPresenceHandler: addPresenceHandler,
        isConnected: () => isInitialized && !isMockMode,
        isMockMode: () => isMockMode,
        deviceId: deviceId,
        MESSAGE_TYPES: MESSAGE_TYPES
    };
    
    // 自动初始化
    init();
})(); 