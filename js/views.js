'use strict';

// ============ VIEWS: dashboard, projects, tags, calendar, kanban ============
import { state, $, $$, escapeHtml, todayStr, formatDate, toast, icon } from './core.js';
import { renderTaskItem, sortTasks, render } from './render.js';
import { save } from './storage.js';
import { addActivity } from './model.js';
import { openDetail } from './detail.js';

// ============ DASHBOARD ============
export function renderDashboard(c) {
    const today = todayStr();
    const inboxCount = state.tasks.filter(t => t.list === 'inbox').length;
    const nextCount = state.tasks.filter(t => t.list === 'next' && !t.completed).length;
    const doneToday = state.tasks.filter(t => t.completedAt && t.completedAt.startsWith(today)).length;
    const overdue = state.tasks.filter(t => !t.completed && t.date && t.date < today && t.list !== 'trash' && t.list !== 'done').length;
    const todayCount = state.tasks.filter(t => t.date === today && !t.completed && t.list !== 'trash').length;
    const projectsActive = state.projects.length;
    const waitingCount = state.tasks.filter(t => t.list === 'waiting' && !t.completed).length;
    const totalActive = state.tasks.filter(t => !t.completed && t.list !== 'trash' && t.list !== 'done' && t.list !== 'someday' && t.list !== 'reference').length;

    // 7-day chart
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const count = state.tasks.filter(t => t.completedAt && t.completedAt.startsWith(ds)).length;
        const label = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
        days.push({ ds, count, label, isToday: ds === today });
    }
    const maxCount = Math.max(...days.map(d => d.count), 5);

    let html = `
        <div class="dashboard">
            <div class="stats-row">
                <div class="stat-card" data-action="switchView" data-view="inbox" style="cursor:pointer">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Входящие</span>
                        <div class="stat-card-icon" style="background:rgba(124,92,255,0.12);color:var(--inbox)">${icon('inbox')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--inbox)">${inboxCount}</div>
                    <div class="stat-card-change">${inboxCount === 0 ? `${icon('check')} Голова свободна` : 'Требует обработки'}</div>
                </div>
                <div class="stat-card" data-action="switchView" data-view="today" style="cursor:pointer">
                    <div class="stat-card-header">
                        <span class="stat-card-label">На сегодня</span>
                        <div class="stat-card-icon" style="background:rgba(245,158,11,0.12);color:var(--warning)">${icon('star')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--warning)">${todayCount}</div>
                    <div class="stat-card-change">${todayCount === 0 ? 'Свободный день' : 'Задач на сегодня'}</div>
                </div>
                <div class="stat-card" data-action="switchView" data-view="next" style="cursor:pointer">
                    <div class="stat-card-header">
                        <span class="stat-card-label">К выполнению</span>
                        <div class="stat-card-icon" style="background:rgba(59,130,246,0.12);color:var(--next)">${icon('zap')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--next)">${nextCount}</div>
                    <div class="stat-card-change">Следующих действий</div>
                </div>
                <div class="stat-card" data-action="switchView" data-view="overdue" style="cursor:pointer">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Просрочено</span>
                        <div class="stat-card-icon" style="background:rgba(239,68,68,0.12);color:var(--danger)">${icon('flame')}</div>
                    </div>
                    <div class="stat-card-value" style="color:${overdue > 0 ? 'var(--danger)' : 'var(--text)'}">${overdue}</div>
                    <div class="stat-card-change ${overdue > 0 ? 'negative' : 'positive'}">${overdue > 0 ? 'Требует внимания' : `${icon('check')} Все по плану`}</div>
                </div>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Сделано сегодня</span>
                        <div class="stat-card-icon" style="background:rgba(34,197,94,0.12);color:var(--done)">${icon('check-circle')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--done)">${doneToday}</div>
                    <div class="stat-card-change positive">${doneToday > 0 ? 'Отличная работа!' : 'Время действовать'}</div>
                </div>
                <div class="stat-card" data-action="switchView" data-view="projects" style="cursor:pointer">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Проекты</span>
                        <div class="stat-card-icon" style="background:rgba(236,72,153,0.12);color:var(--project)">${icon('folder')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--project)">${projectsActive}</div>
                    <div class="stat-card-change">Активных проектов</div>
                </div>
                <div class="stat-card" data-action="switchView" data-view="waiting" style="cursor:pointer">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Ожидания</span>
                        <div class="stat-card-icon" style="background:rgba(245,158,11,0.12);color:var(--waiting)">${icon('clock')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--waiting)">${waitingCount}</div>
                    <div class="stat-card-change">Делегированных</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <span class="stat-card-label">Всего активных</span>
                        <div class="stat-card-icon" style="background:rgba(6,182,212,0.12);color:var(--reference)">${icon('list')}</div>
                    </div>
                    <div class="stat-card-value" style="color:var(--reference)">${totalActive}</div>
                    <div class="stat-card-change">В работе</div>
                </div>
            </div>

            <div class="chart-card">
                <h3>${icon('chart')} Активность за 7 дней</h3>
                <div class="chart-bars">
                    ${days.map(d => `
                        <div class="chart-bar" style="height:${(d.count / maxCount) * 100}%;opacity:${d.isToday ? 1 : 0.7}" title="${d.ds}: ${d.count}">
                            ${d.count > 0 ? `<div class="chart-bar-value">${d.count}</div>` : ''}
                            <div class="chart-bar-label">${d.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Today's tasks
    const todayTasks = state.tasks.filter(t => t.date === today && !t.completed && t.list !== 'trash');
    if (todayTasks.length > 0) {
        html += `
            <div style="margin-top:24px">
                <div class="task-section-header" style="cursor:default">
                    <span class="task-section-title">${icon('star')} На сегодня</span>
                    <span class="task-section-count">${todayTasks.length}</span>
                    <span class="task-section-divider"></span>
                </div>
                <div class="task-list">
                    ${todayTasks.slice(0, 5).map(t => renderTaskItem(t)).join('')}
                </div>
            </div>
        `;
    }

    c.innerHTML = html;
}

