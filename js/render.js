'use strict';

// ============ RENDER: navigation, views shell, task list ============
import { state, $, escapeHtml, todayStr, formatDate, PROJECT_COLORS, icon, levelDot } from './core.js';
import {
    renderDashboard, renderProjects, renderCalendar, renderTags, renderOverdue, renderKanban
} from './views.js';
import { openDetail, closeDetail } from './detail.js';
import { closeSidebar } from './keyboard.js';

// ============ NAV / SIDEBAR ============
export function renderSidebar() {
    const counts = computeCounts();
    const inboxCount = counts.inbox;
    const overdueCount = state.tasks.filter(t => !t.completed && t.date && t.date < todayStr() && t.list !== 'trash').length;

    let html = `
        <div class="nav-section">
            <div class="nav-section-header"><span class="nav-section-title">Обзор</span></div>
            <div class="nav-item ${state.currentView === 'dashboard' ? 'active' : ''}" data-action="switchView" data-view="dashboard">
                <span class="nav-icon">${icon('chart')}</span><span class="nav-label">Дашборд</span>
            </div>
            <div class="nav-item ${state.currentView === 'today' ? 'active' : ''}" data-action="switchView" data-view="today">
                <span class="nav-icon">${icon('star')}</span><span class="nav-label">Сегодня</span>
                ${counts.today > 0 ? `<span class="nav-count">${counts.today}</span>` : ''}
            </div>
            <div class="nav-item ${state.currentView === 'overdue' ? 'active' : ''}" data-action="switchView" data-view="overdue">
                <span class="nav-icon">${icon('flame')}</span><span class="nav-label">Просрочено</span>
                ${overdueCount > 0 ? `<span class="nav-item-tag">${overdueCount}</span>` : ''}
            </div>
        </div>

        <div class="nav-section">
            <div class="nav-section-header"><span class="nav-section-title">Сбор</span></div>
            <div class="nav-item ${state.currentView === 'inbox' ? 'active' : ''}" data-action="switchView" data-view="inbox">
                <span class="nav-icon">${icon('inbox')}</span><span class="nav-label">Входящие</span>
                ${inboxCount > 0 ? `<span class="nav-item-tag" style="background:var(--accent)">${inboxCount}</span>` : ''}
            </div>
        </div>

        <div class="nav-section">
            <div class="nav-section-header"><span class="nav-section-title">Действия</span></div>
            <div class="nav-item ${state.currentView === 'next' ? 'active' : ''}" data-action="switchView" data-view="next">
                <span class="nav-icon">${icon('zap')}</span><span class="nav-label">Следующие</span>
                ${counts.next > 0 ? `<span class="nav-count">${counts.next}</span>` : ''}
            </div>
            <div class="nav-item ${state.currentView === 'waiting' ? 'active' : ''}" data-action="switchView" data-view="waiting">
                <span class="nav-icon">${icon('clock')}</span><span class="nav-label">Ожидания</span>
                ${counts.waiting > 0 ? `<span class="nav-count">${counts.waiting}</span>` : ''}
            </div>
            <div class="nav-item ${state.currentView === 'calendar' ? 'active' : ''}" data-action="switchView" data-view="calendar">
                <span class="nav-icon">${icon('calendar')}</span><span class="nav-label">Календарь</span>
                ${counts.calendar > 0 ? `<span class="nav-count">${counts.calendar}</span>` : ''}
            </div>
        </div>

        <div class="nav-section">
            <div class="nav-section-header">
                <span class="nav-section-title">Проекты</span>
                <button class="nav-section-add" data-action="openProjectModal" title="Новый проект">+</button>
            </div>
            <div class="nav-item ${state.currentView === 'projects' ? 'active' : ''}" data-action="switchView" data-view="projects">
                <span class="nav-icon">${icon('folder')}</span><span class="nav-label">Все проекты</span>
                ${state.projects.length > 0 ? `<span class="nav-count">${state.projects.length}</span>` : ''}
            </div>
            ${state.projects.slice(0, 10).map(p => {
                const pCount = state.tasks.filter(t => t.projectId === p.id && !t.completed && t.list !== 'trash').length;
                const isActive = state.currentView === 'project' && state.currentProjectId === p.id;
                return `<div class="nav-project ${isActive ? 'active' : ''}" data-action="openProject" data-id="${p.id}">
                    <span class="nav-project-icon" style="background:${p.color || PROJECT_COLORS[0]}"></span>
                    <span class="nav-project-label">${escapeHtml(p.title)}</span>
                    ${pCount > 0 ? `<span class="nav-project-count">${pCount}</span>` : ''}
                </div>`;
            }).join('')}
        </div>

        <div class="nav-section">
            <div class="nav-section-header">
                <span class="nav-section-title">Теги</span>
                <button class="nav-section-add" data-action="openTagModal" title="Новый тег">+</button>
            </div>
            <div class="nav-item ${state.currentView === 'tags' ? 'active' : ''}" data-action="switchView" data-view="tags">
                <span class="nav-icon">${icon('tag')}</span><span class="nav-label">Все теги</span>
                ${state.tags.length > 0 ? `<span class="nav-count">${state.tags.length}</span>` : ''}
            </div>
            ${state.tags.slice(0,8).map(tag => {
                const tCount = state.tasks.filter(t => t.tags && t.tags.includes(tag.name) && !t.completed).length;
                const isActive = state.currentView === 'tag' && state.currentTagId === tag.id;
                return `<div class="nav-tag ${isActive ? 'active' : ''}" data-action="openTag" data-id="${tag.id}">
                    <span class="nav-tag-color" style="background:${tag.color}"></span>
                    <span class="nav-project-label">${escapeHtml(tag.name)}</span>
                    ${tCount > 0 ? `<span class="nav-project-count">${tCount}</span>` : ''}
                </div>`;
            }).join('')}
        </div>

        <div class="nav-section">
            <div class="nav-section-header"><span class="nav-section-title">Хранилище</span></div>
            <div class="nav-item ${state.currentView === 'someday' ? 'active' : ''}" data-action="switchView" data-view="someday">
                <span class="nav-icon">${icon('cloud')}</span><span class="nav-label">Когда-нибудь</span>
                ${counts.someday > 0 ? `<span class="nav-count">${counts.someday}</span>` : ''}
            </div>
            <div class="nav-item ${state.currentView === 'reference' ? 'active' : ''}" data-action="switchView" data-view="reference">
                <span class="nav-icon">${icon('book')}</span><span class="nav-label">Справочные</span>
                ${counts.reference > 0 ? `<span class="nav-count">${counts.reference}</span>` : ''}
            </div>
            <div class="nav-item ${state.currentView === 'done' ? 'active' : ''}" data-action="switchView" data-view="done">
                <span class="nav-icon">${icon('check-circle')}</span><span class="nav-label">Выполнено</span>
                ${counts.done > 0 ? `<span class="nav-count">${counts.done}</span>` : ''}
            </div>
            <div class="nav-item ${state.currentView === 'trash' ? 'active' : ''}" data-action="switchView" data-view="trash">
                <span class="nav-icon">${icon('trash')}</span><span class="nav-label">Корзина</span>
                ${counts.trash > 0 ? `<span class="nav-count">${counts.trash}</span>` : ''}
            </div>
        </div>
    `;
    $('#sidebarNav').innerHTML = html;
}

