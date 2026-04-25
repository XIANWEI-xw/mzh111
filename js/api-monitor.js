function updateAmFabVisibility() {
    const fab = document.getElementById('apiFab');
    const orb = document.getElementById('timerOrb');
    const conn = document.getElementById('orbConnector');
    if (fab) {
        if (amEnabled) fab.classList.add('visible');
        else fab.classList.remove('visible');
    }
    if (orb) {
        if (amEnabled) orb.classList.add('visible');
        else orb.classList.remove('visible');
    }
    if (conn) {
        if (amEnabled) conn.classList.add('visible');
        else conn.classList.remove('visible');
    }
    updateConnectorPosition();
}

// ===== 悬浮球拖动系统 =====
let orbDragState = {};

function initOrbDrag(el, onTap) {
    if (!el) return;
    let state = { dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false };

    function getPos(e) {
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX, y: t.clientY };
    }

    function onStart(e) {
        const p = getPos(e);
        state.startX = p.x;
        state.startY = p.y;
        state.origX = el.offsetLeft;
        state.origY = el.offsetTop;
        state.moved = false;
        state.dragging = true;
        el.style.transition = 'none';
        el.style.zIndex = '9999';
    }

    function onMove(e) {
        if (!state.dragging) return;
        const p = getPos(e);
        const dx = p.x - state.startX;
        const dy = p.y - state.startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            state.moved = true;
        }

        if (state.moved) {
            if (e.cancelable) e.preventDefault();
            const newX = state.origX + dx;
            const newY = state.origY + dy;

            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight;

            el.style.left = Math.max(0, Math.min(maxX, newX)) + 'px';
            el.style.top = Math.max(0, Math.min(maxY, newY)) + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';

            updateConnectorPosition();
        }
    }

    function onEnd(e) {
        if (!state.dragging) return;
        state.dragging = false;
        el.style.transition = '';
        el.style.zIndex = '';

        if (!state.moved) {
            if (onTap) onTap();
        } else {
            snapToEdge(el);
        }
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
}

function snapToEdge(el) {
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const halfW = window.innerWidth / 2;

    el.style.transition = 'left 0.3s cubic-bezier(0.16,1,0.3,1), right 0.3s cubic-bezier(0.16,1,0.3,1)';

    if (centerX < halfW) {
        el.style.left = '12px';
        el.style.right = 'auto';
    } else {
        el.style.left = (window.innerWidth - el.offsetWidth - 12) + 'px';
        el.style.right = 'auto';
    }

    setTimeout(() => {
        el.style.transition = '';
        updateConnectorPosition();
    }, 350);
}

function updateConnectorPosition() {
    const fab = document.getElementById('apiFab');
    const orb = document.getElementById('timerOrb');
    const conn = document.getElementById('orbConnector');
    if (!fab || !orb || !conn) return;

    const fabRect = fab.getBoundingClientRect();
    const orbRect = orb.getBoundingClientRect();

    const fabCX = fabRect.left + fabRect.width / 2;
    const fabCY = fabRect.top + fabRect.height / 2;
    const orbCX = orbRect.left + orbRect.width / 2;
    const orbCY = orbRect.top + orbRect.height / 2;

    const dx = orbCX - fabCX;
    const dy = orbCY - fabCY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 150) {
        conn.style.display = 'none';
        return;
    }

    const angle = Math.atan2(dy, dx) * (180 / Math.PI) - 90;
    const startX = fabCX + (dx / dist) * (fabRect.width / 2);
    const startY = fabCY + (dy / dist) * (fabRect.height / 2);
    const lineLen = dist - fabRect.width / 2 - orbRect.width / 2;

    if (lineLen <= 0) {
        conn.style.display = 'none';
        return;
    }

    conn.style.display = amEnabled ? 'block' : 'none';
    conn.style.position = 'fixed';
    conn.style.left = startX + 'px';
    conn.style.top = startY + 'px';
    conn.style.width = '1px';
    conn.style.height = lineLen + 'px';
    conn.style.transform = `rotate(${angle}deg)`;
    conn.style.transformOrigin = 'top center';
    conn.style.right = 'auto';
    conn.style.bottom = 'auto';
}

