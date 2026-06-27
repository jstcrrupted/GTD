'use strict';

// ============ APP ENTRY POINT ============
// Imports every module, registers all delegated actions, wires up the DOM,
// then runs the init sequence (load → seed demo if empty → autobackups → render).

import { state } from './core.js';
import { registerActions, initDelegation } from './actions.js';

import {
    loadAppState, saveNow, createBackup, loadLatestBackupObject,
    restoreBackupById, downloadBackupById, createBackupNow, restoreLatestBackup,
    clearBackups, exportFullBackup, importFullBackup, handleFullBackupImport
} from './storage.js';

import {
    toggleComplete, trashTask, emptyTrash, moveTaskTo, duplicateTask, deleteCurrentTask,
    updateTaskField, toggleSubtask, updateSubtask, addSubtask, deleteSubtask,
    addTag, removeTag, handleInlineAdd
} from './model.js';

import {
    render, switchView, openProject, openTag, setSort, setGroup,
    toggleCompleted, clearFilter, setViewMode, selectTask
} from './render.js';

import { changeMonth, goToToday, filterCalendarDay, initDnD } from './views.js';

import { openDetail, closeDetail, updateDetailTitle } from './detail.js';

import {
    openCapture, closeCapture, saveCaptureAndClose, insertCaptureText, quickAddInList,
    startProcess, closeProcess, processActionable, processChooseAction, processDispose, finishProcess,
    openReview, closeReview, toggleReviewItem,
    openProjectModal, closeProjectModal, saveProject, editProject, deleteProject, selectProjectColor,
    openTagModal, closeTagModal, saveTag, deleteTag, selectTagColor,
    openShortcuts, closeShortcuts
} from './capture.js';

import {
    openSettings, closeSettings, exportData, importData, handleFileImport,
    clearAllData, loadDemoData, seedDemoData, handleGlobalSearch, promptInstallPWA
} from './settings.js';

import { showTaskContext, hideContextMenu, toggleSidebar, closeSidebar } from './keyboard.js';

