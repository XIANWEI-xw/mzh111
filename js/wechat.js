// js/wechat.js
// ================= 微信应用独立控制逻辑 & 本地储存引擎 =================

let wcContacts = [];
let wcChats = [];
let chatMessages = {}; 
let wcAvatarData = ''; 
let editingContactIndex = -1;
let wcEditAvatarData = '';
let currentChatContact = null;

window.wcPendingReply = false;
window.wcPendingQuoteIndex = -1;

window.cancelWcQuote = function() {
    if (window.wcPendingQuoteIndex >= 0 && currentChatContact) {
        const contactName = currentChatContact.name;
        if (chatMessages[contactName] && chatMessages[contactName][window.wcPendingQuoteIndex]) {
            chatMessages[contactName][window.wcPendingQuoteIndex].isQuoted = false;
            saveWeChatData();
            renderChatMessages();
        }
    }
    window.wcPendingReply = false;
    window.wcPendingQuoteIndex = -1;
    const ind = document.getElementById('quoteIndicator');
    if (ind) ind.classList.remove('active');
};

window.toggleWcTranslate = function(event, btn) {
    event.stopPropagation();
    const bubble = btn.closest('.wc-bubble-bot') || btn.closest('.wc-bubble-user');
    if (bubble) bubble.classList.toggle('translated');
};

// ================= 1. 无限储存引擎 (IndexedDB) =================
const DB_NAME = 'StudioZeroDB';
const STORE_NAME = 'WeChatStore';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function idbSet(key, value) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function idbGet(key) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadWeChatData() {
    try {
        const storedContacts = await idbGet('wcContacts');
        const storedChats = await idbGet('wcChats');
        const storedMessages = await idbGet('chatMessages');

        // 如果 IndexedDB 里有数据就用，没有就去 localStorage 里找（兼容老数据迁移）
        if (storedContacts) wcContacts = storedContacts;
        else if (localStorage.getItem('wcContacts')) wcContacts = JSON.parse(localStorage.getItem('wcContacts'));

        if (storedChats) wcChats = storedChats;
        else if (localStorage.getItem('wcChats')) wcChats = JSON.parse(localStorage.getItem('wcChats'));

        if (storedMessages) chatMessages = storedMessages;
        else if (localStorage.getItem('chatMessages')) chatMessages = JSON.parse(localStorage.getItem('chatMessages'));
        
        // 刷新列表
        renderContacts();
        renderChats();
    } catch (e) {
        console.error("Failed to load from DB", e);
    }
}

function saveWeChatData() {
    // 异步存入硬盘，不再受 5MB 限制
    idbSet('wcContacts', wcContacts);
    idbSet('wcChats', wcChats);
    idbSet('chatMessages', chatMessages);
}

// 页面加载时立刻读取数据
loadWeChatData();

// ================= 2. 基础界面控制 =================
// ================= 基础界面控制 =================
function openWeChat() {
    const wechatApp = document.getElementById('wechatApp');
    if(wechatApp) {
        // 【核心修复】：开启 0.4 秒防误触保护，防止桌面图标点击穿透到聊天列表
        wechatApp.style.pointerEvents = 'none';
        setTimeout(() => {
            wechatApp.style.pointerEvents = 'auto';
        }, 400);

        wechatApp.classList.add('active');
        
        // 强制关闭聊天室界面
        const chatView = document.getElementById('wcChatView');
        if(chatView) chatView.classList.remove('active');
        currentChatContact = null;

        // 强制切回“Chats (聊天列表)”Tab
        document.querySelectorAll('.wc-tab-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.wc-view-section').forEach(el => el.classList.remove('active'));
        
        const chatsTabBtn = document.querySelector('.wc-tab-item:nth-child(1)');
        const chatsViewSec = document.getElementById('wc-view-chats');
        if(chatsTabBtn) chatsTabBtn.classList.add('active');
        if(chatsViewSec) chatsViewSec.classList.add('active');

        updateWeChatClock();
        renderContacts();
        renderChats();
    }
}

function closeWeChat() {
    const wechatApp = document.getElementById('wechatApp');
    if(wechatApp) {
        // 退出时同样开启防误触保护，防止穿透点击到桌面其他图标
        wechatApp.style.pointerEvents = 'none';
        wechatApp.classList.remove('active');
        setTimeout(() => {
            wechatApp.style.pointerEvents = 'auto';
        }, 400);
    }
    
    // 退出微信时，顺手把聊天室也强制关掉重置
    const chatView = document.getElementById('wcChatView');
    if(chatView) chatView.classList.remove('active');
    currentChatContact = null;
}

