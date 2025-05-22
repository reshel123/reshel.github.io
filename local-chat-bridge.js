/**
 * 本地聊天通信桥 - 用于跨窗口通信和会话同步
 * 此文件实现了基于localStorage的消息机制，确保不同窗口的聊天信息能够互通
 */

// 初始化
let bridgeClientId = 'client_' + Math.random().toString(36).substring(2, 15);
let currentRoom = null;
let currentUser = null;
let messageHandlers = [];
let presenceHandlers = [];

// 可以有多种消息类型
const MESSAGE_TYPES = {
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
    console.log('初始化本地聊天桥:', bridgeClientId);
    
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
            if (data.sender === bridgeClientId) return;
            
            // 如果是针对当前房间的消息
            if (shouldProcessMessage(data)) {
                console.log('收到跨窗口消息:', data);
                
                switch(data.type) {
                    case MESSAGE_TYPES.TEXT:
                        notifyMessageHandlers({
                            from: data.userName,
                            text: data.message,
                            _lctext: data.message,
                            timestamp: data.timestamp,
                            type: 'text'
                        });
                        break;
                        
                    case MESSAGE_TYPES.JOIN:
                        notifyPresenceHandlers({
                            type: 'join',
                            user: data.userName,
                            timestamp: data.timestamp
                        });
                        break;
                        
                    case MESSAGE_TYPES.LEAVE:
                        notifyPresenceHandlers({
                            type: 'leave',
                            user: data.userName,
                            timestamp: data.timestamp
                        });
                        break;
                        
                    case MESSAGE_TYPES.HEARTBEAT:
                        // 接收到心跳信息，确认其他窗口在同一房间
                        console.log('收到心跳:', data);
                        // 如果刚加入，发送自己的加入通知
                        if (data.joined && currentRoom && currentRoom === data.roomId && currentUser) {
                            setTimeout(() => {
                                sendMessage(MESSAGE_TYPES.JOIN, '已加入房间');
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
 */
function shouldProcessMessage(data) {
    // 没有加入房间时忽略所有消息
    if (!currentRoom) return false;
    
    // 如果是心跳消息，只要是同一个房间就处理
    if (data.type === MESSAGE_TYPES.HEARTBEAT) {
        return data.roomId === currentRoom;
    }
    
    // 其他消息必须是发给当前房间的
    return data.roomId === currentRoom;
}

/**
 * 发送消息到其他窗口
 * @param {String} type 消息类型
 * @param {String} message 消息内容
 */
function sendMessage(type, message) {
    if (!currentRoom || !currentUser) {
        console.warn('未加入房间，不能发送消息');
        return false;
    }
    
    const data = {
        sender: bridgeClientId,
        roomId: currentRoom,
        userName: currentUser,
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
    return sendMessage(MESSAGE_TYPES.TEXT, message);
}

/**
 * 加入房间
 * @param {String} roomId 房间ID
 * @param {String} userName 用户名
 */
function joinRoom(roomId, userName) {
    currentRoom = roomId;
    currentUser = userName;
    console.log(`本地通信桥加入房间: ${roomId}, 用户: ${userName}`);
    
    // 发送加入消息
    setTimeout(() => {
        sendMessage(MESSAGE_TYPES.JOIN, '加入了房间');
    }, 500);
    
    return true;
}

/**
 * 离开房间
 */
function leaveRoom() {
    if (currentRoom && currentUser) {
        // 发送离开消息
        sendMessage(MESSAGE_TYPES.LEAVE, '离开了房间');
        currentRoom = null;
        currentUser = null;
        return true;
    }
    return false;
}

/**
 * 开始心跳检测
 */
function startHeartbeat() {
    // 清除已有的心跳
    if (window._heartbeatTimer) {
        clearInterval(window._heartbeatTimer);
    }
    
    // 设置新的心跳，每10秒发送一次
    window._heartbeatTimer = setInterval(() => {
        if (currentRoom) {
            // 发送心跳
            const data = {
                sender: bridgeClientId,
                roomId: currentRoom,
                userName: currentUser || 'unknown',
                timestamp: Date.now(),
                type: MESSAGE_TYPES.HEARTBEAT,
                joined: true
            };
            
            try {
                localStorage.setItem('chat_message', JSON.stringify(data));
                setTimeout(() => {
                    localStorage.removeItem('chat_message');
                }, 100);
            } catch (error) {
                console.error('发送心跳失败:', error);
            }
        }
    }, 10000);
    
    // 页面关闭时清除心跳
    window.addEventListener('beforeunload', () => {
        if (window._heartbeatTimer) {
            clearInterval(window._heartbeatTimer);
        }
        
        // 发送离开消息
        if (currentRoom && currentUser) {
            sendMessage(MESSAGE_TYPES.LEAVE, '离开了房间');
        }
    });
}

/**
 * 添加消息处理器
 * @param {Function} handler 处理函数
 */
function addMessageHandler(handler) {
    if (typeof handler === 'function') {
        messageHandlers.push(handler);
    }
}

/**
 * 添加在线状态处理器
 * @param {Function} handler 处理函数
 */
function addPresenceHandler(handler) {
    if (typeof handler === 'function') {
        presenceHandlers.push(handler);
    }
}

/**
 * 通知所有消息处理器
 * @param {Object} message 消息对象
 */
function notifyMessageHandlers(message) {
    messageHandlers.forEach(handler => {
        try {
            handler(message);
        } catch (error) {
            console.error('消息处理器出错:', error);
        }
    });
}

/**
 * 通知所有在线状态处理器
 * @param {Object} presenceInfo 在线状态信息
 */
function notifyPresenceHandlers(presenceInfo) {
    presenceHandlers.forEach(handler => {
        try {
            handler(presenceInfo);
        } catch (error) {
            console.error('在线状态处理器出错:', error);
        }
    });
}

// 导出函数
window.chatBridge = {
    init: initChatBridge,
    sendText: sendTextMessage,
    join: joinRoom,
    leave: leaveRoom,
    addMessageHandler: addMessageHandler,
    addPresenceHandler: addPresenceHandler,
    MESSAGE_TYPES: MESSAGE_TYPES
}; 