export function renderOverdue(c) {
    const today = todayStr();
    const tasks = state.tasks.filter(t => !t.completed && t.date && t.date < today && t.list !== 'trash' && t.list !== 'done');
    if (tasks.length === 0) {
        c.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icon('party')}</div>
                <h3>Нет просроченных задач!</h3>
                <p>Все идет по плану. Так держать!</p>
            </div>
        `;
        return;
    }
    let html = '<div class="task-list">';
    sortTasks(tasks).forEach(t => html += renderTaskItem(t));
    html += '</div>';
    c.innerHTML = html;
}

// ============ PROJECTS VIEW ============
export function renderProjects(c) {
    if (state.projects.length === 0) {
        c.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icon('folder')}</div>
                <h3>Нет проектов</h3>
                <p>Проект — это результат, требующий нескольких действий. Создайте первый проект!</p>
                <button class="empty-state-action" data-action="openProjectModal">＋ Создать проект</button>
            </div>
        `;
        return;
    }
    let html = '<div style="display:grid;gap:10px">';
    state.projects.forEach(p => {
        const projectTasks = state.tasks.filter(t => t.projectId === p.id && t.list !== 'trash');
        const done = projectTasks.filter(t => t.completed).length;
        const active = projectTasks.length - done;
        const progress = projectTasks.length ? (done / projectTasks.length) * 100 : 0;
        const isOverdue = p.deadline && p.deadline < todayStr();

        html += `
            <div class="stat-card" style="cursor:pointer" data-action="openProject" data-id="${p.id}">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:10px;height:10px;border-radius:50%;background:${p.color}"></div>
                        <div>
                            <div style="font-size:14px;font-weight:600;margin-bottom:2px">${escapeHtml(p.title)}</div>
                            ${p.description ? `<div style="font-size:11.5px;color:var(--text-3)">${escapeHtml(p.description)}</div>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:4px">
                        <button class="task-action-btn" data-action="editProject" data-id="${p.id}" title="Изменить" aria-label="Изменить">${icon('edit')}</button>
                        <button class="task-action-btn delete" data-action="deleteProject" data-id="${p.id}" title="Удалить" aria-label="Удалить">${icon('trash')}</button>
                    </div>
                </div>
                <div class="project-progress-large">
                    <div class="project-progress-large-fill" style="width:${progress}%;background:${p.color}"></div>
                </div>
                <div class="project-stats">
                    <div class="project-stat-item">${icon('list')} ${projectTasks.length} задач</div>
                    <div class="project-stat-item">${icon('check')} ${done} готово</div>
                    <div class="project-stat-item">${icon('zap')} ${active} активных</div>
                    ${p.deadline ? `<div class="project-stat-item" style="color:${isOverdue ? 'var(--danger)' : 'inherit'}">${icon('calendar')} ${formatDate(p.deadline)}</div>` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    c.innerHTML = html;
}

// ============ TAGS VIEW ============
export function renderTags(c) {
    if (state.tags.length === 0) {
        c.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${icon('tag')}</div>
                <h3>Нет тегов</h3>
                <p>Теги помогают организовать задачи по любым категориям.</p>
                <button class="empty-state-action" data-action="openTagModal">＋ Создать тег</button>
            </div>
        `;
        return;
    }
    let html = '<div class="tags-list">';
    state.tags.forEach(tag => {
        const count = state.tasks.filter(t => t.tags && t.tags.includes(tag.name) && t.list !== 'trash').length;
        html += `
            <div class="tag-card" data-action="openTag" data-id="${tag.id}">
                <div class="tag-card-color" style="background:${tag.color}"></div>
                <div class="tag-card-name">#${escapeHtml(tag.name)}</div>
                <div class="tag-card-count">${count}</div>
                <button class="task-action-btn delete" data-action="deleteTag" data-id="${tag.id}" style="opacity:1" aria-label="Удалить тег">${icon('trash')}</button>
            </div>
        `;
    });
    html += '</div>';
    c.innerHTML = html;
}

// ============ CALENDAR VIEW ============
export function renderCalendar(c) {
    const [year, month] = state.calendarDate.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = (firstDay.getDay() + 6) % 7; // Mon = 0

    const today = todayStr();
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

    let html = `
        <div class="calendar-view">
            <div class="calendar-grid">
                <div class="calendar-nav">
                    <button class="toolbar-icon-btn" data-action="changeMonth" data-arg="-1">◀</button>
                    <div class="calendar-month-title">${monthNames[month-1]} ${year}</div>
                    <div style="display:flex;gap:4px">
                        <button class="toolbar-btn" data-action="goToToday" style="padding:5px 10px;font-size:11px">Сегодня</button>
                        <button class="toolbar-icon-btn" data-action="changeMonth" data-arg="1">▶</button>
                    </div>
                </div>
                <div class="calendar-weekdays">
                    ${weekdays.map(w => `<div class="calendar-weekday">${w}</div>`).join('')}
                </div>
                <div class="calendar-days">
    `;

    // Previous month days
    for (let i = 0; i < startWeekday; i++) {
        const d = new Date(year, month - 1, -startWeekday + i + 1);
        const ds = d.toISOString().split('T')[0];
        const dayTasks = state.tasks.filter(t => t.date === ds && t.list !== 'trash');
        html += renderCalendarDay(d.getDate(), ds, dayTasks, true);
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
        const ds = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dayTasks = state.tasks.filter(t => t.date === ds && t.list !== 'trash');
        html += renderCalendarDay(day, ds, dayTasks, false, ds === today);
    }

    // Next month days
    const totalCells = startWeekday + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month, i);
        const ds = d.toISOString().split('T')[0];
        const dayTasks = state.tasks.filter(t => t.date === ds && t.list !== 'trash');
        html += renderCalendarDay(i, ds, dayTasks, true);
    }

    html += `</div></div>`;

    // Selected day tasks
    const todayTasks = state.tasks.filter(t => t.date === today && t.list !== 'trash');
    if (todayTasks.length > 0) {
        html += `
            <div>
                <h3 style="font-size:14px;font-weight:700;margin-bottom:10px;color:var(--accent)">${icon('calendar')} Сегодня · ${formatDate(today)}</h3>
                <div class="task-list">${todayTasks.map(t => renderTaskItem(t)).join('')}</div>
            </div>
        `;
    }

    html += '</div>';
    c.innerHTML = html;
}

export function renderCalendarDay(day, ds, tasks, otherMonth, isToday) {
    let cls = 'calendar-day';
    if (otherMonth) cls += ' other-month';
    if (isToday) cls += ' today';
    return `
        <div class="${cls}" data-action="filterCalendarDay" data-arg="${ds}">
            <div class="calendar-day-num">${day}</div>
            <div class="calendar-day-tasks">
                ${tasks.slice(0, 3).map(t => `<div class="calendar-day-task" style="background:${t.completed ? 'var(--bg-elev-2)' : 'var(--accent-bg)'}">${escapeHtml(t.title)}</div>`).join('')}
                ${tasks.length > 3 ? `<div class="calendar-day-more">+${tasks.length - 3} ещё</div>` : ''}
            </div>
        </div>
    `;
}

export function changeMonth(dir) {
    const [y, m] = state.calendarDate.split('-').map(Number);
    let newM = m + dir, newY = y;
    if (newM > 12) { newM = 1; newY++; }
    if (newM < 1) { newM = 12; newY--; }
    state.calendarDate = `${newY}-${String(newM).padStart(2,'0')}`;
    render();
}

export function goToToday() {
    state.calendarDate = todayStr().substring(0, 7);
    render();
}

export function filterCalendarDay(ds) {
    // Could open detail of that day's tasks
    const tasks = state.tasks.filter(t => t.date === ds && t.list !== 'trash');
    if (tasks.length === 1) {
        openDetail(tasks[0].id);
    } else if (tasks.length > 0) {
        toast(`${tasks.length} задач на ${formatDate(ds)}`);
    }
}

// ============ KANBAN ============
export function renderKanban(c, tasks) {
    const columns = [
        { id: 'todo', title: 'К выполнению', color: 'var(--text-3)', filter: t => !t.completed && !t.priority },
        { id: 'priority', title: 'Приоритет', color: 'var(--danger)', filter: t => !t.completed && t.priority === 'high' },
        { id: 'progress', title: 'В работе', color: 'var(--warning)', filter: t => !t.completed && t.priority === 'medium' },
        { id: 'done', title: 'Готово', color: 'var(--success)', filter: t => t.completed }
    ];

    let html = '<div class="kanban-board">';
    columns.forEach(col => {
        const colTasks = tasks.filter(col.filter);
        html += `
            <div class="kanban-column" data-col="${col.id}">
                <div class="kanban-column-header">
                    <div class="kanban-column-title">
                        <span class="kanban-column-dot" style="background:${col.color}"></span>
                        ${col.title}
                    </div>
                    <div class="kanban-column-count">${colTasks.length}</div>
                </div>
                <div class="kanban-column-body">
                    ${colTasks.map(t => `
                        <div class="kanban-card" draggable="true" data-id="${t.id}"
                             data-action="openDetail">
                            <div class="kanban-card-title">${escapeHtml(t.title)}</div>
                            <div class="kanban-card-meta">
                                ${t.context ? `<span class="task-badge context">${escapeHtml(t.context)}</span>` : ''}
                                ${t.date ? `<span class="task-badge date">${formatDate(t.date)}</span>` : ''}
                                ${t.energy ? `<span class="task-badge energy-${t.energy}">${t.energy}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    html += '</div>';
    c.innerHTML = html;
}

// ============ DRAG & DROP (delegated, set up once) ============
let draggedTaskId = null;

export function initDnD() {
    document.addEventListener('dragstart', (e) => {
        const el = e.target.closest('.task-item, .kanban-card');
        if (!el) return;
        draggedTaskId = el.dataset.id;
        el.classList.add('dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    document.addEventListener('dragend', (e) => {
        const el = e.target.closest('.task-item, .kanban-card');
        if (el) el.classList.remove('dragging');
        $$('.kanban-column.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
    document.addEventListener('dragover', (e) => {
        const col = e.target.closest('.kanban-column');
        if (!col) return;
        e.preventDefault();
        col.classList.add('drag-over');
    });
    document.addEventListener('dragleave', (e) => {
        const col = e.target.closest('.kanban-column');
        if (col) col.classList.remove('drag-over');
    });
    document.addEventListener('drop', (e) => {
        const col = e.target.closest('.kanban-column');
        if (!col) return;
        e.preventDefault();
        col.classList.remove('drag-over');
        handleKanbanDrop(col.dataset.col);
    });
}

function handleKanbanDrop(colId) {
    if (!draggedTaskId) return;
    const task = state.tasks.find(t => t.id === draggedTaskId);
    if (!task) return;
    if (colId === 'done') {
        task.completed = true;
        task.completedAt = new Date().toISOString();
        addActivity(task, 'completed');
    } else if (colId === 'priority') {
        task.priority = 'high';
        task.completed = false;
        addActivity(task, 'priority set to high');
    } else if (colId === 'progress') {
        task.priority = 'medium';
        task.completed = false;
        addActivity(task, 'priority set to medium');
    } else {
        task.priority = '';
        task.completed = false;
        addActivity(task, 'moved to todo');
    }
    task.updatedAt = new Date().toISOString();
    save();
    render();
    toast('Карточка перемещена', 'success');
}
