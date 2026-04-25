// js/notification.js
// ================= 堆叠通知栏 + 真实聊天室小窗模式 =================
(function() {

var notiCards = [];
var notiAutoHideTimer = null;
var hcMiniChatContact = null;
var isMiniMode = false;

// ================= 1. 推送堆叠通知 =================
window.pushHcNotification = function(contact, messageText) {
    if (!contact || !contact.name) return;
    hcMiniChatContact = contact;

    var stack = document.getElementById('hcNotiStack');
    if (!stack) return;

    var avatarContent = (contact && contact.avatar)
        ? '<img src="' + contact.avatar + '">'
        : '🤖';
    var timeStr = (typeof getCurrentTime === 'function') ? getCurrentTime() : 'NOW';

    var card = document.createElement('div');
    card.className = 'hc-noti-card';
    card.innerHTML =
        '<div class="hc-avatar-outer">' +
            '<div class="hc-avatar-ring"><svg viewBox="0 0 100 100" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="0.8"><circle cx="50" cy="50" r="48" stroke-dasharray="3 5"/><circle cx="50" cy="50" r="42" stroke-dasharray="1 8" stroke="rgba(0,0,0,0.06)"/></svg></div>' +
            '<div class="hc-avatar-circle">' + avatarContent + '</div>' +
        '</div>' +
        '<div class="hc-noti-inner">' +
            '<div class="hc-noti-body">' +
                '<div class="hc-noti-tags"><div class="hc-tag-dot"></div><span class="hc-tag-black">NEW</span><span class="hc-tag-outline">' + (contact.group || 'CHAT') + '</span></div>' +
                '<div class="hc-noti-name">' + contact.name + '</div>' +
                '<div class="hc-noti-msg">' + messageText + '</div>' +
            '</div>' +
            '<div class="hc-noti-right">' +
                '<span class="hc-noti-time">' + timeStr + '</span>' +
                '<svg class="hc-noti-star" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>' +
                '<div class="hc-noti-barcode"></div>' +
            '</div>' +
        '</div>' +
        '<div class="hc-noti-footer">' +
            '<span class="hc-footer-star">✦</span><div class="hc-footer-line"></div>' +
            '<span class="hc-footer-text">Tap to reply</span>' +
            '<div class="hc-footer-line"></div><span class="hc-footer-star">✦</span>' +
        '</div>';

    card.onclick = function() { window.openHcMiniChat(); };
    stack.prepend(card);
    notiCards.unshift(card);

    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            card.classList.add('visible', 'top');
            rearrangeStack();
        });
    });

    clearTimeout(notiAutoHideTimer);
    notiAutoHideTimer = setTimeout(function() { clearAllNotifications(); }, 6000);
};

// ================= 2. 排列堆叠 =================
function rearrangeStack() {
    for (var i = 0; i < notiCards.length; i++) {
        var c = notiCards[i];
        c.classList.remove('top', 'stack-1', 'stack-2', 'stack-3', 'stack-hide');
        if (i === 0) { c.classList.add('visible', 'top'); }
        else if (i === 1) { c.classList.remove('visible'); c.classList.add('stack-1'); }
        else if (i === 2) { c.classList.remove('visible'); c.classList.add('stack-2'); }
        else if (i === 3) { c.classList.remove('visible'); c.classList.add('stack-3'); }
        else { c.classList.remove('visible'); c.classList.add('stack-hide'); }
    }
}

// ================= 3. 清除通知 =================
function clearAllNotifications() {
    for (var i = 0; i < notiCards.length; i++) {
        notiCards[i].classList.remove('visible', 'top', 'stack-1', 'stack-2', 'stack-3');
        notiCards[i].classList.add('stack-hide');
    }
    setTimeout(function() {
        var stack = document.getElementById('hcNotiStack');
        if (stack) stack.innerHTML = '';
        notiCards = [];
    }, 500);
}

// ================= 4. 判断是否弹通知 =================
window.shouldShowNotification = function(contactName) {
    if (typeof currentChatContact !== 'undefined' && currentChatContact && currentChatContact.name === contactName) {
        var chatView = document.getElementById('wcChatView');
        if (chatView && chatView.classList.contains('active')) return false;
    }
    return true;
};

