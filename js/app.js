// ==========================================
// 终极合并版 app.js (包含锁屏 + 桌面拖拽引擎)
// ==========================================

let inputCode = "";
const CORRECT_CODE = "0101";
let isEditMode = false;

window.onload = function() {
    // 1. 初始化时钟
    updateClock();
    setInterval(updateClock, 1000);
    
    // 2. 初始化锁屏上滑监听
    initSwipeToUnlock();
    
    // 3. 初始化桌面网格与滑动
    initBlueprintGrids();
    initDesktopSwiper();
    
    // 4. 加载持久化设置
    loadAllSettings();
    
    // 5. 渲染桌面图标
    renderApps(); 
    
    console.log('✅ 系统启动成功');
};

// ================= 1. 全局时钟 =================
function updateClock() {
    const now = new Date();
    let h = now.getHours().toString().padStart(2, '0');
    let m = now.getMinutes().toString().padStart(2, '0');
    
    const clockEl = document.getElementById('clock');
    const desktopClock = document.getElementById('desktop-clock');
    if(clockEl) clockEl.innerText = `${h}:${m}`;
    if(desktopClock) desktopClock.innerText = `${h}:${m}`;
}

// ================= 2. 锁屏与解锁特效 =================
function initSwipeToUnlock() {
    const mainFrame = document.getElementById('main-frame');
    const swipeHint = document.getElementById('swipeHint');
    let startY = 0;

    document.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive: true});
    document.addEventListener('touchend', e => {
        let endY = e.changedTouches[0].clientY;
        if (startY - endY > 50 && !mainFrame.classList.contains('show-passcode') && !mainFrame.classList.contains('unlocked')) {
            showPasscode();
        }
    });

    let isMouseDown = false;
    document.addEventListener('mousedown', e => { isMouseDown = true; startY = e.clientY; });
    document.addEventListener('mouseup', e => {
        if(!isMouseDown) return;
        isMouseDown = false;
        if (startY - e.clientY > 50 && !mainFrame.classList.contains('show-passcode') && !mainFrame.classList.contains('unlocked')) {
            showPasscode();
        }
    });

    if(swipeHint) swipeHint.addEventListener('click', showPasscode);
}

function showPasscode() { document.getElementById('main-frame').classList.add('show-passcode'); }
function hidePasscode() { 
    document.getElementById('main-frame').classList.remove('show-passcode'); 
    inputCode = ""; 
    updateDots(); 
}

function pressKey(num) {
    if (inputCode.length >= 4) return;
    if(navigator.vibrate) navigator.vibrate(10); 
    inputCode += num;
    updateDots();
    if (inputCode.length === 4) setTimeout(checkCode, 150); 
}

function updateDots() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        if (index < inputCode.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
    });
}

function checkCode() {
    const dotsContainer = document.getElementById('dots');
    const mainFrame = document.getElementById('main-frame');
    const glassOverlay = document.getElementById('glassOverlay');
    const shatterContainer = document.getElementById('shatterContainer');
    const flashBang = document.getElementById('flashBang');

    if (inputCode === CORRECT_CODE) {
        if(navigator.vibrate) navigator.vibrate([30, 50, 30]);
        flashBang.classList.add('flash-active');
        glassOverlay.style.opacity = '0';
        shatterContainer.style.display = 'block';
        
        setTimeout(() => {
            shatterContainer.classList.add('shattered');
            mainFrame.classList.add('unlocked');
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if(themeMeta) themeMeta.setAttribute('content', '#EFEFEF');
        }, 50);
    } else {
        if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
        dotsContainer.classList.add('shake');
        setTimeout(() => {
            dotsContainer.classList.remove('shake');
            inputCode = "";
            updateDots();
        }, 400);
    }
}

