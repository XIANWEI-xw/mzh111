// js/wechat.js
// ================= 微信应用独立控制逻辑 & 本地储存引擎 =================

let wcContacts = [];
let wcChats = [];
let chatMessages = {}; 
let wcAvatarData = ''; 
let editingContactIndex = -1;
let wcEditAvatarData = '';
let currentChatContact = null;

// ================= 1. 本地储存逻辑 (核心) =================
function loadWeChatData() {
    const storedContacts = localStorage.getItem('wcContacts');
    const storedChats = localStorage.getItem('wcChats');
    const storedMessages = localStorage.getItem('chatMessages');
    
    if (storedContacts) wcContacts = JSON.parse(storedContacts);
    if (storedChats) wcChats = JSON.parse(storedChats);
    if (storedMessages) chatMessages = JSON.parse(storedMessages);
}

function saveWeChatData() {
    localStorage.setItem('wcContacts', JSON.stringify(wcContacts));
    localStorage.setItem('wcChats', JSON.stringify(wcChats));
    localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
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
        const avatarContent = chat.avatar 
            ? `<img src="${chat.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;">` 
            : '🤖';
        const randomDeco = decoTexts[index % decoTexts.length];
        const randomStars = decoStars[index % decoStars.length];
        const chatContactIndex = wcContacts.findIndex(c => c.name === chat.name);
        
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
                        <span class="wc-chat-name">${chat.name}</span>
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
    
    document.getElementById('wcChatName').textContent = contact.name;
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
    
    const newMsg = { role: 'user', text: text, time: getCurrentTime() };
    chatMessages[currentChatContact.name].push(newMsg);
    saveWeChatData(); 
    
    input.value = '';
    appendChatMessageToDOM(newMsg); 
}

function triggerAICall() {
    if (!currentChatContact) return;

    const input = document.getElementById('wcChatInput');
    const text = input.value.trim();
    
    if (text) {
        playWcSendSound();
        triggerWcHaptic('send');

        const newMsg = { role: 'user', text: text, time: getCurrentTime() };
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
    
    let systemPrompt = contact.persona || 'You are a helpful AI assistant.';
    
    if (contact.userMask && contact.userMask.trim() !== '') {
        systemPrompt += '\n\n[User Persona / Background]:\n' + contact.userMask;
    }

    if (typeof getCognitionPrompt === 'function') {
        systemPrompt += getCognitionPrompt(contact.name);
    }

    systemPrompt += '\n\n[Format Rule] You MUST split your reply into short separate messages, one sentence or one thought per line. Use "||" as a separator between each message. Do not send one long paragraph. Example format: "Hello!||How are you?||I missed you."';
    
    apiMessages.push({ role: 'system', content: systemPrompt });
    
    const contextRounds = parseInt(settings.contextRounds) || 10;
    const maxMessages = contextRounds * 2; 
    const contextMessages = messages.slice(-maxMessages);
    
    contextMessages.forEach(msg => {
        apiMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    const tempEl = document.getElementById('tempValText');
    const temperature = settings.temp ? parseFloat(settings.temp) : (tempEl ? parseFloat(tempEl.textContent) : 0.7);

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

        if (!response.ok) {
            const errorText = await response.text();
            const errMsg = { role: 'bot', text: `⚠️ API Error ${response.status}: ${errorText}`, time: getCurrentTime() };
            chatMessages[contact.name].push(errMsg);
            appendChatMessageToDOM(errMsg);
            return;
        }

        const data = await response.json();
        const rawReply = data.choices?.[0]?.message?.content || '(No response)';

        const parts = rawReply.split('||').map(s => s.trim()).filter(s => s.length > 0);
        
        for (let i = 0; i < parts.length; i++) {
            await new Promise(resolve => {
                setTimeout(() => {
                    playWcReceiveSound();
                    triggerWcHaptic('receive');

                    const newMsg = { role: 'bot', text: parts[i], time: getCurrentTime() };
                    chatMessages[contact.name].push(newMsg);
                    saveWeChatData(); 
                    
                    appendChatMessageToDOM(newMsg); 
                    resolve();
                }, i === 0 ? 0 : 400 + Math.random() * 600);
            });
        }

    } catch (error) {
        removeTypingIndicator();
        const errMsg = { role: 'bot', text: `⚠️ Network Error: ${error.message}`, time: getCurrentTime() };
        chatMessages[contact.name].push(errMsg);
        appendChatMessageToDOM(errMsg);
    }
}

function getChatAvatars() {
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
    
    // 先隐藏容器，防止滚动跳闪
    if (isFirstLoad) {
        container.style.visibility = 'hidden';
    }
    
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
        if (msg.role === 'bot') {
            html += `
                <div class="wc-msg-row bot" data-index="${realIndex}">
                    ${aiAvatar}
                    <div class="wc-bubble-body">
                        <div class="wc-bubble-bot">${msg.text}</div>
                        <div class="wc-bubble-action"><span onclick="copyBubbleText(this)">Copy</span></div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="wc-msg-row user" data-index="${realIndex}">
                    <div class="wc-bubble-body"><div class="wc-bubble-user">${msg.text}</div></div>
                    ${userAvatar}
                </div>
            `;
        }
    });
    
    container.innerHTML = html;
    
    if (isFirstLoad) {
        // 同步设好滚动位置，然后再显示
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
            container.style.visibility = 'visible';
            bindBubbleLongPress();
        });
    } else if (oldScrollHeight > 0) {
        // 加载更多历史：保持阅读位置
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
        // 删除/编辑消息后重新渲染
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
            bindBubbleLongPress(); 
        });
    }
}