export function computeCounts() {
    const counts = { inbox: 0, next: 0, waiting: 0, calendar: 0, someday: 0, reference: 0, done: 0, trash: 0, today: 0 };
    const today = todayStr();
    state.tasks.forEach(t => {
        if (t.list === 'done') counts.done++;
        else if (t.list === 'trash') counts.trash++;
        else if (!t.completed) {
            if (counts[t.list] !== undefined) counts[t.list]++;
            if (t.date === today || (t.list === 'calendar' && t.date === today)) counts.today++;
        }
    });
    return counts;
}

// ============ VIEWS ============
export function switchView(view) {
    state.currentView = view;
    state.currentProjectId = null;
    state.currentTagId = null;
    closeDetail();
    render();
    closeSidebar();
}

export function openProject(id) {
    state.currentView = 'project';
    state.currentProjectId = id;
    closeDetail();
    render();
    closeSidebar();
}

export function openTag(id) {
    state.currentView = 'tag';
    state.currentTagId = id;
    closeDetail();
    render();
    closeSidebar();
}

export function render() {
    renderSidebar();
    renderHeader();
    renderFilters();
    renderContent();
    renderStatusBar();
}

export function renderHeader() {
    const view = state.currentView;
    const viewInfo = getViewInfo(view);
    $('#viewBreadcrumb').textContent = viewInfo.breadcrumb;
    $('#viewIcon').innerHTML = icon(viewInfo.icon);
    $('#viewTitle').textContent = viewInfo.title;
    $('#viewMeta').textContent = viewInfo.meta || '';

    let actions = '';
    if (['inbox', 'next', 'waiting', 'someday', 'reference', 'today'].includes(view) || view === 'project' || view === 'tag') {
        actions += `<button class="toolbar-btn primary" data-action="quickAddInList">＋ Задача</button>`;
    }
    if (view === 'inbox') {
        const inboxCount = state.tasks.filter(t => t.list === 'inbox').length;
        if (inboxCount > 0) {
            actions += `<button class="toolbar-btn" data-action="startProcess">${icon('refresh')} Обработать (${inboxCount})</button>`;
        }
    }
    if (view === 'projects') {
        actions += `<button class="toolbar-btn primary" data-action="openProjectModal">＋ Проект</button>`;
    }
    if (view === 'project' && state.currentProjectId) {
        actions += `<button class="toolbar-btn" data-action="editProject" data-id="${state.currentProjectId}">${icon('edit')} Изменить</button>`;
        actions += `<button class="toolbar-btn" data-action="deleteProject" data-id="${state.currentProjectId}" aria-label="Удалить проект">${icon('trash')}</button>`;
    }
    // View mode toggle (for next, today, project)
    if (['next', 'today', 'project'].includes(view)) {
        actions += `
            <div style="display:flex;gap:0;background:var(--bg-elev);border:1px solid var(--border);border-radius:6px;padding:2px;margin-left:8px">
                <button class="toolbar-icon-btn ${state.viewMode === 'list' ? 'active' : ''}" style="border:none" data-action="setViewMode" data-arg="list" title="Список" aria-label="Список">${icon('menu')}</button>
                <button class="toolbar-icon-btn ${state.viewMode === 'kanban' ? 'active' : ''}" style="border:none" data-action="setViewMode" data-arg="kanban" title="Канбан" aria-label="Канбан">${icon('kanban')}</button>
            </div>
        `;
    }
    $('#viewActions').innerHTML = actions;
}