function switchWeChatTab(targetViewId, element) {
    document.querySelectorAll('.wc-tab-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.wc-view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(targetViewId).classList.add('active');
}

function updateWeChatClock() {
    const now = new Date();
    let h = now.getHours().toString().padStart(2, '0');
    let m = now.getMinutes().toString().padStart(2, '0');
    const wcClock = document.getElementById('wc-clock');
    if(wcClock) wcClock.innerText = `${h}:${m}`;
    
    const wcChatClock = document.getElementById('wc-chat-clock');
    if(wcChatClock) wcChatClock.innerText = `${h}:${m}`;
}
setInterval(updateWeChatClock, 1000);

// ================= 3. 新建联系人逻辑 =================
function previewWcAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        wcAvatarData = e.target.result;
        const img = document.getElementById('wcAvatarPreviewImg');
        img.src = wcAvatarData;
        document.getElementById('wcAvatarCircle').classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

function selectWcTag(el) {
    document.querySelectorAll('.wc-group-tag').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

function customWcTag(el) {
    const name = prompt('Enter custom group name:');
    if (name && name.trim()) {
        document.querySelectorAll('.wc-group-tag').forEach(t => t.classList.remove('active'));
        const newTag = document.createElement('div');
        newTag.className = 'wc-group-tag active';
        newTag.textContent = name.trim();
        newTag.onclick = function() { selectWcTag(newTag); };
        el.parentNode.insertBefore(newTag, el);
    }
}

function openNewContactModal() {
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    document.getElementById('wcContactName').value = '';
    document.getElementById('wcContactPersona').value = '';
    wcAvatarData = '';
    const img = document.getElementById('wcAvatarPreviewImg');
    img.src = '';
    document.getElementById('wcAvatarCircle').classList.remove('has-image');
    
    document.querySelectorAll('.wc-group-tag').forEach(t => t.classList.remove('active'));
    const firstTag = document.querySelector('.wc-group-tag');
    if(firstTag) firstTag.classList.add('active');
    
    document.getElementById('wcNewContactModal').classList.add('active');
}

function closeNewContactModal() {
    document.getElementById('wcNewContactModal').classList.remove('active');
}

function saveNewContact() {
    playWcSaveSound();
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    const name = document.getElementById('wcContactName').value.trim();
    const persona = document.getElementById('wcContactPersona').value.trim() || 'No persona description provided.';
    const activeTag = document.querySelector('.wc-group-tag.active');
    const group = activeTag ? activeTag.textContent.trim() : 'Uncategorized';
    const avatar = wcAvatarData || '';
    
    if (!name) return alert('Please enter a name.');

    wcContacts.push({ name, avatar, group, persona });
    
    wcChats.unshift({
        name: name,
        avatar: avatar,
        time: 'Just now',
        msg: persona
    });

    saveWeChatData(); // 保存数据
    closeNewContactModal();
    renderContacts();
    renderChats();
}

// ================= 4. 编辑联系人逻辑 =================
function openEditContactModal(index) {
    editingContactIndex = index;
    const contact = wcContacts[index];
    if (!contact) return;

    document.getElementById('wcEditContactName').value = contact.name;
    document.getElementById('wcEditContactPersona').value = contact.persona;
    
    wcEditAvatarData = contact.avatar || '';
    const img = document.getElementById('wcEditAvatarPreviewImg');
    const circle = document.getElementById('wcEditAvatarCircle');
    if (wcEditAvatarData) {
        img.src = wcEditAvatarData;
        img.style.display = 'block';
        circle.querySelector('.wc-edit-avatar-placeholder').style.display = 'none';
    } else {
        img.style.display = 'none';
        circle.querySelector('.wc-edit-avatar-placeholder').style.display = 'flex';
    }

    const tags = document.querySelectorAll('#wcEditGroupTags .wc-group-tag');
    tags.forEach(t => {
        t.classList.remove('active');
        if (t.textContent.trim() === contact.group) t.classList.add('active');
    });
    
    const hasActive = document.querySelector('#wcEditGroupTags .wc-group-tag.active');
    if (!hasActive) {
        const customBtn = document.querySelector('#wcEditGroupTags .wc-group-tag-custom');
        if (customBtn) {
            const newTag = document.createElement('div');
            newTag.className = 'wc-group-tag active';
            newTag.textContent = contact.group;
            newTag.onclick = function() { selectWcTag(newTag); };
            customBtn.parentNode.insertBefore(newTag, customBtn);
        }
    }

    document.getElementById('wcEditContactModal').classList.add('active');
}

function closeEditContactModal() {
    document.getElementById('wcEditContactModal').classList.remove('active');
    editingContactIndex = -1;
}

function previewEditAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        wcEditAvatarData = e.target.result;
        const img = document.getElementById('wcEditAvatarPreviewImg');
        img.src = wcEditAvatarData;
        img.style.display = 'block';
        document.getElementById('wcEditAvatarCircle').querySelector('.wc-edit-avatar-placeholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function saveEditContact() {
    if (editingContactIndex < 0) return;
    playWcSaveSound();
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);

    const oldName = wcContacts[editingContactIndex].name;
    const newName = document.getElementById('wcEditContactName').value.trim();
    const persona = document.getElementById('wcEditContactPersona').value.trim() || 'No persona description provided.';
    const activeTag = document.querySelector('#wcEditGroupTags .wc-group-tag.active');
    const group = activeTag ? activeTag.textContent.trim() : 'Uncategorized';
    const newAvatar = wcEditAvatarData || wcContacts[editingContactIndex].avatar;

    if (!newName) return alert('Please enter a name.');

    wcContacts[editingContactIndex].name = newName;
    wcContacts[editingContactIndex].persona = persona;
    wcContacts[editingContactIndex].group = group;
    wcContacts[editingContactIndex].avatar = newAvatar;

    wcChats.forEach(chat => {
        if (chat.name === oldName) {
            chat.name = newName;
            chat.avatar = newAvatar;
            chat.msg = persona;
        }
    });

    // 迁移聊天记录的 Key
    if (oldName !== newName && chatMessages[oldName]) {
        chatMessages[newName] = chatMessages[oldName];
        delete chatMessages[oldName];
    }

    saveWeChatData(); // 保存数据
    closeEditContactModal();
    renderContacts();
    renderChats();
}

function deleteContact() {
    if (editingContactIndex < 0) return;
    playWcDangerSound();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    if (!confirm('Delete this AI Persona and all chat history?')) return;

    const deletedName = wcContacts[editingContactIndex].name;
    
    wcContacts.splice(editingContactIndex, 1);
    wcChats = wcChats.filter(chat => chat.name !== deletedName);
    delete chatMessages[deletedName]; // 删除聊天记录

    saveWeChatData(); // 保存数据
    closeEditContactModal();
    renderContacts();
    renderChats();
}

// ================= 5. 渲染列表 =================
function renderContacts() {
    const container = document.getElementById('wc-contacts-list');
    if (!container) return;
    container.innerHTML = '';

    if (wcContacts.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#ccc; padding:40px 20px; font-size:13px; font-family:Georgia, serif; font-style:italic;">No AI Personas yet.</div>';
        return;
    }

    const grouped = {};
    wcContacts.forEach(c => {
        if(!grouped[c.group]) grouped[c.group] = [];
        grouped[c.group].push(c);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(groupName => {
        html += `<div class="wc-contact-group"><div class="wc-group-title">${groupName}</div>`;
        grouped[groupName].sort((a,b) => a.name.localeCompare(b.name)).forEach(contact => {
            const avatarContent = contact.avatar 
                ? `<img src="${contact.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;">` 
                : '🤖';
            const contactIndex = wcContacts.indexOf(contact);
            html += `
                <div class="wc-contact-item" onclick="openEditContactModal(${contactIndex})">
                    <div class="wc-contact-avatar">${avatarContent}</div>
                    <div class="wc-contact-info">
                        <div class="wc-contact-name">${contact.name}</div>
                        <div class="wc-contact-persona">${contact.persona}</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    });
    
    container.innerHTML = html;
}

function renderChats() {
    const container = document.getElementById('wc-chat-list');
    if (!container) return;
    container.innerHTML = '';

    if (wcChats.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#ccc; padding:40px 20px; font-size:13px; font-family:Georgia, serif; font-style:italic;">No messages.</div>';
        return;
    }

    const decoTexts = ['no. 01', 'vol. i', 'ch. 1', '§ memo', '— note', 'draft', 'log.'];
    const decoStars = ['✧ · ✦', '★ ✧', '· ✦ ·', '✧ ★ ✧', '⟡ · ✦'];

    let html = '';
    wcChats.forEach((chat, index) => {
        const chatContactIndex = wcContacts.findIndex(c => c.name === chat.name);
        const contact = wcContacts[chatContactIndex];
        
        const displayName = (contact && contact.chatName) ? contact.chatName : chat.name;
        const displayAvatar = (contact && contact.avatar) ? contact.avatar : chat.avatar;

        const avatarContent = displayAvatar 
            ? `<img src="${displayAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;">` 
            : '🤖';
        const randomDeco = decoTexts[index % decoTexts.length];
        const randomStars = decoStars[index % decoStars.length];
        
        html += `
            <div class="wc-chat-item" onclick="openChatView(${chatContactIndex})">
                <div class="wc-card-deco-line"></div>
                <div class="wc-card-deco-stars">${randomStars}</div>
                <div class="wc-card-deco-corner">${randomDeco}</div>
                <div class="wc-card-deco-dot"></div>
                
                <div class="wc-avatar-container">
                    <div class="wc-avatar-bg"></div>
                    <div class="wc-avatar-img">${avatarContent}</div>
                </div>
                <div class="wc-chat-info">
                    <div class="wc-chat-header">
                        <span class="wc-chat-name">${displayName}</span>
                        <span class="wc-chat-time">${chat.time}</span>
                    </div>
                    <div class="wc-chat-msg">${chat.msg}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ================= 6. 聊天对话界面逻辑 =================
let currentChatDisplayLimit = 20;

let isFetchingMoreChats = false;
let chatScrollListenerActive = false;

function openChatView(contactIndex) {
    const contact = wcContacts[contactIndex];
    if (!contact) return;
    
    currentChatContact = contact;
    currentChatDisplayLimit = 20; 
    isFetchingMoreChats = false;
    chatScrollListenerActive = false;
    
    const displayName = contact.chatName || contact.name;
    document.getElementById('wcChatName').textContent = displayName;
    const watermarkEl = document.getElementById('wcChatWatermark');
    if (watermarkEl) watermarkEl.textContent = displayName.charAt(0).toUpperCase() + '.';
    
    const avatarEl = document.getElementById('wcChatAvatar');
    if (contact.avatar) {
        avatarEl.innerHTML = `<img src="${contact.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        avatarEl.innerHTML = '🤖';
    }
    
    if (!chatMessages[contact.name]) {
        chatMessages[contact.name] = [];
    }
    
    const container = document.getElementById('wcChatMessages');
    container.removeEventListener('scroll', handleChatScroll);
    
    renderChatMessages(true);
    applyBubbleStyle(contact.bubbleStyle || 'default');
    applyChatBg();
    document.getElementById('wcChatView').classList.add('active');

    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
        
        setTimeout(() => {
            chatScrollListenerActive = true;
            container.addEventListener('scroll', handleChatScroll);
        }, 500);
    }, 50);
}

function handleChatScroll() {
    if (!currentChatContact || isFetchingMoreChats || !chatScrollListenerActive) return;
    
    const container = document.getElementById('wcChatMessages');
    const totalMsgs = chatMessages[currentChatContact.name]?.length || 0;
    
    if (container.scrollTop < 50 && currentChatDisplayLimit < totalMsgs) {
        isFetchingMoreChats = true;
        chatScrollListenerActive = false;
        
        container.removeEventListener('scroll', handleChatScroll);
        
        const oldScrollHeight = container.scrollHeight;
        currentChatDisplayLimit += 20;
        
        renderChatMessages(false, oldScrollHeight);
    }
}

function closeChatView() {
    document.getElementById('wcChatView').classList.remove('active');
    
    closeWcPlusMenu();
    if (window.wcPendingReply) {
        window.cancelWcQuote();
    }
    
    if (currentChatContact && chatMessages[currentChatContact.name]) {
        const msgs = chatMessages[currentChatContact.name];
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            const existingChat = wcChats.find(c => c.name === currentChatContact.name);
            if (existingChat) {
                existingChat.msg = lastMsg.text;
                existingChat.time = lastMsg.time;
            }
        }
    }
    
    saveWeChatData(); 
    renderChats();
    currentChatContact = null;
}

function sendWcMessageOnly() {
    const input = document.getElementById('wcChatInput');
    const text = input.value.trim();
    if (!text || !currentChatContact) return;
    
    playWcSendSound();
    triggerWcHaptic('send');
    
    let finalText = text;
    const newMsg = { role: 'user', text: finalText, time: getCurrentTime() };
    
    if (window.wcPendingReply && window.wcPendingQuoteIndex >= 0) {
        newMsg.isReply = true;
        newMsg.replyToIndex = window.wcPendingQuoteIndex;
        window.wcPendingReply = false;
        window.wcPendingQuoteIndex = -1;
        const quoteIndicator = document.getElementById('quoteIndicator');
        if (quoteIndicator) quoteIndicator.classList.remove('active');
    }

    chatMessages[currentChatContact.name].push(newMsg);
    saveWeChatData(); 
    
    input.value = '';
    appendChatMessageToDOM(newMsg); 
}

window.sendWcPhotoMessage = function(event) {
    const file = event.target.files[0];
    if (!file || !currentChatContact) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // 既然空间无限了，提高照片清晰度
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200; // 提高分辨率
            const MAX_HEIGHT = 1200; 
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // 提高画质到 0.85
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

            if (typeof playWcSendSound === 'function') playWcSendSound();
            if (typeof triggerWcHaptic === 'function') triggerWcHaptic('send');

            const pStyle = currentChatContact.photoStyle || 'a';
            let imgHtml = '';
            const timeStr = getCurrentTime();
            const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            if (pStyle === 'a') {
                imgHtml = `<div class="photo-card-a"><img src="${compressedDataUrl}" class="pc-demo-img"><div class="photo-a-text">Captured moment</div></div>`;
            } else if (pStyle === 'b') {
                imgHtml = `<div class="photo-card-b"><img src="${compressedDataUrl}" class="pc-demo-img"><div class="photo-b-meta"><div class="photo-b-left"><span class="photo-b-title">VISION LENS</span><span class="photo-b-sub">Uploaded Image</span></div><div class="photo-b-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></div></div></div>`;
            } else if (pStyle === 'c') {
                imgHtml = `<div class="photo-card-c"><div class="photo-c-top"><div class="photo-c-tag">RAW</div><div class="photo-c-iso">ISO 400</div></div><img src="${compressedDataUrl}" class="pc-demo-img"><div class="photo-c-bottom"><div class="photo-c-barcode"></div><div class="photo-c-date">${dateStr}</div></div></div>`;
            } else if (pStyle === 'd') {
                imgHtml = `<div class="photo-card-d"><img src="${compressedDataUrl}" class="pc-demo-img"><div class="pc1-footer"><span class="pc1-tag">LENS // VISION</span><div class="pc1-barcode"></div></div></div>`;
            } else if (pStyle === 'e') {
                imgHtml = `<div class="photo-card-e"><img src="${compressedDataUrl}" class="pc-demo-img"><div class="pc2-footer"><span class="pc2-tag">Captured.</span><span class="pc2-time">${timeStr}</span></div></div>`;
            } else if (pStyle === 'f') {
                imgHtml = `<div class="photo-card-f"><img src="${compressedDataUrl}" class="pc-demo-img"><div class="pc3-pill"><div class="pc3-pill-dot"></div><span class="pc3-pill-text">LENS · ${timeStr}</span></div></div>`;
            } else {
                imgHtml = `<img src="${compressedDataUrl}" style="max-width: 100%; border-radius: 8px; display: block; margin: 4px 0;">`;
            }
            
            const newMsg = { 
                role: 'user', 
                text: imgHtml, 
                visionUrl: compressedDataUrl,
                time: timeStr 
            };

            // 存入数组并异步保存，无需再捕获容量错误
            chatMessages[currentChatContact.name].push(newMsg);
            saveWeChatData();
            
            appendChatMessageToDOM(newMsg);
            closeWcPlusMenu();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

function triggerAICall() {
    if (!currentChatContact) return;

    const input = document.getElementById('wcChatInput');
    const text = input.value.trim();
    
    if (text) {
        playWcSendSound();
        triggerWcHaptic('send');

        const newMsg = { role: 'user', text: text, time: getCurrentTime() };
        
        if (window.wcPendingReply && window.wcPendingQuoteIndex >= 0) {
            newMsg.isReply = true;
            newMsg.replyToIndex = window.wcPendingQuoteIndex;
            window.wcPendingReply = false;
            window.wcPendingQuoteIndex = -1;
            const quoteIndicator = document.getElementById('quoteIndicator');
            if (quoteIndicator) quoteIndicator.classList.remove('active');
        }

        chatMessages[currentChatContact.name].push(newMsg);
        input.value = '';
        appendChatMessageToDOM(newMsg); 
    }
    
    showTypingIndicator();
    callChatAPI(currentChatContact, chatMessages[currentChatContact.name]);
}

async function callChatAPI(contact, messages) {
    const settings = JSON.parse(localStorage.getItem('systemSettings')) || {};
    const apiUrl = settings.apiUrl || (document.getElementById('setApiUrl') ? document.getElementById('setApiUrl').value.trim() : '');
    const apiToken = settings.apiToken || (document.getElementById('setApiToken') ? document.getElementById('setApiToken').value.trim() : '');
    const model = settings.apiModel || (document.getElementById('setApiModelSelect') ? document.getElementById('setApiModelSelect').value : '');

    if (!apiUrl || !apiToken || !model) {
        removeTypingIndicator();
        const errMsg = { role: 'bot', text: '⚠️ Please configure API URL, Token, and Model in Settings or "Me" page first.', time: getCurrentTime() };
        chatMessages[contact.name].push(errMsg);
        appendChatMessageToDOM(errMsg);
        return;
    }

    const apiMessages = [];

    let wbData = { before: '', middle: '', after: '' };
    if (typeof getWorldbookPrompt === 'function') {
        wbData = getWorldbookPrompt(contact.name, messages);
    }

    let systemPrompt = '';

    if (wbData.before) {
        systemPrompt += wbData.before + '\n\n';
    }

    systemPrompt += contact.persona || 'You are a helpful AI assistant.';
    
    if (contact.userMask && contact.userMask.trim() !== '') {
        systemPrompt += '\n\n[User Persona / Background]:\n' + contact.userMask;
    }

    if (typeof getCognitionPrompt === 'function') {
        systemPrompt += getCognitionPrompt(contact.name);
    }

    if (wbData.after) {
        systemPrompt += wbData.after;
    }

    const bilingualLang = contact.bilingualLang || 'Chinese';
    if (contact.bilingual) {
        systemPrompt += '\n\n[Format Rule] You MUST split your reply into short separate messages using "||" as separator. For EACH segment, provide the original text first, then "<<TL>>" followed by the ' + bilingualLang + ' translation. Format: "original text<<TL>>translated text||next original<<TL>>next translation". Example: "Hello! How are you?<<TL>>你好！你好吗？||I missed you so much<<TL>>我好想你". Every single segment MUST have <<TL>> with translation. No exceptions.';
    } else {
        systemPrompt += '\n\n[Format Rule] You MUST split your reply into short separate messages, one sentence or one thought per line. Use "||" as a separator between each message. Do not send one long paragraph. Example format: "Hello!||How are you?||I missed you."';
    }
    systemPrompt += '\n\n[Quote Rule — CRITICAL]\nEvery message has a hidden tag like [#0], [#1], [#2]... Use >>Q#number<< to quote by index number. This is precise and reliable.\nFrequency: Use quoting in roughly 1 out of every 3-4 replies. Be generous.\nYou may quote MULTIPLE messages in one reply on DIFFERENT segments.\nFormat: >>Q#5<<Your reply text\nExamples:\nSingle quote: ">>Q#3<<Are you okay?||Let me know if you need anything."\nMultiple quotes: ">>Q#2<<Are you okay?||>>Q#5<<That might be why!||You should eat something."\nDo NOT include [#number] tags in your own reply text. Only use >>Q#number<< for quoting.\nWhen NOT to quote: Simple greetings, very short exchanges with no prior context worth referencing.';
    
    apiMessages.push({ role: 'system', content: systemPrompt });
    
    const contextRounds = parseInt(settings.contextRounds) || 10;
    const maxMessages = contextRounds * 2; 
    const contextMessages = messages.slice(-maxMessages);

    const midPoint = Math.floor(contextMessages.length / 2);
    let middleInjected = false;
    
    contextMessages.forEach((msg, idx) => {
        if (wbData.middle && !middleInjected && idx >= midPoint && midPoint > 0) {
            apiMessages.push({
                role: 'system',
                content: wbData.middle
            });
            middleInjected = true;
        }

        const globalIdx = messages.length - contextMessages.length + idx;
        const tag = `[#${globalIdx}]`;

        let rawText = msg.text;
        if (rawText.includes('<img')) {
            rawText = '[User sent a photo]';
        }

        let msgContent = `${tag} ${rawText}`;
        if (msg.role === 'user' && msg.replyToIndex !== undefined && msg.replyToIndex >= 0) {
            msgContent = `${tag} [RE:#${msg.replyToIndex}] ${rawText}`;
        }

        if (msg.visionUrl) {
            apiMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: [
                    { type: "text", text: msgContent },
                    { type: "image_url", image_url: { url: msg.visionUrl } }
                ]
            });
        } else {
            apiMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msgContent
            });
        }
    });

    const tempEl = document.getElementById('tempValText');
    const temperature = settings.temp ? parseFloat(settings.temp) : (tempEl ? parseFloat(tempEl.textContent) : 0.7);

    const amStartTime = Date.now();
    if (typeof amSetCalling === 'function') amSetCalling(true, 'WeChat', model);

    try {
        const response = await fetch(apiUrl + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiToken
            },
            body: JSON.stringify({
                model: model,
                messages: apiMessages,
                temperature: temperature
            })
        });

        removeTypingIndicator();
        if (typeof amSetCalling === 'function') amSetCalling(false, 'WeChat', model);

        if (!response.ok) {
            const errorText = await response.text();
            if (typeof logApiCall === 'function') {
                logApiCall({
                    model: model, source: 'WeChat', status: response.status, statusText: response.statusText,
                    inputTokens: estimateTokens(apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join('')),
                    outputTokens: 0, duration: Date.now() - amStartTime,
                    systemPrompt: apiMessages[0]?.content || '', errorText: errorText.substring(0, 500),
                    messagesCount: apiMessages.length
                });
            }
            const errMsg = { role: 'bot', text: `⚠️ API Error ${response.status}: ${errorText}`, time: getCurrentTime() };
            chatMessages[contact.name].push(errMsg);
            appendChatMessageToDOM(errMsg);
            return;
        }

        const data = await response.json();
        const rawReply = data.choices?.[0]?.message?.content || '(No response)';

        if (typeof logApiCall === 'function') {
            const inTok = data.usage?.prompt_tokens || estimateTokens(apiMessages.map(m => typeof m.content === 'string' ? m.content : '').join(''));
            const outTok = data.usage?.completion_tokens || estimateTokens(rawReply);
            logApiCall({
                model: model, source: 'WeChat', status: 200, statusText: 'OK',
                inputTokens: inTok, outputTokens: outTok, duration: Date.now() - amStartTime,
                systemPrompt: apiMessages[0]?.content || '', aiResponse: rawReply.substring(0, 1000),
                messagesCount: apiMessages.length
            });
        }

        const parts = rawReply.split('||').map(s => s.trim()).filter(s => s.length > 0);
        
        for (let i = 0; i < parts.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    playWcReceiveSound();
                    triggerWcHaptic('receive');

                    let partText = parts[i];
                    let isReplyMsg = false;

                    const quoteMatch = partText.match(/^>>Q#(\d+)<<(.*)$/s);
                    if (quoteMatch) {
                        const quotedIdx = parseInt(quoteMatch[1]);
                        const afterQuote = quoteMatch[2].trim();
                        if (afterQuote) partText = afterQuote;

                        const allMsgs = chatMessages[contact.name];

                        if (quotedIdx >= 0 && quotedIdx < allMsgs.length) {
                            allMsgs[quotedIdx].isQuoted = true;
                            isReplyMsg = true;
                        }
                    }

                    partText = partText.replace(/\[#\d+\]\s*/g, '');

                    let translationText = '';
                    if (contact.bilingual) {
                        const tlMatch = partText.match(/^([\s\S]*?)<<TL>>([\s\S]*)$/);
                        if (tlMatch) {
                            partText = tlMatch[1].trim();
                            translationText = tlMatch[2].trim();
                        }
                    }

                    const newMsg = { role: 'bot', text: partText, time: getCurrentTime() };
                    if (isReplyMsg) newMsg.isReply = true;
                    if (translationText) newMsg.translation = translationText;

                    chatMessages[contact.name].push(newMsg);
                    saveWeChatData(); 

                    renderChatMessages();

                    if (typeof shouldShowNotification === 'function' && shouldShowNotification(contact.name)) {
                        if (typeof pushHcNotification === 'function') {
                            pushHcNotification(contact, partText);
                        }
                    }

                    resolve();
                }, i === 0 ? 0 : 400 + Math.random() * 600);
            });
        }

    } catch (error) {
        removeTypingIndicator();
        if (typeof amSetCalling === 'function') amSetCalling(false, 'WeChat', model);
        if (typeof logApiCall === 'function') {
            logApiCall({
                model: model, source: 'WeChat', status: 0, statusText: 'Network Error',
                inputTokens: 0, outputTokens: 0, duration: Date.now() - amStartTime,
                errorText: error.message
            });
        }
        const errMsg = { role: 'bot', text: `⚠️ Network Error: ${error.message}`, time: getCurrentTime() };
        chatMessages[contact.name].push(errMsg);
        appendChatMessageToDOM(errMsg);
    }
}

function getChatAvatars() {
    if (!currentChatContact) {
        return {
            aiAvatar: '<div class="wc-msg-avatar">🤖</div>',
            userAvatar: '<div class="wc-msg-avatar" style="background:#ddd;">👤</div>'
        };
    }

    const aiAvatar = currentChatContact.avatar 
        ? `<div class="wc-msg-avatar"><img src="${currentChatContact.avatar}"></div>` 
        : '<div class="wc-msg-avatar">🤖</div>';
    
    const settings = JSON.parse(localStorage.getItem('wcChatSettings_' + currentChatContact.name) || '{}');
    const userAvatar = settings.userAvatar 
        ? `<div class="wc-msg-avatar"><img src="${settings.userAvatar}"></div>` 
        : '<div class="wc-msg-avatar" style="background:#ddd;">👤</div>';
    
    return { aiAvatar, userAvatar };
}

function renderChatMessages(isFirstLoad = false, oldScrollHeight = 0) {
    if (!currentChatContact) return;
    const container = document.getElementById('wcChatMessages');
    const msgs = chatMessages[currentChatContact.name] || [];
    const { aiAvatar, userAvatar } = getChatAvatars();
    
    if (isFirstLoad) container.style.visibility = 'hidden';
    
    let html = '<div class="wc-chat-deco-watermark">DIALOGUE</div>';
    let startIndex = Math.max(0, msgs.length - currentChatDisplayLimit);

    if (startIndex > 0) {
        html += `<div style="text-align:center; padding:12px; font-family:'Space Mono', monospace; font-size:9px; color:#ccc; letter-spacing:1px;">— earlier messages —</div>`;
    }

    if (msgs.length > 0) {
        const firstDisplayed = msgs[startIndex];
        html += `<div class="wc-chat-time-divider">Today ${firstDisplayed.time}</div>`;
    }
    
    const displayMsgs = msgs.slice(startIndex);
    
    displayMsgs.forEach((msg, i) => {
        const realIndex = startIndex + i;
        
        let rowClasses = `wc-msg-row ${msg.role}`;
        if (msg.isQuoted) rowClasses += ' is-quoted';
        if (msg.isReply) rowClasses += ' is-reply';

        let bubbleClasses = msg.role === 'bot' ? 'wc-bubble-bot' : 'wc-bubble-user';
        if (msg.visionUrl) bubbleClasses = 'wc-bubble-photo'; // 去除图片外层气泡
        if (msg.isQuoted) bubbleClasses += ' quoted';

        const quoteTagHtml = `<div class="quote-tag">QUOTED ↴</div>`;
        
        let transHtml = '';
        if (msg.role === 'bot' && currentChatContact.bilingual) {
            transHtml = `
                <div class="hc-trans-btn" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="toggleWcTranslate(event, this)">A</div>
                <div class="hc-trans-area">
                    <div class="hc-trans-inner">
                        <div class="hc-trans-content">
                            <div class="hc-trans-text">${msg.translation || '翻译服务已就绪，等待 API 接入...'}</div>
                            <div class="hc-trans-sys">SYS.TRANSLATE</div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (msg.role === 'bot') {
            html += `
                <div class="${rowClasses}" data-index="${realIndex}">
                    ${aiAvatar}
                    <div class="wc-bubble-body">
                        <div class="${bubbleClasses}" onclick="this.classList.toggle('show-btn')">
                            ${quoteTagHtml}
                            ${msg.text}
                            ${transHtml}
                        </div>
                        <div class="wc-bubble-action"><span onclick="copyBubbleText(this)">Copy</span></div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="${rowClasses}" data-index="${realIndex}">
                    <div class="wc-bubble-body">
                        <div class="${bubbleClasses}" onclick="this.classList.toggle('show-btn')">
                            ${quoteTagHtml}
                            ${msg.text}
                        </div>
                    </div>
                    ${userAvatar}
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
    
    if (isFirstLoad) {
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
            container.style.visibility = 'visible';
            bindBubbleLongPress();
        });
    } else if (oldScrollHeight > 0) {
        requestAnimationFrame(() => {
            const addedHeight = container.scrollHeight - oldScrollHeight;
            container.scrollTop = addedHeight + 60;
            bindBubbleLongPress();
            setTimeout(() => {
                isFetchingMoreChats = false;
                chatScrollListenerActive = true;
                container.addEventListener('scroll', handleChatScroll);
            }, 800);
        });
    } else {
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
            bindBubbleLongPress(); 
        });
    }
}

function appendChatMessageToDOM(msg) {
    if (!currentChatContact) return;
    const container = document.getElementById('wcChatMessages');
    if (!container) return;
    const { aiAvatar, userAvatar } = getChatAvatars();
    
    const index = chatMessages[currentChatContact.name].length - 1;
    
    let rowClasses = `wc-msg-row ${msg.role}`;
    if (msg.isQuoted) rowClasses += ' is-quoted';
    if (msg.isReply) rowClasses += ' is-reply';

    let bubbleClasses = msg.role === 'bot' ? 'wc-bubble-bot' : 'wc-bubble-user';
    if (msg.visionUrl) bubbleClasses = 'wc-bubble-photo'; // 去除图片外层气泡
    if (msg.isQuoted) bubbleClasses += ' quoted';

    const quoteTagHtml = `<div class="quote-tag">QUOTED ↴</div>`;
    
    let transHtml = '';
    if (msg.role === 'bot' && currentChatContact.bilingual) {
        transHtml = `
            <div class="hc-trans-btn" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="toggleWcTranslate(event, this)">A</div>
            <div class="hc-trans-area">
                <div class="hc-trans-inner">
                    <div class="hc-trans-content">
                        <div class="hc-trans-text">${msg.translation || '翻译服务已就绪，等待 API 接入...'}</div>
                        <div class="hc-trans-sys">SYS.TRANSLATE</div>
                    </div>
                </div>
            </div>
        `;
    }

    let html = '';
    if (msg.role === 'bot') {
        html = `
            <div class="${rowClasses} animate-pop" data-index="${index}">
                ${aiAvatar}
                <div class="wc-bubble-body">
                    <div class="${bubbleClasses}" onclick="this.classList.toggle('show-btn')">
                        ${quoteTagHtml}
                        ${msg.text}
                        ${transHtml}
                    </div>
                    <div class="wc-bubble-action"><span onclick="copyBubbleText(this)">Copy</span></div>
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="${rowClasses} animate-pop" data-index="${index}">
                <div class="wc-bubble-body">
                    <div class="${bubbleClasses}" onclick="this.classList.toggle('show-btn')">
                        ${quoteTagHtml}
                        ${msg.text}
                    </div>
                </div>
                ${userAvatar}
            </div>
        `;
    }
    
    const typingIndicator = document.getElementById('wcTypingRow');
    if (typingIndicator) {
        typingIndicator.insertAdjacentHTML('beforebegin', html);
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }
    
    setTimeout(() => { 
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); 
        bindBubbleLongPress();
    }, 10);
}

