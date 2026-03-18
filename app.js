const INVENTORY_CACHE_KEY = 'lume_inventory_cache_v1';
const SALES_KEY = 'lume_vault';
const OUTBOX_KEY = 'lume_outbox_v1';
const LAST_SYNC_KEY = 'lume_last_sync_v1';
const DEVICE_ID_KEY = 'lume_device_id_v1';

const defaultInventory = [
    { id: 1, name: "Eau de toilette", price: 160.00, img: "https://images.unsplash.com/photo-1606334585230-3ba76447cdbd?q=80&w=863&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", barcode: "1001" },
    { id: 2, name: "Cream Set", price: 115.00, img: "https://images.unsplash.com/photo-1647492989217-afaf693e19b8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", barcode: "1002" },
    { id: 3, name: "Body Oil", price: 45.00, img: "https://images.unsplash.com/photo-1532413992378-f169ac26fff0?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", barcode: "1003" },
    { id: 4, name: "Lipstick", price: 31.00, img: "https://images.unsplash.com/photo-1671575212918-0af5f840997a?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", barcode: "1004" }
];

function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
}

function loadInventory() {
    const cached = safeJsonParse(localStorage.getItem(INVENTORY_CACHE_KEY), null);
    if (Array.isArray(cached) && cached.length) {
        return cached.map((item, idx) => ({
            ...item,
            barcode: item.barcode || String(1001 + idx)
        }));
    }
    localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(defaultInventory));
    return defaultInventory;
}

function getOutbox() {
    const outbox = safeJsonParse(localStorage.getItem(OUTBOX_KEY), []);
    return Array.isArray(outbox) ? outbox : [];
}

function setOutbox(outbox) {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
}

function getDeviceId() {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && String(existing).trim().length) return String(existing).trim();

    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
}

function updateSyncStatusUI() {
    const el = document.getElementById('sync-status');
    if (!el) return;

    const online = navigator.onLine;
    const outbox = getOutbox();
    const pending = outbox.length;
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);

    // Auto-hide timer for "all good" states
    if (!updateSyncStatusUI._hideTimer) updateSyncStatusUI._hideTimer = null;
    if (updateSyncStatusUI._hideTimer) {
        clearTimeout(updateSyncStatusUI._hideTimer);
        updateSyncStatusUI._hideTimer = null;
    }

    const setState = (text, stateClass, { autoHide } = { autoHide: false }) => {
        el.textContent = text;
        el.classList.remove('hidden', 'is-offline', 'is-syncing', 'is-online');
        el.classList.add(stateClass);
        if (autoHide) {
            updateSyncStatusUI._hideTimer = setTimeout(() => {
                el.classList.add('hidden');
            }, 2200);
        }
    };

    if (!online) {
        setState(pending ? `Offline • ${pending} pending` : 'Offline', 'is-offline');
        return;
    }

    if (pending) {
        setState(`Online • syncing (${pending})`, 'is-syncing');
        return;
    }

    // Keep this subtle and auto-hide (not important to be always visible)
    setState(lastSync ? `Online • synced` : 'Online', 'is-online', { autoHide: true });
}

function flushOutboxToLocalSales() {
    // Demo "sync": we don't have a backend, so we mark pending records as synced.
    const outbox = getOutbox();
    if (!outbox.length) return;

    const sales = safeJsonParse(localStorage.getItem(SALES_KEY), []) || [];
    const outboxIds = new Set(outbox.map(x => x.id));
    const updated = sales.map(s => outboxIds.has(s.id) ? { ...s, syncStatus: 'synced' } : s);
    localStorage.setItem(SALES_KEY, JSON.stringify(updated));

    setOutbox([]);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

const LumeTerminal = {
    state: {
        deviceId: getDeviceId(),
        inventory: loadInventory(),
        cart: [],
        sales: safeJsonParse(localStorage.getItem(SALES_KEY), []) || [],
        sessionItems: 0
    },
    actions: {},
};

document.addEventListener('DOMContentLoaded', () => {
    // Legacy migration: ensure old records have deviceId for correct scoping.
    try {
        if (Array.isArray(LumeTerminal.state.sales) && LumeTerminal.state.sales.length) {
            const deviceId = LumeTerminal.state.deviceId;
            const needs = LumeTerminal.state.sales.some(s => !s || !s.deviceId);
            if (needs) {
                const migrated = LumeTerminal.state.sales.map(s => ({
                    ...s,
                    deviceId: s?.deviceId ? s.deviceId : deviceId
                }));
                LumeTerminal.state.sales = migrated;
                localStorage.setItem(SALES_KEY, JSON.stringify(migrated));
            }
        }
    } catch (_) {}

    // Connectivity indicator + demo sync behavior
    updateSyncStatusUI();
    window.addEventListener('online', () => {
        flushOutboxToLocalSales();
        updateSyncStatusUI();
        // Keep in-memory state consistent with localStorage after "sync"
        LumeTerminal.state.sales = safeJsonParse(localStorage.getItem(SALES_KEY), []) || [];
        if (LumeTerminal.ui?.renderOperations) LumeTerminal.ui.renderOperations();
        if (LumeTerminal.ui?.renderAnalytics) LumeTerminal.ui.renderAnalytics();
    });
    window.addEventListener('offline', updateSyncStatusUI);

    if (LumeTerminal.ui) LumeTerminal.ui.init();
});
