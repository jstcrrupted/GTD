'use strict';

// ============ STORAGE: IndexedDB, persistence, backups ============
import {
    state, STORAGE_KEY, generateId, escapeHtml, formatDateTime, todayStr,
    toast, setSyncStatus, bus
} from './core.js';
import { render } from './render.js';

const DB_NAME = 'gtd_pro_db';
const DB_VERSION = 1;
const STORE_APP = 'app';
const STORE_BACKUPS = 'backups';
const STORE_FILES = 'files'; // for future attachments

let __dbPromise = null;
let __saveTimer = null;
let __saving = false;
let __pendingSave = false;

export function openDB() {
    if (__dbPromise) return __dbPromise;
    __dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_APP)) db.createObjectStore(STORE_APP);
            if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
                const s = db.createObjectStore(STORE_BACKUPS, { keyPath: 'id' });
                s.createIndex('createdAt', 'createdAt', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return __dbPromise;
}

export async function idbGet(store, key) {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbPut(store, value, key) {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        const req = (key !== undefined) ? os.put(value, key) : os.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function idbDelete(store, key) {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const req = tx.objectStore(store).delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

export async function idbGetAll(store) {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

export function packState() {
    return {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        tasks: state.tasks,
        projects: state.projects,
        tags: state.tags,
        reviewProgress: state.reviewProgress
    };
}

export function applyPackedState(data) {
    state.tasks = data.tasks || [];
    state.projects = data.projects || [];
    state.tags = data.tags || [];
    state.reviewProgress = data.reviewProgress || {};
}

export async function migrateFromLocalStorageIfNeeded() {
    try {
        const existing = await idbGet(STORE_APP, 'state');
        if (existing) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const packed = { schemaVersion: 1, migratedAt: new Date().toISOString(), ...parsed };
        await idbPut(STORE_APP, packed, 'state');
        toast('Данные перенесены в IndexedDB', 'success');
        setSyncStatus('Сохранено (IndexedDB)');
    } catch (e) {
        console.error(e);
    }
}

export async function loadLatestBackupObject() {
    const all = await idbGetAll(STORE_BACKUPS);
    all.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return all[0] || null;
}

export async function createBackup(reason='auto') {
    try {
        const id = generateId();
        const backup = {
            id,
            createdAt: new Date().toISOString(),
            reason,
            state: packState()
        };
        await idbPut(STORE_BACKUPS, backup);
        // rotate backups
        const all = await idbGetAll(STORE_BACKUPS);
        const limit = 120; // ~4h of 2-min backups
        if (all.length > limit) {
            all.sort((a,b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
            const toDelete = all.slice(0, all.length - limit);
            for (const b of toDelete) await idbDelete(STORE_BACKUPS, b.id);
        }
        renderBackupList();
    } catch (e) {
        console.error(e);
    }
}

export async function loadAppState() {
    setSyncStatus('Загрузка…', true);
    await migrateFromLocalStorageIfNeeded();
    try {
        const data = await idbGet(STORE_APP, 'state');
        if (data && (data.tasks || data.projects || data.tags)) {
            applyPackedState(data);
            setSyncStatus('Сохранено (IndexedDB)');
            return true;
        }
    } catch (e) {
        console.error(e);
    }
    // try recover from latest backup
    try {
        const latest = await loadLatestBackupObject();
        if (latest && latest.state) {
            applyPackedState(latest.state);
            await idbPut(STORE_APP, packState(), 'state');
            toast('Данные восстановлены из бэкапа', 'success');
            setSyncStatus('Восстановлено из бэкапа');
            return true;
        }
    } catch (e) {
        console.error(e);
    }
    setSyncStatus('Нет данных (создаём демо)', true);
    return false;
}

export function scheduleSave() {
    __pendingSave = true;
    if (__saveTimer) return;
    __saveTimer = setTimeout(async () => {
        __saveTimer = null;
        if (!__pendingSave) return;
        __pendingSave = false;
        await saveNow();
    }, 250);
}

export async function saveNow() {
    if (__saving) { __pendingSave = true; return; }
    __saving = true;
    setSyncStatus('Сохраняю…', true);
    try {
        await idbPut(STORE_APP, packState(), 'state');
        setSyncStatus('Сохранено (IndexedDB)');
        bus.emit('after-local-save');
    } catch (e) {
        console.error(e);
        setSyncStatus('Ошибка сохранения', false);
        toast('Ошибка сохранения (IndexedDB)', 'error');
    } finally {
        __saving = false;
        if (__pendingSave) { __pendingSave = false; await saveNow(); }
    }
}

// Backwards-compatible wrappers used throughout the app
export function load() { /* no-op: replaced by async init */ }
export function save() { scheduleSave(); }

// ============ BACKUP UI ============
export async function renderBackupList() {
    const el = document.getElementById('backupList');
    if (!el) return;
    const backups = await idbGetAll(STORE_BACKUPS);
    backups.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (backups.length === 0) {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-3)">Бэкапов пока нет.</div>`;
        return;
    }
    const top = backups.slice(0, 8);
    el.innerHTML = top.map(b => `
        <div class="backup-item">
            <div class="backup-meta">
                <div class="backup-title">${formatDateTime(b.createdAt)} · ${escapeHtml(b.reason || 'auto')}</div>
                <div class="backup-sub">${(b.state?.tasks?.length || 0)} задач · ${(b.state?.projects?.length || 0)} проектов · ${(b.state?.tags?.length || 0)} тегов</div>
            </div>
            <div class="backup-actions">
                <button class="small-btn" data-action="restoreBackupById" data-id="${b.id}">Восст.</button>
                <button class="small-btn" data-action="downloadBackupById" data-id="${b.id}">JSON</button>
            </div>
        </div>
    `).join('');
}

export async function createBackupNow() {
    await createBackup('manual');
    toast('Бэкап создан', 'success');
}

export async function restoreBackupById(id) {
    if (!confirm('Восстановить бэкап? Текущие данные будут заменены.')) return;
    const b = await idbGet(STORE_BACKUPS, id);
    if (!b || !b.state) { toast('Бэкап не найден', 'error'); return; }
    applyPackedState(b.state);
    await idbPut(STORE_APP, packState(), 'state');
    render();
    toast('Восстановлено', 'success');
    setSyncStatus('Восстановлено из бэкапа');
}

export async function restoreLatestBackup() {
    const b = await loadLatestBackupObject();
    if (!b) { toast('Нет бэкапов', 'error'); return; }
    await restoreBackupById(b.id);
}

export async function downloadBackupById(id) {
    const b = await idbGet(STORE_BACKUPS, id);
    if (!b) { toast('Бэкап не найден', 'error'); return; }
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtd-pro-backup-${(b.createdAt||todayStr()).substring(0,10)}-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function clearBackups() {
    if (!confirm('Очистить историю бэкапов?')) return;
    const backups = await idbGetAll(STORE_BACKUPS);
    for (const b of backups) await idbDelete(STORE_BACKUPS, b.id);
    renderBackupList();
    toast('История бэкапов очищена', 'success');
}

export function exportFullBackup() {
    // Full package = current packed state + (optional) recent backups list metadata
    (async () => {
        await createBackup('pre-export');
        const payload = {
            type: 'gtd-pro-full-backup',
            exportedAt: new Date().toISOString(),
            appState: packState()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gtd-pro-full-backup-${todayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Полный бэкап экспортирован', 'success');
    })();
}

export function importFullBackup() {
    document.getElementById('fullBackupInput')?.click();
}

export function handleFullBackupImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (data.type !== 'gtd-pro-full-backup' || !data.appState) throw new Error('bad');
            if (!confirm('Импортировать полный бэкап? Текущие данные будут заменены.')) return;
            await createBackup('pre-import');
            applyPackedState(data.appState);
            await idbPut(STORE_APP, packState(), 'state');
            await createBackup('import');
            render();
            toast('Полный бэкап импортирован', 'success');
        } catch(err) {
            console.error(err);
            toast('Ошибка импорта полного бэкапа', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}
