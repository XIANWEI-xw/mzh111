/* =============================================
   Encounter · Novel Mode - JS
   所有函数前缀 enc / Enc 避免冲突
   ============================================= */

// ===== DOM 引用 =====
let encApp, encSelectionScreen, encStoryScreen, encProseContainer, encUserInput;
let encHeartContainer, encQuickMenuPanel, encBtnQuickMenu, encFabSettings;
let encSettingsOverlay, encPersonaOverlay, encClimaxSlider, encClimaxValue, encVignette;

function initEncounterDOM() {
    encApp = document.getElementById('encounterApp');
    encSelectionScreen = document.getElementById('enc-selection-screen');
    encStoryScreen = document.getElementById('enc-story-screen');
    encProseContainer = document.getElementById('enc-prose-container');
    encUserInput = document.getElementById('enc-user-input');
    encHeartContainer = document.getElementById('enc-heart-container');
    encQuickMenuPanel = document.getElementById('enc-quick-menu-panel');
    encBtnQuickMenu = document.getElementById('enc-btn-quick-menu');
    encFabSettings = document.getElementById('enc-fab-settings');
    encSettingsOverlay = document.getElementById('enc-settings-overlay');
    encPersonaOverlay = document.getElementById('enc-persona-overlay');
    encClimaxSlider = document.getElementById('enc-climax-slider');
    encClimaxValue = document.getElementById('enc-climax-value');
    encVignette = document.getElementById('enc-intimate-vignette');

    if (encClimaxSlider) {
        encClimaxSlider.addEventListener('input', function() {
            const val = this.value;
            if (encClimaxValue) encClimaxValue.innerText = val + '%';
            const opacity = (val / 100) * 0.45;
            if (encVignette) {
                encVignette.style.background = `radial-gradient(circle, transparent 40%, rgba(217,122,141, ${opacity}) 100%)`;
                if (val > 80) encVignette.style.animation = 'encBreathVignette 1.2s ease-in-out infinite alternate';
                else if (val > 50) encVignette.style.animation = 'encBreathVignette 2.5s ease-in-out infinite alternate';
                else encVignette.style.animation = 'none';
            }
        });

        encClimaxSlider.addEventListener('change', function() {
            const val = parseInt(this.value);
            if (Math.abs(val - encLastClimaxVal) > 5) {
                encLastClimaxVal = val;
                let stateText = '';
                if (val < 30) stateText = '呼吸平稳，保持理智';
                else if (val < 60) stateText = '体温微升，心跳逐渐加快';
                else if (val < 90) stateText = '意乱情迷，眼神开始涣散';
                else stateText = '濒临临界，理智彻底失控';
                if (encProseContainer) {
                    encProseContainer.insertAdjacentHTML('beforeend', `
                        <div class="enc-prose-divider" style="color:rgba(217,122,141,0.3);">· · ·</div>
                        <div class="enc-story-tag enc-intimate-tag">✦ Sensory Sync: ${stateText} (${val}%) ✦</div>
                    `);
                }
                const content = document.getElementById('enc-story-content');
                if (content) content.scrollTo({ top: 99999, behavior: 'smooth' });
                setTimeout(() => generateEncAIResponse(), 800);
            }
        });
    }

    if (encUserInput) {
        encUserInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEncAction(); }
        });
    }

    document.querySelectorAll('.enc-set-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentNode.querySelectorAll('.enc-set-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            saveEncSettings();
        });
    });

    document.addEventListener('click', function(e) {
        if (encQuickMenuPanel && encBtnQuickMenu && !encQuickMenuPanel.contains(e.target) && !encBtnQuickMenu.contains(e.target)) {
            encQuickMenuPanel.classList.remove('active');
            encBtnQuickMenu.classList.remove('active');
        }
    });

    console.log('✅ Encounter DOM initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEncounterDOM);
} else {
    initEncounterDOM();
}

let encHeartInterval;
let encFabTimeout;
let encLastClimaxVal = 0;
let encCurrentContact = null;
let encAutoSaveTimer = null;

// ===== Encounter 专属 IndexedDB 存储引擎（无限空间）=====
const ENC_DB_NAME = 'EncounterDB';
const ENC_STORE_NAME = 'StoryStore';

function initEncDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(ENC_DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(ENC_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function encDbSet(key, value) {
    try {
        const db = await initEncDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ENC_STORE_NAME, 'readwrite');
            tx.objectStore(ENC_STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('EncDB write error:', e);
    }
}

async function encDbGet(key) {
    try {
        const db = await initEncDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ENC_STORE_NAME, 'readonly');
            const request = tx.objectStore(ENC_STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('EncDB read error:', e);
        return null;
    }
}

async function encDbDelete(key) {
    try {
        const db = await initEncDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(ENC_STORE_NAME, 'readwrite');
            tx.objectStore(ENC_STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('EncDB delete error:', e);
    }
}

// 保存当前故事（防抖，避免频繁写入）
function saveEncStory() {
    if (!encCurrentContact || !encProseContainer) return;
    clearTimeout(encAutoSaveTimer);
    encAutoSaveTimer = setTimeout(() => {
        const html = encProseContainer.innerHTML;
        if (html && html.trim()) {
            const key = 'story_' + encCurrentContact.name;
            encDbSet(key, html);

            // 同时尝试存一份到 localStorage 做备份（如果能存下的话）
            try {
                localStorage.setItem('encStory_' + encCurrentContact.name, html);
            } catch (e) {
                // localStorage 满了也没关系，IndexedDB 里有
            }
        }
    }, 500);
}

// 加载故事
async function loadEncStory(name) {
    // 优先从 IndexedDB 读取
    const key = 'story_' + name;
    let html = await encDbGet(key);

    // 如果 IndexedDB 没有，尝试从 localStorage 迁移旧数据
    if (!html) {
        const lsKey = 'encStory_' + name;
        html = localStorage.getItem(lsKey);
        if (html) {
            // 迁移到 IndexedDB
            await encDbSet(key, html);
        }
    }

    return html || null;
}

// ===== 从 WeChat 联系人获取角色数据 =====
function getEncContacts() {
    if (typeof wcContacts !== 'undefined' && Array.isArray(wcContacts) && wcContacts.length > 0) {
        return wcContacts;
    }
    return [];
}

function getContactAvatar(contact) {
    if (!contact) return '';
    if (contact.avatar && contact.avatar.length > 4 && (contact.avatar.startsWith('data:') || contact.avatar.startsWith('http') || contact.avatar.startsWith('blob:'))) {
        return contact.avatar;
    }
    return '';
}

function getContactEmoji(contact) {
    if (!contact) return '✦';
    if (contact.avatar && contact.avatar.length <= 4 && contact.avatar.length > 0) {
        return contact.avatar;
    }
    return '';
}

function generateEncOpening(contact) {
    const name = contact.name || 'Unknown';
    const persona = contact.persona || '';
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');

    // 如果有 API，用 AI 生成开场白
    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    if (settings.apiUrl && settings.apiToken && settings.apiModel) {
        setTimeout(() => {
            generateEncAIResponse();
        }, 500);
        return `<div class="enc-story-tag">${hours}:${mins} PM · THE ENCOUNTER</div>`;
    }

    return `<div class="enc-story-block ai-block">
        <p>空气中弥漫着一种难以名状的静谧。光线从某个不可名状的角度倾泻下来，在空间里勾勒出一道柔和的轮廓——属于${name}的轮廓。</p>
        <p>你不确定自己是什么时候注意到的，只知道当视线落在那个方向时，一切都变得安静了。周围的声音像是隔了一层薄纱，模糊而遥远。</p>
        <div class="enc-story-tag">${hours}:${mins} PM · THE ENCOUNTER</div>
        <div class="enc-quote-mark">\u201c</div>
        <p><span class="enc-dialogue-ai" onclick="toggleEncThought(this)">\u201c你来了。\u201d</span> ${name}的目光落在你身上。那种注视不算锐利，却有一种令人无法回避的重量——仿佛你是这个空间里唯一值得关注的事物。</p>
        <div class="enc-inner-thought">其实在她推门之前，我就已经感觉到了。那种微妙的气息变化，像是空气本身在替她通报。</div>
        <div class="enc-msg-actions"><button class="enc-msg-action-btn" onclick="editEncBlock(this)">Edit</button><button class="enc-msg-action-btn" onclick="redoEncBlock(this)">Regenerate</button><button class="enc-msg-action-btn" onclick="deleteEncBlock(this)">Del</button></div>
    </div>`;
}

// ===== 打开/关闭 Encounter =====
function openEncounter() {
    encApp.classList.add('active');
    encSelectionScreen.classList.remove('enc-hidden');
    encStoryScreen.classList.add('enc-hidden');
    loadEncPersonaPresets();
    loadEncSettings();
    renderEncCharacterCards();
}

function closeEncounter() {
    encApp.classList.remove('active');
    exitEncStory();
}

// ===== 渲染角色选择卡片（从 WeChat 联系人读取）=====
function renderEncCharacterCards() {
    const list = document.getElementById('enc-dir-list');
    list.innerHTML = '';

    const allContacts = getEncContacts();

    if (allContacts.length === 0) {
        list.innerHTML = `
            <div class="enc-empty-state">
                <div class="enc-empty-icon">❦</div>
                <div class="enc-empty-title">No Characters Yet</div>
                <div class="enc-empty-desc">Create contacts in WeChat to begin your encounters.</div>
            </div>`;
        return;
    }

    const now = new Date();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr = monthNames[now.getMonth()] + '. ' + now.getFullYear();

    allContacts.forEach((contact, idx) => {
        const imgUrl = getContactAvatar(contact);
        const emoji = getContactEmoji(contact);
        const hasImage = imgUrl && imgUrl.length > 0;
        const name = contact.name || 'Unknown';
        const group = contact.group || 'Roleplay';
        const persona = contact.persona || '';
        const descText = persona
            ? (persona.length > 80 ? persona.substring(0, 80) + '...' : persona)
            : '一个等待被书写的故事。点击进入，开启属于你们的篇章。';

        const imgHtml = hasImage
            ? `<img src="${imgUrl}" alt="${name}">`
            : `<div class="enc-polaroid-emoji">${emoji || name.charAt(0)}</div>`;

        const wrapper = document.createElement('div');
        wrapper.className = 'enc-polaroid-wrapper';
        wrapper.onclick = function(e) {
            if (!e.target.closest('.enc-btn-enter-story')) {
                this.classList.toggle('flipped');
            }
        };
        wrapper.innerHTML = `
            <div class="enc-polaroid-inner">
                <div class="enc-polaroid-front">
                    <div class="enc-polaroid-tape"></div>
                    <div class="enc-polaroid-img">${imgHtml}</div>
                    <div class="enc-polaroid-caption">
                        <span class="enc-polaroid-name">${name} <span class="enc-status-dot online"></span></span>
                        <span class="enc-polaroid-date">${dateStr}</span>
                    </div>
                    <div class="enc-flip-hint">TAP TO FLIP</div>
                </div>
                <div class="enc-polaroid-back">
                    <div class="enc-back-header">
                        <span class="enc-back-num">NO.${String(idx+1).padStart(2,'0')}</span>
                        <span class="enc-back-name">${name}</span>
                    </div>
                    <div class="enc-back-desc">${descText}</div>
                    <div class="enc-back-footer">
                        <div class="enc-roster-tags">
                            <span class="enc-roster-meta">${group}</span>
                            <span class="enc-roster-meta-light">Ch.01</span>
                        </div>
                        <button class="enc-btn-enter-story" onclick="event.stopPropagation();enterEncStory(${idx})">Enter Encounter</button>
                    </div>
                </div>
            </div>`;
        list.appendChild(wrapper);
    });
}

// ===== 进入故事 =====
async function enterEncStory(idx) {
    const allContacts = getEncContacts();
    if (idx < 0 || idx >= allContacts.length) return;

    const contact = allContacts[idx];
    encCurrentContact = contact;

    const name = contact.name || 'Unknown';
    const imgUrl = getContactAvatar(contact);
    const emoji = getContactEmoji(contact);
    const group = contact.group || 'Encounter';
    const heroImg = document.getElementById('enc-story-hero-img');

    document.getElementById('enc-story-target-name').innerText = name;
    document.getElementById('enc-story-location').innerText = 'LOC: ' + group;
    document.getElementById('enc-story-watermark').innerText =
        /[a-zA-Z]/.test(name.charAt(0)) ? name.charAt(0).toUpperCase() : name.charAt(0);

    if (imgUrl) {
        heroImg.src = imgUrl;
        heroImg.style.display = 'block';
        const oldEmoji = heroImg.parentElement.querySelector('.enc-hero-emoji');
        if (oldEmoji) oldEmoji.remove();
    } else {
        heroImg.style.display = 'none';
        let emojiEl = heroImg.parentElement.querySelector('.enc-hero-emoji');
        if (!emojiEl) {
            emojiEl = document.createElement('div');
            emojiEl.className = 'enc-hero-emoji';
            heroImg.parentElement.appendChild(emojiEl);
        }
        emojiEl.innerText = emoji || name.charAt(0);
    }

    encSelectionScreen.classList.add('enc-hidden');
    encStoryScreen.classList.remove('enc-hidden');
    encStoryScreen.classList.remove('enc-intimate-mode', 'enc-dark-mode');

    encClimaxSlider.value = 0;
    encClimaxValue.innerText = '0%';
    encVignette.style.background = 'transparent';
    encVignette.style.animation = 'none';
    encLastClimaxVal = 0;
    clearInterval(encHeartInterval);
    encHeartContainer.innerHTML = '';

    // 从 IndexedDB 加载故事（无限空间，不丢数据）
    encProseContainer.innerHTML = '<p style="text-align:center;color:var(--enc-text-muted);font-style:italic;padding:40px 0;">Loading story...</p>';

    const savedStory = await loadEncStory(name);
    if (savedStory) {
        encProseContainer.innerHTML = savedStory;
    } else {
        encProseContainer.innerHTML = generateEncOpening(contact);
    }

    setTimeout(() => {
        const content = document.getElementById('enc-story-content');
        content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
    }, 300);
}

// ===== 退出故事（自动保存进度到 IndexedDB）=====
function exitEncStory() {
    if (encCurrentContact && encProseContainer && encProseContainer.innerHTML.trim()) {
        saveEncStory();
    }
    encStoryScreen.classList.add('enc-hidden');
    encSelectionScreen.classList.remove('enc-hidden');
    encStoryScreen.classList.remove('enc-intimate-mode', 'enc-dark-mode');
    clearInterval(encHeartInterval);
    encHeartContainer.innerHTML = '';
    clearTimeout(encAutoSaveTimer);
    encCurrentContact = null;
    document.querySelectorAll('.enc-polaroid-wrapper.flipped').forEach(p => p.classList.remove('flipped'));
    encQuickMenuPanel.classList.remove('active');
    encBtnQuickMenu.classList.remove('active');
    renderEncCharacterCards();
}

// ===== 深夜模式 =====
function toggleEncDarkMode() {
    encStoryScreen.classList.toggle('enc-dark-mode');
    if (encStoryScreen.classList.contains('enc-dark-mode') && encStoryScreen.classList.contains('enc-intimate-mode')) {
        encStoryScreen.classList.remove('enc-intimate-mode');
        clearInterval(encHeartInterval);
        encHeartContainer.innerHTML = '';
        encVignette.style.background = 'transparent';
        encVignette.style.animation = 'none';
    }
}

// ===== 甜蜜模式 =====
const encHeartFilled = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
const encHeartOutline = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

function toggleEncIntimateMode() {
    if (encStoryScreen.classList.contains('enc-dark-mode')) {
        encStoryScreen.classList.remove('enc-dark-mode');
    }
    const isIntimate = encStoryScreen.classList.toggle('enc-intimate-mode');
    if (isIntimate) {
        encClimaxSlider.dispatchEvent(new Event('input'));
        encHeartInterval = setInterval(() => {
            const heart = document.createElement('div');
            heart.className = 'enc-floating-heart';
            heart.innerHTML = Math.random() > .5 ? encHeartFilled : encHeartOutline;
            heart.style.left = Math.random() * 100 + '%';
            const size = (Math.random() * 14 + 10) + 'px';
            heart.style.width = size; heart.style.height = size;
            const dur = Math.random() * 3 + 4;
            heart.style.animationDuration = dur + 's';
            encHeartContainer.appendChild(heart);
            setTimeout(() => heart.remove(), dur * 1000);
        }, 280);
    } else {
        clearInterval(encHeartInterval);
        encHeartContainer.querySelectorAll('.enc-floating-heart').forEach(h => h.style.opacity = '0');
        setTimeout(() => encHeartContainer.innerHTML = '', 1000);
        encVignette.style.background = 'transparent';
        encVignette.style.animation = 'none';
    }
}

// ===== 感官同步滑块 → 已移入 initEncounterDOM() =====

// ===== 内心独白展开 =====
function toggleEncThought(el) {
    const p = el.closest('p');
    let nextEl = p.nextElementSibling;
    while (nextEl) {
        if (nextEl.classList.contains('enc-inner-thought')) {
            nextEl.classList.toggle('reveal');
            if (nextEl.classList.contains('reveal'))
                setTimeout(() => nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
            break;
        }
        nextEl = nextEl.nextElementSibling;
    }
}

// ===== 编辑 & 重做 =====
function editEncBlock(btn) {
    const block = btn.closest('.enc-story-block');
    let tc = block.querySelector('.enc-dialogue-user');
    if (tc) {
        const t = prompt('Edit:', tc.innerText);
        if (t && t.trim()) tc.innerText = t;
    } else {
        tc = block.querySelector('p');
        const t = prompt('Edit:', tc.innerText);
        if (t && t.trim()) tc.innerHTML = `<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">"${t}"</span>`;
    }
}

function redoEncBlock(btn) {
    const block = btn.closest('.enc-story-block');
    const isUser = block.classList.contains('user-block');
    block.style.opacity = '.5';
    setTimeout(() => {
        if (isUser) {
            encUserInput.value = block.querySelector('.enc-dialogue-user').innerText;
            encUserInput.style.height = 'auto';
            encUserInput.style.height = encUserInput.scrollHeight + 'px';
        }
        while (block.nextSibling) block.nextSibling.remove();
        if (block.previousElementSibling?.classList.contains('enc-prose-divider')) block.previousElementSibling.remove();
        block.remove();
        if (!isUser) generateEncAIResponse();
    }, 300);
}

function deleteEncBlock(btn) {
    const block = btn.closest('.enc-story-block');
    if (!block) return;
    block.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    block.style.opacity = '0';
    block.style.transform = 'translateX(-30px)';
    block.style.maxHeight = block.offsetHeight + 'px';
    setTimeout(() => {
        block.style.maxHeight = '0';
        block.style.padding = '0';
        block.style.margin = '0';
    }, 200);
    setTimeout(() => {
        const prevEl = block.previousElementSibling;
        if (prevEl && prevEl.classList.contains('enc-prose-divider')) prevEl.remove();
        block.remove();
        saveEncStory();
    }, 500);
}

// ===== AI 生成 =====
function generateEncAIResponse() {
    const name = encCurrentContact ? encCurrentContact.name : '他';

    const loadingHtml = `<div class="enc-prose-divider">· · ·</div><div class="enc-story-block ai-block enc-loading-block"><p style="opacity:.4;font-style:italic;">${name} is composing...</p></div>`;
    encProseContainer.insertAdjacentHTML('beforeend', loadingHtml);
    document.getElementById('enc-story-content').scrollTo({ top: 99999, behavior: 'smooth' });

    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    const apiUrl = settings.apiUrl;
    const apiToken = settings.apiToken;
    const apiModel = settings.apiModel;

    if (apiUrl && apiToken && apiModel) {
        callEncAI(apiUrl, apiToken, apiModel);
    } else {
        setTimeout(() => {
            removeEncLoadingBlock();
            const responses = [
                `<p>${name}的视线微微偏移，像是在回忆什么。<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">"既然如此，那接下来的时间就交给我吧。"</span> 站起身时，动作里带着一种不容拒绝的从容，自然地向你伸出手，<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">"走吧。"</span></p><div class="enc-inner-thought">其实一切都已经安排好了。我只是在等她点头。</div>`,
                `<p>沉默在两人之间流淌了片刻。${name}没有急着开口，只是将目光从窗外收回，缓缓落在你的脸上。<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">"你看起来有心事。"</span> 声音很轻，像是怕惊扰什么。</p><div class="enc-inner-thought">她眉心那道浅浅的纹路，只有在焦虑的时候才会出现。我见过太多次了。</div>`,
                `<p>${name}忽然笑了一下，极轻极淡。那种笑容不是给别人看的，更像是某种自嘲。<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">"有时候我在想，你到底是太勇敢，还是太不怕死。"</span> 说完，抬手轻轻弹了一下你额头。</p><div class="enc-inner-thought">每次看到她这副无所畏惧的样子，我心里就会浮现出一种奇怪的情绪——介于心疼和无奈之间。</div>`
            ];
            const randomResp = responses[Math.floor(Math.random() * responses.length)];
            encProseContainer.insertAdjacentHTML('beforeend', `
                <div class="enc-prose-divider">· · ·</div>
                <div class="enc-story-block ai-block">
                    <div class="enc-quote-mark">"</div>
                    ${randomResp}
                    <div class="enc-msg-actions">
                        <button class="enc-msg-action-btn" onclick="editEncBlock(this)">Edit</button>
                        <button class="enc-msg-action-btn" onclick="redoEncBlock(this)">Regenerate</button>
                    </div>
                </div>
            `);
            document.getElementById('enc-story-content').scrollTo({ top: 99999, behavior: 'smooth' });
        }, 1500);
    }
}

function removeEncLoadingBlock() {
    const loadingBlock = encProseContainer.querySelector('.enc-loading-block');
    if (loadingBlock) {
        const prev = loadingBlock.previousElementSibling;
        if (prev && prev.classList.contains('enc-prose-divider')) prev.remove();
        loadingBlock.remove();
    }
}

// ===== 从 Encounter 设置面板读取配置 =====
function getEncPerspective() {
    const activeBtn = document.querySelector('#encounterApp .enc-set-btn.active');
    if (activeBtn) {
        const txt = activeBtn.textContent.trim();
        if (txt === '1ST') return '第一人称';
        if (txt === '2ND') return '第二人称';
        if (txt === '3RD') return '第三人称';
    }
    return '第二人称';
}

function getEncWordLimit() {
    const input = document.querySelector('#encounterApp .enc-set-input');
    if (input && input.value) {
        const val = parseInt(input.value);
        if (val > 0) return val;
    }
    return 500;
}

function getEncSelectedPresets() {
    const presets = [];
    document.querySelectorAll('#enc-persona-overlay .enc-preset-block.selected').forEach(block => {
        const nameEl = block.querySelector('.enc-preset-name');
        const textEl = block.querySelector('.enc-preset-text');
        if (textEl && textEl.innerText.trim()) {
            const label = nameEl ? nameEl.innerText.trim() : '';
            presets.push({ label, content: textEl.innerText.trim() });
        }
    });
    return presets;
}

function getEncIntimateState() {
    if (!encStoryScreen.classList.contains('enc-intimate-mode')) return null;
    const slider = document.getElementById('enc-climax-slider');
    if (slider) return parseInt(slider.value);
    return null;
}

function buildEncStoryContext() {
    const storyBlocks = encProseContainer.querySelectorAll('.enc-story-block');
    const contextMessages = [];

    storyBlocks.forEach(block => {
        if (block.classList.contains('enc-loading-block')) return;

        const userEl = block.querySelector('.enc-dialogue-user');
        if (userEl) {
            // 用 textContent 代替 innerText，确保 display:none 的隐藏指令也能被读取
            const text = userEl.textContent.trim();
            if (text) {
                contextMessages.push({ role: 'user', content: text });
            }
            return;
        }

        const paragraphs = block.querySelectorAll('p');
        if (paragraphs.length > 0) {
            let aiText = '';
            paragraphs.forEach(p => {
                aiText += p.textContent.trim() + '\n\n';
            });
            const thought = block.querySelector('.enc-inner-thought');
            if (thought && thought.textContent.trim()) {
                aiText += '【内心】' + thought.textContent.trim();
            }
            if (aiText.trim()) {
                contextMessages.push({ role: 'assistant', content: aiText.trim() });
            }
        }
    });

    return contextMessages;
}

// ===== 核心：构建完整 System Prompt =====
function buildEncSystemPrompt(contact) {
    const charName = contact.name || 'Unknown';
    const persona = contact.persona || '';
    const perspective = getEncPerspective();
    const wordLimit = getEncWordLimit();
    const selectedPresets = getEncSelectedPresets();
    const intimateVal = getEncIntimateState();

    let prompt = '';

    // ── 世界书 (before) ──
    let wbData = { before: '', middle: '', after: '' };
    if (typeof getWorldbookPrompt === 'function') {
        wbData = getWorldbookPrompt(charName, []);
    }
    if (wbData.before) {
        prompt += wbData.before + '\n\n';
    }

    // ── 核心身份 ──
    prompt += `你是"${charName}"，正在参与一场沉浸式文学小说叙事。\n\n`;

    // ── 角色人设 ──
    if (persona) {
        prompt += `[角色设定]\n${persona}\n\n`;
    }

    // ── 用户面具（聊天室设置中的 Your Mask）──
    if (contact.userMask && contact.userMask.trim()) {
        prompt += `[用户人设 / User Persona]\n${contact.userMask}\n\n`;
    }

    // ── 认知记忆库（聊天室设置中的 Cognition Archive）──
    if (typeof getCognitionPrompt === 'function') {
        const cogPrompt = getCognitionPrompt(charName);
        if (cogPrompt) {
            prompt += cogPrompt + '\n\n';
        }
    }

    // ── 微信聊天记录作为背景上下文 ──
    if (typeof chatMessages !== 'undefined' && chatMessages[charName] && chatMessages[charName].length > 0) {
        const recentWcMsgs = chatMessages[charName].slice(-6);
        let wcContext = '[近期对话记忆（来自日常聊天）]\n';
        recentWcMsgs.forEach(msg => {
            const role = msg.role === 'user' ? '你' : charName;
            let txt = msg.text || '';
            if (txt.includes('<img') || txt.includes('<div')) txt = '[图片/媒体]';
            if (txt.length > 80) txt = txt.substring(0, 80) + '...';
            wcContext += `${role}：${txt}\n`;
        });
        wcContext += '（以上为日常聊天片段，仅作为角色关系的背景参考，不要直接引用。当前是小说叙事模式。）\n';
        prompt += wcContext + '\n';
    }

    // ── Persona 面板预设（文风、关系、自定义、禁忌）──
    if (selectedPresets.length > 0) {
        prompt += '[写作风格与关系设定]\n';
        selectedPresets.forEach(p => {
            if (p.label) {
                prompt += `◆ ${p.label}：${p.content}\n`;
            } else {
                prompt += `◆ ${p.content}\n`;
            }
        });
        prompt += '\n';
    }

    // ── 人称视角 ──
    const perspectiveMap = {
        '第一人称': '以"我"（即角色本人）的第一人称视角叙述。读者通过角色的眼睛感受世界。',
        '第二人称': '以"你"称呼读者/主角，角色以第三方视角被描写。读者是故事的参与者。',
        '第三人称': '以"他/她"称呼所有人物，全知全能的上帝视角叙述。'
    };
    prompt += `[叙事视角] ${perspective}\n${perspectiveMap[perspective] || ''}\n\n`;

    // ── 甜蜜模式状态注入 ──
    if (intimateVal !== null && intimateVal > 0) {
        let stateDesc = '';
        if (intimateVal < 30) stateDesc = '氛围微妙升温，角色开始注意到对方的细微变化';
        else if (intimateVal < 60) stateDesc = '暧昧感加深，身体距离缩短，呼吸和心跳成为叙述重点';
        else if (intimateVal < 90) stateDesc = '情欲渐浓，描写更加感官化，注重触觉、温度、气息的细节';
        else stateDesc = '极度亲密，理智边缘，所有感官描写达到最高烈度';
        prompt += `[感官同步状态: ${intimateVal}%] ${stateDesc}\n根据此状态调整叙述的亲密程度和感官描写强度。\n\n`;
    }

    // ── 世界书 (after) ──
    if (wbData.after) {
        prompt += wbData.after + '\n\n';
    }

    // ── 写作规则 ──
    prompt += `[写作要求]
- 字数控制在 ${wordLimit} 字左右
- 像文学小说一样写作，注重文学性和画面感
- 对话用引号""括起来，自然穿插在叙述性描写中
- 包含角色的内心独白，用"【内心】"标记（每次回复只写一段内心独白，放在最后）
- 注重氛围营造：光线、气味、声音、温度等感官细节
- 注重微表情和肢体语言描写
- 不要使用 markdown 格式（不要用 **、#、- 等标记）
- 不要使用 emoji
- 段落之间用空行分隔
- 保持角色性格的一致性，不要OOC`;

    return { systemPrompt: prompt, wbMiddle: wbData.middle };
}

// ===== API 调用 =====
async function callEncAI(apiUrl, apiToken, apiModel) {
    if (!encCurrentContact) { removeEncLoadingBlock(); return; }

    const { systemPrompt, wbMiddle } = buildEncSystemPrompt(encCurrentContact);
    const storyContext = buildEncStoryContext();

    // 上下文轮数限制
    const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}');
    const contextRounds = parseInt(settings.contextRounds) || 10;
    const maxMessages = contextRounds * 2;

    let trimmedContext = storyContext;
    if (trimmedContext.length > maxMessages) {
        trimmedContext = trimmedContext.slice(-maxMessages);
    }

    // 组装 API messages
    const apiMessages = [];
    apiMessages.push({ role: 'system', content: systemPrompt });

    // 世界书中段注入
    const midPoint = Math.floor(trimmedContext.length / 2);
    let middleInjected = false;

    trimmedContext.forEach((msg, idx) => {
        if (wbMiddle && !middleInjected && idx >= midPoint && midPoint > 0) {
            apiMessages.push({ role: 'system', content: wbMiddle });
            middleInjected = true;
        }
        apiMessages.push({ role: msg.role, content: msg.content });
    });

    // 根据上下文末尾情况添加续写指令
    const lastMsg = trimmedContext.length > 0 ? trimmedContext[trimmedContext.length - 1] : null;
    
    if (!lastMsg) {
        // 完全没有上下文，让 AI 写开场
        apiMessages.push({ role: 'user', content: '[开始叙事] 请以小说开篇的方式，描写角色登场的第一个场景。' });
    } else if (lastMsg.role === 'assistant') {
        // 最后一条是 AI 写的，用户直接点了星星，让 AI 自行续写
        apiMessages.push({ role: 'user', content: '[续写指令] 请自然地继续推进故事。可以描写角色的下一步动作、新的场景变化、或角色之间的新互动。不要重复已有内容。' });
    }
    // 如果最后一条是 user 的，AI 自然会回应，不需要额外指令

    // 温度
    const tempEl = document.getElementById('tempValText');
    const temperature = settings.temp ? parseFloat(settings.temp) : (tempEl ? parseFloat(tempEl.textContent) : 0.8);
    const wordLimit = getEncWordLimit();

    const amStartTime = Date.now();
    if (typeof amSetCalling === 'function') amSetCalling(true, 'Encounter', apiModel);

    try {
        const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({
                model: apiModel,
                messages: apiMessages,
                temperature: temperature,
                max_tokens: Math.max(wordLimit * 3, 1500)
            })
        });

        removeEncLoadingBlock();
        if (typeof amSetCalling === 'function') amSetCalling(false, 'Encounter', apiModel);

        if (!response.ok) {
            const errorText = await response.text();
            if (typeof logApiCall === 'function') {
                logApiCall({
                    model: apiModel, source: 'Encounter', status: response.status, statusText: response.statusText || 'Error',
                    inputTokens: estimateTokens(apiMessages.map(m => m.content || '').join('')),
                    outputTokens: 0, duration: Date.now() - amStartTime,
                    systemPrompt: systemPrompt.substring(0, 1000), errorText: errorText.substring(0, 500)
                });
            }
            encProseContainer.insertAdjacentHTML('beforeend', `
                <div class="enc-prose-divider">· · ·</div>
                <div class="enc-story-block ai-block">
                    <p style="color:var(--enc-text-muted);font-style:italic;">⚠ API Error ${response.status}: ${errorText.substring(0, 200)}</p>
                    <div class="enc-msg-actions">
                        <button class="enc-msg-action-btn" onclick="redoEncBlock(this)">Retry</button>
                    </div>
                </div>
            `);
            return;
        }

        const data = await response.json();
        const aiReply = data.choices?.[0]?.message?.content || '';

        if (typeof logApiCall === 'function') {
            const inTok = data.usage?.prompt_tokens || estimateTokens(apiMessages.map(m => m.content || '').join(''));
            const outTok = data.usage?.completion_tokens || estimateTokens(aiReply);
            logApiCall({
                model: apiModel, source: 'Encounter', status: 200, statusText: 'OK',
                inputTokens: inTok, outputTokens: outTok, duration: Date.now() - amStartTime,
                systemPrompt: systemPrompt.substring(0, 1000), aiResponse: aiReply.substring(0, 1000),
                messagesCount: apiMessages.length
            });
        }

        if (aiReply) {
            const formatted = formatEncAIReply(aiReply);
            encProseContainer.insertAdjacentHTML('beforeend', `
                <div class="enc-prose-divider">· · ·</div>
                <div class="enc-story-block ai-block">
                    <div class="enc-quote-mark">"</div>
                    ${formatted}
                    <div class="enc-msg-actions">
                        <button class="enc-msg-action-btn" onclick="editEncBlock(this)">Edit</button>
                        <button class="enc-msg-action-btn" onclick="redoEncBlock(this)">Regenerate</button>
                    </div>
                </div>
            `);

            // 自动保存进度到 IndexedDB
            saveEncStory();
        }
        document.getElementById('enc-story-content').scrollTo({ top: 99999, behavior: 'smooth' });
        saveEncStory();

    } catch (e) {
        console.error('Encounter AI error:', e);
        removeEncLoadingBlock();
        if (typeof amSetCalling === 'function') amSetCalling(false, 'Encounter', apiModel);
        if (typeof logApiCall === 'function') {
            logApiCall({
                model: apiModel, source: 'Encounter', status: 0, statusText: 'Network Error',
                inputTokens: 0, outputTokens: 0, duration: Date.now() - amStartTime,
                errorText: e.message
            });
        }
        encProseContainer.insertAdjacentHTML('beforeend', `
            <div class="enc-prose-divider">· · ·</div>
            <div class="enc-story-block ai-block">
                <p style="color:var(--enc-text-muted);font-style:italic;">⚠ Connection failed: ${e.message}</p>
                <div class="enc-msg-actions">
                    <button class="enc-msg-action-btn" onclick="redoEncBlock(this)">Retry</button>
                </div>
            </div>
        `);
    }
}

function formatEncAIReply(text) {
    let html = '';
    let thoughtParts = [];

    // 提取所有内心独白
    const thoughtRegex = /【内心】([\s\S]*?)(?=\n\n【|$)/g;
    let match;
    while ((match = thoughtRegex.exec(text)) !== null) {
        thoughtParts.push(match[1].trim());
    }
    if (thoughtParts.length === 0) {
        const singleMatch = text.match(/【内心】([\s\S]*?)$/);
        if (singleMatch) {
            thoughtParts.push(singleMatch[1].trim());
        }
    }

    // 移除内心独白部分
    let cleanText = text.replace(/【内心】[\s\S]*?(?=\n\n|$)/g, '').trim();

    // 清理 markdown
    cleanText = cleanText.replace(/\*\*/g, '');
    cleanText = cleanText.replace(/^#+\s*/gm, '');
    cleanText = cleanText.replace(/^[-*]\s+/gm, '');

    // 按段落分割
    const paragraphs = cleanText.split(/\n\n+/).filter(p => p.trim());
    paragraphs.forEach(para => {
        para = para.trim();
        if (!para) return;

        // 用占位符安全替换，避免正则互相污染
        let pieces = [];
        let idx = 0;

        // 先提取中文引号 "" 对话
        para = para.replace(/\u201c([^\u201d]+)\u201d/g, function(full, inner) {
            const placeholder = `__ENC_DLG_${idx}__`;
            pieces.push({ placeholder, html: `<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">\u201c${inner}\u201d</span>` });
            idx++;
            return placeholder;
        });

        // 再提取日式引号 「」 对话
        para = para.replace(/\u300c([^\u300d]+)\u300d/g, function(full, inner) {
            const placeholder = `__ENC_DLG_${idx}__`;
            pieces.push({ placeholder, html: `<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">\u201c${inner}\u201d</span>` });
            idx++;
            return placeholder;
        });

        // 再提取直角引号 «» 对话
        para = para.replace(/«([^»]+)»/g, function(full, inner) {
            const placeholder = `__ENC_DLG_${idx}__`;
            pieces.push({ placeholder, html: `<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">\u201c${inner}\u201d</span>` });
            idx++;
            return placeholder;
        });

        // 再提取普通英文直引号 "..." 对话
        para = para.replace(/"([^"]+)"/g, function(full, inner) {
            if (inner.includes('__ENC_DLG_')) return full;
            const placeholder = `__ENC_DLG_${idx}__`;
            pieces.push({ placeholder, html: `<span class="enc-dialogue-ai" onclick="toggleEncThought(this)">\u201c${inner}\u201d</span>` });
            idx++;
            return placeholder;
        });

        // 把占位符还原为真正的 HTML
        pieces.forEach(p => {
            para = para.replace(p.placeholder, p.html);
        });

        html += `<p>${para}</p>\n`;
    });

    // 添加内心独白
    if (thoughtParts.length > 0) {
        html += `<div class="enc-inner-thought">${thoughtParts.join(' ')}</div>`;
    }

    return html;
}

