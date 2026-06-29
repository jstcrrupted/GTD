'use strict';

// ============ SYNC: Supabase <-> local state (IndexedDB = offline cache) ============
import { state, setSyncStatus, isUuid, generateId, bus } from './core.js';
import { supabase } from './supabase.js';
import { saveNow } from './storage.js';
import { render } from './render.js';
import {
    taskToRow, rowToTask, projectToRow, rowToProject, tagToRow, rowToTag
} from './mapper.js';

let userId = null;
let applyingRemote = false;          // guard: don't push while applying remote changes
let started = false;

// id -> updated_at of the last value we know the server has, per type
const lastSynced = { tasks: new Map(), projects: new Map(), tags: new Map() };

const COLLECTIONS = [
    { type: 'tasks',    arr: 'tasks',    toRow: taskToRow,    toLocal: rowToTask },
    { type: 'projects', arr: 'projects', toRow: projectToRow, toLocal: rowToProject },
    { type: 'tags',     arr: 'tags',     toRow: tagToRow,     toLocal: rowToTag },
];

export function setUser(id) { userId = id; }
export function getUserId() { return userId; }
export function isApplyingRemote() { return applyingRemote; }

// ---- legacy id migration (run once before first push) ----
export function migrateLocalIdsToUuid() {
    const projectIdRemap = {};
    state.projects.forEach(p => {
        if (!isUuid(p.id)) { const nid = generateId(); projectIdRemap[p.id] = nid; p.id = nid; }
    });
    state.tasks.forEach(t => {
        if (t.projectId && projectIdRemap[t.projectId]) t.projectId = projectIdRemap[t.projectId];
        if (!isUuid(t.id)) t.id = generateId();
    });
    state.tags.forEach(tag => {
        if (!isUuid(tag.id)) tag.id = generateId();
    });
}

function snapshot() {
    for (const c of COLLECTIONS) {
        lastSynced[c.type].clear();
        for (const e of state[c.arr]) lastSynced[c.type].set(e.id, e.updatedAt || '');
    }
}

// ============ INITIAL HYDRATION + RECONCILE ============
export async function hydrate() {
    if (!userId) return;
    setSyncStatus('Синхронизация…', true);
    let remote;
    try {
        remote = await pullAll();
    } catch (e) {
        console.error('[sync] pull failed', e);
        setSyncStatus('Офлайн (локально)', false);
        return;
    }

    // Migrate any legacy (non-UUID) local ids before reconciling/pushing.
    migrateLocalIdsToUuid();

    const toPush = { tasks: [], projects: [], tags: [] };

    for (const c of COLLECTIONS) {
        const remoteById = new Map(remote[c.type].map(r => [r.id, r]));
        const localById = new Map(state[c.arr].map(e => [e.id, e]));
        const merged = [];
        const seen = new Set();

        // local items: keep newer-or-equal local, push when local-only or local-newer
        for (const local of state[c.arr]) {
            seen.add(local.id);
            const r = remoteById.get(local.id);
            if (!r) { merged.push(local); toPush[c.type].push(local); }       // local-only → push
            else {
                const rl = c.toLocal(r);
                if ((local.updatedAt || '') > (r.updated_at || '')) { merged.push(local); toPush[c.type].push(local); }
                else merged.push(rl);                                          // remote newer/equal → take remote
            }
        }
        // remote-only items: take them
        for (const r of remote[c.type]) {
            if (seen.has(r.id)) continue;
            merged.push(c.toLocal(r));
        }
        state[c.arr] = merged;
    }

    // Push local-only / local-newer up, then snapshot the reconciled state.
    if (userId) {
        for (const c of COLLECTIONS) {
            if (toPush[c.type].length) await upsertRows(c, toPush[c.type]);
        }
    }
    snapshot();

    // write-through to IndexedDB cache without triggering another push
    applyingRemote = true;
    try { await saveNow(); } finally { applyingRemote = false; }

    setSyncStatus('Синхронизировано', true);
    render();
}