export function getViewInfo(view) {
    const info = {
        dashboard: { breadcrumb: 'Обзор', icon: 'chart', title: 'Дашборд', meta: 'Аналитика и статистика' },
        today: { breadcrumb: 'Обзор', icon: 'star', title: 'Сегодня', meta: 'Задачи на сегодня' },
        overdue: { breadcrumb: 'Обзор', icon: 'flame', title: 'Просроченные', meta: 'Требуют внимания' },
        inbox: { breadcrumb: 'GTD · Сбор', icon: 'inbox', title: 'Входящие', meta: 'Соберите все, что у вас на уме' },
        next: { breadcrumb: 'GTD · Действия', icon: 'zap', title: 'Следующие действия', meta: 'Что можно сделать прямо сейчас' },
        waiting: { breadcrumb: 'GTD · Действия', icon: 'clock', title: 'Ожидания', meta: 'Делегированные задачи' },
        calendar: { breadcrumb: 'GTD · Действия', icon: 'calendar', title: 'Календарь', meta: 'Задачи на конкретные даты' },
        projects: { breadcrumb: 'GTD · Организация', icon: 'folder', title: 'Проекты', meta: `${state.projects.length} активных проектов` },
        someday: { breadcrumb: 'GTD · Хранилище', icon: 'cloud', title: 'Когда-нибудь / Может быть', meta: 'Идеи на будущее' },
        reference: { breadcrumb: 'GTD · Хранилище', icon: 'book', title: 'Справочные материалы', meta: 'Информация для хранения' },
        done: { breadcrumb: 'Архив', icon: 'check-circle', title: 'Выполнено', meta: 'Завершенные задачи' },
        trash: { breadcrumb: 'Архив', icon: 'trash', title: 'Корзина', meta: 'Удаленные элементы' },
        tags: { breadcrumb: 'Организация', icon: 'tag', title: 'Все теги', meta: `${state.tags.length} тегов` }
    };
    if (view === 'project' && state.currentProjectId) {
        const p = state.projects.find(p => p.id === state.currentProjectId);
        if (p) {
            const pTasks = state.tasks.filter(t => t.projectId === p.id && t.list !== 'trash');
            const done = pTasks.filter(t => t.completed).length;
            return { breadcrumb: 'Проект', icon: 'folder', title: p.title, meta: `${done} из ${pTasks.length} выполнено` };
        }
    }
    if (view === 'tag' && state.currentTagId) {
        const t = state.tags.find(t => t.id === state.currentTagId);
        if (t) {
            const tasks = state.tasks.filter(task => task.tags && task.tags.includes(t.name) && task.list !== 'trash');
            return { breadcrumb: 'Тег', icon: 'tag', title: '#' + t.name, meta: `${tasks.length} задач` };
        }
    }
    return info[view] || { breadcrumb: '', icon: 'list', title: 'View', meta: '' };
}

