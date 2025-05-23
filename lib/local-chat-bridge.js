/**
 * 本地聊天通信桥 - 用于跨窗口通信和会话同步
 * 此文件实现了基于localStorage的消息机制，确保不同窗口的聊天信息能够互通
 */

// 使用立即执行函数避免全局变量冲突
(function() {
    // 初始化
    let localBridgeClientId = 'client_' + Math.random().toString(36).substring(2, 15);
    let localBridgeCurrentRoom = null;
    let localBridgeCurrentUser = null;
    let localMessageHandlers = [];
    let localPresenceHandlers = [];
    let heartbeatInterval = null;
    
    // 可以有多种消息类型
    const LOCAL_MESSAGE_TYPES = {
        TEXT: 'text',            // 普通文本消息
        JOIN: 'join',            // 用户加入房间
        LEAVE: 'leave',          // 用户离开房间
        HEARTBEAT: 'heartbeat',  // 心跳检测
        FILE: 'file'             // 文件消息
    };
    
    /**
     * 初始化本地聊天桥
     * @param {Object} config 配置项
     */
    function initChatBridge(config = {}) {
        console.log('初始化本地聊天桥:', localBridgeClientId);
        
        // 清理旧的事件监听器，避免重复绑定
        window.removeEventListener('storage', handleStorageEvent);
        
        // 设置新的事件监听器
        window.addEventListener('storage', handleStorageEvent);
        
        // 设置心跳检测，告知其他窗口我的存在
        startHeartbeat();
        
        // 初始完成
        console.log('本地聊天桥初始化完成');
    }
    
    /**
     * 处理localStorage事件
     */
    function handleStorageEvent(event) {
        if (event.key === 'chat_message' && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                
                // 忽略自己发送的消息
                if (data.sender === localBridgeClientId) return;
                
                // 如果是针对当前房间的消息
                if (shouldProcessMessage(data)) {
                    // 只有非心跳消息才显示日志
                    if (data.type !== LOCAL_MESSAGE_TYPES.HEARTBEAT) {
                        console.log('收到跨窗口消息:', data);
                    }
                    
                    switch(data.type) {
                        case LOCAL_MESSAGE_TYPES.TEXT:
                            notifyMessageHandlers({
                                from: data.userName,
                                text: data.message,
                                _lctext: data.message,
                                timestamp: data.timestamp,
                                type: 'text'
                            });
                            break;
                            
                        case LOCAL_MESSAGE_TYPES.JOIN:
                            notifyPresenceHandlers({
                                type: 'join',
                                user: data.userName,
                                timestamp: data.timestamp
                            });
                            break;
                            
                        case LOCAL_MESSAGE_TYPES.LEAVE:
                            notifyPresenceHandlers({
                                type: 'leave',
                                user: data.userName,
                                timestamp: data.timestamp
                            });
                            break;
                            
                        case LOCAL_MESSAGE_TYPES.HEARTBEAT:
                            // 接收到心跳信息，确认其他窗口在同一房间
                            // 降级为调试日志，避免控制台刷屏
                            if (window.DEBUG_MODE) {
                                console.log('收到心跳:', data);
                            }
                            // 如果刚加入，发送自己的加入通知
                            if (data.joined && localBridgeCurrentRoom && localBridgeCurrentRoom === data.roomId && localBridgeCurrentUser) {
                                setTimeout(() => {
                                    sendMessage(LOCAL_MESSAGE_TYPES.JOIN, '已加入房间');
                                }, 500);
                            }
                            break;
                    }
                }
            } catch (error) {
                console.error('处理跨窗口消息出错:', error);
            }
        }
    }
    
    /**
     * 判断是否应该处理该消息
     * @param {Object} data 消息数据
     * @returns {Boolean} 是否应该处理
     */
    function shouldProcessMessage(data) {
        // 如果没有加入房间，不处理任何消息
        if (!localBridgeCurrentRoom) return false;
        
        // 只处理针对当前房间的消息
        return data.roomId === localBridgeCurrentRoom;
    }
    
    /**
     * 通知所有消息处理器
     * @param {Object} message 消息对象
     */
    function notifyMessageHandlers(message) {
        localMessageHandlers.forEach(function(handler) {
            try {
                handler(message);
            } catch (error) {
                console.error('调用消息处理器出错:', error);
            }
        });
    }
    
    /**
     * 通知所有在线状态处理器
     * @param {Object} presence 在线状态对象
     */
    function notifyPresenceHandlers(presence) {
        localPresenceHandlers.forEach(function(handler) {
            try {
                handler(presence);
            } catch (error) {
                console.error('调用状态处理器出错:', error);
            }
        });
    }
    
    /**
     * 发送消息到其他窗口
     * @param {String} type 消息类型
     * @param {String} message 消息内容
     */
    function sendMessage(type, message) {
        if (!localBridgeCurrentRoom || !localBridgeCurrentUser) {
            console.warn('未加入房间，不能发送消息');
            return false;
        }
        
        const data = {
            sender: localBridgeClientId,
            roomId: localBridgeCurrentRoom,
            userName: localBridgeCurrentUser,
            message: message,
            timestamp: Date.now(),
            type: type
        };
        
        try {
            localStorage.setItem('chat_message', JSON.stringify(data));
            // 清除消息，触发其他窗口的事件
            setTimeout(() => {
                localStorage.removeItem('chat_message');
            }, 100);
            return true;
        } catch (error) {
            console.error('发送跨窗口消息失败:', error);
            return false;
        }
    }
    
    /**
     * 发送文本消息
     * @param {String} message 消息内容
     */
    function sendTextMessage(message) {
        return sendMessage(LOCAL_MESSAGE_TYPES.TEXT, message);
    }
    
    /**
     * 加入房间
     * @param {String} roomId 房间ID
     * @param {String} userName 用户名
     */
    function joinRoom(roomId, userName) {
        localBridgeCurrentRoom = roomId;
        localBridgeCurrentUser = userName;
        console.log(`本地通信桥加入房间: ${roomId}, 用户: ${userName}`);
        
        // 发送加入消息
        sendMessage(LOCAL_MESSAGE_TYPES.JOIN, '已加入房间');
        
        return true;
    }
    
    /**
     * 离开房间
     */
    function leaveRoom() {
        if (localBridgeCurrentRoom && localBridgeCurrentUser) {
            // 发送离开消息
            sendMessage(LOCAL_MESSAGE_TYPES.LEAVE, '已离开房间');
            
            // 清除当前房间信息
            localBridgeCurrentRoom = null;
            localBridgeCurrentUser = null;
            
            console.log('本地通信桥已离开房间');
        }
    }
    
    /**
     * 启动心跳检测
     * 心跳机制用于确保其他已打开的窗口能及时知道新窗口的加入
     */
    function startHeartbeat() {
        // 清除可能存在的旧心跳
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        // 设置新的心跳
        heartbeatInterval = setInterval(() => {
            // 只有在加入房间后才发送心跳
            if (localBridgeCurrentRoom && localBridgeCurrentUser) {
                try {
                    const data = {
                        sender: localBridgeClientId,
                        roomId: localBridgeCurrentRoom,
                        userName: localBridgeCurrentUser,
                        timestamp: Date.now(),
                        type: LOCAL_MESSAGE_TYPES.HEARTBEAT,
                        joined: true
                    };
                    
                    localStorage.setItem('chat_heartbeat', JSON.stringify(data));
                    // 清除消息，触发其他窗口的事件
                    setTimeout(() => {
                        localStorage.removeItem('chat_heartbeat');
                    }, 50);
                } catch (error) {
                    console.error('发送心跳失败:', error);
                }
            }
        }, 5000);
        
        // 页面关闭时清除心跳
        window.addEventListener('beforeunload', () => {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
            
            // 如果在房间中，发送离开消息
            if (localBridgeCurrentRoom && localBridgeCurrentUser) {
                sendMessage(LOCAL_MESSAGE_TYPES.LEAVE, '已关闭窗口');
            }
        });
    }
    
    /**
     * 添加消息处理器
     * @param {Function} handler 处理函数
     */
    function addMessageHandler(handler) {
        if (typeof handler === 'function') {
            localMessageHandlers.push(handler);
        }
    }
    
    /**
     * 添加在线状态处理器
     * @param {Function} handler 处理函数
     */
    function addPresenceHandler(handler) {
        if (typeof handler === 'function') {
            localPresenceHandlers.push(handler);
        }
    }
    
    // 导出API到全局对象
    window.chatBridge = {
        init: initChatBridge,
        join: joinRoom,
        leave: leaveRoom,
        sendText: sendTextMessage,
        addMessageHandler: addMessageHandler,
        addPresenceHandler: addPresenceHandler,
        getClientId: () => localBridgeClientId
    };
    
    // 自动初始化
    initChatBridge();
})(); 