// ============ REGISTER ALL ACTIONS ============
registerActions({
    // Navigation / view
    switchView: (c) => switchView(c.view),
    openProject: (c) => openProject(c.id),
    openTag: (c) => openTag(c.id),
    setSort: (c) => setSort(c.arg),
    setGroup: (c) => setGroup(c.arg),
    setViewMode: (c) => setViewMode(c.arg),
    toggleCompleted: () => toggleCompleted(),
    clearFilter: (c) => clearFilter(c.arg),
    toggleCollapse: (c) => c.el.parentElement.classList.toggle('collapsed'),
    toggleSidebar: () => toggleSidebar(),
    closeSidebar: () => closeSidebar(),

    // Tasks (list / card)
    selectTask: (c) => selectTask(c.id, c.event),
    toggleComplete: (c) => toggleComplete(c.id, c.event),
    openDetail: (c) => openDetail(c.id, c.event),
    trashTask: (c) => trashTask(c.id, c.event),
    showTaskContext: (c) => showTaskContext(c.id, c.event),
    handleInlineAdd: (c) => handleInlineAdd(c.event),
    quickAddInList: () => quickAddInList(),
    filterCalendarDay: (c) => filterCalendarDay(c.arg),
    changeMonth: (c) => changeMonth(Number(c.arg)),
    goToToday: () => goToToday(),
    emptyTrash: () => emptyTrash(),

    // Context-menu wrappers (close the menu afterwards)
    ctxOpenDetail: (c) => (openDetail(c.id), hideContextMenu()),
    ctxToggleComplete: (c) => (toggleComplete(c.id), hideContextMenu()),
    duplicateFromContext: (c) => (state.selectedTaskId = c.id, duplicateTask(), hideContextMenu()),
    ctxMoveNext: (c) => (moveTaskTo(c.id, 'next'), hideContextMenu()),
    ctxMoveSomeday: (c) => (moveTaskTo(c.id, 'someday'), hideContextMenu()),
    ctxMoveReference: (c) => (moveTaskTo(c.id, 'reference'), hideContextMenu()),
    ctxTrash: (c) => (trashTask(c.id), hideContextMenu()),

    // Task detail panel
    updateDetailTitle: (c) => updateDetailTitle(c.event),
    updateTaskField: (c) => updateTaskField(c.field, c.value),
    toggleSubtask: (c) => toggleSubtask(c.index),
    updateSubtask: (c) => updateSubtask(c.index, c.value),
    deleteSubtask: (c) => deleteSubtask(c.index),
    addSubtask: (c) => (addSubtask(c.value), c.el.value = ''),
    addTag: (c) => (addTag(c.value.replace(',', '')), c.el.value = ''),
    removeTag: (c) => removeTag(c.tag),
    duplicateTask: () => duplicateTask(),
    deleteCurrentTask: () => deleteCurrentTask(),
    closeDetail: () => closeDetail(),

    // Capture / Process / Review
    openCapture: () => openCapture(),
    closeCapture: () => closeCapture(),
    saveCaptureAndClose: () => saveCaptureAndClose(),
    insertCaptureText: (c) => insertCaptureText(c.arg),
    startProcess: () => startProcess(),
    closeProcess: () => closeProcess(),
    finishProcess: () => finishProcess(),
    processActionable: (c) => processActionable(c.arg === 'true'),
    processChooseAction: () => processChooseAction(),
    processDispose: (c) => processDispose(c.list),
    openReview: () => openReview(),
    closeReview: () => closeReview(),
    toggleReviewItem: (c) => toggleReviewItem(c.id),

    // Projects / Tags (modals)
    openProjectModal: () => openProjectModal(),
    closeProjectModal: () => closeProjectModal(),
    saveProject: () => saveProject(),
    editProject: (c) => editProject(c.id),
    deleteProject: (c) => deleteProject(c.id),
    selectProjectColor: (c) => selectProjectColor(c.color),
    openTagModal: () => openTagModal(),
    closeTagModal: () => closeTagModal(),
    saveTag: () => saveTag(),
    selectTagColor: (c) => selectTagColor(c.color),
    deleteTag: (c) => deleteTag(c.id, c.event),

    // Settings / Backups / Data
    openSettings: () => openSettings(),
    closeSettings: () => closeSettings(),
    openShortcuts: () => openShortcuts(),
    closeShortcuts: () => closeShortcuts(),
    createBackupNow: () => createBackupNow(),
    restoreLatestBackup: () => restoreLatestBackup(),
    clearBackups: () => clearBackups(),
    restoreBackupById: (c) => restoreBackupById(c.id),
    downloadBackupById: (c) => downloadBackupById(c.id),
    exportData: () => exportData(),
    importData: () => importData(),
    handleFileImport: (c) => handleFileImport(c.event),
    exportFullBackup: () => exportFullBackup(),
    importFullBackup: () => importFullBackup(),
    handleFullBackupImport: (c) => handleFullBackupImport(c.event),
    clearAllData: () => clearAllData(),
    loadDemoData: () => loadDemoData(),
    handleGlobalSearch: (c) => handleGlobalSearch(c.event),
    promptInstallPWA: () => promptInstallPWA(),
});

// ============ WIRE UP DOM ============
initDelegation();
initDnD();

// ============ SERVICE WORKER (PWA offline) ============
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('./sw.js');
        } catch (e) {
            console.warn('SW register failed', e);
        }
    });
}

// ============ INIT ============
(async function initApp() {
    const ok = await loadAppState();
    if (!ok || (state.tasks.length === 0 && state.projects.length === 0)) {
        seedDemoData();
        await saveNow();
        await createBackup('initial');
    } else {
        // make sure we have at least one backup
        const latest = await loadLatestBackupObject();
        if (!latest) await createBackup('initial');
    }

    // Autobackups
    setInterval(() => createBackup('auto'), 120000);
    // backup when tab is hidden (best effort)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) createBackup('visibility');
    });

    render();
})();
