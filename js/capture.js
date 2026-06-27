'use strict';

// ============ CAPTURE / PROCESS / REVIEW / PROJECT & TAG MODALS / SHORTCUTS ============
import { state, $, escapeHtml, todayStr, toast, generateId, PROJECT_COLORS, TAG_COLORS, icon } from './core.js';
import { save } from './storage.js';
import { render, switchView } from './render.js';
import { createTask, parseQuickInput, addActivity } from './model.js';

// ============ CAPTURE ============
export function openCapture() {
    $('#captureModal').classList.add('active');
    $('#captureInput').value = '';
    $('#captureNotes').value = '';
    renderCaptureSuggestions();
    setTimeout(() => $('#captureInput').focus(), 50);
}

export function closeCapture() {
    $('#captureModal').classList.remove('active');
}

export function renderCaptureSuggestions() {
    const suggestions = ['~сегодня', '~завтра', '!1', '!2', '@дом', '@офис', '@компьютер', '@телефон'];
    $('#captureSuggestions').innerHTML = suggestions.map(s =>
        `<span class="capture-suggestion" data-action="insertCaptureText" data-arg="${s}">${s}</span>`
    ).join('');
}

export function insertCaptureText(text) {
    const input = $('#captureInput');
    input.value = (input.value + ' ' + text).trim();
    input.focus();
}

export function saveCaptureAndClose() {
    const input = $('#captureInput').value.trim();
    if (!input) {
        $('#captureInput').focus();
        return;
    }
    const parsed = parseQuickInput(input);
    parsed.tags.forEach(name => {
        if (!state.tags.find(t => t.name === name)) {
            state.tags.push({ id: generateId(), name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] });
        }
    });
    const task = createTask({
        title: parsed.title,
        notes: $('#captureNotes').value,
        list: 'inbox',
        context: parsed.context,
        priority: parsed.priority,
        tags: parsed.tags,
        date: parsed.date
    });
    state.tasks.unshift(task);
    save();
    closeCapture();
    render();
    toast('Добавлено во входящие', 'success');
}

export function quickAddInList() {
    const input = document.getElementById('inlineAddInput');
    if (input) {
        input.focus();
    } else {
        openCapture();
    }
}

// ============ PROCESSING WIZARD ============
export function startProcess() {
    state.processQueue = state.tasks.filter(t => t.list === 'inbox');
    if (state.processQueue.length === 0) {
        toast('Входящие пусты!');
        return;
    }
    state.processingIndex = 0;
    $('#processModal').classList.add('active');
    renderProcessStep();
}

export function closeProcess() {
    $('#processModal').classList.remove('active');
    render();
}

export function renderProcessStep() {
    if (state.processingIndex >= state.processQueue.length) {
        $('#processBody').innerHTML = `
            <div class="process-step">
                <div style="font-size:64px;margin-bottom:16px">${icon('party')}</div>
                <h3 style="font-size:20px;font-weight:700;margin-bottom:8px">Готово!</h3>
                <p style="color:var(--text-3);margin-bottom:20px">Все входящие обработаны. Ваша голова свободна для творческой работы.</p>
                <button class="toolbar-btn primary" data-action="closeProcess" style="padding:10px 24px">Отлично!</button>
            </div>
        `;
        return;
    }
    const task = state.processQueue[state.processingIndex];
    $('#processBody').innerHTML = `
        <div class="process-progress">Элемент ${state.processingIndex + 1} из ${state.processQueue.length}</div>
        <div class="process-task-card">
            <div class="process-task-title">${escapeHtml(task.title)}</div>
            ${task.notes ? `<div class="process-task-notes">${escapeHtml(task.notes)}</div>` : ''}
        </div>
        <div class="process-question">
            <h3>${icon('help')} Что это такое?</h3>
            <p>С этим можно что-то сделать?</p>
        </div>
        <div class="process-options">
            <button class="process-option" data-action="processActionable" data-arg="true">
                <div class="process-option-icon">${icon('check-circle')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Да, требует действия</div>
                    <div class="process-option-desc">Это требует конкретного физического действия</div>
                </div>
            </button>
            <button class="process-option" data-action="processActionable" data-arg="false">
                <div class="process-option-icon">${icon('x')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Нет, действий не требует</div>
                    <div class="process-option-desc">Это информация, идея или мусор</div>
                </div>
            </button>
        </div>
        <div class="process-hint">
            <strong>GTD подсказка:</strong> Если не можете сформулировать конкретное физическое действие — значит действий не требуется.
        </div>
    `;
}