// 初始化拖动
(function initDragOnReady() {
    function setup() {
        initOrbDrag(document.getElementById('apiFab'), toggleApiMonitor);
        initOrbDrag(document.getElementById('timerOrb'), toggleTimerPanel);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setTimeout(setup, 100);
    }
})();

// ===== 计时器系统 =====
let amTimerRunning = false;
let amTimerStart = 0;
let amTimerElapsed = 0;
let amTimerInterval = null;
let amTimerLaps = [];
let amTimerLastLap = 0;
let amTimerCurrentSource = '';
let amTimerCurrentModel = '';
const amOrbCircum = 2 * Math.PI * 22.5;

function toggleTimerPanel() {
    const overlay = document.getElementById('tpOverlay');
    if (overlay) overlay.classList.toggle('active');
}

// API 调用开始时自动调用：每次从 0 重新计时
function amAutoTimerStart(source, model) {
    amTimerCurrentSource = source || '';
    amTimerCurrentModel = model || '';

    // 每次调用都重置并从 0 开始
    clearInterval(amTimerInterval);
    amTimerElapsed = 0;
    amTimerStart = Date.now();
    amTimerInterval = setInterval(updateAmTimerDisplay, 30);
    amTimerRunning = true;
    updateTimerButtons(true);

    // 重置进度环
    const prog = document.getElementById('orbProgress');
    if (prog) prog.style.strokeDashoffset = amOrbCircum;

    const orb = document.getElementById('timerOrb');
    if (orb) { orb.classList.add('running'); orb.classList.remove('paused'); }
}

// API 调用结束时自动调用：停止计时，记录本次耗时
function amAutoTimerStop() {
    if (amTimerRunning) {
        clearInterval(amTimerInterval);
        amTimerRunning = false;

        const elapsed = Date.now() - amTimerStart;
        amTimerElapsed = elapsed;

        amTimerLaps.push({
            time: elapsed,
            diff: elapsed,
            source: amTimerCurrentSource,
            model: amTimerCurrentModel
        });

        renderAmTimerLaps();
        updateTimerButtons(false);
        const orb = document.getElementById('timerOrb');
        if (orb) { orb.classList.remove('running'); orb.classList.add('paused'); }
    }
}

// 手动开始/暂停
function toggleAmTimer() {
    if (amTimerRunning) {
        clearInterval(amTimerInterval);
        amTimerRunning = false;
        updateTimerButtons(false);
        const orb = document.getElementById('timerOrb');
        if (orb) { orb.classList.remove('running'); orb.classList.add('paused'); }
    } else {
        amTimerStart = Date.now() - amTimerElapsed;
        amTimerInterval = setInterval(updateAmTimerDisplay, 30);
        amTimerRunning = true;
        updateTimerButtons(true);
        const orb = document.getElementById('timerOrb');
        if (orb) { orb.classList.add('running'); orb.classList.remove('paused'); }
    }
}

function resetAmTimer() {
    clearInterval(amTimerInterval);
    amTimerRunning = false;
    amTimerElapsed = 0;
    amTimerStart = 0;
    amTimerLaps = [];
    amTimerLastLap = 0;

    const els = {
        tpTime: '00:00', tpMs: '.00', orbTime: '00:00', orbMs: '.00'
    };
    Object.keys(els).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = els[id];
    });

    const prog = document.getElementById('orbProgress');
    if (prog) prog.style.strokeDashoffset = amOrbCircum;

    updateTimerButtons(false);
    const orb = document.getElementById('timerOrb');
    if (orb) orb.classList.remove('running', 'paused');

    const laps = document.getElementById('tpLaps');
    if (laps) laps.innerHTML = '<div class="tp-laps-empty">— API calls auto-record here —</div>';
    const cnt = document.getElementById('tpLapCount');
    if (cnt) cnt.textContent = '0 LAPS';
}