function appendChatMessageToDOM(msg) {
    const container = document.getElementById('wcChatMessages');
    if (!container) return;
    const { aiAvatar, userAvatar } = getChatAvatars();
    
    const index = chatMessages[currentChatContact.name].length - 1;
    let html = '';
    if (msg.role === 'bot') {
        html = `
            <div class="wc-msg-row bot" data-index="${index}">
                ${aiAvatar}
                <div class="wc-bubble-body">
                    <div class="wc-bubble-bot">${msg.text}</div>
                    <div class="wc-bubble-action"><span onclick="copyBubbleText(this)">Copy</span></div>
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="wc-msg-row user" data-index="${index}">
                <div class="wc-bubble-body"><div class="wc-bubble-user">${msg.text}</div></div>
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
    const bubbles = document.querySelectorAll('.wc-bubble-user, .wc-bubble-bot');
    
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
    
    // 【终极防遮挡魔法】：用 JS 直接强行提升当前气泡和整个聊天列表的层级
    currentLongPressRow.style.zIndex = '999';
    currentLongPressRow.style.position = 'relative';

    const chatMsgs = document.getElementById('wcChatMessages');
    chatMsgs.style.zIndex = '170';
    chatMsgs.style.position = 'relative';

    // 强行把其他没被选中的气泡变暗模糊
    const allRows = chatMsgs.querySelectorAll('.wc-msg-row');
    allRows.forEach(row => {
        if (row !== currentLongPressRow) {
            row.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            row.style.filter = 'blur(4px)';
            row.style.opacity = '0.2';
            row.style.pointerEvents = 'none';
        }
    });

    const rect = bubble.getBoundingClientRect();
    const isUser = currentLongPressRow.classList.contains('user');
    const menu = document.getElementById('wcContextMenu');
    const overlay = document.getElementById('wcMenuOverlay');
    
    let menuTop = rect.bottom + 10;
    let menuLeft = isUser ? (rect.right - 150) : rect.left;
    
    menu.style.transformOrigin = 'top center';

    if (menuTop + 180 > window.innerHeight) {
        menuTop = rect.top - 180;
        menu.style.transformOrigin = 'bottom center';
    }

    menu.style.top = `${menuTop}px`;
    menu.style.left = `${menuLeft}px`;

    overlay.classList.add('active');
    menu.classList.add('active');
}

function closeWcContextMenu() {
    document.getElementById('wcMenuOverlay').classList.remove('active');
    document.getElementById('wcContextMenu').classList.remove('active');
    
    // 【解除魔法】：恢复所有层级和亮度
    const chatMsgs = document.getElementById('wcChatMessages');
    if (chatMsgs) {
        chatMsgs.style.zIndex = '';
        const allRows = chatMsgs.querySelectorAll('.wc-msg-row');
        allRows.forEach(row => {
            row.style.filter = '';
            row.style.opacity = '';
            row.style.pointerEvents = '';
        });
    }

    if (currentLongPressRow) {
        currentLongPressRow.style.zIndex = '';
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
        const input = document.getElementById('wcChatInput');
        input.value = `「${targetMsg.text}」\n`;
        input.focus();
        
    } else if (action === 'Redo') {
        if (targetMsg.role === 'bot') {
            // 先删掉这条 AI 消息
            chatMessages[contactName].splice(index, 1);
            saveWeChatData();
            renderChatMessages();
            // 然后根据剩余的完整上下文重新生成
            setTimeout(() => {
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

function openChatSettings() {
    if (!currentChatContact) return;
    document.getElementById('wcChatSettings').classList.add('active');
    
    document.getElementById('wcCsUserName').value = currentChatContact.userName || 'Me';
    document.getElementById('wcCsAiName').value = currentChatContact.name || '';
    document.getElementById('wcCsPersona').value = currentChatContact.persona || '';
    document.getElementById('wcCsBilingual').checked = currentChatContact.bilingual || false;
    
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
    currentChatContact.userName = document.getElementById('wcCsUserName').value;
    currentChatContact.name = document.getElementById('wcCsAiName').value;
    currentChatContact.persona = document.getElementById('wcCsPersona').value;
    currentChatContact.bilingual = document.getElementById('wcCsBilingual').checked;
    
    // 保存你的专属面具
    const userMaskInput = document.getElementById('wcCsUserMask');
    if (userMaskInput) currentChatContact.userMask = userMaskInput.value;
    
    const uAvatar = document.getElementById('wcCsUserAvatarPreview');
    if (uAvatar.style.display === 'block') currentChatContact.userAvatar = uAvatar.src;
    
    const aAvatar = document.getElementById('wcCsAiAvatarPreview');
    if (aAvatar.style.display === 'block') currentChatContact.avatar = aAvatar.src;
    
    saveWeChatData();
    renderContacts();
    openChat(currentChatContact);
    closeChatSettings();
}

function closeChatSettings() {
    const settingsPanel = document.getElementById('wcChatSettings');
    if (settingsPanel) {
        settingsPanel.classList.remove('active');
    }
}

function clearChatHistory() {
    if (!currentChatContact) return;
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

    // 2. 渲染到“聊天设置”界面，去除了 Emoji
    const scrollContainer = document.getElementById('wcCsMaskScroll');
    if (scrollContainer) {
        let chipsHtml = '';
        userMasks.forEach(mask => {
            const safePrompt = mask.prompt.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            chipsHtml += `<div class="wc-cs-mask-chip" onclick="applyCsMask(this, '${safePrompt}')" style="padding:6px 12px; border:1px solid #111; border-radius:8px; font-size:11px; font-weight:700; font-family:'Space Mono', monospace; cursor:pointer; white-space:nowrap; color:#111; transition:0.2s;">${mask.name}</div>`;
        });
        chipsHtml += `<div class="wc-cs-mask-chip" onclick="applyCsMask(this, '')" style="padding:6px 12px; border:1px dashed #999; border-radius:8px; font-size:11px; font-weight:700; font-family:'Space Mono', monospace; cursor:pointer; white-space:nowrap; color:#999; transition:0.2s;">+ Custom</div>`;
        scrollContainer.innerHTML = chipsHtml;
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
    const chips = document.querySelectorAll('#wcCsMaskScroll .wc-cs-mask-chip');
    chips.forEach(chip => {
        chip.style.background = chip.innerText.includes('Custom') ? 'transparent' : 'transparent';
        chip.style.color = chip.innerText.includes('Custom') ? '#999' : '#111';
    });
    el.style.background = '#111';
    el.style.color = '#fff';
    
    const textarea = document.getElementById('wcCsUserMask');
    if (promptText !== '') {
        textarea.value = promptText;
    }
    textarea.dispatchEvent(new Event('input'));
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadWcMeProfile, 500);
});