export function renderFilters() {
    const view = state.currentView;
    if (['dashboard', 'calendar', 'projects', 'tags'].includes(view)) {
        $('#filterBar').style.display = 'none';
        return;
    }
    $('#filterBar').style.display = 'flex';

    let html = `<span class="filter-label">Сортировка</span>`;
    const sortOptions = [
        { v: 'created', l: 'Создано' },
        { v: 'updated', l: 'Изменено' },
        { v: 'priority', l: 'Приоритет' },
        { v: 'date', l: 'Дата' },
        { v: 'title', l: 'Название' }
    ];
    sortOptions.forEach(opt => {
        html += `<div class="filter-chip ${state.sortBy === opt.v ? 'active' : ''}" data-action="setSort" data-arg="${opt.v}">${opt.l}${state.sortBy === opt.v ? (state.sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}</div>`;
    });

    html += `<div class="filter-divider"></div><span class="filter-label">Группировка</span>`;
    const groupOptions = [
        { v: 'none', l: 'Нет' },
        { v: 'priority', l: 'Приоритет' },
        { v: 'context', l: 'Контекст' },
        { v: 'project', l: 'Проект' },
        { v: 'energy', l: 'Энергия' }
    ];
    groupOptions.forEach(opt => {
        html += `<div class="filter-chip ${state.groupBy === opt.v ? 'active' : ''}" data-action="setGroup" data-arg="${opt.v}">${opt.l}</div>`;
    });

    // Quick filters
    html += `<div class="filter-divider"></div>`;
    html += `<div class="filter-chip ${state.showCompleted ? 'active' : ''}" data-action="toggleCompleted">${state.showCompleted ? icon('check') + ' ' : ''}Показать выполненные</div>`;

    // Active filters
    if (state.filters.context || state.filters.energy || state.filters.priority) {
        html += `<div class="filter-divider"></div>`;
        if (state.filters.context) html += `<div class="filter-chip active" data-action="clearFilter" data-arg="context">Контекст: ${state.filters.context} <span class="filter-chip-close">×</span></div>`;
        if (state.filters.energy) html += `<div class="filter-chip active" data-action="clearFilter" data-arg="energy">Энергия: ${state.filters.energy} <span class="filter-chip-close">×</span></div>`;
        if (state.filters.priority) html += `<div class="filter-chip active" data-action="clearFilter" data-arg="priority">Приоритет: ${state.filters.priority} <span class="filter-chip-close">×</span></div>`;
    }

    $('#filterBar').innerHTML = html;
}

export function setSort(v) {
    if (state.sortBy === v) {
        state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
        state.sortBy = v;
        state.sortOrder = 'desc';
    }
    render();
}

export function setGroup(v) {
    state.groupBy = v;
    render();
}

export function toggleCompleted() {
    state.showCompleted = !state.showCompleted;
    render();
}

export function clearFilter(key) {
    state.filters[key] = '';
    render();
}

export function setViewMode(mode) {
    state.viewMode = mode;
    render();
}

