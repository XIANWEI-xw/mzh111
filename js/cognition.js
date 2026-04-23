// ================= Cognition 记忆库 核心逻辑 =================
let cogMemories = {}; // 结构: { "ContactName": [ {id, type, text, date}, ... ] }
let cogCurrentContact = '';
let cogCurrentFilter = 'ALL';
let cogCurrentEditId = null;
let cogCurrentEditType = 'HIGH';

const cogWeight = { 'CORE': 3, 'HIGH': 2, 'TRACE': 1 };

function loadCogData() {
    const data = localStorage.getItem('cognitionData');
    if (data) cogMemories = JSON.parse(data);
}

function saveCogData() {
    localStorage.setItem('cognitionData', JSON.stringify(cogMemories));
}

function openCognition(contactName) {
    cogCurrentContact = contactName;
    if (!cogMemories[contactName]) {
        cogMemories[contactName] = [];
    }
    
    // 初始化界面
    document.getElementById('cognitionApp').classList.add('active');
    
    // 切换到 ALL 标签
    document.querySelectorAll('.cog-filter-item').forEach(i => i.classList.remove('active'));
    document.querySelector('.cog-filter-item[data-filter="ALL"]').classList.add('active');
    cogCurrentFilter = 'ALL';
    
    renderCogMemories();
}

function closeCognition() {
    document.getElementById('cognitionApp').classList.remove('active');
    cogCurrentContact = '';
}

function renderCogMemories() {
    const container = document.getElementById('cogMemList');
    container.innerHTML = '';
    
    if (!cogCurrentContact || !cogMemories[cogCurrentContact]) return;

    let memories = cogMemories[cogCurrentContact];
    
    // 过滤
    let filtered = memories.filter(m => cogCurrentFilter === 'ALL' || m.type === cogCurrentFilter);
    
    // 排序
    filtered.sort((a, b) => cogWeight[b.type] - cogWeight[a.type]);

    // 更新数量
    document.getElementById('cogEntryCount').innerText = filtered.length.toString().padStart(2, '0');

    // 渲染
    filtered.forEach((m, index) => {
        const numStr = (index + 1).toString().padStart(2, '0');
        let html = '';
        
        if (m.type === 'CORE') {
            html = `
            <div class="cog-card-core cog-mem-card" style="animation-delay: ${index * 0.05}s" onclick="openCogEditor(${m.id})">
                <span class="cog-card-label">${numStr} / CORE MEMORY</span>
                <p class="cog-card-text">${m.text}</p>
                <span class="cog-card-date">${m.date}</span>
            </div>`;
        } else if (m.type === 'HIGH') {
            html = `
            <div class="cog-card-high cog-mem-card" style="animation-delay: ${index * 0.05}s" onclick="openCogEditor(${m.id})">
                <div class="cog-label-row">
                    <span class="cog-card-label">${numStr} / HIGH PRIORITY</span>
                    <span class="cog-card-date">${m.date}</span>
                </div>
                <p class="cog-card-text">${m.text}</p>
            </div>`;
        } else if (m.type === 'TRACE') {
            html = `
            <div class="cog-card-trace cog-mem-card" style="animation-delay: ${index * 0.05}s" onclick="openCogEditor(${m.id})">
                <span class="cog-card-label">${numStr} / TRACE</span>
                <p class="cog-card-text">${m.text}</p>
                <span class="cog-card-date">${m.date}</span>
            </div>`;
        }
        container.insertAdjacentHTML('beforeend', html);
    });
}

// 绑定过滤点击
document.addEventListener('DOMContentLoaded', () => {
    loadCogData();
    document.querySelectorAll('.cog-filter-item').forEach(item => {
        item.onclick = () => {
            document.querySelectorAll('.cog-filter-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            cogCurrentFilter = item.getAttribute('data-filter');
            renderCogMemories();
        };
    });
});

function openCogEditor(id) {
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
    editor.style.display = 'flex';
    setTimeout(() => editor.classList.add('active'), 10);
}

function setCogPriority(level) {
    cogCurrentEditType = level;
    document.getElementById('cogEditType').innerText = level + ' MEMORY';
    document.querySelectorAll('.cog-p-dot').forEach(d => {
        if (d.getAttribute('data-level') === level) d.classList.add('active');
        else d.classList.remove('active');
    });
}

function saveCogMem() {
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
    setTimeout(() => editor.style.display = 'none', 400);
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