function invokeEncAI() { generateEncAIResponse(); }

// ===== 发送用户输入（根据 Auto Invoke 开关决定是否自动调用 AI）=====
function sendEncAction() {
    const text = encUserInput.value.trim();
    if (!text) return;
    encProseContainer.insertAdjacentHTML('beforeend', `
        <div class="enc-prose-divider">· · ·</div>
        <div class="enc-story-block user-block">
            <div class="enc-dialogue-user">${text}</div>
            <div class="enc-msg-actions">
                <button class="enc-msg-action-btn" onclick="editEncBlock(this)">Edit</button>
                <button class="enc-msg-action-btn" onclick="redoEncBlock(this)">Redo</button>
                <button class="enc-msg-action-btn" onclick="deleteEncBlock(this)">Del</button>
            </div>
        </div>
    `);
    encUserInput.value = '';
    encUserInput.style.height = 'auto';
    document.getElementById('enc-story-content').scrollTo({ top: 99999, behavior: 'smooth' });

    saveEncStory();

    const autoToggle = document.getElementById('enc-auto-invoke-toggle');
    if (autoToggle && autoToggle.classList.contains('active')) {
        generateEncAIResponse();
    }
}

// Enter 发送 → 已移入 initEncounterDOM()

// ===== Quick Menu =====
function toggleEncQuickMenu() {
    encBtnQuickMenu.classList.toggle('active');
    encQuickMenuPanel.classList.toggle('active');
}