// ============ CONTENT RENDERING ============
export function renderContent() {
    const view = state.currentView;
    const c = $('#content');

    // Global search mode: a non-empty query searches across ALL tasks and
    // takes over rendering completely, regardless of the active view.
    if (state.searchQuery.trim()) return renderSearchResults(c);

    if (view === 'dashboard') return renderDashboard(c);
    if (view === 'projects') return renderProjects(c);
    if (view === 'calendar') return renderCalendar(c);
    if (view === 'tags') return renderTags(c);
    if (view === 'overdue') return renderOverdue(c);

    let tasks = getTasksForView(view);

    // Apply filters
    if (state.filters.context) tasks = tasks.filter(t => t.context === state.filters.context);
    if (state.filters.energy) tasks = tasks.filter(t => t.energy === state.filters.energy);
    if (state.filters.priority) tasks = tasks.filter(t => t.priority === state.filters.priority);

    // Show completed
    if (!state.showCompleted && view !== 'done') {
        tasks = tasks.filter(t => !t.completed);
    }

    // Kanban mode
    if (state.viewMode === 'kanban' && ['next', 'today', 'project'].includes(view)) {
        return renderKanban(c, tasks);
    }

    // Sort
    tasks = sortTasks(tasks);

    let html = '';

    // Inline add for active lists
    if (['inbox', 'next', 'waiting', 'someday', 'reference', 'today'].includes(view) || view === 'project' || view === 'tag') {
        html += `
            <div class="inline-add">
                <span class="inline-add-icon">＋</span>
                <input type="text" id="inlineAddInput" placeholder="Быстро добавить задачу... (используйте @контекст, #тег, !1-!3, ~дата)" data-action="handleInlineAdd" data-on="enter">
                <span class="inline-add-hint">Enter</span>
            </div>
        `;
    }

    if (tasks.length === 0) {
        html += renderEmptyState(view);
    } else {
        // Group
        if (state.groupBy === 'none') {
            html += '<div class="task-list">';
            tasks.forEach(t => html += renderTaskItem(t));
            html += '</div>';
        } else {
            const groups = groupTasks(tasks, state.groupBy);
            Object.keys(groups).forEach(groupKey => {
                const groupTasks = groups[groupKey];
                html += `
                    <div class="task-section">
                        <div class="task-section-header" data-action="toggleCollapse">
                            <span class="task-section-toggle">▼</span>
                            <span class="task-section-title">${escapeHtml(groupKey)}</span>
                            <span class="task-section-count">${groupTasks.length}</span>
                            <span class="task-section-divider"></span>
                        </div>
                        <div class="task-list">
                            ${groupTasks.map(t => renderTaskItem(t)).join('')}
                        </div>
                    </div>
                `;
            });
        }
    }

    // Clear actions
    if (view === 'trash' && tasks.length > 0) {
        html += `<div style="margin-top:20px;text-align:center"><button class="toolbar-btn" style="color:var(--danger)" data-action="emptyTrash">${icon('trash')} Очистить корзину</button></div>`;
    }

    c.innerHTML = html;
}

// ============ GLOBAL SEARCH RESULTS ============
export function renderSearchResults(c) {
    const q = state.searchQuery.trim().toLowerCase();
    const matches = state.tasks.filter(t =>
        t.list !== 'trash' &&
        (
            (t.title || '').toLowerCase().includes(q) ||
            (t.notes || '').toLowerCase().includes(q) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(q))
        )
    );

    const sorted = sortTasks(matches);

    let html = `
        <div class="task-section-header" style="cursor:default">
            <button class="toolbar-btn" data-action="clearSearch" title="Вернуться к текущему виду">← Назад</button>
            <span class="task-section-title">${icon('search')} Поиск: «${escapeHtml(state.searchQuery.trim())}»</span>
            <span class="task-section-count">${sorted.length}</span>
            <span class="task-section-divider"></span>
        </div>`;

    if (!sorted.length) {
        html += `
            <div class="empty-state">
                <div class="empty-icon">${icon('search')}</div>
                <h3>Ничего не найдено</h3>
                <p>По запросу нет задач. Попробуйте изменить запрос.</p>
            </div>`;
    } else {
        html += `<div class="task-list">` +
            sorted.map(t => renderTaskItem(t)).join('') +
            `</div>`;
    }

    c.innerHTML = html;
}