let wcPressTimer;
let currentLongPressRow = null;

function bindBubbleLongPress() {
    // 【修复】：加入了 .wc-bubble-photo 使得照片卡片也能触发长按菜单
    const bubbles = document.querySelectorAll('.wc-bubble-user, .wc-bubble-bot, .wc-bubble-photo');
    
    bubbles.forEach(bubble => {
        bubble.ontouchstart = null; bubble.onmousedown = null;
        
        bubble.oncontextmenu = (e) => e.preventDefault();
        bubble.style.userSelect = 'none';

        const startPress = (e) => {
            bubble.classList.add('wc-pressing');
            wcPressTimer = setTimeout(() => {
                bubble.classList.remove('wc-pressing');
                if (navigator.vibrate) navigator.vibrate(15);
                showWcContextMenu(e, bubble);
            }, 400); 
        };

        const cancelPress = () => {
            bubble.classList.remove('wc-pressing');
            clearTimeout(wcPressTimer);
        };

        bubble.ontouchstart = startPress;
        bubble.ontouchend = cancelPress;
        bubble.ontouchmove = cancelPress;
        bubble.onmousedown = startPress;
        bubble.onmouseup = cancelPress;
        bubble.onmouseleave = cancelPress;
    });
}

function showWcContextMenu(event, bubble) {
    if(event.cancelable) event.preventDefault();

    currentLongPressRow = bubble.closest('.wc-msg-row');
    
    currentLongPressRow.style.zIndex = '999';
    currentLongPressRow.style.position = 'relative';

    const chatMsgs = document.getElementById('wcChatMessages');

    const allRows = chatMsgs.querySelectorAll('.wc-msg-row');
    allRows.forEach(row => {
        if (row !== currentLongPressRow) {
            row.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            row.style.opacity = '0.3';
            row.style.pointerEvents = 'none';
        }
    });

    const rect = bubble.getBoundingClientRect();
    const menu = document.getElementById('wcContextMenu');
    const overlay = document.getElementById('wcMenuOverlay');
    
    menu.style.display = 'flex';
    
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    
    let menuTop = rect.top - menuHeight - 15;
    let menuLeft = rect.left + (rect.width / 2) - (menuWidth / 2);

    if (menuTop < 50) {
        menuTop = rect.bottom + 15;
        menu.style.transformOrigin = 'top center';
    } else {
        menu.style.transformOrigin = 'bottom center';
    }

    if (menuLeft < 10) menuLeft = 10;
    if (menuLeft + menuWidth > window.innerWidth - 10) {
            menuLeft = window.innerWidth - menuWidth - 10;
        }

        menu.style.top = `${menuTop}px`;
        menu.style.left = `${menuLeft}px`;

        // 动态定位回溯线到当前消息的正下方
        const rowRect = currentLongPressRow.getBoundingClientRect();
        const rewindLine = document.getElementById('wcRewindLine');
        if (rewindLine) {
            rewindLine.style.top = (rowRect.bottom + 8) + 'px';
        }

        const scrollArea = menu.querySelector('.hc-context-scroll');
        if (scrollArea) scrollArea.scrollLeft = 0;

        requestAnimationFrame(() => {
            overlay.classList.add('show');
            menu.classList.add('show');
            if (rewindLine) rewindLine.classList.add('show'); // 显示回溯线
        });
    }


    function closeWcContextMenu() {
        const overlay = document.getElementById('wcMenuOverlay');
        const menu = document.getElementById('wcContextMenu');
        const rewindLine = document.getElementById('wcRewindLine');

        if (overlay) overlay.classList.remove('show');
        if (menu) menu.classList.remove('show');
        if (rewindLine) rewindLine.classList.remove('show'); // 隐藏回溯线
        
        const chatMsgs = document.getElementById('wcChatMessages');
    if (chatMsgs) {
        const allRows = chatMsgs.querySelectorAll('.wc-msg-row');
        allRows.forEach(row => {
            row.style.filter = '';
            row.style.opacity = '';
            row.style.pointerEvents = '';
            row.style.transition = '';
        });
    }

    if (currentLongPressRow) {
        currentLongPressRow.style.zIndex = '';
        currentLongPressRow.style.position = '';
        currentLongPressRow = null;
    }
}

