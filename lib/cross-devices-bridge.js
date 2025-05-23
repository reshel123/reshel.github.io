/**
 * 跨设备通信桥 - 使用广播通道实现设备间消息传递
 * 此库通过BroadcastChannel API实现跨标签页/窗口通信
 */

// 初始化变量
const CROSS_DEVICE_CHANNEL_PREFIX = "CHAT_ROOM_";
let crossDeviceCurrentChannel = null;
let crossDeviceCurrentUser = null;
let crossDeviceMessageCallbacks = [];
let crossDevicePresenceCallbacks = [];
let crossDeviceId = generateDeviceId();
let isCrossDeviceConnected = false;

// 消息类型
const CROSS_DEVICE_MESSAGE_TYPES = {
    TEXT: 'text',
    JOIN: 'join',
    LEAVE: 'leave',
    HEARTBEAT: 'heartbeat'
};

/**
 * 初始化跨设备通信桥
 */
function init() {
    console.log('初始化跨设备通信桥:', crossDeviceId);
    
    // 检查BroadcastChannel API是否可用
    if (typeof BroadcastChannel !== 'undefined') {
        console.log('设备支持BroadcastChannel API');
        isCrossDeviceConnected = true;
        
        // 创建全局频道用于房间发现
        const globalChannel = new BroadcastChannel('GLOBAL_CHAT_DISCOVERY');
        globalChannel.onmessage = function(event) {
            const message = event.data;
            
            // 处理全局频道消息
            if (message && message.type === 'ROOM_DISCOVERY' && crossDeviceCurrentChannel && 
                message.deviceId !== crossDeviceId) {
                
                // 响应房间发现请求
                globalChannel.postMessage({
                    type: 'ROOM_INFO',
                    deviceId: crossDeviceId,
                    user: crossDeviceCurrentUser,
                    roomId: crossDeviceCurrentChannel.id || crossDeviceCurrentChannel.name,
                    timestamp: Date.now()
                });
            }
        };
        
        // 发送一次发现请求
        setTimeout(() => {
            globalChannel.postMessage({
                type: 'ROOM_DISCOVERY',
                deviceId: crossDeviceId,
                timestamp: Date.now()
            });
        }, 2000);
    } else {
        console.warn('此设备不支持BroadcastChannel API，回退到localStorage方案');
        setupLocalStorageFallback();
    }
    
    // 当页面关闭时发送离开消息
    window.addEventListener('beforeunload', function() {
        if (crossDeviceCurrentChannel && crossDeviceCurrentUser) {
            sendMessageToChannel({
                type: CROSS_DEVICE_MESSAGE_TYPES.LEAVE,
                user: crossDeviceCurrentUser,
                deviceId: crossDeviceId,
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
                if (data.deviceId !== crossDeviceId) {
                    processIncomingMessage(data);
                }
            } catch (e) {
                console.error('处理localStorage消息出错:', e);
            }
        }
    });
    
    isCrossDeviceConnected = true;
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
    
    crossDeviceCurrentUser = username;
    const channelId = CROSS_DEVICE_CHANNEL_PREFIX + roomId;
    
    // 创建或重用广播通道
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            crossDeviceCurrentChannel = new BroadcastChannel(channelId);
            crossDeviceCurrentChannel.name = roomId; // 保存原始ID方便调试
            
            crossDeviceCurrentChannel.onmessage = function(event) {
                const message = event.data;
                // 避免处理自己发送的消息
                if (message.deviceId !== crossDeviceId) {
                    processIncomingMessage(message);
                }
            };
            
            console.log('成功创建BroadcastChannel:', channelId);
        } catch (e) {
            console.error('创建BroadcastChannel失败:', e);
            // 回退到localStorage
            crossDeviceCurrentChannel = { id: channelId, name: roomId };
            setupLocalStorageFallback();
        }
    } else {
        // localStorage方式，只记录通道ID
        crossDeviceCurrentChannel = { id: channelId, name: roomId };
    }
    
    // 发送加入消息
    setTimeout(() => {
        const success = sendMessageToChannel({
            type: CROSS_DEVICE_MESSAGE_TYPES.JOIN,
            user: username,
            deviceId: crossDeviceId,
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
    if (crossDeviceCurrentChannel && crossDeviceCurrentUser) {
        // 发送离开消息
        sendMessageToChannel({
            type: CROSS_DEVICE_MESSAGE_TYPES.LEAVE,
            user: crossDeviceCurrentUser,
            deviceId: crossDeviceId,
            timestamp: Date.now()
        });
        
        // 关闭通道
        if (typeof BroadcastChannel !== 'undefined' && crossDeviceCurrentChannel.close) {
            try {
                crossDeviceCurrentChannel.close();
                console.log('已关闭BroadcastChannel');
            } catch (e) {
                console.error('关闭BroadcastChannel失败:', e);
            }
        }
        
        crossDeviceCurrentChannel = null;
        
        // 停止心跳
        if (window._crossDeviceHeartbeat) {
            clearInterval(window._crossDeviceHeartbeat);
            window._crossDeviceHeartbeat = null;
        }
    }
}

/**
 * 开始心跳检测
 */
function startHeartbeat() {
    if (window._crossDeviceHeartbeat) {
        clearInterval(window._crossDeviceHeartbeat);
    }
    
    window._crossDeviceHeartbeat = setInterval(function() {
        if (crossDeviceCurrentChannel && crossDeviceCurrentUser) {
            sendMessageToChannel({
                type: CROSS_DEVICE_MESSAGE_TYPES.HEARTBEAT,
                user: crossDeviceCurrentUser,
                deviceId: crossDeviceId,
                timestamp: Date.now()
            });
        }
    }, 5000); // 减少至5秒一次，提高响应速度
    
    // 页面关闭时清除心跳
    window.addEventListener('beforeunload', () => {
        if (window._crossDeviceHeartbeat) {
            clearInterval(window._crossDeviceHeartbeat);
        }
        
        // 发送离开消息
        if (crossDeviceCurrentChannel && crossDeviceCurrentUser) {
            sendMessageToChannel({
                type: CROSS_DEVICE_MESSAGE_TYPES.LEAVE,
                user: crossDeviceCurrentUser,
                deviceId: crossDeviceId,
                timestamp: Date.now()
            });
        }
    });
}

/**
 * 发送文本消息
 * @param {string} text 消息文本
 */
function sendTextMessage(text) {
    if (!crossDeviceCurrentChannel || !crossDeviceCurrentUser) {
        console.warn('未加入房间，无法发送消息');
        return false;
    }
    
    return sendMessageToChannel({
        type: CROSS_DEVICE_MESSAGE_TYPES.TEXT,
        text: text,
        user: crossDeviceCurrentUser,
        deviceId: crossDeviceId,
        timestamp: Date.now(),
        from: crossDeviceCurrentUser
    });
}

/**
 * 发送消息到通道
 * @param {Object} message 消息对象
 */
function sendMessageToChannel(message) {
    if (!crossDeviceCurrentChannel) {
        console.warn('通道未初始化，不能发送消息');
        return false;
    }
    
    try {
        if (typeof BroadcastChannel !== 'undefined' && crossDeviceCurrentChannel instanceof BroadcastChannel) {
            // 使用BroadcastChannel API
            try {
                crossDeviceCurrentChannel.postMessage(message);
                console.log('通过BroadcastChannel发送消息成功');
            } catch (e) {
                console.error('通过BroadcastChannel发送消息失败:', e);
                // 回退到localStorage
                const channelData = JSON.stringify(message);
                localStorage.setItem(crossDeviceCurrentChannel.id || CROSS_DEVICE_CHANNEL_PREFIX + crossDeviceCurrentChannel.name, channelData);
                setTimeout(() => {
                    localStorage.removeItem(crossDeviceCurrentChannel.id || CROSS_DEVICE_CHANNEL_PREFIX + crossDeviceCurrentChannel.name);
                }, 100);
            }
        } else {
            // 使用localStorage回退方案
            const channelData = JSON.stringify(message);
            localStorage.setItem(crossDeviceCurrentChannel.id, channelData);
            // 短暂延迟后移除，触发其他窗口的storage事件
            setTimeout(() => {
                localStorage.removeItem(crossDeviceCurrentChannel.id);
            }, 100);
        }
        return true;
    } catch (e) {
        console.error('发送消息到通道失败:', e);
        return false;
    }
}

/**
 * 处理接收到的消息
 * @param {Object} message 接收到的消息
 */
function processIncomingMessage(message) {
    console.log('接收到跨设备消息:', message);
    
    switch (message.type) {
        case CROSS_DEVICE_MESSAGE_TYPES.TEXT:
            // 文本消息
            notifyMessageHandlers({
                from: message.user,
                text: message.text,
                _lctext: message.text,
                timestamp: message.timestamp,
                type: 'text'
            });
            break;
            
        case CROSS_DEVICE_MESSAGE_TYPES.JOIN:
            // 加入消息
            console.log('收到加入消息:', message);
            notifyPresenceHandlers({
                type: 'join',
                user: message.user,
                timestamp: message.timestamp
            });
            break;
            
        case CROSS_DEVICE_MESSAGE_TYPES.LEAVE:
            // 离开消息
            notifyPresenceHandlers({
                type: 'leave',
                user: message.user,
                timestamp: message.timestamp
            });
            break;
            
        case CROSS_DEVICE_MESSAGE_TYPES.HEARTBEAT:
            // 心跳消息，可以用于检测活跃用户
            console.log('收到心跳消息:', message);
            break;
    }
}

/**
 * 通知所有消息处理器
 * @param {Object} message 消息对象
 */
function notifyMessageHandlers(message) {
    crossDeviceMessageCallbacks.forEach(function(handler) {
        try {
            handler(message);
        } catch (e) {
            console.error('调用消息处理器时出错:', e);
        }
    });
}

/**
 * 通知所有在线状态处理器
 * @param {Object} presence 在线状态对象
 */
function notifyPresenceHandlers(presence) {
    crossDevicePresenceCallbacks.forEach(function(handler) {
        try {
            handler(presence);
        } catch (e) {
            console.error('调用状态处理器时出错:', e);
        }
    });
}

/**
 * 添加消息处理器
 * @param {Function} handler 处理函数
 */
function addMessageHandler(handler) {
    if (typeof handler === 'function') {
        crossDeviceMessageCallbacks.push(handler);
    }
}

/**
 * 添加在线状态处理器
 * @param {Function} handler 处理函数
 */
function addPresenceHandler(handler) {
    if (typeof handler === 'function') {
        crossDevicePresenceCallbacks.push(handler);
    }
}

/**
 * 生成设备ID
 */
function generateDeviceId() {
    // 尝试从 sessionStorage 获取持久的会话标识
    let id = sessionStorage.getItem('device_chat_id');
    if (!id) {
        id = 'device_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
        sessionStorage.setItem('device_chat_id', id);
    }
    return id;
}

/**
 * 导出模块
 */
window.crossDevicesBridge = {
    init: init,
    join: joinRoom,
    leave: leaveCurrentRoom,
    sendText: sendTextMessage,
    addMessageHandler: addMessageHandler,
    addPresenceHandler: addPresenceHandler,
    isConnected: function() { return isCrossDeviceConnected; },
    deviceId: crossDeviceId
};

// 自动初始化
init(); 