function addAmLap() {
    if (!amTimerRunning) return;
    const t = amTimerElapsed;
    const diff = t - amTimerLastLap;
    amTimerLastLap = t;
    amTimerLaps.push({ time: t, diff: diff, source: 'Manual', model: '' });
    renderAmTimerLaps();
}

function updateAmTimerDisplay() {
    amTimerElapsed = Date.now() - amTimerStart;
    const sec = amTimerElapsed / 1000;
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    const cs = Math.floor((sec % 1) * 100).toString().padStart(2, '0');

    const tpTime = document.getElementById('tpTime');
    const tpMs = document.getElementById('tpMs');
    const orbTime = document.getElementById('orbTime');
    const orbMs = document.getElementById('orbMs');
    if (tpTime) tpTime.textContent = `${m}:${s}`;
    if (tpMs) tpMs.textContent = `.${cs}`;
    if (orbTime) orbTime.textContent = `${m}:${s}`;
    if (orbMs) orbMs.textContent = `.${cs}`;

    const progress = (sec % 60) / 60;
    const offset = amOrbCircum * (1 - progress);
    const prog = document.getElementById('orbProgress');
    if (prog) prog.style.strokeDashoffset = offset;
}

function updateTimerButtons(isRunning) {
    const btn = document.getElementById('tpBtnMain');
    const play = document.getElementById('tpIconPlay');
    const pause = document.getElementById('tpIconPause');
    if (btn) btn.classList.toggle('running', isRunning);
    if (play) play.style.display = isRunning ? 'none' : '';
    if (pause) pause.style.display = isRunning ? '' : 'none';
}

function renderAmTimerLaps() {
    const container = document.getElementById('tpLaps');
    const countEl = document.getElementById('tpLapCount');
    if (!container) return;

    if (amTimerLaps.length === 0) {
        container.innerHTML = '<div class="tp-laps-empty">— API calls auto-record here —</div>';
        if (countEl) countEl.textContent = '0 LAPS';
        return;
    }

    let fastest = Infinity, slowest = 0;
    amTimerLaps.forEach(l => {
        if (l.diff < fastest) fastest = l.diff;
        if (l.diff > slowest) slowest = l.diff;
    });

    let html = '';
    for (let i = amTimerLaps.length - 1; i >= 0; i--) {
        const l = amTimerLaps[i];
        const num = (i + 1).toString().padStart(2, '0');
        let tag = '';
        if (amTimerLaps.length >= 3) {
            if (l.diff === fastest) tag = '<span class="tp-lap-tag fast">FAST</span>';
            else if (l.diff === slowest) tag = '<span class="tp-lap-tag slow">SLOW</span>';
        }
        const srcLabel = l.source ? `<span class="tp-lap-src">${l.source}</span>` : '';
        html += `<div class="tp-lap">
            <div class="tp-lap-left">
                <span class="tp-lap-num">#${num}</span>
                ${srcLabel}${tag}
            </div>
            <div class="tp-lap-right">
                <div class="tp-lap-time">${fmtAmTime(l.diff)}</div>
                <div class="tp-lap-diff">@ ${fmtAmTime(l.time)}</div>
            </div>
        </div>`;
    }
    container.innerHTML = html;
    if (countEl) countEl.textContent = amTimerLaps.length + ' LAPS';
}

function fmtAmTime(ms) {
    const s = ms / 1000;
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    const cs = Math.floor((s % 1) * 100).toString().padStart(2, '0');
    return `${m}:${sec}.${cs}`;
}
let amLogs = [];
let amTotalInput = 0;
let amTotalOutput = 0;
let amEnabled = false;
let amCurrentFilter = 'all';

const AM_DB_NAME = 'ApiMonitorDB';
const AM_STORE_NAME = 'AmStore';

function initAmDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(AM_DB_NAME, 1);
        request.onupgradeneeded = (e) => { e.target.result.createObjectStore(AM_STORE_NAME); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function amDbSet(key, value) {
    try {
        const db = await initAmDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AM_STORE_NAME, 'readwrite');
            tx.objectStore(AM_STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error('AmDB write error:', e); }
}

async function amDbGet(key) {
    try {
        const db = await initAmDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AM_STORE_NAME, 'readonly');
            const request = tx.objectStore(AM_STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) { console.error('AmDB read error:', e); return null; }
}

// 加载状态
(async function loadAmState() {
    try {
        const saved = localStorage.getItem('amEnabled');
        amEnabled = saved === 'true';

        const storedLogs = await amDbGet('amLogs');
        if (storedLogs && Array.isArray(storedLogs)) {
            amLogs = storedLogs;
        } else {
            const lsLogs = localStorage.getItem('amLogs');
            if (lsLogs) {
                try {
                    amLogs = JSON.parse(lsLogs);
                    await amDbSet('amLogs', amLogs);
                    localStorage.removeItem('amLogs');
                } catch(e) { amLogs = []; }
            }
        }

        const storedTotals = await amDbGet('amTotals');
        if (storedTotals) {
            amTotalInput = storedTotals.input || 0;
            amTotalOutput = storedTotals.output || 0;
        } else {
            const ti = localStorage.getItem('amTotalInput');
            const to = localStorage.getItem('amTotalOutput');
            if (ti) amTotalInput = parseInt(ti);
            if (to) amTotalOutput = parseInt(to);
        }
    } catch(e) {
        console.error('AmDB load error:', e);
    }
    updateAmFabVisibility();
})();

function toggleAmEnabled(isOn) {
    amEnabled = isOn;
    localStorage.setItem('amEnabled', isOn ? 'true' : 'false');
    updateAmFabVisibility();
}

function toggleApiMonitor() {
    const overlay = document.getElementById('apiMonitorOverlay');
    if (overlay) {
        overlay.classList.toggle('active');
        if (overlay.classList.contains('active')) {
            renderAmStats();
            renderAmLogs();
        }
    }
}

// ===== 记录 API 调用 =====
function logApiCall(data) {
    if (!amEnabled) return;

    const entry = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        model: data.model || 'unknown',
        source: data.source || 'unknown',
        status: data.status || 200,
        statusText: data.statusText || 'OK',
        inputTokens: data.inputTokens || 0,
        outputTokens: data.outputTokens || 0,
        duration: data.duration || 0,
        systemPrompt: data.systemPrompt || '',
        userMessage: data.userMessage || '',
        aiResponse: data.aiResponse || '',
        errorText: data.errorText || '',
        messagesCount: data.messagesCount || 0
    };

    amLogs.unshift(entry);
    if (amLogs.length > 100) amLogs = amLogs.slice(0, 100);

    amTotalInput += entry.inputTokens;
    amTotalOutput += entry.outputTokens;

    // 保存到 IndexedDB
    amDbSet('amLogs', amLogs);
    amDbSet('amTotals', { input: amTotalInput, output: amTotalOutput });

    // 更新徽章
    const badge = document.getElementById('amFabBadge');
    if (badge) {
        badge.textContent = amLogs.length;
        badge.classList.add('show');
    }

    // 如果面板开着就实时刷新
    const overlay = document.getElementById('apiMonitorOverlay');
    if (overlay && overlay.classList.contains('active')) {
        renderAmStats();
        renderAmLogs();
    }
}

// 估算 token（粗略：中文1字≈2token，英文1词≈1.3token）
function estimateTokens(text) {
    if (!text) return 0;
    const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const other = text.length - chinese;
    return Math.ceil(chinese * 2 + other * 0.4);
}

// ===== 悬浮球调用中状态 =====
function amSetCalling(isCalling, source, model) {
    const fab = document.getElementById('apiFab');
    if (fab) {
        if (isCalling) fab.classList.add('calling');
        else fab.classList.remove('calling');
    }
    if (amEnabled) {
        if (isCalling) amAutoTimerStart(source || '', model || '');
        else amAutoTimerStop();
    }
}