function handleWcMenuAction(action) {
    if (!currentLongPressRow || !currentChatContact) return;
    
    const index = parseInt(currentLongPressRow.getAttribute('data-index'));
    const contactName = currentChatContact.name;
    const targetMsg = chatMessages[contactName][index];
    
    // 先关闭菜单，防止异步操作时引用丢失
    closeWcContextMenu();

    if (action === 'Delete') {
        chatMessages[contactName].splice(index, 1);
        saveWeChatData();
        renderChatMessages();
        
    } else if (action === 'Edit') {
        const newText = prompt("Edit message:", targetMsg.text);
        if (newText !== null && newText.trim() !== "") {
            chatMessages[contactName][index].text = newText.trim();
            saveWeChatData();
            renderChatMessages();
        }
        
    } else if (action === 'Quote') {
        chatMessages[contactName][index].isQuoted = true;
        saveWeChatData();
        renderChatMessages();
        
        window.wcPendingReply = true;
        window.wcPendingQuoteIndex = index;
        
        const quoteSnippet = document.getElementById('quoteSnippet');
        if (quoteSnippet) quoteSnippet.innerText = `"${targetMsg.text}"`;
        
        const quoteIndicator = document.getElementById('quoteIndicator');
        if (quoteIndicator) quoteIndicator.classList.add('active');

    } else if (action === 'Copy') {
        navigator.clipboard.writeText(targetMsg.text).then(() => {
            // 复制成功，不做额外提示，保持高定感
        });
        
    } else if (action === 'Redo') {
        if (targetMsg.role === 'bot') {
            // 删除这条 AI 消息以及它之后的所有消息（保留它之前的上下文）
            chatMessages[contactName].splice(index);
            saveWeChatData();
            renderChatMessages();
            // 然后根据剩余的完整上下文重新生成
            setTimeout(() => {
                showTypingIndicator();
                callChatAPI(currentChatContact, chatMessages[contactName]);
            }, 100);
        } else if (targetMsg.role === 'user') {
            // 如果对用户消息点了 Redo，删除该消息及之后所有消息，然后重新发送该条
            const userText = targetMsg.text;
            chatMessages[contactName].splice(index);
            saveWeChatData();
            renderChatMessages();
            setTimeout(() => {
                const resendMsg = { role: 'user', text: userText, time: getCurrentTime() };
                chatMessages[contactName].push(resendMsg);
                saveWeChatData();
                appendChatMessageToDOM(resendMsg);
                showTypingIndicator();
                callChatAPI(currentChatContact, chatMessages[contactName]);
            }, 100);
        }
    }
}