// Quick Menu 点击关闭 → 已移入 initEncounterDOM()

function applyEncQuickMenu() {
    const scene = document.getElementById('enc-qm-scene').value.trim();
    const mood = document.getElementById('enc-qm-mood').value.trim();
    const instruction = document.getElementById('enc-qm-instruction').value.trim();

    let tagParts = [];
    if (scene) tagParts.push('Scene: ' + scene);
    if (mood) tagParts.push('Mood: ' + mood);

    if (tagParts.length > 0 || instruction) {
        let html = `<div class="enc-prose-divider">· · ·</div>`;
        if (tagParts.length > 0) html += `<div class="enc-story-tag">${tagParts.join(' · ')}</div>`;
        if (instruction) html += `<div style="text-align:center;font-family:var(--enc-mono);font-size:7px;color:var(--enc-text-muted);letter-spacing:1px;text-transform:uppercase;margin:-20px 0 20px;opacity:.5">[ ${instruction} ]</div>`;
        encProseContainer.insertAdjacentHTML('beforeend', html);

        // 将 Quick Menu 的指令作为隐藏的用户指令注入上下文
        let directives = [];
        if (scene) directives.push(`场景转换到：${scene}`);
        if (mood) directives.push(`氛围/情绪基调：${mood}`);
        if (instruction) directives.push(`剧情指令：${instruction}`);

        const hiddenBlock = document.createElement('div');
        hiddenBlock.className = 'enc-story-block user-block';
        hiddenBlock.style.display = 'none';
        hiddenBlock.setAttribute('data-directive', 'true');
        hiddenBlock.innerHTML = `<div class="enc-dialogue-user">[导演指令] ${directives.join('；')}</div>`;
        encProseContainer.appendChild(hiddenBlock);
    }

    encQuickMenuPanel.classList.remove('active');
    encBtnQuickMenu.classList.remove('active');
    generateEncAIResponse();
    document.getElementById('enc-qm-scene').value = '';
    document.getElementById('enc-qm-mood').value = '';
    document.getElementById('enc-qm-instruction').value = '';
}