export function getTasksForView(view) {
    if (view === 'today') {
        const t = todayStr();
        return state.tasks.filter(task =>
            task.list !== 'trash' && task.list !== 'done' &&
            (task.date === t || (task.list === 'calendar' && task.date === t))
        );
    }
    if (view === 'project') {
        return state.tasks.filter(t => t.projectId === state.currentProjectId && t.list !== 'trash');
    }
    if (view === 'tag') {
        const tag = state.tags.find(t => t.id === state.currentTagId);
        if (!tag) return [];
        return state.tasks.filter(t => t.tags && t.tags.includes(tag.name) && t.list !== 'trash');
    }
    return state.tasks.filter(t => t.list === view);
}

export function sortTasks(tasks) {
    const sorted = [...tasks];
    const priorityOrder = { high: 3, medium: 2, low: 1, '': 0 };
    sorted.sort((a, b) => {
        let cmp = 0;
        if (state.sortBy === 'created') cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
        else if (state.sortBy === 'updated') cmp = (a.updatedAt || '').localeCompare(b.updatedAt || '');
        else if (state.sortBy === 'priority') cmp = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
        else if (state.sortBy === 'date') {
            const ad = a.date || '9999';
            const bd = b.date || '9999';
            cmp = ad.localeCompare(bd);
            if (state.sortOrder === 'desc') cmp = -cmp;
        }
        else if (state.sortBy === 'title') cmp = a.title.localeCompare(b.title);
        return state.sortOrder === 'desc' ? -cmp : cmp;
    });
    return sorted;
}

