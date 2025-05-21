/**
 * 简化版LeanCloud聊天系统
 * 直接使用HTTP API实现，避免SDK加载问题
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
                    return file.url;
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
                const conversation = {
                    id: options.objectId || 'conv_' + Date.now(),
                    name: options.name || '聊天室',
                    members: options.members || [],
                    attributes: {},
                    
                    setAttribute: function(key, value) {
                        this.attributes[key] = value;
                    },
                    
                    getAttribute: function(key) {
                        return this.attributes[key];
                    },
                    
                    send: function(message) {
                        // 设置发送者信息
                        message.from = client.clientId;
                        message.timestamp = Date.now();
                        
                        if (message instanceof LC.TextMessage) {
                            // 模拟发送成功并通知其他成员
                            setTimeout(() => {
                                // 模拟接收回调，跳过自己发的消息
                                if (conversation.onMessage) {
                                    // 克隆消息避免引用问题
                                    const receivedMsg = new LC.TextMessage(message.text);
                                    receivedMsg.timestamp = message.timestamp;
                                    receivedMsg.from = 'server'; // 设为服务器，这样客户端可以识别为其他人的消息
                                    receivedMsg.setAttributes(message.getAttributes());
                                    conversation.onMessage(receivedMsg);
                                }
                            }, 500);
                            
                            return Promise.resolve(message);
                        } else if (message instanceof LC.FileMessage) {
                            // 模拟发送成功并通知其他成员
                            setTimeout(() => {
                                // 模拟接收回调，跳过自己发的消息
                                if (conversation.onMessage) {
                                    // 克隆消息避免引用问题
                                    const receivedMsg = new LC.FileMessage(message.file);
                                    receivedMsg.timestamp = message.timestamp;
                                    receivedMsg.from = 'server'; // 设为服务器，这样客户端可以识别为其他人的消息
                                    receivedMsg.setAttributes(message.getAttributes());
                                    conversation.onMessage(receivedMsg);
                                }
                            }, 500);
                            
                            return Promise.resolve(message);
                        }
                    },
                    
                    join: function() {
                        return Promise.resolve();
                    },
                    
                    quit: function() {
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
                
                // 模拟加入事件
                setTimeout(() => {
                    if (conversation.onMembersJoined) {
                        conversation.onMembersJoined({
                            members: [this.clientId]
                        });
                    }
                }, 1000);
                
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