export function processActionable(yes) {
    const task = state.processQueue[state.processingIndex];
    if (!yes) {
        $('#processBody').innerHTML = `
            <div class="process-progress">Элемент ${state.processingIndex + 1} из ${state.processQueue.length}</div>
            <div class="process-task-card"><div class="process-task-title">${escapeHtml(task.title)}</div></div>
            <div class="process-question"><h3>${icon('package')} Куда отправить?</h3></div>
            <div class="process-options">
                <button class="process-option" data-action="processDispose" data-list="trash">
                    <div class="process-option-icon">${icon('trash')}</div>
                    <div class="process-option-content">
                        <div class="process-option-title">Мусор</div>
                        <div class="process-option-desc">Это не нужно</div>
                    </div>
                </button>
                <button class="process-option" data-action="processDispose" data-list="someday">
                    <div class="process-option-icon">${icon('cloud')}</div>
                    <div class="process-option-content">
                        <div class="process-option-title">Когда-нибудь / Может быть</div>
                        <div class="process-option-desc">Интересная идея, но не сейчас</div>
                    </div>
                </button>
                <button class="process-option" data-action="processDispose" data-list="reference">
                    <div class="process-option-icon">${icon('book')}</div>
                    <div class="process-option-content">
                        <div class="process-option-title">Справочные материалы</div>
                        <div class="process-option-desc">Полезная информация на будущее</div>
                    </div>
                </button>
            </div>
        `;
        return;
    }
    // Actionable - check 2-min rule
    $('#processBody').innerHTML = `
        <div class="process-progress">Элемент ${state.processingIndex + 1} из ${state.processQueue.length}</div>
        <div class="process-task-card"><div class="process-task-title">${escapeHtml(task.title)}</div></div>
        <div class="process-question">
            <h3>${icon('clock')} Займет менее 2 минут?</h3>
            <p>Правило 2 минут: если можно сделать быстро — делайте сейчас!</p>
        </div>
        <div class="process-options">
            <button class="process-option" data-action="processDispose" data-list="done">
                <div class="process-option-icon">${icon('rocket')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Да — делаю сейчас</div>
                    <div class="process-option-desc">Выполню и отмечу как сделано</div>
                </div>
            </button>
            <button class="process-option" data-action="processChooseAction">
                <div class="process-option-icon">${icon('clock')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Нет, больше 2 минут</div>
                    <div class="process-option-desc">Делегировать, запланировать или отложить</div>
                </div>
            </button>
        </div>
    `;
}

export function processChooseAction() {
    const task = state.processQueue[state.processingIndex];
    $('#processBody').innerHTML = `
        <div class="process-progress">Элемент ${state.processingIndex + 1} из ${state.processQueue.length}</div>
        <div class="process-task-card"><div class="process-task-title">${escapeHtml(task.title)}</div></div>
        <div class="process-question"><h3>${icon('target')} Что с этим делать?</h3></div>
        <div class="process-options">
            <button class="process-option" data-action="processDispose" data-list="next">
                <div class="process-option-icon">${icon('zap')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Выполню сам</div>
                    <div class="process-option-desc">→ Следующие действия</div>
                </div>
            </button>
            <button class="process-option" data-action="processDispose" data-list="waiting">
                <div class="process-option-icon">${icon('clock')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Перепоручить</div>
                    <div class="process-option-desc">→ Ожидания</div>
                </div>
            </button>
            <button class="process-option" data-action="processDispose" data-list="calendar">
                <div class="process-option-icon">${icon('calendar')}</div>
                <div class="process-option-content">
                    <div class="process-option-title">Запланировать</div>
                    <div class="process-option-desc">→ Календарь, конкретная дата</div>
                </div>
            </button>
        </div>
    `;
}

export function processDispose(list) {
    const task = state.processQueue[state.processingIndex];
    task.list = list;
    if (list === 'done') {
        task.completed = true;
        task.completedAt = new Date().toISOString();
        addActivity(task, 'completed (2-min rule)');
        toast('Готово за 2 минуты!', 'success');
        state.processingIndex++;
        save();
        renderProcessStep();
        return;
    }
    if (list === 'waiting') {
        $('#processBody').innerHTML = `
            <div class="process-progress">Элемент ${state.processingIndex + 1} из ${state.processQueue.length}</div>
            <div class="process-task-card"><div class="process-task-title">${escapeHtml(task.title)}</div></div>
            <div class="process-question"><h3>${icon('user')} Кому поручили?</h3></div>
            <input type="text" id="processWaitingInput" class="capture-input" placeholder="Имя человека" autofocus data-action="finishProcess" data-on="enter">
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                <button class="toolbar-btn primary" data-action="finishProcess">Продолжить</button>
            </div>
        `;
        setTimeout(() => $('#processWaitingInput').focus(), 50);
        return;
    }
    if (list === 'calendar') {
        $('#processBody').innerHTML = `
            <div class="process-progress">Элемент ${state.processingIndex + 1} из ${state.processQueue.length}</div>
            <div class="process-task-card"><div class="process-task-title">${escapeHtml(task.title)}</div></div>
            <div class="process-question"><h3>${icon('calendar')} На какую дату?</h3></div>
            <input type="date" id="processDateInput" class="capture-input" value="${todayStr()}">
            <input type="time" id="processTimeInput" class="capture-input" placeholder="Время (необязательно)">
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                <button class="toolbar-btn primary" data-action="finishProcess">Запланировать</button>
            </div>
        `;
        return;
    }
    finishProcess();
}