export function groupTasks(tasks, by) {
    const groups = {};
    tasks.forEach(t => {
        let key = 'Без категории';
        if (by === 'priority') {
            key = t.priority === 'high' ? 'Высокий приоритет' : t.priority === 'medium' ? 'Средний приоритет' : t.priority === 'low' ? 'Низкий приоритет' : 'Без приоритета';
        } else if (by === 'context') {
            key = t.context || 'Без контекста';
        } else if (by === 'project') {
            const p = state.projects.find(p => p.id === t.projectId);
            key = p ? p.title : 'Без проекта';
        } else if (by === 'energy') {
            key = t.energy === 'high' ? 'Высокая энергия' : t.energy === 'medium' ? 'Средняя энергия' : t.energy === 'low' ? 'Низкая энергия' : 'Не указана';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
    });
    return groups;
}

export function renderTaskItem(task) {
    const project = task.projectId ? state.projects.find(p => p.id === task.projectId) : null;
    const subtasksDone = (task.subtasks || []).filter(s => s.done).length;
    const subtasksTotal = (task.subtasks || []).length;
    const isSelected = state.selectedTaskId === task.id ? 'selected' : '';
    const completedClass = task.completed ? 'completed' : '';
    const priorityClass = task.priority ? `priority-${task.priority}` : '';

    let metaItems = [];
    if (task.context) metaItems.push(`<span class="task-badge context">${escapeHtml(task.context)}</span>`);
    if (project) metaItems.push(`<span class="task-badge project" style="color:${project.color}">${icon('folder')} ${escapeHtml(project.title)}</span>`);
    if (task.date) {
        const isOverdue = task.date < todayStr() && !task.completed;
        const isToday = task.date === todayStr();
        const cls = isOverdue ? 'overdue' : isToday ? 'today' : '';
        metaItems.push(`<span class="task-badge date ${cls}">${icon('calendar')} ${formatDate(task.date)}${task.time ? ' ' + task.time : ''}</span>`);
    }
    if (task.energy) {
        const labels = { high: 'High', medium: 'Med', low: 'Low' };
        metaItems.push(`<span class="task-badge energy-${task.energy}">${levelDot(task.energy)}${labels[task.energy]}</span>`);
    }
    if (task.timeEstimate) metaItems.push(`<span class="task-badge time">${icon('clock')} ${escapeHtml(task.timeEstimate)}</span>`);
    if (task.waitingFor) metaItems.push(`<span class="task-badge waiting">${icon('user')} ${escapeHtml(task.waitingFor)}</span>`);
    (task.tags || []).forEach(tag => {
        const tagObj = state.tags.find(t => t.name === tag);
        const color = tagObj ? tagObj.color : 'var(--text-3)';
        metaItems.push(`<span class="task-badge tag" style="color:${color}">#${escapeHtml(tag)}</span>`);
    });
    if (task.notes) metaItems.push(`<span class="task-indicator">${icon('note')}</span>`);

    return `
        <div class="task-item ${isSelected} ${completedClass} ${priorityClass}" data-id="${task.id}"
             data-action="selectTask"
             data-action-context="showTaskContext"
             draggable="true">
            <span class="task-drag-handle">⋮⋮</span>
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="toggleComplete" data-id="${task.id}"></div>
            <div class="task-body">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${metaItems.length ? `<div class="task-meta">${metaItems.join('')}</div>` : ''}
                ${subtasksTotal > 0 ? `
                    <div class="task-subtasks-bar">
                        <div class="task-subtasks-fill" style="width:${(subtasksDone/subtasksTotal)*100}%"></div>
                    </div>
                ` : ''}
            </div>
            <div class="task-actions">
                <button class="task-action-btn" data-action="openDetail" data-id="${task.id}" title="Открыть" aria-label="Открыть">${icon('external')}</button>
                <button class="task-action-btn delete" data-action="trashTask" data-id="${task.id}" title="Удалить" aria-label="Удалить">${icon('trash')}</button>
            </div>
        </div>
    `;
}

export function renderEmptyState(view) {
    const states = {
        inbox: { i: 'inbox', t: 'Входящие пусты', d: 'Голова свободна. Захватите новые мысли через быстрый захват (N).', a: 'Захватить мысль', f: 'openCapture' },
        next: { i: 'zap', t: 'Нет следующих действий', d: 'Обработайте входящие, чтобы определить конкретные действия.', a: 'Обработать входящие', f: 'startProcess' },
        waiting: { i: 'clock', t: 'Нет ожиданий', d: 'Делегированные задачи появятся здесь.' },
        calendar: { i: 'calendar', t: 'Календарь пуст', d: 'Задачи с конкретными датами появятся здесь.' },
        someday: { i: 'cloud', t: 'Нет идей на будущее', d: 'Сохраняйте идеи и мечты для будущего рассмотрения.' },
        reference: { i: 'book', t: 'Нет справочных материалов', d: 'Полезная информация для хранения.' },
        done: { i: 'party', t: 'Пока ничего не сделано', d: 'Выполненные задачи появятся здесь.' },
        trash: { i: 'trash', t: 'Корзина пуста', d: 'Удаленные элементы.' },
        today: { i: 'star', t: 'На сегодня ничего нет', d: 'Свободный день! Или запланируйте задачи.' },
        project: { i: 'folder', t: 'В проекте нет задач', d: 'Добавьте задачи в этот проект.' },
        tag: { i: 'tag', t: 'Нет задач с этим тегом', d: 'Добавьте тег к задачам в детальной панели.' }
    };
    const s = states[view] || { i: 'list', t: 'Пусто', d: '' };
    return `
        <div class="empty-state">
            <div class="empty-icon">${icon(s.i)}</div>
            <h3>${s.t}</h3>
            <p>${s.d}</p>
            ${s.a ? `<button class="empty-state-action" data-action="${s.f}">${s.a}</button>` : ''}
        </div>
    `;
}

// ============ STATUS BAR ============
export function renderStatusBar() {
    const total = state.tasks.filter(t => t.list !== 'trash' && t.list !== 'done').length;
    const today = todayStr();
    const doneToday = state.tasks.filter(t => t.completedAt && t.completedAt.startsWith(today)).length;
    $('#statusTotal').innerHTML = `${icon('list')} ${total} активных задач`;
    $('#statusDone').innerHTML = `${icon('check')} ${doneToday} выполнено сегодня`;
}

// ============ SELECT TASK ============
export function selectTask(id, e) {
    if (e.target.closest('.task-actions') || e.target.closest('.task-checkbox')) return;
    state.selectedTaskId = id;
    openDetail(id);
}