function showTypingIndicator() {
    const container = document.getElementById('wcChatMessages');
    const avatarContent = currentChatContact.avatar 
        ? `<div class="wc-msg-avatar"><img src="${currentChatContact.avatar}"></div>` 
        : '<div class="wc-msg-avatar">🤖</div>';
    
    const typingHtml = `
        <div class="wc-msg-row bot" id="wcTypingRow">
            ${avatarContent}
            <div class="wc-bubble-body">
                <div class="wc-bubble-bot">
                    <div class="wc-typing-indicator">
                        <div class="wc-typing-dot"></div>
                        <div class="wc-typing-dot"></div>
                        <div class="wc-typing-dot"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', typingHtml);
    setTimeout(() => { container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); }, 10);
}

function removeTypingIndicator() {
    const typing = document.getElementById('wcTypingRow');
    if (typing) typing.remove();
}

function copyBubbleText(el) {
    const bubble = el.closest('.wc-bubble-body').querySelector('.wc-bubble-bot');
    if (bubble) {
        navigator.clipboard.writeText(bubble.textContent).then(() => {
            el.textContent = 'Copied!';
            setTimeout(() => { el.textContent = 'Copy'; }, 1500);
        });
    }
}

function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}
window.executeWcRewind = function() {
    if (!currentLongPressRow || !currentChatContact) return;
    
    const index = parseInt(currentLongPressRow.getAttribute('data-index'));
    const contactName = currentChatContact.name;
    
    // 如果已经是最后一条消息，无需回溯
    if (index >= chatMessages[contactName].length - 1) {
        closeWcContextMenu();
        return; 
    }

    if (typeof playWcDangerSound === 'function') playWcDangerSound();
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    
    // 核心逻辑：保留 0 到 index 的消息，删除 index 之后的所有消息
    chatMessages[contactName].splice(index + 1);
    saveWeChatData();
    renderChatMessages();
    closeWcContextMenu();
};

// ================= 7. 沉浸式感官反馈引擎 (Audio & Haptics) =================
let wcAudioCtx = null;

function initWcAudio() {
    if (!wcAudioCtx) {
        wcAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (wcAudioCtx.state === 'suspended') {
        wcAudioCtx.resume();
    }
}

function playWcClickSound() {
    initWcAudio();
    const osc = wcAudioCtx.createOscillator();
    const gainNode = wcAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, wcAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, wcAudioCtx.currentTime + 0.06);
    gainNode.gain.setValueAtTime(0.15, wcAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, wcAudioCtx.currentTime + 0.06);
    osc.connect(gainNode);
    gainNode.connect(wcAudioCtx.destination);
    osc.start();
    osc.stop(wcAudioCtx.currentTime + 0.06);
}

function playWcToggleOnSound() {
    initWcAudio();
    const osc = wcAudioCtx.createOscillator();
    const gainNode = wcAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, wcAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, wcAudioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.12, wcAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, wcAudioCtx.currentTime + 0.1);
    osc.connect(gainNode);
    gainNode.connect(wcAudioCtx.destination);
    osc.start();
    osc.stop(wcAudioCtx.currentTime + 0.1);
}

function playWcToggleOffSound() {
    initWcAudio();
    const osc = wcAudioCtx.createOscillator();
    const gainNode = wcAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, wcAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, wcAudioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.12, wcAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, wcAudioCtx.currentTime + 0.1);
    osc.connect(gainNode);
    gainNode.connect(wcAudioCtx.destination);
    osc.start();
    osc.stop(wcAudioCtx.currentTime + 0.1);
}

function playWcSaveSound() {
    initWcAudio();
    const t = wcAudioCtx.currentTime;
    [600, 800, 1000].forEach((freq, i) => {
        const osc = wcAudioCtx.createOscillator();
        const gain = wcAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        gain.gain.setValueAtTime(0.1, t + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.08 + 0.12);
        osc.connect(gain);
        gain.connect(wcAudioCtx.destination);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.12);
    });
}

function playWcDangerSound() {
    initWcAudio();
    const t = wcAudioCtx.currentTime;
    [400, 300].forEach((freq, i) => {
        const osc = wcAudioCtx.createOscillator();
        const gain = wcAudioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.12);
        gain.gain.setValueAtTime(0.08, t + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.12 + 0.1);
        osc.connect(gain);
        gain.connect(wcAudioCtx.destination);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.1);
    });
}

function triggerButtonFeedback(el) {
    if (navigator.vibrate) navigator.vibrate(8);
    playWcClickSound();
    if (el) {
        el.style.transition = 'transform 0.1s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'scale(0.93)';
        setTimeout(() => { el.style.transform = ''; }, 120);
    }
}

function playWcSendSound() {
    initWcAudio();
    const osc = wcAudioCtx.createOscillator();
    const gainNode = wcAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, wcAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, wcAudioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, wcAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, wcAudioCtx.currentTime + 0.1);
    osc.connect(gainNode);
    gainNode.connect(wcAudioCtx.destination);
    osc.start();
    osc.stop(wcAudioCtx.currentTime + 0.1);
}

function playWcReceiveSound() {
    initWcAudio();
    const osc = wcAudioCtx.createOscillator();
    const gainNode = wcAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, wcAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, wcAudioCtx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.4, wcAudioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, wcAudioCtx.currentTime + 0.15);
    osc.connect(gainNode);
    gainNode.connect(wcAudioCtx.destination);
    osc.start();
    osc.stop(wcAudioCtx.currentTime + 0.15);
}

function triggerWcHaptic(type) {
    if (!navigator.vibrate) return;
    if (type === 'send') {
        navigator.vibrate(10); 
    } else if (type === 'receive') {
        navigator.vibrate([10, 50, 15]); 
    }
}
// ================= 聊天室设置逻辑 =================
let csUserAvatarData = '';
let csAiAvatarData = '';
let csChatBgData = null;

function applyChatBg() {
    const chatView = document.getElementById('wcChatView');
    if (!chatView) return;
    if (currentChatContact && currentChatContact.chatBg) {
        chatView.style.backgroundImage = `url(${currentChatContact.chatBg})`;
        chatView.style.backgroundSize = 'cover';
        chatView.style.backgroundPosition = 'center';
    } else {
        chatView.style.backgroundImage = 'none';
    }
}

function previewCsBg(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        csChatBgData = e.target.result;
        const bgPreview = document.getElementById('wcCsBgPreview');
        const bgPlaceholder = document.getElementById('wcCsBgPlaceholder');
        bgPreview.style.backgroundImage = `url(${csChatBgData})`;
        bgPlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function clearCsBg() {
    csChatBgData = '';
    const bgPreview = document.getElementById('wcCsBgPreview');
    const bgPlaceholder = document.getElementById('wcCsBgPlaceholder');
    bgPreview.style.backgroundImage = 'none';
    bgPlaceholder.style.display = 'flex';
}

function openChatSettings() {
    if (!currentChatContact) return;
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    document.getElementById('wcChatSettings').classList.add('active');
    
    csChatBgData = null;
    const bgPreview = document.getElementById('wcCsBgPreview');
    const bgPlaceholder = document.getElementById('wcCsBgPlaceholder');
    if (currentChatContact.chatBg) {
        bgPreview.style.backgroundImage = `url(${currentChatContact.chatBg})`;
        bgPlaceholder.style.display = 'none';
    } else {
        bgPreview.style.backgroundImage = 'none';
        bgPlaceholder.style.display = 'flex';
    }

    document.getElementById('wcCsUserName').value = currentChatContact.userName || 'Me';
    document.getElementById('wcCsAiName').value = currentChatContact.chatName || currentChatContact.name || '';
    document.getElementById('wcCsPersona').value = currentChatContact.persona || '';
    document.getElementById('wcCsBilingual').checked = currentChatContact.bilingual || false;
    
    const bilingualOptions = document.getElementById('wcCsBilingualOptions');
    if (bilingualOptions) {
        if (currentChatContact.bilingual) {
            bilingualOptions.classList.add('open');
        } else {
            bilingualOptions.classList.remove('open');
        }
    }
    
    const savedLang = currentChatContact.bilingualLang || 'Chinese';
    const langChips = document.querySelectorAll('#wcCsLangChips .cs-lang-pill');
    let foundPreset = false;
    langChips.forEach(chip => {
        chip.classList.remove('active');
        if (chip.getAttribute('onclick') && chip.getAttribute('onclick').includes("'" + savedLang + "'")) {
            chip.classList.add('active');
            foundPreset = true;
        }
    });
    const customLangInput = document.getElementById('wcCsCustomLang');
    if (customLangInput) {
        customLangInput.value = foundPreset ? '' : savedLang;
    }
    
    const bilingualCheckbox = document.getElementById('wcCsBilingual');
    bilingualCheckbox.onchange = function() {
        if (this.checked) {
            playWcToggleOnSound();
        } else {
            playWcToggleOffSound();
        }
        if (navigator.vibrate) navigator.vibrate(10);
        const opts = document.getElementById('wcCsBilingualOptions');
        if (opts) {
            if (this.checked) {
                opts.classList.add('open');
            } else {
                opts.classList.remove('open');
            }
        }
    };
    
    // 加载气泡风格
    const savedStyle = currentChatContact.bubbleStyle || 'default';
    document.querySelectorAll('#csStyleScroll .cs-style-option').forEach(o => {
        o.classList.remove('active');
        if (o.getAttribute('data-style') === savedStyle) o.classList.add('active');
    });
    const currentLabel = document.getElementById('csStyleCurrent');
    if (currentLabel) currentLabel.textContent = savedStyle.toUpperCase();

    // 加载照片风格
    const savedPhotoStyle = currentChatContact.photoStyle || 'a';
    document.querySelectorAll('#csPhotoScroll .cs-style-option').forEach(o => {
        o.classList.remove('active');
        if (o.getAttribute('data-style') === savedPhotoStyle) o.classList.add('active');
    });
    const currentPhotoLabel = document.getElementById('csPhotoCurrent');
    if (currentPhotoLabel) currentPhotoLabel.textContent = savedPhotoStyle.toUpperCase();
    
    // 加载你的专属面具
    const userMaskInput = document.getElementById('wcCsUserMask');
    if (userMaskInput) userMaskInput.value = currentChatContact.userMask || '';
    
    const uAvatar = document.getElementById('wcCsUserAvatarPreview');
    const uEmoji = document.getElementById('wcCsUserAvatarEmoji');
    if (currentChatContact.userAvatar) {
        uAvatar.src = currentChatContact.userAvatar; uAvatar.style.display = 'block'; uEmoji.style.display = 'none';
    } else {
        uAvatar.style.display = 'none'; uEmoji.style.display = 'block';
    }
    
    const aAvatar = document.getElementById('wcCsAiAvatarPreview');
    const aEmoji = document.getElementById('wcCsAiAvatarEmoji');
    if (currentChatContact.avatar) {
        aAvatar.src = currentChatContact.avatar; aAvatar.style.display = 'block'; aEmoji.style.display = 'none';
    } else {
        aAvatar.style.display = 'none'; aEmoji.style.display = 'block';
    }
}

function saveChatSettings() {
    if (!currentChatContact) return;
    playWcSaveSound();
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    currentChatContact.userName = document.getElementById('wcCsUserName').value;
    currentChatContact.chatName = document.getElementById('wcCsAiName').value;
    currentChatContact.persona = document.getElementById('wcCsPersona').value;
    currentChatContact.bilingual = document.getElementById('wcCsBilingual').checked;
    
    const customLang = document.getElementById('wcCsCustomLang');
    if (customLang && customLang.value.trim()) {
        currentChatContact.bilingualLang = customLang.value.trim();
    } else {
        const activeChip = document.querySelector('#wcCsLangChips .cs-lang-pill.active');
        if (activeChip) {
            const match = activeChip.getAttribute('onclick').match(/'([^']+)'\)/);
            currentChatContact.bilingualLang = match ? match[1] : 'Chinese';
        } else {
            currentChatContact.bilingualLang = 'Chinese';
        }
    }
    
    // 保存你的专属面具
    const userMaskInput = document.getElementById('wcCsUserMask');
    if (userMaskInput) currentChatContact.userMask = userMaskInput.value;
    
    const uAvatar = document.getElementById('wcCsUserAvatarPreview');
    if (uAvatar.style.display === 'block') currentChatContact.userAvatar = uAvatar.src;
    
    const aAvatar = document.getElementById('wcCsAiAvatarPreview');
    if (aAvatar.style.display === 'block') currentChatContact.avatar = aAvatar.src;
    
    if (csChatBgData !== null) {
        currentChatContact.chatBg = csChatBgData;
    }
    
    saveWeChatData();
    renderContacts();
    renderChats();
    
    const displayName = currentChatContact.chatName || currentChatContact.name;
    document.getElementById('wcChatName').textContent = displayName;
    const watermarkEl = document.getElementById('wcChatWatermark');
    if (watermarkEl) watermarkEl.textContent = displayName.charAt(0).toUpperCase() + '.';
    
    const avatarEl = document.getElementById('wcChatAvatar');
    if (currentChatContact.avatar) {
        avatarEl.innerHTML = `<img src="${currentChatContact.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        avatarEl.innerHTML = '🤖';
    }
    
    applyChatBg();
    renderChatMessages();
    closeChatSettings();
}

