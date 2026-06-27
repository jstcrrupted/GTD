'use strict';

// ============ MODEL: task creation, parsing, mutations ============
import { state, generateId, todayStr, tomorrowStr, toast, TAG_COLORS } from './core.js';
import { save } from './storage.js';
import { render, renderContent, renderSidebar } from './render.js';
import { closeDetail, renderDetailBody } from './detail.js';

export function createTask(data = {}) {
    return {
        id: generateId(),
        title: data.title || '',
        notes: data.notes || '',
        list: data.list || 'inbox',
        projectId: data.projectId || null,
        context: data.context || '',
        energy: data.energy || '',
        priority: data.priority || '',
        timeEstimate: data.timeEstimate || '',
        date: data.date || '',
        time: data.time || '',
        waitingFor: data.waitingFor || '',
        tags: data.tags || [],
        subtasks: data.subtasks || [],
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activity: [{ at: new Date().toISOString(), action: 'created' }]
    };
}

export function addActivity(task, action) {
    if (!task.activity) task.activity = [];
    task.activity.unshift({ at: new Date().toISOString(), action });
    if (task.activity.length > 20) task.activity = task.activity.slice(0, 20);
}

// ============ PARSE QUICK INPUT ============
export function parseQuickInput(input) {
    const result = { title: input, context: '', priority: '', tags: [], date: '' };
    // Priority !1 !2 !3
    const pMatch = input.match(/\s!([123])\b/);
    if (pMatch) {
        result.priority = { '1': 'high', '2': 'medium', '3': 'low' }[pMatch[1]];
        result.title = result.title.replace(pMatch[0], '');
    }
    // Context @context
    const ctxMatch = input.match(/(@\S+)/);
    if (ctxMatch) {
        result.context = ctxMatch[1];
        result.title = result.title.replace(ctxMatch[0], '');
    }
    // Tags #tag
    const tagMatches = input.match(/#(\S+)/g);
    if (tagMatches) {
        result.tags = tagMatches.map(t => t.substring(1));
        tagMatches.forEach(t => result.title = result.title.replace(t, ''));
    }
    // Date ~today, ~tomorrow, ~YYYY-MM-DD
    const dateMatch = input.match(/~(\S+)/);
    if (dateMatch) {
        const v = dateMatch[1].toLowerCase();
        if (v === 'today' || v === 'сегодня') result.date = todayStr();
        else if (v === 'tomorrow' || v === 'завтра') result.date = tomorrowStr();
        else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) result.date = v;
        result.title = result.title.replace(dateMatch[0], '');
    }
    result.title = result.title.trim().replace(/\s+/g, ' ');
    return result;
}

// ============ TASK OPERATIONS ============
export function handleInlineAdd(e) {
    if (e.key === 'Enter') {
        const input = e.target;
        const val = input.value.trim();
        if (!val) return;
        const parsed = parseQuickInput(val);
        const view = state.currentView;
        let list = view;
        let projectId = null;
        let tagsToUse = parsed.tags;

        if (view === 'today') {
            list = 'next';
            parsed.date = parsed.date || todayStr();
        }
        if (view === 'project') {
            list = 'next';
            projectId = state.currentProjectId;
        }
        if (view === 'tag') {
            list = 'next';
            const tag = state.tags.find(t => t.id === state.currentTagId);
            if (tag) tagsToUse = [...tagsToUse, tag.name];
        }

        // Add tags that don't exist
        tagsToUse.forEach(name => {
            if (!state.tags.find(t => t.name === name)) {
                state.tags.push({ id: generateId(), name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] });
            }
        });

        const task = createTask({
            title: parsed.title,
            list,
            context: parsed.context,
            priority: parsed.priority,
            tags: tagsToUse,
            date: parsed.date,
            projectId
        });
        state.tasks.unshift(task);
        save();
        input.value = '';
        render();
        toast('Задача добавлена', 'success');
    }
}

export function toggleComplete(id, e) {
    if (e) e.stopPropagation();
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    if (task.completed) {
        task.completedAt = new Date().toISOString();
        addActivity(task, 'completed');
        // Move to done if not in done already
        if (task.list !== 'done') {
            task.originalList = task.list;
            task.list = 'done';
        }
        toast('Задача выполнена!', 'success');
    } else {
        task.completedAt = null;
        addActivity(task, 'uncompleted');
        if (task.originalList) {
            task.list = task.originalList;
            delete task.originalList;
        } else if (task.list === 'done') {
            task.list = 'next';
        }
        toast('Задача возвращена');
    }
    task.updatedAt = new Date().toISOString();
    save();
    render();
}

export function trashTask(id, e) {
    if (e) e.stopPropagation();
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    if (task.list === 'trash') {
        if (!confirm('Удалить навсегда?')) return;
        state.tasks = state.tasks.filter(t => t.id !== id);
        toast('Удалено навсегда', 'success');
    } else {
        task.list = 'trash';
        addActivity(task, 'moved to trash');
        toast('Перемещено в корзину');
    }
    save();
    render();
    if (state.selectedTaskId === id) closeDetail();
}

export function emptyTrash() {
    if (!confirm('Очистить корзину? Все элементы будут удалены навсегда.')) return;
    state.tasks = state.tasks.filter(t => t.list !== 'trash');
    save();
    render();
    toast('Корзина очищена', 'success');
}

export function updateTaskField(field, value) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    const old = task[field];
    if (field === 'projectId') value = value || null;
    task[field] = value;
    task.updatedAt = new Date().toISOString();
    if (old !== value) addActivity(task, `changed ${field}`);
    save();
    renderContent();
    renderSidebar();
}

export function toggleSubtask(i) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    task.subtasks[i].done = !task.subtasks[i].done;
    task.updatedAt = new Date().toISOString();
    save();
    renderDetailBody(task);
    renderContent();
}

export function updateSubtask(i, value) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    if (!value.trim()) {
        task.subtasks.splice(i, 1);
    } else {
        task.subtasks[i].text = value;
    }
    save();
    renderDetailBody(task);
}

export function addSubtask(text) {
    if (!text.trim()) return;
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({ text: text.trim(), done: false });
    save();
    renderDetailBody(task);
    renderContent();
}

export function deleteSubtask(i) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    task.subtasks.splice(i, 1);
    save();
    renderDetailBody(task);
    renderContent();
}

export function addTag(name) {
    if (!name.trim()) return;
    name = name.trim();
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    if (!task.tags) task.tags = [];
    if (task.tags.includes(name)) return;
    task.tags.push(name);
    if (!state.tags.find(t => t.name === name)) {
        state.tags.push({ id: generateId(), name, color: TAG_COLORS[state.tags.length % TAG_COLORS.length] });
    }
    save();
    renderDetailBody(task);
    renderContent();
    renderSidebar();
}

export function removeTag(name) {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    task.tags = (task.tags || []).filter(t => t !== name);
    save();
    renderDetailBody(task);
    renderContent();
}

export function duplicateTask() {
    const task = state.tasks.find(t => t.id === state.selectedTaskId);
    if (!task) return;
    const copy = createTask({...task, title: task.title + ' (копия)'});
    state.tasks.unshift(copy);
    save();
    render();
    toast('Задача продублирована', 'success');
}

export function deleteCurrentTask() {
    if (state.selectedTaskId) {
        trashTask(state.selectedTaskId);
    }
}

export function moveTaskTo(id, list) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.list = list;
        addActivity(task, `moved to ${list}`);
        task.updatedAt = new Date().toISOString();
        save();
        render();
        toast('Задача перемещена', 'success');
    }
}
