'use strict';

// ============ CORE: STATE, CONSTANTS, HELPERS, BUS ============

export const STORAGE_KEY = 'gtd_pro_v2';

export const PROJECT_COLORS = ['#ec4899', '#7c5cff', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
export const TAG_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export const state = {
    tasks: [],
    projects: [],
    tags: [],
    currentView: 'inbox',
    currentProjectId: null,
    currentTagId: null,
    selectedTaskId: null,
    editingProjectId: null,
    sortBy: 'created',
    sortOrder: 'desc',
    groupBy: 'none',
    viewMode: 'list', // list, kanban, calendar
    showCompleted: false,
    searchQuery: '',
    filters: { context: '', energy: '', priority: '' },
    processingIndex: 0,
    processQueue: [],
    calendarDate: new Date().toISOString().split('T')[0].substring(0,7), // YYYY-MM
    reviewProgress: {}
};

// ============ HELPERS ============
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export function generateId() {
    return (crypto.randomUUID) ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16);
        });
}

export function isUuid(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(id || '');
}

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function todayStr() {
    return new Date().toISOString().split('T')[0];
}

export function tomorrowStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    const today = todayStr();
    const tom = tomorrowStr();
    if (dateStr === today) return 'Сегодня';
    if (dateStr === tom) return 'Завтра';
    const d = new Date(dateStr + 'T00:00');
    const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const today_d = new Date();
    if (d.getFullYear() === today_d.getFullYear()) {
        return `${d.getDate()} ${months[d.getMonth()]}`;
    }
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function setSyncStatus(text, ok=true) {
    const el = document.getElementById('statusSync');
    if (el) el.textContent = text;
    const dot = document.querySelector('.status-dot');
    if (dot) dot.style.background = ok ? 'var(--success)' : 'var(--warning)';
}

// Renders a sprite icon. `name` is the symbol id WITHOUT the 'i-' prefix.
export function icon(name, cls = '') {
    return `<svg class="icon ${cls}" aria-hidden="true"><use href="assets/icons.svg#i-${name}"></use></svg>`;
}

// Colored priority/energy dot. level: 'high' | 'medium' | 'low'
export function levelDot(level) {
    const color = level === 'high' ? '#e24b4a' : level === 'medium' ? '#ef9f27' : '#639922';
    return `<svg class="level-dot" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="${color}"/></svg>`;
}

export function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const sym = type === 'success' ? 'check-circle' : type === 'error' ? 'alert' : 'info';
    t.innerHTML = `<span>${icon(sym)}</span><span>${escapeHtml(msg)}</span>`;
    $('#toastContainer').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ============ EVENT BUS (for breaking circular dependencies) ============
const __busHandlers = new Map();
export const bus = {
    on(name, fn) {
        if (!__busHandlers.has(name)) __busHandlers.set(name, []);
        __busHandlers.get(name).push(fn);
    },
    emit(name, payload) {
        const hs = __busHandlers.get(name);
        if (hs) for (const fn of hs) fn(payload);
    }
};
