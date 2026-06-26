'use strict';

// ============ KEYBOARD / CONTEXT MENU / SIDEBAR ============
import { state, $, $$ } from './core.js';
import { openDetail, closeDetail } from './detail.js';
import { toggleComplete, trashTask } from './model.js';
import { openCapture, startProcess, openReview, openShortcuts, saveCaptureAndClose, quickAddInList } from './capture.js';
import { switchView } from './render.js';

// ============ CONTEXT MENU ============
export function showTaskContext(id, e) {
    e.preventDefault();
    const menu = $('#contextMenu');
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    state.selectedTaskId = id;
    menu.innerHTML = `
        <div class="context-menu-item" data-action="ctxOpenDetail" data-id="${id}">
            <span class="context-menu-icon">↗</span>Открыть детали<span class="context-menu-shortcut">Enter</span>
        </div>
        <div class="context-menu-item" data-action="ctxToggleComplete" data-id="${id}">
            <span class="context-menu-icon">✓</span>${task.completed ? 'Вернуть' : 'Выполнить'}<span class="context-menu-shortcut">Space</span>
        </div>
        <div class="context-menu-item" data-action="duplicateFromContext" data-id="${id}">
            <span class="context-menu-icon">📋</span>Дублировать
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" data-action="ctxMoveNext" data-id="${id}">
            <span class="context-menu-icon">⚡</span>В Следующие
        </div>
        <div class="context-menu-item" data-action="ctxMoveSomeday" data-id="${id}">
            <span class="context-menu-icon">💭</span>В Когда-нибудь
        </div>
        <div class="context-menu-item" data-action="ctxMoveReference" data-id="${id}">
            <span class="context-menu-icon">📚</span>В Справочные
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" data-action="ctxTrash" data-id="${id}">
            <span class="context-menu-icon">🗑</span>Удалить<span class="context-menu-shortcut">Del</span>
        </div>
    `;
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('open');
}

export function hideContextMenu() {
    $('#contextMenu').classList.remove('open');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) hideContextMenu();
});

// ============ KEYBOARD ============
let lastKey = '';
let lastKeyTime = 0;

document.addEventListener('keydown', (e) => {
    const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

    // Modal closes
    if (e.key === 'Escape') {
        $$('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        closeDetail();
        hideContextMenu();
        return;
    }

    // Cmd+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        $('#globalSearch').focus();
        return;
    }

    if (inInput) {
        if (e.target.id === 'captureInput' && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveCaptureAndClose();
        }
        return;
    }

    // Single key shortcuts
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openCapture(); }
    else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); startProcess(); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); openReview(); }
    else if (e.key === '?') { e.preventDefault(); openShortcuts(); }
    else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); quickAddInList(); }
    else if (e.key === ' ') {
        if (state.selectedTaskId) { e.preventDefault(); toggleComplete(state.selectedTaskId); }
    }
    else if (e.key === 'Enter') {
        if (state.selectedTaskId) { e.preventDefault(); openDetail(state.selectedTaskId); }
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedTaskId) { e.preventDefault(); trashTask(state.selectedTaskId); }
    }
    // G navigation
    else if (e.key === 'g' || e.key === 'G') { lastKey = 'g'; lastKeyTime = Date.now(); }
    else if (lastKey === 'g' && (Date.now() - lastKeyTime) < 1000) {
        const navMap = { i: 'inbox', n: 'next', w: 'waiting', c: 'calendar', p: 'projects', s: 'someday', r: 'reference', d: 'dashboard', t: 'today' };
        const view = navMap[e.key.toLowerCase()];
        if (view) {
            e.preventDefault();
            switchView(view);
        }
        lastKey = '';
    }
});

// ============ MOBILE / SIDEBAR ============
export function toggleSidebar() {
    const open = $('#sidebar').classList.toggle('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.toggle('active', open);
}

export function closeSidebar() {
    $('#sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
}