// ===== 设置面板 =====
function handleEncFabClick(e) {
    if (encFabSettings.classList.contains('enc-fab-watermark')) {
        encFabSettings.classList.remove('enc-fab-watermark');
        clearTimeout(encFabTimeout);
        encFabTimeout = setTimeout(() => {
            if (!encSettingsOverlay.classList.contains('active'))
                encFabSettings.classList.add('enc-fab-watermark');
        }, 3000);
    } else {
        toggleEncSettings();
    }
}

function toggleEncSettings() {
    if (encSettingsOverlay.classList.toggle('active')) {
        clearTimeout(encFabTimeout);
        encFabSettings.classList.remove('enc-fab-watermark');
    } else {
        saveEncSettings();
        encFabSettings.classList.add('enc-fab-watermark');
    }
}

function closeEncSettings(e) {
    if (e.target === encSettingsOverlay) {
        saveEncSettings();
        encSettingsOverlay.classList.remove('active');
        encFabSettings.classList.add('enc-fab-watermark');
    }
}

// 设置按钮组交互 → 已移入 initEncounterDOM()

// ===== Encounter 设置持久化 =====
function saveEncSettings() {
    const activeBtn = document.querySelector('#encounterApp .enc-set-btngroup .enc-set-btn.active');
    const wordInput = document.querySelector('#encounterApp .enc-set-input');
    const autoToggle = document.getElementById('enc-auto-invoke-toggle');

    const data = {
        perspective: activeBtn ? activeBtn.textContent.trim() : '2ND',
        wordLimit: wordInput ? wordInput.value : '500',
        autoInvoke: autoToggle ? autoToggle.classList.contains('active') : false
    };

    localStorage.setItem('encSettings', JSON.stringify(data));
}