// ===== 渲染统计 =====
function renderAmStats() {
    const total = amTotalInput + amTotalOutput;
    const el = (id) => document.getElementById(id);
    if (el('amTotalTokens')) el('amTotalTokens').textContent = total.toLocaleString();
    if (el('amInputTokens')) el('amInputTokens').textContent = amTotalInput.toLocaleString();
    if (el('amOutputTokens')) el('amOutputTokens').textContent = amTotalOutput.toLocaleString();

    // 粗略估算成本 (GPT-4o-mini 价格)
    const cost = (amTotalInput * 0.00000015 + amTotalOutput * 0.0000006);
    if (el('amCost')) el('amCost').textContent = '$' + cost.toFixed(4);
}

// ===== 渲染日志 =====
function renderAmLogs() {
    const area = document.getElementById('amLogArea');
    if (!area) return;

    let filtered = amLogs;
    if (amCurrentFilter !== 'all') {
        filtered = amLogs.filter(l => l.source.toLowerCase() === amCurrentFilter);
    }

    if (filtered.length === 0) {
        area.innerHTML = `<div class="am-empty"><div class="am-empty-icon">⚡</div><div class="am-empty-text">No API calls recorded</div></div>`;
        return;
    }

    let html = '';
    filtered.forEach(log => {
        const isError = log.status >= 400;
        const tagClass = isError ? 'error' : 'success';
        const tagText = isError ? `${log.status} ${log.statusText}` : '200 OK';
        const duration = (log.duration / 1000).toFixed(1);

        const sysPreview = log.systemPrompt ? log.systemPrompt.substring(0, 500) : '—';
        const respPreview = log.aiResponse || log.errorText || '—';
        const sysChars = log.systemPrompt ? log.systemPrompt.length + ' chars' : '—';
        const respChars = log.aiResponse ? log.aiResponse.length + ' chars' : '—';

        html += `
        <div class="am-log-entry" onclick="this.classList.toggle('expanded')">
            <div class="am-log-top">
                <div class="am-log-tag ${tagClass}"><div class="am-log-tag-dot"></div>${tagText}</div>
                <div class="am-log-time">${log.time}</div>
            </div>
            <div class="am-log-model">${log.model}</div>
            <div class="am-log-metrics">
                <div class="am-log-metric">IN <span>${log.inputTokens.toLocaleString()}</span></div>
                <div class="am-log-metric">OUT <span>${log.outputTokens.toLocaleString()}</span></div>
                <div class="am-log-metric">TIME <span>${duration}s</span></div>
                <div class="am-log-metric">SRC <span>${log.source}</span></div>
            </div>
            <div class="am-log-detail">
                <div class="am-detail-section">
                    <div class="am-detail-header">
                        <div class="am-detail-label">System Prompt</div>
                        <div class="am-detail-chars">${sysChars}</div>
                    </div>
                    <div class="am-detail-body">${escAmHtml(sysPreview)}</div>
                </div>
                <div class="am-detail-section">
                    <div class="am-detail-header">
                        <div class="am-detail-label">${isError ? 'Error' : 'AI Response'}</div>
                        <div class="am-detail-chars">${respChars}</div>
                    </div>
                    <div class="am-detail-body" ${isError ? 'style="color:rgba(200,100,100,0.6)"' : ''}>${escAmHtml(respPreview)}</div>
                </div>
            </div>
        </div>`;
    });

    area.innerHTML = html;
}

function escAmHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function switchAmTab(el, type) {
    document.querySelectorAll('.am-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    amCurrentFilter = type;
    renderAmLogs();
}

function clearAmLogs() {
    if (!confirm('Clear all API logs?')) return;
    amLogs = [];
    amTotalInput = 0;
    amTotalOutput = 0;
    amDbSet('amLogs', []);
    amDbSet('amTotals', { input: 0, output: 0 });
    const badge = document.getElementById('amFabBadge');
    if (badge) badge.classList.remove('show');
    renderAmStats();
    renderAmLogs();
}

function exportAmLogs() {
    const text = amLogs.map(l => `[${l.time}] ${l.source} | ${l.model} | ${l.status} | IN:${l.inputTokens} OUT:${l.outputTokens} | ${(l.duration/1000).toFixed(1)}s`).join('\n');
    navigator.clipboard.writeText(text).then(() => alert('Logs copied to clipboard'));
}