// ================= 3. 桌面数据与渲染 =================
let page1Items = [
    { id: 'wg1', type: 'widget', name: 'Profile', col: 0, row: 0, rows: 3 },
    { id: 'app1', type: 'app', name: 'WeChat', fill: 'tex-dark', icon: '<svg viewBox="0 0 64 64"><path d="M32 12c-13.2 0-24 9.6-24 21.5 0 6.5 3.3 12.3 8.4 16.2l-2.4 7.3 8.5-4.2c3 .9 6.2 1.4 9.5 1.4 13.2 0 24-9.6 24-21.5S45.2 12 32 12z" fill="#fff"/><path d="M32 20l3 8h8l-6.5 5 2.5 8-7-5.5-7 5.5 2.5-8L21 28h8z" fill="#2a2a2a"/></svg>', col: 1, row: 3 },
    { id: 'app2', type: 'app', name: 'Q', fill: 'tex-light', icon: '<svg viewBox="0 0 64 64"><path d="M15 45c5-5 12-8 20-8 8 0 15 5 18 10-5-12-15-20-28-20-8 0-15 4-20 10 5-2 10-2 15-2z" fill="#111"/><path d="M35 27c-3-5-8-8-14-8 5 0 10 3 12 8z" fill="#111"/></svg>', col: 2, row: 3 },
    { id: 'app3', type: 'app', name: 'Z', fill: 'tex-light', icon: '<svg viewBox="0 0 64 64"><path d="M28 50h-4c1-10 2-20 4-30h4c-1 10-3 20-4 30zM40 50h-3c0-8 1-16 2-24h3c-1 8-2 16-2 24z" fill="#111"/><path d="M28 20c-5 2-10 5-12 10 2-4 6-6 10-7-2-3-5-5-8-6 3 0 7 1 10 3 0-4-1-8-3-12 3 3 5 7 5 11 3-3 7-5 11-5-2 4-5 6-8 8 4 0 8 1 11 3-4-1-8-1-11 0z" fill="#111"/></svg>', col: 1, row: 4 },
    { id: 'app4', type: 'app', name: 'Emo', fill: 'tex-dark', icon: '<svg viewBox="0 0 64 64"><rect x="30" y="20" width="4" height="24" fill="#fff"/><rect x="20" y="30" width="24" height="4" fill="#fff"/></svg>', col: 2, row: 4 },
    { id: 'app5', type: 'app', name: '~', fill: 'tex-light', icon: '<svg viewBox="0 0 64 64"><path d="M25 45c0 4-3 7-7 7s-7-3-7-7 3-7 7-7c1 0 2 0 3 1v-24h18v6H25v24z" fill="#111"/><rect x="10" y="25" width="44" height="2" fill="#111"/><rect x="10" y="35" width="44" height="2" fill="#111"/></svg>', col: 0, row: 5 },
    { id: 'app6', type: 'app', name: 'Archive', fill: 'tex-black', icon: '<div style="font-family: \'Cormorant Garamond\', serif; font-size: 34px; font-weight: bold; font-style: italic; color: #fff; line-height: 56px;">A</div>', col: 1, row: 5 },
    { id: 'app7', type: 'app', name: 'Camera', fill: 'tex-light', icon: '<svg viewBox="0 0 64 64"><rect x="10" y="40" width="44" height="14" fill="#111"/><circle cx="32" cy="35" r="8" fill="#111"/><path d="M10 40c10-5 20-5 44 0" fill="none" stroke="#111" stroke-width="2"/></svg>', col: 2, row: 5 },
    { id: 'app8', type: 'app', name: 'Settings', fill: 'tex-black', icon: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 12v4M32 48v4M12 32h4M48 32h4M18 18l3 3M43 43l3 3M18 46l3-3M46 18l-3 3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>', col: 3, row: 5 },
];

function openSettings() {
    renderSettingsIconGrid();
    document.getElementById('settingsOverlay').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsOverlay').classList.remove('active');
    saveAllSettings();
}

function switchSettingsPage(idx) {
    document.querySelectorAll('.settings-nav-item').forEach((el, i) => el.classList.toggle('active', i === idx));
    document.querySelectorAll('.settings-page').forEach((el, i) => el.classList.toggle('active', i === idx));
}

function updateSettingsVal(id, val) {
    document.getElementById(id).innerText = val;
    if (id === 'sizeValText') {
        let styleEl = document.getElementById('dynamic-typography');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-typography';
            document.head.appendChild(styleEl);
        }
        const ratio = parseInt(val) / 100;
        styleEl.innerHTML = `
            .iphone-frame-body { font-size: ${val} !important; }
            .app-label { font-size: ${11 * ratio}px !important; }
            .widget-name { font-size: ${18 * ratio}px !important; }
            .widget-handle, .widget-location { font-size: ${12 * ratio}px !important; }
            .widget-bio { font-size: ${11 * ratio}px !important; }
            .time { font-size: ${60 * ratio}px !important; }
            .date { font-size: ${16 * ratio}px !important; }
            .desktop-status-bar { font-size: ${12 * ratio}px !important; }
        `;
    }
}