function loadEncSettings() {
    const saved = localStorage.getItem('encSettings');
    if (!saved) return;

    let data;
    try { data = JSON.parse(saved); } catch(e) { return; }

    // 恢复人称
    if (data.perspective) {
        const btns = document.querySelectorAll('#encounterApp .enc-set-btngroup .enc-set-btn');
        btns.forEach(b => {
            b.classList.remove('active');
            if (b.textContent.trim() === data.perspective) b.classList.add('active');
        });
    }

    // 恢复字数
    if (data.wordLimit) {
        const wordInput = document.querySelector('#encounterApp .enc-set-input');
        if (wordInput) wordInput.value = data.wordLimit;
    }

    // 恢复 Auto Invoke
    if (data.autoInvoke !== undefined) {
        const autoToggle = document.getElementById('enc-auto-invoke-toggle');
        if (autoToggle) {
            if (data.autoInvoke) autoToggle.classList.add('active');
            else autoToggle.classList.remove('active');
        }
    }
}

// ===== Persona 面板 =====
function openEncPersonaPanel() {
    if (!encPersonaOverlay) return;
    encPersonaOverlay.classList.add('active');
}

function closeEncPersonaPanel() {
    if (!encPersonaOverlay) return;
    encPersonaOverlay.classList.remove('active');
    saveEncPersonaPresets();
}