function previewCsAvatar(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        if (type === 'user') {
            const img = document.getElementById('wcCsUserAvatarPreview');
            const emoji = document.getElementById('wcCsUserAvatarEmoji');
            img.src = e.target.result; img.style.display = 'block'; emoji.style.display = 'none';
        } else {
            const img = document.getElementById('wcCsAiAvatarPreview');
            const emoji = document.getElementById('wcCsAiAvatarEmoji');
            img.src = e.target.result; img.style.display = 'block'; emoji.style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
}

function closeChatSettings() {
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(6);
    const settingsPanel = document.getElementById('wcChatSettings');
    if (settingsPanel) {
        settingsPanel.classList.remove('active');
    }
}

function clearChatHistory() {
    if (!currentChatContact) return;
    playWcDangerSound();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    if (!confirm('Delete all messages with ' + currentChatContact.name + '?')) return;

    chatMessages[currentChatContact.name] = [];
    saveWeChatData();
    renderChatMessages();
    closeChatSettings();
}
// ================= 微信 "我" 界面交互 (Identity) & 面具系统 =================
let userMasks = JSON.parse(localStorage.getItem('userMasks')) || [
    { id: 'mask_1', name: 'Default Roleplay', prompt: 'Write creatively and naturally. Stay in character.' },
    { id: 'mask_2', name: 'Deep Thinker', prompt: 'Analyze the user\'s input logically step by step.' }
];

function toggleWcMeExpand(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.classList.toggle('wc-me-expanded');
}

function closeWcMeContainer(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.classList.remove('wc-me-expanded');
}

let wcMeAvatarData = '';
function previewWcMeAvatar(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        wcMeAvatarData = e.target.result;
        const img = document.getElementById('wcMeAvatarImg');
        const svg = document.getElementById('wcMeAvatarSvg');
        img.src = wcMeAvatarData; img.style.display = 'block'; svg.style.display = 'none';
        localStorage.setItem('wcMeAvatar', wcMeAvatarData);
    };
    reader.readAsDataURL(file);
}