function saveAllSettings() {
    const settings = {
        apiUrl: document.getElementById('setApiUrl').value,
        apiToken: document.getElementById('setApiToken').value,
        apiModel: document.getElementById('setApiModelSelect').value,
        scale: document.getElementById('sizeValText').innerText,
        temp: document.getElementById('tempValText').innerText
    };
    localStorage.setItem('systemSettings', JSON.stringify(settings));
}

async function fetchModels() {
    const url = document.getElementById('setApiUrl').value;
    const token = document.getElementById('setApiToken').value;
    const select = document.getElementById('setApiModelSelect');
    
    if (!url || !token) return alert('请先填写 URL 和 Token');
    
    select.innerHTML = '<option>正在拉取...</option>';
    
    try {
        const response = await fetch(`${url.replace(/\/+$/, '')}/models`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data && data.data) {
            select.innerHTML = data.data.map(m => `<option value="${m.id}">${m.id}</option>`).join('');
        } else {
            throw new Error('格式错误');
        }
    } catch (e) {
        alert('获取模型失败，请检查网络或配置');
        select.innerHTML = '<option value="">获取失败</option>';
    }
}

function saveNewPreset() {
    const url = document.getElementById('setApiUrl').value;
    const token = document.getElementById('setApiToken').value;
    const model = document.getElementById('setApiModelSelect').value;
    if (!url) return alert('请输入接口地址');
    
    const name = prompt('为该预设命名:', '新预设 ' + new Date().toLocaleTimeString());
    if (!name) return;

    let presets = JSON.parse(localStorage.getItem('apiPresets') || '[]');
    presets.push({ name, url, token, model });
    localStorage.setItem('apiPresets', JSON.stringify(presets));
    renderPresetOptions();
    alert('预设已添加');
}

function deleteCurrentPreset() {
    const select = document.getElementById('apiPresetSelect');
    const index = select.selectedIndex - 1; 
    if (index < 0) return alert('请先选择一个预设');

    if (confirm('确定要删除该预设吗？')) {
        let presets = JSON.parse(localStorage.getItem('apiPresets') || '[]');
        presets.splice(index, 1);
        localStorage.setItem('apiPresets', JSON.stringify(presets));
        renderPresetOptions();
    }
}

function renderPresetOptions() {
    const select = document.getElementById('apiPresetSelect');
    if (!select) return;
    const presets = JSON.parse(localStorage.getItem('apiPresets') || '[]');
    select.innerHTML = '<option value="">-- 选择预设 --</option>' + 
        presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
}

function applyPresetSelection() {
    const select = document.getElementById('apiPresetSelect');
    const index = select.value;
    if (index === "") return;

    const presets = JSON.parse(localStorage.getItem('apiPresets') || '[]');
    const data = presets[index];
    if (data) {
        document.getElementById('setApiUrl').value = data.url || '';
        document.getElementById('setApiToken').value = data.token || '';
        const modelSelect = document.getElementById('setApiModelSelect');
        modelSelect.innerHTML = `<option value="${data.model || ''}">${data.model || '未指定模型'}</option>`;
    }
}