function toggleEncPersonaPanel() {
    if (!encPersonaOverlay) return;
    if (encPersonaOverlay.classList.contains('active')) {
        closeEncPersonaPanel();
    } else {
        openEncPersonaPanel();
    }
}
function toggleEncPersonaGroup(headerEl) { headerEl.parentElement.classList.toggle('active'); }
function toggleEncPreset(infoEl) {
    infoEl.closest('.enc-preset-block').classList.toggle('selected');
    saveEncPersonaPresets();
}

// ===== Persona 预设持久化存储 =====
function saveEncPersonaPresets() {
    const groups = document.querySelectorAll('#enc-persona-overlay .enc-persona-item-group');
    const data = [];

    groups.forEach((group, gIdx) => {
        const titleEl = group.querySelector('.enc-persona-item-title');
        const groupTitle = titleEl ? titleEl.textContent.trim() : 'Group ' + gIdx;
        const isOpen = group.classList.contains('active');
        const presets = [];

        group.querySelectorAll('.enc-preset-block').forEach(block => {
            const nameEl = block.querySelector('.enc-preset-name');
            const textEl = block.querySelector('.enc-preset-text');
            const isSelected = block.classList.contains('selected');

            if (nameEl && textEl) {
                presets.push({
                    name: nameEl.innerText.trim(),
                    text: textEl.innerText.trim(),
                    selected: isSelected
                });
            }
        });

        data.push({
            title: groupTitle,
            isOpen: isOpen,
            presets: presets
        });
    });

    localStorage.setItem('encPersonaPresets', JSON.stringify(data));
}