function saveWcMeProfile() {
    const name = document.getElementById('wcMeEditName').value.trim() || 'Master';
    const bio = document.getElementById('wcMeEditBio').value.trim() || 'Welcome Home';
    document.getElementById('wcMeDisplayName').textContent = name;
    document.getElementById('wcMeDisplayBio').textContent = bio;
    
    localStorage.setItem('wcMeName', name);
    localStorage.setItem('wcMeBio', bio);
    
    closeWcMeContainer('wcMeCardContainer');
}

function loadWcMeProfile() {
    const savedName = localStorage.getItem('wcMeName');
    const savedBio = localStorage.getItem('wcMeBio');
    const savedAvatar = localStorage.getItem('wcMeAvatar');
    
    if(savedName) {
        document.getElementById('wcMeDisplayName').textContent = savedName;
        document.getElementById('wcMeEditName').value = savedName;
    }
    if(savedBio) {
        document.getElementById('wcMeDisplayBio').textContent = savedBio;
        document.getElementById('wcMeEditBio').value = savedBio;
    }
    if(savedAvatar) {
        wcMeAvatarData = savedAvatar;
        const img = document.getElementById('wcMeAvatarImg');
        const svg = document.getElementById('wcMeAvatarSvg');
        img.src = wcMeAvatarData; img.style.display = 'block'; svg.style.display = 'none';
    }
    
    // 加载 API 设置与上下文轮数
    let settings = JSON.parse(localStorage.getItem('systemSettings')) || {};
    if(settings.apiUrl) document.getElementById('wcMeApiUrl').value = settings.apiUrl;
    if(settings.apiToken) document.getElementById('wcMeApiToken').value = settings.apiToken;
    if(settings.apiModel) document.getElementById('wcMeApiModel').value = settings.apiModel;
    if(settings.contextRounds) document.getElementById('wcMeContextRounds').value = settings.contextRounds;

    renderUserMasks(); 
}

