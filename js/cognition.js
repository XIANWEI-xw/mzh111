// ================= Cognition 记忆库 核心逻辑 =================
let cogMemories = {}; // 结构: { "ContactName": [ {id, type, text, date}, ... ] }
let cogCurrentContact = '';
let cogCurrentFilter = 'ALL';
let cogCurrentEditId = null;
let cogCurrentEditType = 'HIGH';

const cogWeight = { 'CORE': 3, 'HIGH': 2, 'TRACE': 1 };

const COG_DB_NAME = 'CognitionDB';
const COG_STORE_NAME = 'CogStore';

function initCogDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(COG_DB_NAME, 1);
        request.onupgradeneeded = (e) => { e.target.result.createObjectStore(COG_STORE_NAME); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function cogDbSet(key, value) {
    try {
        const db = await initCogDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(COG_STORE_NAME, 'readwrite');
            tx.objectStore(COG_STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error('CogDB write error:', e); }
}

async function cogDbGet(key) {
    try {
        const db = await initCogDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(COG_STORE_NAME, 'readonly');
            const request = tx.objectStore(COG_STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) { console.error('CogDB read error:', e); return null; }
}

async function loadCogData() {
    try {
        const stored = await cogDbGet('cogMemories');
        if (stored) {
            cogMemories = stored;
        } else {
            const lsData = localStorage.getItem('cognitionData');
            if (lsData) {
                try {
                    cogMemories = JSON.parse(lsData);
                    await cogDbSet('cogMemories', cogMemories);
                    localStorage.removeItem('cognitionData');
                    console.log('✅ Cognition data migrated to IndexedDB');
                } catch (e) { cogMemories = {}; }
            }
        }
    } catch (e) {
        console.error('Failed to load cognition data:', e);
        try {
            const lsData = localStorage.getItem('cognitionData');
            if (lsData) cogMemories = JSON.parse(lsData);
        } catch (e2) { cogMemories = {}; }
    }
}

let cogSaveTimer = null;
function saveCogData() {
    clearTimeout(cogSaveTimer);
    cogSaveTimer = setTimeout(() => {
        cogDbSet('cogMemories', cogMemories);
    }, 300);
}

function openCognition(contactName) {
    if (typeof playWcClickSound === 'function') playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    
    cogCurrentContact = contactName;
    if (!cogMemories[contactName]) {
        cogMemories[contactName] = [];
    }
    
    document.getElementById('cognitionApp').classList.add('active');
    
    document.querySelectorAll('.cog-filter-btn').forEach(i => i.classList.remove('active'));
    document.querySelector('.cog-filter-btn[data-filter="ALL"]').classList.add('active');
    cogCurrentFilter = 'ALL';
    
    renderCogMemories();
}

function closeCognition() {
    if (typeof playWcClickSound === 'function') playWcClickSound();
    document.getElementById('cognitionApp').classList.remove('active');
    cogCurrentContact = '';
}

function renderCogMemories() {
    const container = document.getElementById('cogMemList');
    container.innerHTML = '';
    
    if (!cogCurrentContact || !cogMemories[cogCurrentContact]) return;

    let memories = cogMemories[cogCurrentContact];
    
    let filtered = memories.filter(m => cogCurrentFilter === 'ALL' || m.type === cogCurrentFilter);
    filtered.sort((a, b) => cogWeight[b.type] - cogWeight[a.type]);

    // 更新统计
    const coreCount = memories.filter(m => m.type === 'CORE').length;
    const highCount = memories.filter(m => m.type === 'HIGH').length;
    const traceCount = memories.filter(m => m.type === 'TRACE').length;
    
    document.getElementById('cogStatCore').innerText = coreCount.toString().padStart(2, '0');
    document.getElementById('cogStatHigh').innerText = highCount.toString().padStart(2, '0');
    document.getElementById('cogStatTrace').innerText = traceCount.toString().padStart(2, '0');
    document.getElementById('cogStatTotal').innerText = memories.length.toString().padStart(2, '0');

    filtered.forEach((m, index) => {
        const numStr = (index + 1).toString().padStart(2, '0');
        let html = '';
        
        if (m.type === 'CORE') {
            html = `
            <div class="cog-card-core cog-mem-card" style="animation-delay: ${index * 0.05}s" onclick="openCogEditor(${m.id})">
                <div class="cog-core-top">
                    <div class="cog-core-badge">Core Memory</div>
                    <div class="cog-core-num">${numStr}</div>
                </div>
                <div class="cog-core-text">${m.text}</div>
                <div class="cog-core-footer">
                    <div class="cog-core-date">${m.date}</div>
                    <div class="cog-core-icon"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
                </div>
            </div>`;
        } else if (m.type === 'HIGH') {
            html = `
            <div class="cog-card-high cog-mem-card" style="animation-delay: ${index * 0.05}s" onclick="openCogEditor(${m.id})">
                <div class="cog-high-top">
                    <div class="cog-high-badge">HIGH PRIORITY</div>
                </div>
                <div class="cog-high-text">${m.text}</div>
                <div class="cog-high-footer">
                    <div class="cog-high-date">${m.date}</div>
                    <div class="cog-high-num">NO.${numStr}</div>
                </div>
            </div>`;
        } else if (m.type === 'TRACE') {
            html = `
            <div class="cog-card-trace cog-mem-card" style="animation-delay: ${index * 0.05}s" onclick="openCogEditor(${m.id})">
                <div class="cog-trace-top">
                    <span class="cog-trace-badge">TRACE</span>
                    <span class="cog-trace-date">${m.date}</span>
                </div>
                <div class="cog-trace-text">${m.text}</div>
            </div>`;
        }
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.filterCog = function(filterStr, el) {
    if (typeof playWcClickSound === 'function') playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(5);
    document.querySelectorAll('.cog-filter-btn').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    cogCurrentFilter = filterStr;
    renderCogMemories();
};

document.addEventListener('DOMContentLoaded', () => {
    loadCogData();
});

function openCogEditor(id) {
    if (typeof playWcClickSound === 'function') playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(8);
    
    const editor = document.getElementById('cogEditor');
    const textInput = document.getElementById('cogEditText');
    const typeLabel = document.getElementById('cogEditType');
    const dateLabel = document.getElementById('cogEditDate');
    const delBtn = document.getElementById('cogBtnDelete');

    cogCurrentEditId = id;

    if (id !== null) {
        const mem = cogMemories[cogCurrentContact].find(m => m.id === id);
        textInput.value = mem.text;
        cogCurrentEditType = mem.type;
        dateLabel.innerText = mem.date.toUpperCase();
        delBtn.style.display = 'block';
    } else {
        textInput.value = '';
        cogCurrentEditType = 'HIGH';
        dateLabel.innerText = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
        delBtn.style.display = 'none';
    }

    setCogPriority(cogCurrentEditType);
    editor.classList.add('active');
}

function setCogPriority(level) {
    if (typeof playWcClickSound === 'function') playWcClickSound();
    if (navigator.vibrate) navigator.vibrate(5);
    cogCurrentEditType = level;
    const typeLabel = document.getElementById('cogEditType');
    if (level === 'CORE') typeLabel.innerText = 'CORE MEMORY';
    else if (level === 'HIGH') typeLabel.innerText = 'HIGH PRIORITY';
    else typeLabel.innerText = 'TRACE';
    
    document.querySelectorAll('.cog-p-btn').forEach(d => {
        d.classList.remove('active-core', 'active-high', 'active-trace');
        if (d.getAttribute('data-level') === level) {
            d.classList.add('active-' + level.toLowerCase());
        }
    });
}

function saveCogMem() {
    if (typeof playWcSaveSound === 'function') playWcSaveSound();
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    
    const text = document.getElementById('cogEditText').value.trim();
    if (!text) {
        closeCogEditor();
        return;
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (cogCurrentEditId !== null) {
        const mem = cogMemories[cogCurrentContact].find(m => m.id === cogCurrentEditId);
        mem.text = text;
        mem.type = cogCurrentEditType;
    } else {
        cogMemories[cogCurrentContact].push({
            id: Date.now(),
            type: cogCurrentEditType,
            text: text,
            date: dateStr
        });
    }

    saveCogData();
    closeCogEditor();
    renderCogMemories();
}

function deleteCogMem() {
    if (typeof playWcDangerSound === 'function') playWcDangerSound();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    
    if (cogCurrentEditId !== null) {
        cogMemories[cogCurrentContact] = cogMemories[cogCurrentContact].filter(m => m.id !== cogCurrentEditId);
        saveCogData();
        closeCogEditor();
        renderCogMemories();
    }
}

function closeCogEditor() {
    const editor = document.getElementById('cogEditor');
    editor.classList.remove('active');
}

// 供外部 AI 调用：将所有记忆拼接为字符串
function getCognitionPrompt(contactName) {
    if (!cogMemories[contactName] || cogMemories[contactName].length === 0) return '';
    
    let prompt = "\n\n[Cognition / Persistent Memory]:\n";
    
    // 按优先级排序后发送给 AI
    let sorted = [...cogMemories[contactName]].sort((a, b) => cogWeight[b.type] - cogWeight[a.type]);
    
    sorted.forEach(m => {
        prompt += `- (${m.type}) ${m.text}\n`;
    });
    
    return prompt;
}