function loadEncPersonaPresets() {
    const saved = localStorage.getItem('encPersonaPresets');
    if (!saved) return;

    let data;
    try { data = JSON.parse(saved); } catch(e) { return; }
    if (!Array.isArray(data)) return;

    const groups = document.querySelectorAll('#enc-persona-overlay .enc-persona-item-group');

    data.forEach((groupData, gIdx) => {
        if (gIdx >= groups.length) return;
        const group = groups[gIdx];

        if (groupData.isOpen) {
            group.classList.add('active');
        } else {
            group.classList.remove('active');
        }

        const presetList = group.querySelector('.enc-preset-list');
        if (!presetList) return;
        presetList.innerHTML = '';

        if (groupData.presets && groupData.presets.length > 0) {
            groupData.presets.forEach(p => {
                const block = document.createElement('div');
                block.className = 'enc-preset-block' + (p.selected ? ' selected' : '');
                block.innerHTML = `
                    <div class="enc-preset-view">
                        <div class="enc-preset-info" onclick="toggleEncPreset(this)">
                            <div class="enc-preset-name">${escEncHtml(p.name)}</div>
                            <div class="enc-preset-text">${escEncHtml(p.text)}</div>
                        </div>
                        <div class="enc-preset-actions-side">
                            <button class="enc-btn-edit-icon" onclick="openEncEditForm(this)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <span class="enc-preset-check">✓</span>
                        </div>
                    </div>
                    <div class="enc-preset-edit-form">
                        <input type="text" class="enc-preset-input-title" value="${escEncAttr(p.name)}" placeholder="Preset Name">
                        <textarea class="enc-preset-textarea">${escEncHtml(p.text)}</textarea>
                        <div class="enc-form-actions">
                            <button class="enc-btn-form-action danger" onclick="deleteEncPreset(this)">Delete</button>
                            <div class="enc-form-actions-right">
                                <button class="enc-btn-form-action" onclick="cancelEncEdit(this)">Cancel</button>
                                <button class="enc-btn-form-action primary" onclick="saveEncEdit(this)">Save</button>
                            </div>
                        </div>
                    </div>`;
                presetList.appendChild(block);
            });
        }
    });
}

function escEncHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escEncAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openEncEditForm(btnEl) {
    const block = btnEl.closest('.enc-preset-block');
    block.querySelector('.enc-preset-view').style.display = 'none';
    block.querySelector('.enc-preset-edit-form').style.display = 'block';
}

function cancelEncEdit(btnEl) {
    const block = btnEl.closest('.enc-preset-block');
    if (block.getAttribute('data-is-new') === 'true') {
        block.remove();
        saveEncPersonaPresets();
    } else {
        block.querySelector('.enc-preset-edit-form').style.display = 'none';
        block.querySelector('.enc-preset-view').style.display = 'flex';
        block.querySelector('.enc-preset-input-title').value = block.querySelector('.enc-preset-name').innerText;
        block.querySelector('.enc-preset-textarea').value = block.querySelector('.enc-preset-text').innerText;
    }
}

function saveEncEdit(btnEl) {
    const block = btnEl.closest('.enc-preset-block');
    const title = block.querySelector('.enc-preset-input-title').value.trim() || 'Untitled';
    const text = block.querySelector('.enc-preset-textarea').value.trim();
    if (!text) { alert('Content cannot be empty.'); return; }
    block.querySelector('.enc-preset-name').innerText = title;
    block.querySelector('.enc-preset-text').innerText = text;
    block.removeAttribute('data-is-new');
    block.querySelector('.enc-preset-edit-form').style.display = 'none';
    block.querySelector('.enc-preset-view').style.display = 'flex';
    saveEncPersonaPresets();
}

function deleteEncPreset(btnEl) {
    if (confirm('Delete this entry?')) {
        btnEl.closest('.enc-preset-block').remove();
        saveEncPersonaPresets();
    }
}

function addEncNewPreset(btnEl) {
    const list = btnEl.parentElement.previousElementSibling;
    const block = document.createElement('div');
    block.className = 'enc-preset-block selected';
    block.setAttribute('data-is-new', 'true');
    block.innerHTML = `
        <div class="enc-preset-view" style="display:none;">
            <div class="enc-preset-info" onclick="toggleEncPreset(this)"><div class="enc-preset-name">New</div><div class="enc-preset-text">...</div></div>
            <div class="enc-preset-actions-side"><button class="enc-btn-edit-icon" onclick="openEncEditForm(this)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><span class="enc-preset-check">✓</span></div>
        </div>
        <div class="enc-preset-edit-form" style="display:block;">
            <input type="text" class="enc-preset-input-title" placeholder="Preset Name">
            <textarea class="enc-preset-textarea" placeholder="Detailed description..."></textarea>
            <div class="enc-form-actions">
                <button class="enc-btn-form-action danger" onclick="deleteEncPreset(this)">Delete</button>
                <div class="enc-form-actions-right">
                    <button class="enc-btn-form-action" onclick="cancelEncEdit(this)">Cancel</button>
                    <button class="enc-btn-form-action primary" onclick="saveEncEdit(this)">Save</button>
                </div>
            </div>
        </div>`;
    list.appendChild(block);
    setTimeout(() => block.querySelector('.enc-preset-input-title').focus(), 100);
}
