// ================= 世界书 (Archive) 核心逻辑 =================
let worldbookEntries = JSON.parse(localStorage.getItem('worldbookData')) || [];
let currentWbFilter = 'ALL';
const wbTypes = ['LOCATION', 'FACTION', 'ARTIFACT', 'CHARACTER', 'LORE'];

function openWorldbook() {
    document.getElementById('worldbookApp').classList.add('active');
    renderWbEntries();
}

function closeWorldbook() {
    document.getElementById('worldbookApp').classList.remove('active');
}

function saveWbData() {
    localStorage.setItem('worldbookData', JSON.stringify(worldbookEntries));
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
        
        // 动态生成联系人绑定列表 (读取微信联系人 wcContacts)
        let contactsHtml = '';
        if (typeof wcContacts !== 'undefined') {
            wcContacts.forEach(c => {
                const isActive = entry.linkedPersonas.includes(c.name) ? 'active' : '';
                const avatarContent = c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '🤖';
                contactsHtml += `
                    <div class="wb-flat-chip ${isActive}" onclick="toggleWbContact('${entry.id}', '${c.name}', this)">
                        <div class="avatar">${avatarContent}</div>
                        <span>${c.name}</span>
                    </div>
                `;
            });
        }

        const html = `
        <div class="wb-item" id="wb-item-${entry.id}">
            <div class="wb-item-header" onclick="toggleWbExpand('${entry.id}')">
                <div style="flex:1; padding-right:15px;">
                    <div class="wb-item-meta" onclick="cycleWbType(event, '${entry.id}')">NO. ${entry.id.toString().slice(-4)} // ${entry.type} (TAP TO CHANGE)</div>
                    <input type="text" class="wb-item-title" value="${entry.title}" placeholder="Enter Title..." onclick="event.stopPropagation()" oninput="updateWbData('${entry.id}', 'title', this.value)">
                </div>
                <div class="wb-item-icon">+</div>
            </div>
            
            <div class="wb-item-content">
                <textarea class="wb-desc-textarea" placeholder="Write description here..." oninput="updateWbData('${entry.id}', 'desc', this.value)">${entry.desc}</textarea>
                
                <div class="wb-bind-box">
                    <span class="wb-bind-label">BINDING SETTINGS</span>
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
        isGlobal: true,
        linkedPersonas: []
    };
    worldbookEntries.unshift(newEntry);
    saveWbData();
    
    // 如果当前在特定分类下，切回 ALL 以确保能看到新建的词条
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
