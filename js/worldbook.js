// ================= 世界书 (Archive) 核心逻辑 =================
let worldbookEntries = [];
let currentWbFilter = 'ALL';
const wbTypes = ['LOCATION', 'FACTION', 'ARTIFACT', 'CHARACTER', 'LORE'];
const wbPositions = ['before', 'middle', 'after'];
const wbPosLabels = { before: '▲ Before', middle: '● Middle', after: '▼ After' };

// ===== IndexedDB 存储引擎（无限空间）=====
const WB_DB_NAME = 'WorldbookDB';
const WB_STORE_NAME = 'WbStore';

function initWbDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(WB_DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(WB_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function wbDbSet(key, value) {
    try {
        const db = await initWbDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(WB_STORE_NAME, 'readwrite');
            tx.objectStore(WB_STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('WbDB write error:', e);
    }
}

async function wbDbGet(key) {
    try {
        const db = await initWbDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(WB_STORE_NAME, 'readonly');
            const request = tx.objectStore(WB_STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('WbDB read error:', e);
        return null;
    }
}

// 页面加载时从 IndexedDB 读取（兼容 localStorage 旧数据迁移）
async function loadWbData() {
    try {
        const stored = await wbDbGet('worldbookEntries');
        if (stored && Array.isArray(stored)) {
            worldbookEntries = stored;
        } else {
            // 尝试从 localStorage 迁移旧数据
            const lsData = localStorage.getItem('worldbookData');
            if (lsData) {
                try {
                    worldbookEntries = JSON.parse(lsData);
                    // 迁移到 IndexedDB
                    await wbDbSet('worldbookEntries', worldbookEntries);
                    // 迁移成功后清理 localStorage 释放空间
                    localStorage.removeItem('worldbookData');
                    console.log('✅ Worldbook data migrated to IndexedDB');
                } catch (e) {
                    worldbookEntries = [];
                }
            }
        }
    } catch (e) {
        console.error('Failed to load worldbook data:', e);
    }
}

// 页面加载完成后安全加载
(async function() {
    try {
        await loadWbData();
        console.log('✅ Worldbook loaded, entries:', worldbookEntries.length);
    } catch(e) {
        console.error('Worldbook load failed, using fallback:', e);
        try {
            const lsData = localStorage.getItem('worldbookData');
            if (lsData) worldbookEntries = JSON.parse(lsData);
        } catch(e2) {
            worldbookEntries = [];
        }
    }
})();

function openWorldbook() {
    document.getElementById('worldbookApp').classList.add('active');
    renderWbEntries();
}

function closeWorldbook() {
    document.getElementById('worldbookApp').classList.remove('active');
}

let wbSaveTimer = null;
function saveWbData() {
    // 防抖保存到 IndexedDB
    clearTimeout(wbSaveTimer);
    wbSaveTimer = setTimeout(() => {
        wbDbSet('worldbookEntries', worldbookEntries);
    }, 300);
}

function filterWb(type, tabElement) {
    currentWbFilter = type;
    document.querySelectorAll('.wb-tab').forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');
    renderWbEntries();
}

function renderWbEntries() {
    const list = document.getElementById('wbList');
    list.innerHTML = '';
    
    let filtered = worldbookEntries;
    if (currentWbFilter !== 'ALL') {
        filtered = worldbookEntries.filter(e => e.type === currentWbFilter);
    }

    document.getElementById('wbCountBadge').textContent = `${filtered.length} ENTRIES`;

    filtered.forEach(entry => {
        const isGlobalChecked = entry.isGlobal ? 'checked' : '';
        const disabledClass = entry.isGlobal ? 'disabled' : '';
        const entryPos = entry.position || 'before';
        const posLabel = wbPosLabels[entryPos] || '▲ Before';
        
        let contactsHtml = '';
        if (typeof wcContacts !== 'undefined') {
            wcContacts.forEach(c => {
                const isActive = (entry.linkedPersonas || []).includes(c.name) ? 'active' : '';
                const avatarContent = c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '🤖';
                contactsHtml += `
                    <div class="wb-flat-chip ${isActive}" onclick="toggleWbContact('${entry.id}', '${c.name}', this)">
                        <div class="avatar">${avatarContent}</div>
                        <span>${c.name}</span>
                    </div>
                `;
            });
        }

        let posButtonsHtml = '';
        wbPositions.forEach(pos => {
            const activeClass = entryPos === pos ? 'active' : '';
            posButtonsHtml += `<div class="wb-pos-chip ${activeClass}" onclick="setWbPosition('${entry.id}', '${pos}')">${wbPosLabels[pos]}</div>`;
        });

        const keywordsVal = entry.keywords || '';

        const html = `
        <div class="wb-item" id="wb-item-${entry.id}">
            <div class="wb-item-header" onclick="toggleWbExpand('${entry.id}')">
                <div style="flex:1; padding-right:15px;">
                    <div class="wb-item-meta" onclick="cycleWbType(event, '${entry.id}')">NO. ${entry.id.toString().slice(-4)} // ${entry.type} <span class="wb-pos-badge">${posLabel}</span></div>
                    <input type="text" class="wb-item-title" value="${entry.title}" placeholder="Enter Title..." onclick="event.stopPropagation()" oninput="updateWbData('${entry.id}', 'title', this.value)">
                </div>
                <div class="wb-item-icon">+</div>
            </div>
            
            <div class="wb-item-content">
                <textarea class="wb-desc-textarea" placeholder="Write description here..." oninput="updateWbData('${entry.id}', 'desc', this.value)">${entry.desc}</textarea>
                
                <div class="wb-bind-box">
                    <span class="wb-bind-label">INJECTION POSITION</span>
                    <div class="wb-pos-group" id="wb-pos-${entry.id}">
                        ${posButtonsHtml}
                    </div>

                    <span class="wb-bind-label" style="margin-top:18px;">KEYWORDS <span style="font-weight:400;color:#aaa;">(comma separated, triggers injection)</span></span>
                    <input type="text" class="wb-keywords-input" value="${keywordsVal}" placeholder="e.g. tower, crystal, magic" oninput="updateWbData('${entry.id}', 'keywords', this.value)">

                    <span class="wb-bind-label" style="margin-top:18px;">BINDING SETTINGS</span>
                    <label class="wb-flat-toggle">
                        <input type="checkbox" ${isGlobalChecked} onchange="toggleWbGlobal('${entry.id}', this.checked)">
                        <div class="wb-flat-checkbox"></div>
                        <span>Global Effect (All Personas)</span>
                    </label>
                    <div class="wb-chip-scroll ${disabledClass}" id="wb-chips-${entry.id}">
                        ${contactsHtml}
                    </div>
                    
                    <button class="wb-delete-btn" onclick="deleteWbEntry('${entry.id}')">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        DELETE ENTRY
                    </button>
                </div>
            </div>
        </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

function updateWbData(id, field, value) {
    const entry = worldbookEntries.find(e => e.id == id);
    if (entry) {
        entry[field] = value;
        saveWbData();
    }
}

function toggleWbExpand(id) {
    const item = document.getElementById(`wb-item-${id}`);
    if (item) item.classList.toggle('expanded');
}

function cycleWbType(event, id) {
    event.stopPropagation();
    const entry = worldbookEntries.find(e => e.id == id);
    if (entry) {
        let idx = wbTypes.indexOf(entry.type);
        entry.type = wbTypes[(idx + 1) % wbTypes.length];
        saveWbData();
        renderWbEntries();
        setTimeout(() => { document.getElementById(`wb-item-${id}`).classList.add('expanded'); }, 10);
    }
}

function setWbPosition(id, pos) {
    const entry = worldbookEntries.find(e => e.id == id);
    if (entry) {
        entry.position = pos;
        saveWbData();
        const group = document.getElementById(`wb-pos-${id}`);
        if (group) {
            group.querySelectorAll('.wb-pos-chip').forEach(chip => chip.classList.remove('active'));
            const activeChip = group.querySelector(`.wb-pos-chip:nth-child(${wbPositions.indexOf(pos) + 1})`);
            if (activeChip) activeChip.classList.add('active');
        }
        const metaEl = document.querySelector(`#wb-item-${id} .wb-pos-badge`);
        if (metaEl) metaEl.textContent = wbPosLabels[pos];
    }
}

function toggleWbGlobal(id, isChecked) {
    const entry = worldbookEntries.find(e => e.id == id);
    if (entry) {
        entry.isGlobal = isChecked;
        saveWbData();
        const chipScroll = document.getElementById(`wb-chips-${id}`);
        if (isChecked) chipScroll.classList.add('disabled');
        else chipScroll.classList.remove('disabled');
    }
}

function toggleWbContact(id, contactName, chipElement) {
    const entry = worldbookEntries.find(e => e.id == id);
    if (entry) {
        if (!entry.linkedPersonas) entry.linkedPersonas = [];
        const index = entry.linkedPersonas.indexOf(contactName);
        if (index > -1) {
            entry.linkedPersonas.splice(index, 1);
            chipElement.classList.remove('active');
        } else {
            entry.linkedPersonas.push(contactName);
            chipElement.classList.add('active');
        }
        saveWbData();
    }
}

function createNewWbEntry() {
    const newEntry = {
        id: Date.now().toString(),
        type: 'LORE',
        title: '',
        desc: '',
        keywords: '',
        position: 'before',
        isGlobal: true,
        linkedPersonas: []
    };
    worldbookEntries.unshift(newEntry);
    saveWbData();
    
    if (currentWbFilter !== 'ALL') {
        filterWb('ALL', document.querySelector('.wb-tab'));
    } else {
        renderWbEntries();
    }

    setTimeout(() => {
        const firstItem = document.getElementById(`wb-item-${newEntry.id}`);
        if (firstItem) {
            firstItem.classList.add('expanded');
            firstItem.querySelector('.wb-item-title').focus();
            document.getElementById('wbList').scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, 50);
}

function deleteWbEntry(id) {
    const item = document.getElementById(`wb-item-${id}`);
    if (item) item.style.opacity = '0';
    setTimeout(() => {
        worldbookEntries = worldbookEntries.filter(e => e.id != id);
        saveWbData();
        renderWbEntries();
    }, 300);
}

// ================= 世界书 API 注入引擎 =================
function getWorldbookPrompt(contactName, recentMessages) {
    if (!worldbookEntries || worldbookEntries.length === 0) {
        return { before: '', middle: '', after: '' };
    }

    const recentText = (recentMessages || []).slice(-10).map(m => m.text || '').join(' ').toLowerCase();

    const result = { before: [], middle: [], after: [] };

    worldbookEntries.forEach(entry => {
        if (!entry.desc || entry.desc.trim() === '') return;

        let isRelevantToContact = false;
        if (entry.isGlobal) {
            isRelevantToContact = true;
        } else if (entry.linkedPersonas && entry.linkedPersonas.includes(contactName)) {
            isRelevantToContact = true;
        }
        if (!isRelevantToContact) return;

        let shouldInject = false;

        if (!entry.keywords || entry.keywords.trim() === '') {
            shouldInject = true;
        } else {
            const keys = entry.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
            shouldInject = keys.some(k => recentText.includes(k));
        }

        if (shouldInject) {
            const block = `[${entry.type || 'LORE'}: ${entry.title || 'Untitled'}]\n${entry.desc}`;
            const pos = entry.position || 'before';
            if (result[pos]) {
                result[pos].push(block);
            } else {
                result.before.push(block);
            }
        }
    });

    return {
        before: result.before.length > 0 ? '\n\n[World Book — Before System Prompt]\n' + result.before.join('\n\n') : '',
        middle: result.middle.length > 0 ? '\n\n[World Book — Mid Context]\n' + result.middle.join('\n\n') : '',
        after: result.after.length > 0 ? '\n\n[World Book — After Context]\n' + result.after.join('\n\n') : ''
    };
}
