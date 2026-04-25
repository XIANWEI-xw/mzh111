// ===== API Monitor · 全局 API 监控系统 =====
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

function updateAmFabVisibility() {
    const fab = document.getElementById('apiFab');
    if (fab) {
        if (amEnabled) fab.classList.add('visible');
        else fab.classList.remove('visible');
    }
}

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
function amSetCalling(isCalling) {
    const fab = document.getElementById('apiFab');
    if (fab) {
        if (isCalling) fab.classList.add('calling');
        else fab.classList.remove('calling');
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
