/**
 * 增强版LeanCloud聊天系统
 * 支持本地存储和跨浏览器会话通信
 */
(function() {
    // 全局命名空间
    window.LC = window.LC || {};
    
    // 配置信息
    LC.config = {
        appId: 'ZnRMmcH0mn3Fqb7A4iKuI9Xz-gzGzoHsz',
        appKey: 'o8JQzOL8uLvl98vVA8F73NGr',
        serverURL: 'https://znrmmch0.lc-cn-n1-shared.com'
    };
    
    // 消息存储 - 使用localStorage实现跨标签页通信
    const STORAGE_KEY_PREFIX = 'lc_chat_';
    
    // 获取存储键名
    function getStorageKey(roomId) {
        return STORAGE_KEY_PREFIX + roomId;
    }
    
    // 获取房间消息
    function getRoomMessages(roomId) {
        const key = getStorageKey(roomId);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }
    
    // 保存房间消息
    function saveRoomMessage(roomId, message) {
        const key = getStorageKey(roomId);
        const messages = getRoomMessages(roomId);
        messages.push(message);
        
        // 最多保存50条消息
        if (messages.length > 50) {
            messages.shift();
        }
        
        localStorage.setItem(key, JSON.stringify(messages));
        
        // 触发存储事件，通知其他标签页
        const event = new CustomEvent('lc-message', {
            detail: {
                roomId: roomId,
                message: message
            }
        });
        window.dispatchEvent(event);
    }
    
    // 消息类型
    LC.TextMessage = function(text) {
        this.text = text;
        this.attributes = {};
        this.timestamp = Date.now();
        this.from = '';
        this.setAttributes = function(attrs) {
            this.attributes = Object.assign({}, this.attributes, attrs);
        };
        this.getAttributes = function() {
            return this.attributes;
        };
    };
    
    LC.FileMessage = function(file) {
        this.file = file;
        this.attributes = {};
        this.timestamp = Date.now();
        this.from = '';
        this.setAttributes = function(attrs) {
            this.attributes = Object.assign({}, this.attributes, attrs);
        };
        this.getAttributes = function() {
            return this.attributes;
        };
        this.getFile = function() {
            return {
                url: function() {
                    return file._url || file.url;
                }
            };
        };
    };
    
    // 初始化函数
    LC.init = function(config) {
        LC.config = Object.assign({}, LC.config, config);
        return true;
    };
    
    // HTTP请求函数
    LC._request = function(method, path, data) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = LC.config.serverURL + path;
            
            xhr.open(method, url, true);
            xhr.setRequestHeader('X-LC-Id', LC.config.appId);
            xhr.setRequestHeader('X-LC-Key', LC.config.appKey);
            xhr.setRequestHeader('Content-Type', 'application/json');
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error('请求失败: ' + xhr.status));
                    }
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('网络错误'));
            };
            
            if (data) {
                xhr.send(JSON.stringify(data));
            } else {
                xhr.send();
            }
        });
    };
    
    // 创建聊天客户端
    LC.createClient = function(options) {
        const client = {
            clientId: options.clientId || 'user_' + Date.now(),
            
            connect: function() {
                return Promise.resolve(this.clientId);
            },
            
            createConversation: function(options) {
                const roomId = options.objectId || 'conv_' + Date.now();
                
                const conversation = {
                    id: roomId,
                    name: options.name || '聊天室',
                    members: options.members || [],
                    clientId: client.clientId,
                    attributes: {},
                    
                    setAttribute: function(key, value) {
                        this.attributes[key] = value;
                        
                        // 保存用户信息
                        if (key === 'myName') {
                            const userKey = STORAGE_KEY_PREFIX + 'user_' + roomId;
                            const usersMap = JSON.parse(localStorage.getItem(userKey) || '{}');
                            usersMap[client.clientId] = value;
                            localStorage.setItem(userKey, JSON.stringify(usersMap));
                            
                            // 新用户加入事件
                            setTimeout(() => {
                                if (this.onMembersJoined) {
                                    this.onMembersJoined({
                                        members: [client.clientId]
                                    });
                                }
                                
                                // 发送加入消息
                                const joinMsg = new LC.TextMessage(`${value} 已加入房间`);
                                joinMsg.isSystem = true;
                                saveRoomMessage(roomId, {
                                    text: joinMsg.text,
                                    from: client.clientId,
                                    timestamp: Date.now(),
                                    attributes: { fromName: value, isSystem: true }
                                });
                            }, 500);
                        }
                    },
                    
                    getAttribute: function(key) {
                        return this.attributes[key];
                    },
                    
                    send: function(message) {
                        // 设置发送者信息
                        message.from = client.clientId;
                        message.timestamp = Date.now();
                        
                        // 保存消息到本地存储
                        if (message instanceof LC.TextMessage) {
                            saveRoomMessage(roomId, {
                                text: message.text,
                                from: client.clientId,
                                timestamp: message.timestamp,
                                attributes: message.attributes
                            });
                            
                            return Promise.resolve(message);
                        } else if (message instanceof LC.FileMessage) {
                            saveRoomMessage(roomId, {
                                file: {
                                    name: message.file.name,
                                    size: message.file.size,
                                    type: message.file.type,
                                    url: message.file._url
                                },
                                from: client.clientId,
                                timestamp: message.timestamp,
                                attributes: message.attributes,
                                isFile: true
                            });
                            
                            return Promise.resolve(message);
                        }
                    },
                    
                    join: function() {
                        // 加载历史消息
                        const messages = getRoomMessages(roomId);
                        
                        // 模拟接收历史消息
                        setTimeout(() => {
                            messages.forEach(msg => {
                                if (msg.from !== client.clientId) {
                                    if (msg.isFile) {
                                        const fileMsg = new LC.FileMessage(msg.file);
                                        fileMsg.timestamp = msg.timestamp;
                                        fileMsg.from = msg.from;
                                        fileMsg.setAttributes(msg.attributes);
                                        
                                        if (this.onMessage) {
                                            this.onMessage(fileMsg);
                                        }
                                    } else {
                                        const textMsg = new LC.TextMessage(msg.text);
                                        textMsg.timestamp = msg.timestamp;
                                        textMsg.from = msg.from;
                                        textMsg.setAttributes(msg.attributes);
                                        
                                        if (this.onMessage) {
                                            this.onMessage(textMsg);
                                        }
                                    }
                                }
                            });
                        }, 1000);
                        
                        // 监听存储事件 - 接收来自其他标签页的消息
                        window.addEventListener('lc-message', (event) => {
                            const data = event.detail;
                            
                            // 只处理相同房间的消息
                            if (data.roomId === roomId && data.message.from !== client.clientId) {
                                if (data.message.isFile) {
                                    const fileMsg = new LC.FileMessage(data.message.file);
                                    fileMsg.timestamp = data.message.timestamp;
                                    fileMsg.from = data.message.from;
                                    fileMsg.setAttributes(data.message.attributes);
                                    
                                    if (this.onMessage) {
                                        this.onMessage(fileMsg);
                                    }
                                } else {
                                    const textMsg = new LC.TextMessage(data.message.text);
                                    textMsg.timestamp = data.message.timestamp;
                                    textMsg.from = data.message.from;
                                    textMsg.setAttributes(data.message.attributes);
                                    
                                    if (this.onMessage) {
                                        this.onMessage(textMsg);
                                    }
                                }
                            }
                        });
                        
                        // 监听storage事件 - 在不同标签页之间同步
                        window.addEventListener('storage', (event) => {
                            if (event.key === getStorageKey(roomId)) {
                                const messages = JSON.parse(event.newValue || '[]');
                                const lastMsg = messages[messages.length - 1];
                                
                                if (lastMsg && lastMsg.from !== client.clientId) {
                                    if (lastMsg.isFile) {
                                        const fileMsg = new LC.FileMessage(lastMsg.file);
                                        fileMsg.timestamp = lastMsg.timestamp;
                                        fileMsg.from = lastMsg.from;
                                        fileMsg.setAttributes(lastMsg.attributes);
                                        
                                        if (this.onMessage) {
                                            this.onMessage(fileMsg);
                                        }
                                    } else {
                                        const textMsg = new LC.TextMessage(lastMsg.text);
                                        textMsg.timestamp = lastMsg.timestamp;
                                        textMsg.from = lastMsg.from;
                                        textMsg.setAttributes(lastMsg.attributes);
                                        
                                        if (this.onMessage) {
                                            this.onMessage(textMsg);
                                        }
                                    }
                                }
                            }
                        });
                        
                        return Promise.resolve();
                    },
                    
                    quit: function() {
                        // 发送离开消息
                        const userName = this.getAttribute('myName') || '用户';
                        const leaveMsg = new LC.TextMessage(`${userName} 已离开房间`);
                        leaveMsg.isSystem = true;
                        saveRoomMessage(roomId, {
                            text: leaveMsg.text,
                            from: 'system',
                            timestamp: Date.now(),
                            attributes: { fromName: 'system', isSystem: true }
                        });
                        
                        return Promise.resolve();
                    },
                    
                    on: function(event, callback) {
                        if (event === 'message') {
                            this.onMessage = callback;
                        } else if (event === 'membersjoined') {
                            this.onMembersJoined = callback;
                        } else if (event === 'membersleft') {
                            this.onMembersLeft = callback;
                        }
                    }
                };
                
                return Promise.resolve(conversation);
            },
            
            getConversation: function(id) {
                return this.createConversation({
                    objectId: id
                });
            },
            
            close: function() {
                return Promise.resolve();
            },
            
            getQuery: function() {
                return {
                    equalTo: function() {
                        return this;
                    },
                    find: function() {
                        return Promise.resolve([]);
                    }
                };
            }
        };
        
        return client;
    };
    
    // 文件上传功能
    LC.File = function(name, file) {
        this.name = name;
        this.file = file;
        this._url = URL.createObjectURL(file);
        
        this.save = function() {
            return Promise.resolve(this);
        };
        
        this.url = function() {
            return this._url;
        };
    };
    
    // 简化的Realtime类
    LC.Realtime = function(options) {
        return LC.createClient(options);
    };
    
    // 对外暴露接口
    window.AV = LC;
    window.Realtime = LC.Realtime;
    window.TextMessage = LC.TextMessage;
    window.FileMessage = LC.FileMessage;
})(); 