// ================= 5. 点击通知 → 打开真实聊天室（小窗模式） =================
window.openHcMiniChat = function() {
    if (!hcMiniChatContact || !hcMiniChatContact.name) return;

    clearAllNotifications();

    var contact = hcMiniChatContact;

    // 找到联系人在 wcContacts 数组中的索引
    var contactIndex = -1;
    if (typeof wcContacts !== 'undefined') {
        for (var i = 0; i < wcContacts.length; i++) {
            if (wcContacts[i].name === contact.name) {
                contactIndex = i;
                break;
            }
        }
    }
    if (contactIndex < 0) return;

    // 直接设置聊天室数据，不调用 openWeChat
    if (typeof currentChatContact !== 'undefined') {
        currentChatContact = wcContacts[contactIndex];
    }

    // 填充聊天室头部
    var displayName = contact.chatName || contact.name;
    var nameEl = document.getElementById('wcChatName');
    if (nameEl) nameEl.textContent = displayName;
    
    var watermarkEl = document.getElementById('wcChatWatermark');
    if (watermarkEl) watermarkEl.textContent = displayName.charAt(0).toUpperCase() + '.';

    var avatarEl = document.getElementById('wcChatAvatar');
    if (avatarEl) {
        if (contact.avatar) {
            avatarEl.innerHTML = '<img src="' + contact.avatar + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            avatarEl.innerHTML = '🤖';
        }
    }

    // 确保聊天记录存在
    if (typeof chatMessages !== 'undefined' && !chatMessages[contact.name]) {
        chatMessages[contact.name] = [];
    }

    // 渲染聊天记录
    if (typeof renderChatMessages === 'function') {
        renderChatMessages(true);
    }

    // 把聊天室临时移到 main-frame 下，脱离 wechatApp 的限制
    var chatView = document.getElementById('wcChatView');
    var mainFrame = document.getElementById('main-frame');
    if (chatView && mainFrame) {
        mainFrame.appendChild(chatView);
        chatView.classList.add('mini-mode');
        chatView.classList.add('active');
        isMiniMode = true;
    }

    // 滚动到底部
    setTimeout(function() {
        var container = document.getElementById('wcChatMessages');
        if (container) container.scrollTop = container.scrollHeight;
    }, 100);
};

// ================= 6. 关闭小窗模式 =================
window.closeHcMiniChat = function() {
    var chatView = document.getElementById('wcChatView');

    if (chatView && chatView.classList.contains('mini-mode')) {
        chatView.classList.remove('mini-mode');
        chatView.classList.remove('active');
        isMiniMode = false;

        // 把聊天室移回 wechatApp 容器
        var wechatApp = document.getElementById('wechatApp');
        if (wechatApp && chatView.parentNode !== wechatApp) {
            wechatApp.appendChild(chatView);
        }

        // 保存聊天数据但不触发微信列表渲染
        if (typeof currentChatContact !== 'undefined' && currentChatContact && typeof chatMessages !== 'undefined') {
            var msgs = chatMessages[currentChatContact.name];
            if (msgs && msgs.length > 0) {
                var lastMsg = msgs[msgs.length - 1];
                if (typeof wcChats !== 'undefined') {
                    var existingChat = wcChats.find(function(c) { return c.name === currentChatContact.name; });
                    if (existingChat) {
                        existingChat.msg = lastMsg.text;
                        existingChat.time = lastMsg.time;
                    }
                }
            }
        }

        if (typeof saveWeChatData === 'function') saveWeChatData();
        currentChatContact = null;
    }
};

// ================= 7. 拦截聊天室的返回按钮 =================
var originalCloseChatView = null;
var hookInstalled = false;

function installCloseHook() {
    if (hookInstalled) return;
    if (typeof window.closeChatView !== 'function') return;

    originalCloseChatView = window.closeChatView;
    hookInstalled = true;

    window.closeChatView = function() {
        var chatView = document.getElementById('wcChatView');

        // 如果是小窗模式，走小窗关闭逻辑，不走微信列表
        if (chatView && chatView.classList.contains('mini-mode')) {
            window.closeHcMiniChat();
            return;
        }

        // 正常模式走原始逻辑
        if (originalCloseChatView) {
            originalCloseChatView();
        }
    };
}

setTimeout(installCloseHook, 500);
setTimeout(installCloseHook, 1500);
setTimeout(installCloseHook, 3000);

})();