function loadAllSettings() {
    renderPresetOptions();

    const savedSettings = JSON.parse(localStorage.getItem('systemSettings'));
    if (savedSettings) {
        const urlInput = document.getElementById('setApiUrl');
        const tokenInput = document.getElementById('setApiToken');
        const modelSelect = document.getElementById('setApiModelSelect');
        if(urlInput) urlInput.value = savedSettings.apiUrl || '';
        if(tokenInput) tokenInput.value = savedSettings.apiToken || '';
        if(modelSelect && savedSettings.apiModel) {
            modelSelect.innerHTML = `<option value="${savedSettings.apiModel}">${savedSettings.apiModel}</option>`;
        }
        
        const scaleVal = savedSettings.scale || '100%';
        document.getElementById('sizeValText').innerText = scaleVal;
        updateSettingsVal('sizeValText', scaleVal);
        
        document.getElementById('tempValText').innerText = savedSettings.temp || '0.7';
    }
    
    const deskWall = localStorage.getItem('desktopWallpaper');
    if (deskWall) {
        const desktop = document.querySelector('.desktop-container');
        if(desktop) {
            desktop.style.backgroundImage = `url(${deskWall})`;
            desktop.style.backgroundSize = 'cover';
            desktop.style.backgroundPosition = 'center';
        }
        const preview = document.getElementById('setWgCover');
        if(preview) {
            preview.style.backgroundImage = `url(${deskWall})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
    }

    const wgWall = localStorage.getItem('widgetCover');
    if (wgWall) {
        const wg = document.getElementById('wgCover');
        if(wg) { 
            wg.style.backgroundImage = `url(${wgWall})`; 
            wg.style.backgroundSize = 'cover';
            wg.style.backgroundPosition = 'center';
            wg.innerText = ''; 
        }
    }

    const wgAv = localStorage.getItem('widgetAvatar');
    if (wgAv) {
        const av = document.getElementById('wgAvatar');
        if(av) { 
            av.style.backgroundImage = `url(${wgAv})`; 
            av.style.backgroundSize = 'cover';
            av.style.backgroundPosition = 'center';
            av.innerText = ''; 
        }
    }
}

function renderSettingsIconGrid() {
    const grid = document.getElementById('settingsIconGrid');
    const allApps = [...page1Items.filter(a => a.type === 'app'), ...dockItems];
    grid.innerHTML = allApps.map(app => `
        <div class="settings-icon-item" onclick="openIconEditModal('${app.name}')">
            <div class="settings-icon-preview">${app.icon}</div>
            <div class="settings-icon-name">${app.name}</div>
        </div>
    `).join('');
}

function openIconEditModal(name) {
    document.getElementById('iconEditTitle').innerText = `Edit ${name}`;
    document.getElementById('iconEditModal').classList.add('active');
}

function closeIconEditModal() {
    document.getElementById('iconEditModal').classList.remove('active');
}

let page2Items = [];

let dockItems = [
    { id: 'dock1', type: 'app', name: 'Z', fill: 'tex-white', icon: '<svg viewBox="0 0 64 64"><mask id="cut"><rect width="64" height="64" fill="white"/><circle cx="64" cy="0" r="25" fill="black"/></mask><g mask="url(#cut)"><path d="M30 45h-4c1-8 2-16 3-24h4c-1 8-2 16-3 24z" fill="#111"/><path d="M30 21c-4 2-8 4-10 8 2-3 5-5 8-6-2-2-4-4-6-5 2 0 5 1 8 2 0-3-1-6-2-9 2 2 4 5 4 8 2-2 5-4 8-4-1 3-3 5-6 6 3 0 6 1 8 2-3-1-6-1-8 0z" fill="#111"/></g></svg>', col: 0, row: 6 },
    { id: 'dock2', type: 'app', name: 'oh', fill: 'tex-black', icon: '<svg viewBox="0 0 64 64"><text x="50%" y="55%" font-size="24" font-weight="900" fill="#fff" text-anchor="middle" dominant-baseline="middle">oh.</text></svg>', col: 1, row: 6 },
    { id: 'dock3', type: 'app', name: 'User', fill: 'tex-black', icon: '<svg viewBox="0 0 64 64"><circle cx="32" cy="24" r="10" fill="#fff"/><path d="M16 54c0-10 8-16 16-16s16 6 16 16" fill="#fff"/></svg>', col: 2, row: 6 },
    { id: 'dock4', type: 'app', name: 'Folder', fill: 'tex-black', icon: '<svg viewBox="0 0 64 64"><path d="M10 20h15l5 5h24v25H10z" fill="none" stroke="#fff" stroke-width="3"/><path d="M32 30l-6 10h12z" fill="#fff"/><path d="M32 42h10v2H32z" fill="#fff"/></svg>', col: 3, row: 6 },
];

function initBlueprintGrids() {
    document.querySelectorAll('.blueprint-grid').forEach(grid => {
        grid.innerHTML = '';
        for(let i = 0; i < 28; i++) {
            const cell = document.createElement('div');
            cell.className = 'blueprint-cell';
            cell.innerHTML = '<div class="blueprint-footprint"></div>';
            grid.appendChild(cell);
        }
    });
}

function initDesktopSwiper() {
    const swiper = document.getElementById('swiper');
    const dot1 = document.getElementById('dot1');
    const dot2 = document.getElementById('dot2');
    if(!swiper) return;

    swiper.addEventListener('scroll', () => {
        let ratio = swiper.scrollLeft / swiper.clientWidth;
        if (ratio < 0.5) {
            dot1.classList.add('active'); dot2.classList.remove('active');
        } else {
            dot2.classList.add('active'); dot1.classList.remove('active');
        }
    }, {passive: true});
}

function renderApps() {
    const page1El = document.getElementById('page1');
    const page2El = document.getElementById('page2');
    const dockEl = document.getElementById('dock');
    if(!page1El || !page2El || !dockEl) return;

    page1El.querySelectorAll('.grid-item').forEach(e => e.remove());
    page2El.querySelectorAll('.grid-item').forEach(e => e.remove());
    dockEl.innerHTML = '';

    renderList(page1Items, page1El);
    renderList(page2Items, page2El);
    renderList(dockItems, dockEl);
}

function renderList(list, container) {
    list.forEach(item => {
        const el = document.createElement('div');
        el.id = item.id;
        
        if (item.type === 'app') {
            el.className = 'grid-item app-item';
            el.innerHTML = `
                <div class="stamp-delete" onmousedown="deleteAppItem(event, '${item.id}')" ontouchstart="deleteAppItem(event, '${item.id}')"></div>
                <div class="app-icon ${item.fill}">${item.icon}</div>
                <div class="app-label">${item.name}</div>
            `;
            // 绑定点击事件
            el.onclick = () => {
                if(!isEditMode) {
                    if(item.name === 'Settings') openSettings();
                    if(item.name === 'WeChat') openWeChat();
                    if(item.name === 'Archive') openWorldbook(); // 新增 Archive 点击事件
                }
            };
        } else if (item.type === 'widget') {
            el.className = 'grid-item widget-item';
            const savedCover = localStorage.getItem('widgetCover');
            const savedAvatar = localStorage.getItem('widgetAvatar');
            const coverStyle = savedCover ? `style="background-image:url(${savedCover})"` : '';
            const avatarStyle = savedAvatar ? `style="background-image:url(${savedAvatar})"` : '';
            const coverText = savedCover ? '' : 'UPLOAD COVER';
            const avatarText = savedAvatar ? '' : 'UPLOAD';

            el.innerHTML = `
                <div class="stamp-delete" onmousedown="deleteAppItem(event, '${item.id}')" ontouchstart="deleteAppItem(event, '${item.id}')"></div>
                <div class="widget-card">
                    <div class="widget-cover" id="wgCover" onclick="triggerCoverUpload(event)" ${coverStyle}>${coverText}</div>
                    <div class="widget-content">
                        <div class="widget-avatar" id="wgAvatar" onclick="triggerAvatarUpload(event)" ${avatarStyle}>${avatarText}</div>
                        <div class="widget-name" contenteditable="true" spellcheck="false" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">Three- Seven</div>
                        <div class="widget-handle" contenteditable="true" spellcheck="false" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">@Three- Seven</div>
                        <div class="widget-bio" contenteditable="true" spellcheck="false" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">我們的未來 隨潮汐漂流至不同嶼岸🤍</div>
                        <div class="widget-location">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            <span contenteditable="true" spellcheck="false" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()">伦敦</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        updateElPos(el, item);
        container.appendChild(el);
        bindDesktopTouchEvents(el, item, list);
    });
}