export function finishProcess() {
    const task = state.processQueue[state.processingIndex];
    const wInput = $('#processWaitingInput');
    if (wInput) task.waitingFor = wInput.value.trim();
    const dInput = $('#processDateInput');
    if (dInput) task.date = dInput.value;
    const tInput = $('#processTimeInput');
    if (tInput) task.time = tInput.value;
    addActivity(task, `processed → ${task.list}`);
    task.updatedAt = new Date().toISOString();
    save();
    const names = { next: 'Следующие', waiting: 'Ожидания', calendar: 'Календарь', someday: 'Когда-нибудь', reference: 'Справочные', trash: 'Корзина' };
    toast(`→ ${names[task.list] || task.list}`, 'success');
    state.processingIndex++;
    renderProcessStep();
}

// ============ REVIEW ============
export function openReview() {
    const week = getWeekKey();
    if (!state.reviewProgress[week]) state.reviewProgress[week] = {};
    const progress = state.reviewProgress[week];

    const items = [
        { id: 'inbox', title: `${icon('inbox')} Очистить входящие`, desc: 'Обработать все элементы во входящих до нуля' },
        { id: 'actions', title: `${icon('zap')} Просмотреть списки действий`, desc: 'Проверить следующие действия, контексты, проекты' },
        { id: 'calendar', title: `${icon('calendar')} Просмотреть календарь`, desc: 'Прошедшие и предстоящие 2 недели' },
        { id: 'waiting', title: `${icon('clock')} Проверить ожидания`, desc: 'Что еще ждем? Нужно ли напомнить?' },
        { id: 'projects', title: `${icon('folder')} Просмотреть проекты`, desc: 'Каждый проект имеет следующее действие?' },
        { id: 'someday', title: `${icon('cloud')} Просмотреть "Когда-нибудь"`, desc: 'Что-то стало актуальным? Активировать?' },
        { id: 'goals', title: `${icon('target')} Цели и приоритеты`, desc: 'Какие у меня цели на эту неделю?' },
        { id: 'creative', title: `${icon('lightbulb')} Креативное мышление`, desc: 'Любые новые идеи, мысли, направления?' }
    ];

    let html = `<p style="font-size:13px;color:var(--text-3);margin-bottom:16px">Еженедельный обзор — основа методологии GTD. Уделите ему 30-60 минут.</p><ul class="review-checklist">`;
    items.forEach(item => {
        const done = progress[item.id];
        html += `
            <li class="review-item ${done ? 'done' : ''}" data-action="toggleReviewItem" data-id="${item.id}">
                <div class="review-item-check"></div>
                <div>
                    <div class="review-item-title">${item.title}</div>
                    <div class="review-item-desc">${item.desc}</div>
                </div>
            </li>
        `;
    });
    html += '</ul>';

    const completedCount = Object.values(progress).filter(v => v).length;
    if (completedCount === items.length) {
        html += `<div style="margin-top:16px;padding:14px;background:rgba(34,197,94,0.1);border:1px solid var(--success);border-radius:8px;text-align:center;color:var(--success);font-weight:600">${icon('party')} Еженедельный обзор завершен!</div>`;
    }

    $('#reviewBody').innerHTML = html;
    $('#reviewModal').classList.add('active');
}

export function toggleReviewItem(id) {
    const week = getWeekKey();
    if (!state.reviewProgress[week]) state.reviewProgress[week] = {};
    state.reviewProgress[week][id] = !state.reviewProgress[week][id];
    save();
    openReview();
}

export function getWeekKey() {
    const d = new Date();
    const year = d.getFullYear();
    const start = new Date(year, 0, 1);
    const days = Math.floor((d - start) / 86400000);
    const week = Math.ceil((days + start.getDay() + 1) / 7);
    return `${year}-W${week}`;
}

export function closeReview() {
    $('#reviewModal').classList.remove('active');
}

