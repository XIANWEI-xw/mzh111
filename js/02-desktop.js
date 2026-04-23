// ================= 02-desktop.js =================

// 数据结构 & 胖乎乎可爱 SVG
let page1Items = [
    { id: 'app1', type: 'app', name: 'Magic', fill: 'glass-black', icon: '<svg viewBox="0 0 24 24"><path d="M12 2l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="19" r="1"/></svg>', col: 0, row: 0 },
    { id: 'app2', type: 'app', name: 'Diary', fill: 'glass-silver', icon: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M12 2v6l-2-2-2 2V2"/></svg>', col: 1, row: 0 },
    { id: 'app3', type: 'app', name: 'Snap', fill: 'glass-white', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="4"/><circle cx="12" cy="14" r="3"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', col: 2, row: 0 },
    { id: 'app4', type: 'app', name: 'Cloud', fill: 'glass-dark', icon: '<svg viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 0 0 0-9h-.5a7 7 0 0 0-13.36 3.5A4 4 0 0 0 5 21h12.5a3.5 3.5 0 0 0 0-7z"/></svg>', col: 3, row: 0 },
    { id: 'wg1', type: 'widget', name: 'Art', col: 0, row: 1, rows: 3 },
    { id: 'app5', type: 'app', name: 'Ghost', fill: 'glass-white', icon: '<svg viewBox="0 0 24 24"><path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>', col: 0, row: 4 },
    { id: 'app6', type: 'app', name: 'Blocks', fill: 'glass-silver', icon: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="2"/><rect x="14" y="4" width="6" height="6" rx="2"/><rect x="4" y="14" width="6" height="6" rx="2"/><circle cx="17" cy="17" r="3"/></svg>', col: 1, row: 4 },
];

let page2Items = [
    { id: 'app7', type: 'app', name: 'Game', fill: 'glass-dark', icon: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="4"/><circle cx="17" cy="12" r="1"/><circle cx="15" cy="14" r="1"/><path d="M6 12h4M8 10v4"/></svg>', col: 0, row: 0 },
    { id: 'app8', type: 'app', name: 'Love', fill: 'glass-white', icon: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', col: 1, row: 0 },
];

let dockItems = [
    { id: 'dock1', type: 'app', name: 'Chat', fill: 'glass-black', icon: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9 10h.01M15 10h.01M9 15s1.5 2 3 2 3-2 3-2"/></svg>', col: 0, row: 6 },
    { id: 'dock2', type: 'app', name: 'Draw', fill: 'glass-white', icon: '<svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>', col: 1, row: 6 },
    { id: 'dock3', type: 'app', name: 'Planet', fill: 'glass-silver', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="12" ry="4" transform="rotate(45 12 12)"/></svg>', col: 2, row: 6 },
    { id: 'dock4', type: 'app', name: 'Tunes', fill: 'glass-dark', icon: '<svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4zM3 19a2 2 0 0 0 2 2h1v-6H3v4z"/></svg>', col: 3, row: 6 },
];

let isEditMode = false;

// 渲染引擎
function renderDesktopApps() {
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
        } else if (item.type === 'widget') {
            el.className = 'grid-item widget-item';
            el.innerHTML = `
                <div class="stamp-delete" onmousedown="deleteAppItem(event, '${item.id}')" ontouchstart="deleteAppItem(event, '${item.id}')"></div>
                <div class="widget-card">
                    <div class="wg-top">
                        <div class="wg-no">MY UNIVERSE</div>
                        <svg class="wg-star" viewBox="0 0 24 24" fill="none" stroke="#fff">
                            <path d="M12 2l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/>
                        </svg>
                    </div>
                    <div class="wg-avatar-container" id="wgAvatar" onclick="triggerAvatarUpload(event)">
                        TAP TO UPLOAD
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
    document.getElementById('avatar-upload').click();
}

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

// 物理拖拽引擎
let dragTimer = null, draggedEl = null, draggedItem = null, currentList = null;
let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

function bindDesktopTouchEvents(el, itemData, listRef) {
    el.addEventListener('touchstart', (e) => {
        if (!isEditMode) {
            dragTimer = setTimeout(() => { enterEditMode(); startDrag(e, el, itemData, listRef); }, 500);
        } else {
            startDrag(e, el, itemData, listRef);
        }
    }, {passive: false});

    el.addEventListener('touchmove', (e) => {
        clearTimeout(dragTimer);
        if (draggedEl === el) { e.preventDefault(); moveDrag(e); }
    }, {passive: false});

    el.addEventListener('touchend', (e) => {
        clearTimeout(dragTimer);
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

// 模式控制
function enterEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode');
    if(navigator.vibrate) navigator.vibrate([20, 20, 20]);
}

function exitEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode');
}

// 分页联动初始化
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

// 蓝图网格初始化
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