function updateElPos(el, item) {
    el.style.left = (item.col * 25) + '%';
    el.style.top = item.row < 6 ? (item.row * 14.28) + '%' : '0';
}

function triggerAvatarUpload(e) {
    if (isEditMode) { e.stopPropagation(); return; }
    const input = document.getElementById('avatar-upload');
    input.onchange = (ev) => {
        const file = ev.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const avatar = document.getElementById('wgAvatar');
            if(avatar) {
                avatar.style.backgroundImage = `url(${f.target.result})`;
                avatar.innerText = '';
                localStorage.setItem('widgetAvatar', f.target.result);
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function triggerCoverUpload(e) {
    if (isEditMode) { e.stopPropagation(); return; }
    const isSettings = e.target.closest('.settings-overlay') !== null;
    const input = document.getElementById('avatar-upload');
    
    input.onchange = (ev) => {
        const file = ev.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            if (isSettings) {
                const desktop = document.querySelector('.desktop-container');
                const preview = document.getElementById('setWgCover');
                if(desktop) desktop.style.backgroundImage = `url(${f.target.result})`;
                if(preview) preview.style.backgroundImage = `url(${f.target.result})`;
                localStorage.setItem('desktopWallpaper', f.target.result);
            } else {
                const cover = document.getElementById('wgCover');
                if(cover) {
                    cover.style.backgroundImage = `url(${f.target.result})`;
                    cover.innerText = '';
                    localStorage.setItem('widgetCover', f.target.result);
                }
            }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function handleAvatarUpload(e) {}

function deleteAppItem(e, id) {
    e.stopPropagation(); 
    if(navigator.vibrate) navigator.vibrate(20);

    const el = document.getElementById(id);
    if(!el) return;

    el.classList.add('deleting');
    page1Items = page1Items.filter(a => a.id !== id);
    page2Items = page2Items.filter(a => a.id !== id);
    dockItems = dockItems.filter(a => a.id !== id);

    setTimeout(() => { el.remove(); }, 300);
}

// ================= 4. 桌面物理拖拽引擎 =================
let dragTimer = null, draggedEl = null, draggedItem = null, currentList = null;
let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

function bindDesktopTouchEvents(el, itemData, listRef) {
    let touchStartTime = 0;
    let startPosX = 0;
    let startPosY = 0;

    el.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        startPosX = e.touches[0].clientX;
        startPosY = e.touches[0].clientY;

        if (!isEditMode) {
            dragTimer = setTimeout(() => { 
                enterEditMode(); 
                startDrag(e, el, itemData, listRef); 
            }, 500);
        } else {
            startDrag(e, el, itemData, listRef);
        }
    }, {passive: false});

    el.addEventListener('touchmove', (e) => {
        clearTimeout(dragTimer);
        if (draggedEl === el) { 
            e.preventDefault(); 
            moveDrag(e); 
        }
    }, {passive: false});

    el.addEventListener('touchend', (e) => {
        clearTimeout(dragTimer);
        
        const touchDuration = Date.now() - touchStartTime;
        const moveX = Math.abs(e.changedTouches[0].clientX - startPosX);
        const moveY = Math.abs(e.changedTouches[0].clientY - startPosY);

        if (!isEditMode && touchDuration < 300 && moveX < 10 && moveY < 10) {
            if (itemData.name === 'Settings') openSettings();
            else if (itemData.name === 'WeChat') openWeChat();
            else if (itemData.name === 'Archive') openWorldbook();
        }

        if (draggedEl === el) endDrag();
    });
}

function startDrag(e, el, itemData, listRef) {
    if (!isEditMode) return;
    if(navigator.vibrate) navigator.vibrate(15);

    draggedEl = el; draggedItem = itemData; currentList = listRef;
    draggedEl.classList.add('dragging');

    const touch = e.touches[0];
    startX = touch.clientX; startY = touch.clientY;
    initialLeft = draggedEl.offsetLeft; initialTop = draggedEl.offsetTop;
}

function moveDrag(e) {
    if (!draggedEl) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    draggedEl.style.left = (initialLeft + dx) + 'px';
    draggedEl.style.top = (initialTop + dy) + 'px';

    const rect = draggedEl.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;
    
    const parentRect = draggedEl.parentElement.getBoundingClientRect();
    
    let targetCol = Math.floor(((centerX - parentRect.left) / parentRect.width) * 4);
    targetCol = Math.max(0, Math.min(3, targetCol));

    let targetRow;
    if (draggedItem.type === 'widget') {
        targetCol = 0;
        const relY = centerY - parentRect.top;
        targetRow = Math.floor((relY / parentRect.height) * 7);
        targetRow = Math.max(0, Math.min(3, targetRow));
    } else {
        const phoneRect = document.getElementById('main-frame').getBoundingClientRect();
        if (centerY - phoneRect.top > phoneRect.height - 110) {
            targetRow = 6;
        } else {
            const relY = centerY - parentRect.top;
            targetRow = Math.floor((relY / parentRect.height) * 7);
            targetRow = Math.max(0, Math.min(5, targetRow));
        }
    }

    if (targetCol !== draggedItem.col || targetRow !== draggedItem.row) {
        handleCollision(draggedItem, targetCol, targetRow);
    }
}

function handleCollision(sourceItem, targetCol, targetRow) {
    const oldRow = sourceItem.row;
    
    if (sourceItem.type === 'widget') {
        if (targetRow !== oldRow) {
            if(navigator.vibrate) navigator.vibrate(5);
            let displacedApps = currentList.filter(a => a.id !== sourceItem.id && a.row >= targetRow && a.row < targetRow + sourceItem.rows);
            
            displacedApps.forEach(a => {
                if (targetRow < oldRow) a.row += sourceItem.rows; 
                else a.row -= sourceItem.rows;
                a.row = Math.max(0, Math.min(5, a.row));
                updateElPos(document.getElementById(a.id), a);
            });
            sourceItem.row = targetRow;
        }
    } else {
        const allItems = [...currentList, ...dockItems];
        const targetItem = allItems.find(a => {
            if (a.type === 'app') return a.col === targetCol && a.row === targetRow;
            if (a.type === 'widget') return targetRow >= a.row && targetRow < a.row + a.rows;
        });

        if (targetItem && targetItem.id !== sourceItem.id) {
            if (targetItem.type === 'app') {
                if(navigator.vibrate) navigator.vibrate(5);
                targetItem.col = sourceItem.col;
                targetItem.row = sourceItem.row;
                sourceItem.col = targetCol;
                sourceItem.row = targetRow;
                
                updateElPos(document.getElementById(targetItem.id), targetItem);
            }
        } else if (!targetItem) {
            sourceItem.col = targetCol;
            sourceItem.row = targetRow;
        }
    }
}

function endDrag() {
    if (!draggedEl) return;
    if(navigator.vibrate) navigator.vibrate(10);
    draggedEl.classList.remove('dragging');
    updateElPos(draggedEl, draggedItem);
    draggedEl = null; draggedItem = null; currentList = null;
}

function enterEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode');
    if(navigator.vibrate) navigator.vibrate([20, 20, 20]);
}

function exitEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode');
}