// ============ PROJECTS MODAL ============
export function openProjectModal() {
    state.editingProjectId = null;
    $('#projectModalTitle').innerHTML = `${icon('folder')} Новый проект`;
    $('#projectNameInput').value = '';
    $('#projectDescInput').value = '';
    $('#projectDeadline').value = '';
    renderProjectColorPicker(PROJECT_COLORS[0]);
    $('#projectModal').classList.add('active');
    setTimeout(() => $('#projectNameInput').focus(), 50);
}

export function renderProjectColorPicker(selected) {
    $('#projectColorPicker').innerHTML = PROJECT_COLORS.map(c =>
        `<div data-action="selectProjectColor" data-color="${c}" style="width:24px;height:24px;border-radius:6px;background:${c};cursor:pointer;border:2px solid ${c === selected ? 'white' : 'transparent'}"></div>`
    ).join('');
    $('#projectColorPicker').dataset.selected = selected;
}

export function selectProjectColor(c) {
    renderProjectColorPicker(c);
}

export function editProject(id) {
    const p = state.projects.find(p => p.id === id);
    if (!p) return;
    state.editingProjectId = id;
    $('#projectModalTitle').innerHTML = `${icon('edit')} Редактирование проекта`;
    $('#projectNameInput').value = p.title;
    $('#projectDescInput').value = p.description || '';
    $('#projectDeadline').value = p.deadline || '';
    renderProjectColorPicker(p.color || PROJECT_COLORS[0]);
    $('#projectModal').classList.add('active');
}

export function closeProjectModal() {
    $('#projectModal').classList.remove('active');
}

export function saveProject() {
    const title = $('#projectNameInput').value.trim();
    if (!title) {
        $('#projectNameInput').focus();
        return;
    }
    const data = {
        title,
        description: $('#projectDescInput').value.trim(),
        color: $('#projectColorPicker').dataset.selected,
        deadline: $('#projectDeadline').value
    };
    if (state.editingProjectId) {
        const p = state.projects.find(p => p.id === state.editingProjectId);
        if (p) Object.assign(p, data);
        toast('Проект обновлен', 'success');
    } else {
        state.projects.push({ id: generateId(), ...data, createdAt: new Date().toISOString() });
        toast('Проект создан', 'success');
    }
    save();
    closeProjectModal();
    render();
}

export function deleteProject(id) {
    if (!confirm('Удалить проект? Задачи останутся, но потеряют связь с проектом.')) return;
    state.projects = state.projects.filter(p => p.id !== id);
    state.tasks.forEach(t => {
        if (t.projectId === id) t.projectId = null;
    });
    save();
    if (state.currentProjectId === id) switchView('projects');
    else render();
    toast('Проект удален', 'success');
}

// ============ TAGS MODAL ============
export function openTagModal() {
    $('#tagNameInput').value = '';
    renderTagColorPicker(TAG_COLORS[0]);
    $('#tagModal').classList.add('active');
    setTimeout(() => $('#tagNameInput').focus(), 50);
}

export function renderTagColorPicker(selected) {
    $('#tagColorPicker').innerHTML = TAG_COLORS.map(c =>
        `<div data-action="selectTagColor" data-color="${c}" style="width:24px;height:24px;border-radius:6px;background:${c};cursor:pointer;border:2px solid ${c === selected ? 'white' : 'transparent'}"></div>`
    ).join('');
    $('#tagColorPicker').dataset.selected = selected;
}

export function selectTagColor(c) {
    renderTagColorPicker(c);
}

export function closeTagModal() {
    $('#tagModal').classList.remove('active');
}

export function saveTag() {
    const name = $('#tagNameInput').value.trim();
    if (!name) return;
    if (state.tags.find(t => t.name === name)) {
        toast('Тег уже существует', 'error');
        return;
    }
    state.tags.push({
        id: generateId(),
        name,
        color: $('#tagColorPicker').dataset.selected
    });
    save();
    closeTagModal();
    render();
    toast('Тег создан', 'success');
}

export function deleteTag(id, e) {
    if (e) e.stopPropagation();
    const tag = state.tags.find(t => t.id === id);
    if (!tag) return;
    if (!confirm(`Удалить тег #${tag.name}?`)) return;
    state.tags = state.tags.filter(t => t.id !== id);
    state.tasks.forEach(t => {
        if (t.tags) t.tags = t.tags.filter(n => n !== tag.name);
    });
    save();
    render();
    toast('Тег удален', 'success');
}

// ============ SHORTCUTS ============
export function openShortcuts() {
    $('#shortcutsModal').classList.add('active');
}

export function closeShortcuts() {
    $('#shortcutsModal').classList.remove('active');
}
