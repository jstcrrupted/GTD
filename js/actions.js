'use strict';

// ============ ACTION REGISTRY + EVENT DELEGATION ============

const registry = new Map();

export function registerActions(obj) {
    for (const [name, fn] of Object.entries(obj)) registry.set(name, fn);
}

export function getAction(name) { return registry.get(name); }

// Builds the ctx object from data-* attributes and the event, then dispatches.
function dispatch(el, e) {
    if (el.dataset.stop) e.stopPropagation();
    const name = el.dataset.action;
    const fn = registry.get(name);
    if (!fn) { console.warn('[action] не зарегистрировано:', name); return; }
    const ctx = {
        id: el.dataset.id,
        field: el.dataset.field,
        index: el.dataset.index != null ? Number(el.dataset.index) : undefined,
        value: ('value' in el) ? el.value : undefined,
        list: el.dataset.list,
        view: el.dataset.view,
        color: el.dataset.color,
        tag: el.dataset.tag,
        arg: el.dataset.arg,        // универсальный строковый аргумент
        el, event: e,
    };
    fn(ctx);
}

export function initDelegation(root = document) {
    // клики
    root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const on = el.dataset.on || 'click';
        if (on !== 'click') return;          // элемент ждёт другое событие
        dispatch(el, e);
    });
    // change (select, input[type=date/time], checkbox-инпуты)
    root.addEventListener('change', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || el.dataset.on !== 'change') return;
        dispatch(el, e);
    });
    // input (живой ввод: заголовок задачи, глобальный поиск)
    root.addEventListener('input', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || el.dataset.on !== 'input') return;
        dispatch(el, e);
    });
    // keydown с фильтром по клавише (data-on="enter" / data-on="enter-comma")
    root.addEventListener('keydown', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const on = el.dataset.on;
        if (on === 'enter' && e.key === 'Enter') { e.preventDefault(); dispatch(el, e); }
        else if (on === 'enter-comma' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); dispatch(el, e); }
    });
    // contextmenu (правый клик по задаче)
    root.addEventListener('contextmenu', (e) => {
        const el = e.target.closest('[data-action-context]');
        if (!el) return;
        const fn = registry.get(el.dataset.actionContext);
        if (fn) fn({ id: el.dataset.id, el, event: e });
    });
}
