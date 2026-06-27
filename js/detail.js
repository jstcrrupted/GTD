'use strict';

// ============ DETAIL PANEL ============
import { state, $, escapeHtml, formatDateTime, icon, levelDot } from './core.js';
import { save } from './storage.js';
import { render, renderContent } from './render.js';

export function openDetail(id, e) {
    if (e) e.stopPropagation();
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    state.selectedTaskId = id;
    $('#detailTitle').value = task.title;
    renderDetailBody(task);
    $('#detailPanel').classList.add('open');
    render();
}

export function closeDetail() {
    $('#detailPanel').classList.remove('open');
    state.selectedTaskId = null;
}

export function updateDetailTitle(e) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    task.title = e.target.value;
    task.updatedAt = new Date().toISOString();
    save();
    renderContent();
}

export function renderDetailBody(task) {
    const projectOptions = ['<option value="">Без проекта</option>',
        ...state.projects.map(p => `<option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>`)].join('');

    const html = `
        <div class="detail-field">
            <div class="detail-field-label">${icon('note')} Заметки</div>
            <textarea class="detail-textarea" id="dNotes" data-action="updateTaskField" data-field="notes" data-on="change">${escapeHtml(task.notes)}</textarea>
        </div>

        <div class="detail-field">
            <div class="detail-field-label">${icon('list')} Подзадачи (${(task.subtasks||[]).filter(s=>s.done).length}/${(task.subtasks||[]).length})</div>
            <div class="detail-subtasks">
                ${(task.subtasks || []).map((s, i) => `
                    <div class="subtask-item ${s.done ? 'done' : ''}">
                        <div class="subtask-check ${s.done ? 'checked' : ''}" data-action="toggleSubtask" data-index="${i}"></div>
                        <input type="text" class="subtask-text" value="${escapeHtml(s.text)}" data-action="updateSubtask" data-index="${i}" data-on="change">
                        <button class="subtask-delete" data-action="deleteSubtask" data-index="${i}" aria-label="Удалить подзадачу">${icon('x')}</button>
                    </div>
                `).join('')}
                <div class="subtask-add">
                    <div class="subtask-check"></div>
                    <input type="text" placeholder="Добавить подзадачу..." data-action="addSubtask" data-on="enter">
                </div>
            </div>
        </div>

        <div class="detail-row">
            <div class="detail-field">
                <div class="detail-field-label">${icon('folder')} Список</div>
                <select class="detail-select" data-action="updateTaskField" data-field="list" data-on="change">
                    <option value="inbox" ${task.list === 'inbox' ? 'selected' : ''}>Входящие</option>
                    <option value="next" ${task.list === 'next' ? 'selected' : ''}>Следующие</option>
                    <option value="waiting" ${task.list === 'waiting' ? 'selected' : ''}>Ожидания</option>
                    <option value="calendar" ${task.list === 'calendar' ? 'selected' : ''}>Календарь</option>
                    <option value="someday" ${task.list === 'someday' ? 'selected' : ''}>Когда-нибудь</option>
                    <option value="reference" ${task.list === 'reference' ? 'selected' : ''}>Справочные</option>
                </select>
            </div>
            <div class="detail-field">
                <div class="detail-field-label">${icon('folder')} Проект</div>
                <select class="detail-select" data-action="updateTaskField" data-field="projectId" data-on="change">${projectOptions}</select>
            </div>
        </div>

        <div class="detail-row">
            <div class="detail-field">
                <div class="detail-field-label">${icon('calendar')} Дата</div>
                <input type="date" class="detail-input" value="${task.date || ''}" data-action="updateTaskField" data-field="date" data-on="change">
            </div>
            <div class="detail-field">
                <div class="detail-field-label">${icon('clock')} Время</div>
                <input type="time" class="detail-input" value="${task.time || ''}" data-action="updateTaskField" data-field="time" data-on="change">
            </div>
        </div>

        <div class="detail-row">
            <div class="detail-field">
                <div class="detail-field-label">${icon('target')} Приоритет ${task.priority ? levelDot(task.priority) : ''}</div>
                <select class="detail-select" data-action="updateTaskField" data-field="priority" data-on="change">
                    <option value="" ${!task.priority ? 'selected' : ''}>Без приоритета</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>Высокий</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Средний</option>
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Низкий</option>
                </select>
            </div>
            <div class="detail-field">
                <div class="detail-field-label">${icon('zap')} Энергия ${task.energy ? levelDot(task.energy) : ''}</div>
                <select class="detail-select" data-action="updateTaskField" data-field="energy" data-on="change">
                    <option value="" ${!task.energy ? 'selected' : ''}>Не указана</option>
                    <option value="high" ${task.energy === 'high' ? 'selected' : ''}>Высокая</option>
                    <option value="medium" ${task.energy === 'medium' ? 'selected' : ''}>Средняя</option>
                    <option value="low" ${task.energy === 'low' ? 'selected' : ''}>Низкая</option>
                </select>
            </div>
        </div>

        <div class="detail-row">
            <div class="detail-field">
                <div class="detail-field-label">${icon('map-pin')} Контекст</div>
                <input type="text" class="detail-input" value="${escapeHtml(task.context)}" placeholder="@дом, @офис..." data-action="updateTaskField" data-field="context" data-on="change">
            </div>
            <div class="detail-field">
                <div class="detail-field-label">${icon('clock')} Время</div>
                <input type="text" class="detail-input" value="${escapeHtml(task.timeEstimate)}" placeholder="15 мин, 1 час..." data-action="updateTaskField" data-field="timeEstimate" data-on="change">
            </div>
        </div>

        ${task.list === 'waiting' ? `
            <div class="detail-field">
                <div class="detail-field-label">${icon('user')} Ожидаю от</div>
                <input type="text" class="detail-input" value="${escapeHtml(task.waitingFor)}" placeholder="Имя человека" data-action="updateTaskField" data-field="waitingFor" data-on="change">
            </div>
        ` : ''}

        <div class="detail-field">
            <div class="detail-field-label">${icon('tag')} Теги</div>
            <div class="detail-tags">
                ${(task.tags || []).map(tag => `
                    <div class="detail-tag">
                        #${escapeHtml(tag)}
                        <span class="detail-tag-remove" data-action="removeTag" data-tag="${escapeHtml(tag)}">×</span>
                    </div>
                `).join('')}
                <input type="text" class="detail-tag-input" placeholder="+ тег" data-action="addTag" data-on="enter-comma">
            </div>
        </div>

        <div class="detail-field">
            <div class="detail-field-label">${icon('activity')} Активность</div>
            <div class="detail-activity">
                ${(task.activity || []).slice(0, 5).map(a => `
                    <div class="detail-activity-item">
                        <span style="color:var(--text-2)">${a.action}</span> · ${formatDateTime(a.at)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    $('#detailBody').innerHTML = html;
}