async function pullAll() {
    const out = { tasks: [], projects: [], tags: [] };
    for (const c of COLLECTIONS) {
        const { data, error } = await supabase.from(c.type).select('*').is('deleted_at', null);
        if (error) throw error;
        out[c.type] = data || [];
    }
    return out;
}

async function upsertRows(c, localEntities) {
    const rows = localEntities.map(e => c.toRow(e, userId));
    const { data, error } = await supabase.from(c.type).upsert(rows).select();
    if (error) throw error;
    // adopt server timestamps so our clock matches (echo suppression + dirty diff)
    const byId = new Map((data || []).map(r => [r.id, r]));
    for (const e of localEntities) {
        const r = byId.get(e.id);
        if (r) { e.updatedAt = r.updated_at; lastSynced[c.type].set(e.id, r.updated_at); }
    }
}

// ============ OUTGOING SYNC (diff against lastSynced) ============
export async function pushDirty() {
    if (!userId || applyingRemote) return;
    if (!navigator.onLine) { setSyncStatus('Офлайн (локально)', false); return; }

    try {
        let changed = false;
        for (const c of COLLECTIONS) {
            const currentIds = new Set();
            const dirty = [];
            for (const e of state[c.arr]) {
                currentIds.add(e.id);
                const prev = lastSynced[c.type].get(e.id);
                if (prev === undefined || prev !== (e.updatedAt || '')) dirty.push(e);
            }
            // permanently removed locally → soft-delete on server
            const removed = [];
            for (const id of lastSynced[c.type].keys()) if (!currentIds.has(id)) removed.push(id);

            if (dirty.length) { await upsertRows(c, dirty); changed = true; }
            for (const id of removed) {
                const nowIso = new Date().toISOString();
                const { error } = await supabase.from(c.type)
                    .update({ deleted_at: nowIso, updated_at: nowIso }).eq('id', id);
                if (!error) { lastSynced[c.type].delete(id); changed = true; }
            }
        }
        setSyncStatus(changed ? 'Синхронизировано' : 'Синхронизировано', true);
    } catch (e) {
        console.error('[sync] push failed', e);
        setSyncStatus('Ошибка синка', false);
    }
}

// ============ APPLY INCOMING REMOTE CHANGE (realtime) ============
export async function applyRemote(table, row) {
    const c = COLLECTIONS.find(x => x.type === table);
    if (!c) return;
    const arr = state[c.arr];
    const idx = arr.findIndex(e => e.id === row.id);
    const local = idx >= 0 ? arr[idx] : null;

    // newest-wins: ignore if our copy is newer-or-equal (also suppresses our own echo)
    if (local && (local.updatedAt || '') >= (row.updated_at || '')) {
        lastSynced[c.type].set(row.id, row.updated_at || '');
        return;
    }

    if (row.deleted_at) {
        if (idx >= 0) arr.splice(idx, 1);
        lastSynced[c.type].delete(row.id);
    } else {
        const local2 = c.toLocal(row);
        if (idx >= 0) arr[idx] = local2; else arr.push(local2);
        lastSynced[c.type].set(row.id, row.updated_at || '');
    }

    applyingRemote = true;
    try { await saveNow(); } finally { applyingRemote = false; }
    render();
}

// ============ HOOKS ============
export function initSyncHooks() {
    if (started) return;
    started = true;
    // outgoing push fires after every successful local (IndexedDB) save
    bus.on('after-local-save', () => { pushDirty(); });
    // flush queued changes when connectivity returns
    window.addEventListener('online', () => { setSyncStatus('Синхронизация…', true); pushDirty(); });
    window.addEventListener('offline', () => setSyncStatus('Офлайн (локально)', false));
}

export function resetSync() {
    userId = null;
    for (const c of COLLECTIONS) lastSynced[c.type].clear();
}
