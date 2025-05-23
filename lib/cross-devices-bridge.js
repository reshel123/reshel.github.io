/**
 * 跨设备通信桥 - 使用广播通道实现设备间消息传递
 * 此库通过BroadcastChannel API实现跨标签页/窗口通信
 */

// 使用立即执行函数避免全局变量冲突
(function() {
    // 频道前缀
    const CROSS_DEVICE_CHANNEL_PREFIX = "CHAT_ROOM_";
    
    // 消息类型
    const CROSS_DEVICE_MESSAGE_TYPES = {
        TEXT: 'text',
        JOIN: 'join',
        LEAVE: 'leave',
        HEARTBEAT: 'heartbeat'
    };
    
    // 私有状态对象
    const state = {
        currentChannel: null,
        currentUser: null,
        messageCallbacks: [],
        presenceCallbacks: [],
        deviceId: generateDeviceId(),
        isConnected: false,
        heartbeatTimer: null
    };
    
    /**
     * 生成设备ID
     */
    function generateDeviceId() {
        // 尝试从 sessionStorage 获取持久的会话标识
        let id = sessionStorage.getItem('cross_devices_id');
        if (!id) {
            id = 'xdevice_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
            sessionStorage.setItem('cross_devices_id', id);
        }
        return id;
    }
    
    /**
     * 初始化跨设备通信桥
     */
    function init() {
        console.log('初始化跨设备通信桥:', state.deviceId);
        
        // 检查BroadcastChannel API是否可用
        if (typeof BroadcastChannel !== 'undefined') {
            console.log('设备支持BroadcastChannel API');
            state.isConnected = true;
            
            // 创建全局频道用于房间发现
            const globalChannel = new BroadcastChannel('GLOBAL_CHAT_DISCOVERY');
            globalChannel.onmessage = function(event) {
                const message = event.data;
                
                // 处理全局频道消息
                if (message && message.type === 'ROOM_DISCOVERY' && state.currentChannel && 
                    message.deviceId !== state.deviceId) {
                    
                    // 响应房间发现请求
                    globalChannel.postMessage({
                        type: 'ROOM_INFO',
                        deviceId: state.deviceId,
                        user: state.currentUser,
                        roomId: state.currentChannel.id || state.currentChannel.name,
                        timestamp: Date.now()
                    });
                }
            };
            
            // 发送一次发现请求
            setTimeout(() => {
                globalChannel.postMessage({
                    type: 'ROOM_DISCOVERY',
                    deviceId: state.deviceId,
                    timestamp: Date.now()
                });
            }, 2000);
        } else {
            console.warn('此设备不支持BroadcastChannel API，回退到localStorage方案');
            setupLocalStorageFallback();
        }
        
        // 当页面关闭时发送离开消息
        window.addEventListener('beforeunload', function() {
            if (state.currentChannel && state.currentUser) {
                sendMessageToChannel({
                    type: CROSS_DEVICE_MESSAGE_TYPES.LEAVE,
                    user: state.currentUser,
                    deviceId: state.deviceId,
                    timestamp: Date.now()
                });
            }
        });
        
        console.log('跨设备通信桥初始化完成');
    }
    
    /**
     * 设置使用localStorage的回退方案
     */
    function setupLocalStorageFallback() {
        console.log('设置localStorage回退方案');
        
        // 设置存储事件监听器
        window.addEventListener('storage', function(event) {
            if (event.key && event.key.startsWith(CROSS_DEVICE_CHANNEL_PREFIX) && event.newValue) {
                try {
                    const data = JSON.parse(event.newValue);
                    // 避免处理自己发送的消息
                    if (data.deviceId !== state.deviceId) {
                        processIncomingMessage(data);
                    }
                } catch (e) {
                    console.error('处理localStorage消息出错:', e);
                }
            }
        });
        
        state.isConnected = true;
    }
    
    /**
     * 加入房间
     * @param {string} roomId 房间ID
     * @param {string} username 用户名
     */
    function joinRoom(roomId, username) {
        console.log(`加入房间: ${roomId}, 用户: ${username}`);
        
        // 如果之前有房间，先离开
        leaveCurrentRoom();
        
        state.currentUser = username;
        const channelId = CROSS_DEVICE_CHANNEL_PREFIX + roomId;
        
        // 创建或重用广播通道
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                state.currentChannel = new BroadcastChannel(channelId);
                state.currentChannel.name = roomId; // 保存原始ID方便调试
                
                state.currentChannel.onmessage = function(event) {
                    const message = event.data;
                    // 避免处理自己发送的消息
                    if (message.deviceId !== state.deviceId) {
                        processIncomingMessage(message);
                    }
                };
                
                console.log('成功创建BroadcastChannel:', channelId);
            } catch (e) {
                console.error('创建BroadcastChannel失败:', e);
                // 回退到localStorage
                state.currentChannel = { id: channelId, name: roomId };
                setupLocalStorageFallback();
            }
        } else {
            // localStorage方式，只记录通道ID
            state.currentChannel = { id: channelId, name: roomId };
        }
        
        // 发送加入消息
        setTimeout(() => {
            const success = sendMessageToChannel({
                type: CROSS_DEVICE_MESSAGE_TYPES.JOIN,
                user: username,
                deviceId: state.deviceId,
                roomId: roomId,
                timestamp: Date.now()
            });
            console.log('发送加入消息结果:', success);
        }, 500);
        
        // 启动心跳检测
        startHeartbeat();
        
        return true;
    }
    
    /**
     * 离开当前房间
     */
    function leaveCurrentRoom() {
        if (state.currentChannel && state.currentUser) {
            // 发送离开消息
            sendMessageToChannel({
                type: CROSS_DEVICE_MESSAGE_TYPES.LEAVE,
                user: state.currentUser,
                deviceId: state.deviceId,
                timestamp: Date.now()
            });
            
            // 关闭通道
            if (typeof BroadcastChannel !== 'undefined' && state.currentChannel.close) {
                try {
                    state.currentChannel.close();
                    console.log('已关闭BroadcastChannel');
                } catch (e) {
                    console.error('关闭BroadcastChannel失败:', e);
                }
            }
            
            state.currentChannel = null;
            
            // 停止心跳
            if (state.heartbeatTimer) {
                clearInterval(state.heartbeatTimer);
                state.heartbeatTimer = null;
            }
        }
    }
    
    /**
     * 启动心跳检测
     */
    function startHeartbeat() {
        // 停止已有的心跳
        if (state.heartbeatTimer) {
            clearInterval(state.heartbeatTimer);
        }
        
        state.heartbeatTimer = setInterval(() => {
            if (state.currentChannel && state.currentUser) {
                // 发送心跳消息
                sendMessageToChannel({
                    type: CROSS_DEVICE_MESSAGE_TYPES.HEARTBEAT,
                    user: state.currentUser,
                    deviceId: state.deviceId,
                    timestamp: Date.now()
                });
            }
        }, 30000); // 30秒发送一次心跳
    }
    
    /**
     * 发送文本消息
     * @param {string} text 消息文本
     */
    function sendTextMessage(text) {
        if (!state.currentChannel || !state.currentUser) {
            console.warn('未加入房间，无法发送消息');
            return false;
        }
        
        return sendMessageToChannel({
            type: CROSS_DEVICE_MESSAGE_TYPES.TEXT,
            text: text,
            from: state.currentUser,
            deviceId: state.deviceId,
            timestamp: Date.now()
        });
    }
    
    /**
     * 发送消息到通道
     * @param {object} message 消息对象
     */
    function sendMessageToChannel(message) {
        if (!state.currentChannel) {
            console.warn('未加入房间，无法发送消息');
            return false;
        }
        
        try {
            // 根据通道类型决定发送方式
            if (typeof BroadcastChannel !== 'undefined' && state.currentChannel.postMessage) {
                // 使用 BroadcastChannel API
                state.currentChannel.postMessage(message);
            } else {
                // 使用 localStorage 回退方案
                const storageKey = state.currentChannel.id;
                localStorage.setItem(storageKey, JSON.stringify(message));
                // 清除消息以触发其他窗口的事件
                setTimeout(() => {
                    localStorage.removeItem(storageKey);
                }, 100);
            }
            return true;
        } catch (e) {
            console.error('发送消息失败:', e);
            return false;
        }
    }
    
    /**
     * 发送消息对象
     * @param {object} messageObj 消息对象
     */
    function sendMessage(messageObj) {
        if (!state.currentChannel || !state.currentUser) {
            console.warn('未加入房间，无法发送消息');
            return false;
        }
        
        // 添加必要的字段
        const message = Object.assign({}, messageObj, {
            deviceId: state.deviceId,
            timestamp: Date.now(),
            from: messageObj.from || state.currentUser
        });
        
        return sendMessageToChannel(message);
    }
    
    /**
     * 处理收到的消息
     * @param {object} message 消息对象
     */
    function processIncomingMessage(message) {
        try {
            // 调试输出
            if (message.type !== CROSS_DEVICE_MESSAGE_TYPES.HEARTBEAT) {
                console.log('收到跨设备消息:', message);
            }
            
            switch (message.type) {
                case CROSS_DEVICE_MESSAGE_TYPES.TEXT:
                    // 文本消息
                    notifyMessageHandlers({
                        from: message.from || message.user,
                        text: message.text,
                        type: 'text',
                        timestamp: message.timestamp,
                        deviceId: message.deviceId
                    });
                    break;
                    
                case CROSS_DEVICE_MESSAGE_TYPES.JOIN:
                    // 用户加入消息
                    notifyPresenceHandlers({
                        type: 'join',
                        user: message.user,
                        timestamp: message.timestamp
                    });
                    break;
                    
                case CROSS_DEVICE_MESSAGE_TYPES.LEAVE:
                    // 用户离开消息
                    notifyPresenceHandlers({
                        type: 'leave',
                        user: message.user,
                        timestamp: message.timestamp
                    });
                    break;
                    
                case CROSS_DEVICE_MESSAGE_TYPES.HEARTBEAT:
                    // 心跳消息不做特殊处理
                    break;
                    
                default:
                    if (message.text || message.from) {
                        // 处理兼容格式的消息
                        notifyMessageHandlers({
                            from: message.from || message.user,
                            text: message.text || message.content,
                            type: message.type || 'text',
                            timestamp: message.timestamp
                        });
                    } else {
                        console.log('收到未知类型消息:', message);
                    }
                    break;
            }
        } catch (e) {
            console.error('处理消息出错:', e);
        }
    }
    
    /**
     * 通知所有消息处理器
     * @param {object} message 消息对象
     */
    function notifyMessageHandlers(message) {
        state.messageCallbacks.forEach(function(handler) {
            try {
                handler(message);
            } catch (e) {
                console.error('调用消息处理器出错:', e);
            }
        });
    }
    
    /**
     * 通知所有在线状态处理器
     * @param {object} presence 在线状态对象
     */
    function notifyPresenceHandlers(presence) {
        state.presenceCallbacks.forEach(function(handler) {
            try {
                handler(presence);
            } catch (e) {
                console.error('调用状态处理器出错:', e);
            }
        });
    }
    
    /**
     * 添加消息处理器
     * @param {function} handler 处理函数
     */
    function addMessageHandler(handler) {
        if (typeof handler === 'function') {
            state.messageCallbacks.push(handler);
        }
    }
    
    /**
     * 添加在线状态处理器
     * @param {function} handler 处理函数
     */
    function addPresenceHandler(handler) {
        if (typeof handler === 'function') {
            state.presenceCallbacks.push(handler);
        }
    }
    
    // 导出API到全局对象
    window.crossDevicesBridge = {
        init: init,
        join: joinRoom,
        leave: leaveCurrentRoom,
        sendText: sendTextMessage,
        sendMessage: sendMessage,
        addMessageHandler: addMessageHandler,
        addPresenceHandler: addPresenceHandler,
        isConnected: () => state.isConnected,
        deviceId: state.deviceId
    };
    
    // 自动初始化
    init();
})(); 