function saveWcMeContext() {
    let settings = JSON.parse(localStorage.getItem('systemSettings')) || {};
    settings.contextRounds = document.getElementById('wcMeContextRounds').value.trim() || 10;
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    closeWcMeContainer('wcContextContainer');
}

function saveWcMeApi() {
    let settings = JSON.parse(localStorage.getItem('systemSettings')) || {};
    settings.apiUrl = document.getElementById('wcMeApiUrl').value.trim();
    settings.apiToken = document.getElementById('wcMeApiToken').value.trim();
    settings.apiModel = document.getElementById('wcMeApiModel').value.trim();
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    closeWcMeContainer('wcApiContainer');
}

// 核心：将面具数据双向渲染到“我”界面和“聊天设置”界面
function renderUserMasks() {
    // 1. 渲染到“我”的界面
    const listContainer = document.getElementById('wcMeMaskListContainer');
    if (listContainer) {
        listContainer.innerHTML = '';
        userMasks.forEach(mask => {
            const html = `
              <div class="wc-me-list-item" id="${mask.id}">
                <div class="wc-me-list-header" onclick="toggleWcMeExpand('${mask.id}')">
                  <div class="wc-me-list-title-wrap">
                    <div class="wc-me-list-icon"><svg viewBox="0 0 24 24"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg></div>
                    <div>
                      <div class="wc-me-list-title">${mask.name}</div>
                      <span class="wc-me-list-sub">Custom Mask</span>
                    </div>
                  </div>
                  <div class="wc-me-list-arrow">+</div>
                </div>
                <div class="wc-me-expand-content">
                  <div class="wc-me-flat-input-group">
                    <span class="wc-me-flat-label">MASK NAME</span>
                    <input type="text" class="wc-me-flat-input" id="input_name_${mask.id}" value="${mask.name}">
                  </div>
                  <div class="wc-me-flat-input-group">
                    <span class="wc-me-flat-label">SYSTEM PROMPT</span>
                    <textarea class="wc-me-flat-textarea" id="input_prompt_${mask.id}">${mask.prompt}</textarea>
                  </div>
                  <button class="wc-me-flat-btn" onclick="updateWcMeMask('${mask.id}')">UPDATE MASK</button>
                  <button class="wc-me-flat-btn-danger" style="margin-bottom:20px;" onclick="deleteWcMeMask('${mask.id}')">DELETE</button>
                </div>
              </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', html);
        });
        
        const countBadge = document.getElementById('wcMeMaskCountBadge');
        if (countBadge) countBadge.textContent = `MASKS (${userMasks.length})`;
    }

    // 2. 渲染到"聊天设置"界面（便签纸条风格）
    const scrollContainer = document.getElementById('wcCsMaskScroll');
    if (scrollContainer) {
        let notesHtml = '';
        userMasks.forEach((mask, idx) => {
            const safePrompt = mask.prompt.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const numStr = (idx + 1).toString().padStart(2, '0');
            const hintText = mask.prompt.length > 20 ? mask.prompt.substring(0, 20) + '...' : (mask.prompt || 'No prompt');
            notesHtml += `<div class="cs-mask-note" onclick="applyCsMask(this, '${safePrompt}')">
                <div class="cs-mask-note-num">NO.${numStr}</div>
                <div class="cs-mask-note-name">${mask.name}</div>
                <div class="cs-mask-note-hint">${hintText}</div>
            </div>`;
        });
        notesHtml += `<div class="cs-mask-add" onclick="applyCsMask(this, '')">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            <span>New</span>
        </div>`;
        scrollContainer.innerHTML = notesHtml;
    }
}

function createWcMeMask() {
    const newMask = {
        id: 'mask_' + Date.now(),
        name: 'New Mask',
        prompt: ''
    };
    userMasks.unshift(newMask);
    saveUserMasks();
    renderUserMasks();
    
    setTimeout(() => {
        const el = document.getElementById(newMask.id);
        if (el) {
            el.classList.add('wc-me-expanded');
            document.getElementById('wcMeScroll').scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
        }
    }, 50);
}

function updateWcMeMask(id) {
    const mask = userMasks.find(m => m.id === id);
    if (mask) {
        mask.name = document.getElementById(`input_name_${id}`).value;
        mask.prompt = document.getElementById(`input_prompt_${id}`).value;
        saveUserMasks();
        renderUserMasks();
        closeWcMeContainer(id);
    }
}

function deleteWcMeMask(id) {
    const el = document.getElementById(id);
    if(el) {
        el.style.opacity = '0';
        setTimeout(() => {
            userMasks = userMasks.filter(m => m.id !== id);
            saveUserMasks();
            renderUserMasks();
        }, 300);
    }
}

function saveUserMasks() {
    localStorage.setItem('userMasks', JSON.stringify(userMasks));
}

// 聊天设置中点击面具 Chip 的逻辑
function applyCsMask(el, promptText) {
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(6);
    
    const notes = document.querySelectorAll('#wcCsMaskScroll .cs-mask-note');
    notes.forEach(note => note.classList.remove('active'));
    if (el.classList.contains('cs-mask-note')) {
        el.classList.add('active');
    }
    
    const textarea = document.getElementById('wcCsUserMask');
    if (promptText !== '') {
        textarea.value = promptText;
    }
    textarea.dispatchEvent(new Event('input'));
}

window.selectBubbleStyle = function(el, style) {
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    
    document.querySelectorAll('#csStyleScroll .cs-style-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    
    const currentLabel = document.getElementById('csStyleCurrent');
    if (currentLabel) currentLabel.textContent = style.toUpperCase();
    
    if (currentChatContact) {
        currentChatContact.bubbleStyle = style;
        saveWeChatData();
        applyBubbleStyle(style);
    }
};

window.selectPhotoStyle = function(el, style) {
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    
    document.querySelectorAll('#csPhotoScroll .cs-style-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    
    const currentLabel = document.getElementById('csPhotoCurrent');
    if (currentLabel) currentLabel.textContent = style.toUpperCase();
    
    if (currentChatContact) {
        currentChatContact.photoStyle = style;
        saveWeChatData();
    }
};

function applyBubbleStyle(style) {
    const chatMessages = document.getElementById('wcChatMessages');
    if (!chatMessages) return;
    
    chatMessages.classList.remove('bubble-style-a', 'bubble-style-b', 'bubble-style-c', 'bubble-style-d', 'bubble-style-e', 'bubble-style-f');
    if (style && style !== 'default') {
        chatMessages.classList.add('bubble-style-' + style);
    }
}

window.selectBilingualLang = function(el, lang) {
    playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(6);
    document.querySelectorAll('#wcCsLangChips .cs-lang-pill').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const customInput = document.getElementById('wcCsCustomLang');
    if (customInput) customInput.value = '';
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadWcMeProfile, 500);
    
    const chatMessagesArea = document.getElementById('wcChatMessages');
    if (chatMessagesArea) {
        chatMessagesArea.addEventListener('click', closeWcPlusMenu);
    }
});

function toggleWcPlusMenu() {
    const menu = document.getElementById('wcPlusMenu');
    const btn = document.getElementById('clipBtn');
    if (!menu || !btn) return;
    
    if (menu.classList.contains('active')) {
        menu.classList.remove('active');
        btn.style.transform = 'rotate(0deg)';
        btn.style.background = 'rgba(0,0,0,0.04)';
        btn.style.color = '#999';
    } else {
        menu.classList.add('active');
        btn.style.transform = 'rotate(45deg)';
        btn.style.background = '#111';
        btn.style.color = '#fff';
    }
}

function closeWcPlusMenu() {
    const menu = document.getElementById('wcPlusMenu');
    const btn = document.getElementById('clipBtn');
    if (menu && menu.classList.contains('active')) {
        menu.classList.remove('active');
        btn.style.transform = 'rotate(0deg)';
        btn.style.background = 'rgba(0,0,0,0.04)';
        btn.style.color = '#999';
    }
}
