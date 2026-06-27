'use strict';

// ============ SETTINGS / DATA MANAGEMENT / SEARCH / PWA INSTALL ============
import { state, $, generateId, todayStr, tomorrowStr, toast } from './core.js';
import { createBackup, save, renderBackupList } from './storage.js';
import { render, renderContent } from './render.js';
import { createTask } from './model.js';

// ============ SETTINGS ============
export function openSettings() {
    $('#settingsModal').classList.add('active');
    renderBackupList();
}

export function closeSettings() {
    $('#settingsModal').classList.remove('active');
}

// ============ SEARCH ============
export function handleGlobalSearch(e) {
    state.searchQuery = e.target.value;
    renderContent();
}

// Exit search mode and return to the currently active view.
export function clearSearch() {
    state.searchQuery = '';
    const input = $('#globalSearch');
    if (input) input.value = '';
    renderContent();
}

// ============ EXPORT/IMPORT ============
export function exportData() {
    const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: state.tasks,
        projects: state.projects,
        tags: state.tags
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtd-pro-export-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Данные экспортированы', 'success');
}

export function importData() {
    $('#fileInput').click();
}

export function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            await createBackup('pre-import-json');
            if (!confirm('Импортировать? Текущие данные будут заменены.')) return;
            state.tasks = data.tasks || [];
            state.projects = data.projects || [];
            state.tags = data.tags || [];
            save();
            render();
            toast('Данные импортированы', 'success');
        } catch(err) {
            toast('Ошибка импорта: некорректный файл', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

export async function clearAllData() {
    if (!confirm('Удалить ВСЕ данные? Это действие необратимо!')) return;
    await createBackup('pre-clear');
    if (!confirm('Точно? Все задачи, проекты, теги будут удалены.')) return;
    state.tasks = [];
    state.projects = [];
    state.tags = [];
    state.reviewProgress = {};
    save();
    closeSettings();
    render();
    toast('Все данные удалены', 'success');
}

export async function loadDemoData() {
    if (state.tasks.length > 0 && !confirm('Это добавит демо-данные к существующим. Продолжить?')) return;
    await createBackup('pre-demo');
    seedDemoData();
    save();
    closeSettings();
    render();
    toast('Демо-данные загружены', 'success');
}

// ============ DEMO DATA ============
export function seedDemoData() {
    const p1 = { id: generateId(), title: 'Запуск нового продукта', description: 'Подготовить и запустить MVP к концу квартала', color: '#ec4899', deadline: '', createdAt: new Date().toISOString() };
    const p2 = { id: generateId(), title: 'Ремонт кухни', description: 'Полностью обновить кухню — мебель, техника, отделка', color: '#7c5cff', deadline: '', createdAt: new Date().toISOString() };
    const p3 = { id: generateId(), title: 'Изучение TypeScript', description: 'Освоить TS и переписать пет-проект', color: '#3b82f6', deadline: '', createdAt: new Date().toISOString() };
    state.projects.push(p1, p2, p3);

    const tag1 = { id: generateId(), name: 'работа', color: '#3b82f6' };
    const tag2 = { id: generateId(), name: 'личное', color: '#10b981' };
    const tag3 = { id: generateId(), name: 'важно', color: '#ef4444' };
    const tag4 = { id: generateId(), name: 'учеба', color: '#8b5cf6' };
    state.tags.push(tag1, tag2, tag3, tag4);

    const tasks = [
        { title: 'Идея: добавить темную тему в приложение', notes: 'Многие пользователи просят. Сделать через CSS переменные', list: 'inbox' },
        { title: 'Позвонить в банк по поводу карты', list: 'inbox', context: '@телефон' },
        { title: 'Прочитать статью про новые фичи React 19', list: 'inbox', notes: 'Ссылка в закладках' },
        { title: 'Подготовить презентацию для совещания', list: 'next', context: '@компьютер', energy: 'high', priority: 'high', projectId: p1.id, tags: ['работа', 'важно'], date: todayStr(), timeEstimate: '2 часа' },
        { title: 'Обновить README проекта', list: 'next', context: '@компьютер', energy: 'low', timeEstimate: '30 мин', projectId: p1.id, tags: ['работа'] },
        { title: 'Записаться к стоматологу', list: 'next', context: '@телефон', energy: 'low', priority: 'medium', tags: ['личное'] },
        { title: 'Купить продукты на неделю', list: 'next', context: '@магазин', date: tomorrowStr(), tags: ['личное'] },
        { title: 'Выбрать дизайн кухонного гарнитура', list: 'next', context: '@компьютер', energy: 'medium', projectId: p2.id, tags: ['личное'] },
        { title: 'Заказать материалы для ремонта', list: 'waiting', waitingFor: 'Прораб Сергей', projectId: p2.id, tags: ['личное'] },
        { title: 'Отзыв от клиента на демо', list: 'waiting', waitingFor: 'Анна (клиент)', tags: ['работа'] },
        { title: 'Встреча с командой по спринту', list: 'calendar', date: todayStr(), time: '14:00', context: '@офис', tags: ['работа'] },
        { title: 'День рождения мамы', list: 'calendar', date: tomorrowStr(), tags: ['личное', 'важно'] },
        { title: 'Курс по продвинутому TypeScript', list: 'calendar', date: '2024-12-30', projectId: p3.id, tags: ['учеба'] },
        { title: 'Выучить испанский язык', list: 'someday', notes: 'Возможно Duolingo + Italki' },
        { title: 'Путешествие в Японию', list: 'someday', notes: 'Хочется весной увидеть сакуру' },
        { title: 'Начать вести блог о разработке', list: 'someday' },
        { title: 'Wi-Fi пароль офиса: NewOffice2024!', list: 'reference', notes: 'Сеть: OfficeNetwork-5G' },
        { title: 'Контакты команды разработки', list: 'reference', notes: 'Анна — backend\nИван — frontend\nМаша — дизайн' }
    ];

    tasks.forEach(t => {
        state.tasks.push(createTask(t));
    });
}

// ============ PWA INSTALL ============
let __beforeInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    __beforeInstallPrompt = e;
    const hint = document.getElementById('installHint');
    if (hint) hint.textContent = 'Готово к установке. Нажмите "Установить приложение".';
});

export async function promptInstallPWA() {
    if (!__beforeInstallPrompt) {
        toast('Установка недоступна (нужен HTTPS/PWA условия)', 'info');
        return;
    }
    __beforeInstallPrompt.prompt();
    const choice = await __beforeInstallPrompt.userChoice;
    if (choice && choice.outcome === 'accepted') toast('Приложение устанавливается', 'success');
    __beforeInstallPrompt = null;
}
