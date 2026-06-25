# Наряд на рефакторинг: GTD Pro → модульная структура с делегированием

> Этот документ — задание для Claude Code. Открой Claude Code в папке проекта
> (`Desktop/gtd`) и вставь его содержимое как первое сообщение, либо положи файл
> в корень репозитория и скажи Claude Code: «Выполни REFACTOR_BRIEF.md».

---

## 0. Контекст

Проект — локальное офлайн-приложение GTD (Getting Things Done) в виде PWA.
Сейчас весь код — один файл `GTD_Pro_App.html` (~5128 строк): инлайновый CSS в
`<style>`, разметка в `<body>`, и ~2574 строк JS в одном `<script>`. Рядом лежат
`sw.js`, `manifest.json`, `icons/icon-192.png`, `icons/icon-512.png`.

**Стек НЕ меняется**: остаёмся на ванильном JavaScript + HTML + CSS + IndexedDB +
PWA. Никаких фреймворков, никакого сборщика. Используем нативные ES-модули
(`<script type="module">`), которые браузер понимает без сборки.

**Цель рефакторинга**: разбить монолит на читаемые модули и заменить ВСЕ инлайновые
обработчики (`onclick="..."`, `onchange="..."`, `oncontextmenu="..."`,
`onkeydown="..."`, `oninput="..."`) на единую систему делегирования событий через
`data-action`. Это подготовит чистый изолированный слой данных для последующей
интеграции с Supabase (синхронизация между устройствами).

**Поведение приложения должно остаться идентичным.** Это рефакторинг структуры, а
не переписывание логики. Тело каждой функции переносится КАК ЕСТЬ; меняются только
способ их связывания (import/export) и способ привязки к DOM (делегирование).

---

## 1. Целевая структура файлов

```
index.html              ← переименованный GTD_Pro_App.html: только разметка + <link> + один <script type="module" src="js/app.js">
css/
  styles.css            ← всё из <style> (без изменений)
js/
  core.js               ← state, константы, $, $$, generateId, escapeHtml, даты, formatDate/DateTime, toast, setSyncStatus, простая шина событий
  actions.js            ← реестр действий (registerActions/getAction) + инициализация делегирования (initDelegation)
  storage.js            ← IndexedDB (openDB, idbGet/Put/Delete/GetAll), packState/applyPackedState, бэкапы, load/save/saveNow/scheduleSave, migrateFromLocalStorage
  model.js              ← createTask, addActivity, parseQuickInput, toggleComplete, trashTask, emptyTrash, moveTaskTo, duplicateTask, мутации тегов/подзадач (addTag/removeTag/addSubtask/updateSubtask/toggleSubtask/deleteSubtask), updateTaskField
  render.js             ← render, renderSidebar, computeCounts, renderHeader, getViewInfo, renderFilters, setSort/setGroup/toggleCompleted/clearFilter/setViewMode, renderContent, getTasksForView, sortTasks, groupTasks, renderTaskItem, renderEmptyState, renderStatusBar, switchView, openProject, openTag
  views.js              ← renderDashboard, renderOverdue, renderProjects, renderTags, renderCalendar, renderCalendarDay, changeMonth, goToToday, filterCalendarDay, renderKanban, handleDragStart/DragEnd/KanbanDrop
  detail.js             ← openDetail, closeDetail, updateDetailTitle, renderDetailBody, selectTask
  capture.js            ← openCapture/closeCapture/renderCaptureSuggestions/insertCaptureText/saveCaptureAndClose, handleInlineAdd, quickAddInList, весь process-флоу (startProcess/closeProcess/renderProcessStep/processActionable/processChooseAction/processDispose/finishProcess), review (openReview/closeReview/toggleReviewItem/getWeekKey), project & tag модалки (openProjectModal/editProject/closeProjectModal/saveProject/deleteProject/renderProjectColorPicker/selectProjectColor + аналоги для тегов), openShortcuts/closeShortcuts
  settings.js           ← openSettings/closeSettings, renderBackupList, createBackupNow/restoreBackupById/restoreLatestBackup/downloadBackupById/clearBackups, exportData/importData/handleFileImport, exportFullBackup/importFullBackup/handleFullBackupImport, clearAllData/loadDemoData/seedDemoData, handleGlobalSearch, promptInstallPWA
  keyboard.js           ← глобальные горячие клавиши (keydown), showTaskContext/hideContextMenu, toggleSidebar/closeSidebar
  app.js                ← точка входа: импортирует всё, регистрирует все действия в actions.js, навешивает делегирование, запускает init (loadAppState → seedDemo при пустоте → autobackup setInterval → visibilitychange → render)
```

> Размещение функции по модулям — ориентир. Если Claude Code видит, что функция
> логичнее лежит в соседнем модуле, можно подвинуть — главное, чтобы граф
> импортов не имел циклов (см. §2).

---

## 2. Как связывать модули (архитектурное правило)

Чтобы избежать циклических зависимостей при тесной паутине вызовов:

1. **`core.js` — низ стека.** Экспортирует `state` (мутируемый объект),
   `$`, `$$`, `generateId`, `escapeHtml`, `todayStr`, `tomorrowStr`, `formatDate`,
   `formatDateTime`, `toast`, `setSyncStatus`, и простую шину событий `bus`
   (`bus.on(name, fn)`, `bus.emit(name, payload)`). Не импортирует ничего из других
   модулей приложения.

2. **Шина для разрыва циклов.** Там, где модуль A должен вызвать функцию из модуля B,
   а B уже импортирует A (цикл), используем шину: A делает `bus.emit('render')`,
   а `render.js` подписывается `bus.on('render', render)`. Главные события:
   `render`, `save`, `closeDetail`, `renderContent`. Прямой импорт — предпочтителен,
   шина — только для разрыва настоящих циклов.

3. **`state` — единый общий объект.** Все модули импортируют `{ state } from './core.js'`
   и мутируют его поля напрямую (как сейчас). Не делать копий state по модулям.

4. **`save()` и `render()`** — самые частые вызовы. `save` живёт в `storage.js`,
   `render` в `render.js`. Чтобы их могли звать все, экспортируй их и импортируй
   где нужно; если возникает цикл — пробрасывай через шину.

---

## 3. Система делегирования (ядро — `actions.js`)

Заменяем инлайновые обработчики на `data-*` атрибуты и ОДИН слушатель на документе.

### 3.1. Формат разметки

Было:
```html
<button onclick="openDetail('abc123')">↗</button>
<div onclick="toggleComplete('abc123', event)">...</div>
<select onchange="updateTaskField('priority', this.value)">...</select>
<input onkeydown="if(event.key==='Enter'){addSubtask(this.value);this.value=''}">
```

Стало:
```html
<button data-action="openDetail" data-id="abc123">↗</button>
<div data-action="selectTask" data-id="abc123">...</div>
<select data-action="updateTaskField" data-field="priority" data-on="change">...</select>
<input data-action="addSubtask" data-on="enter" data-index="2">
```

### 3.2. Диспетчер

`actions.js` экспортирует:

```js
const registry = new Map();

export function registerActions(obj) {
  for (const [name, fn] of Object.entries(obj)) registry.set(name, fn);
}

export function getAction(name) { return registry.get(name); }

// Извлекает аргументы из data-* и контекста события
function dispatch(el, e) {
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
```

> ВАЖНО: функции-обработчики теперь принимают ОДИН объект `ctx`, а не позиционные
> аргументы. При переносе тел функций адаптируй сигнатуры:
> `function openDetail(id, e)` → `function openDetail({ id, event }) { ... }`.
> Внутри тела замени `e` на `event`. Логику не трогай.

### 3.3. Особые случаи

- **`this.value`** в старом коде → теперь `ctx.value` (диспетчер берёт `el.value`).
- **`${i}` (индекс подзадачи)** → `data-index`, в `ctx.index` уже число.
- **Цепочки** вида `state.selectedTaskId='${id}';duplicateTask();hideContextMenu()`
  → сделать отдельное действие `duplicateFromContext`, которое внутри выставляет
  `state.selectedTaskId = ctx.id`, зовёт `duplicateTask()` и `hideContextMenu()`.
  Аналогично для `moveTaskTo`+`hideContextMenu`, `toggleComplete`+`hideContextMenu`,
  `openDetail`+`hideContextMenu`, `trashTask`+`hideContextMenu`: либо отдельные
  «context-» действия, либо `hideContextMenu()` вызывается в конце соответствующего
  обработчика, если он был открыт из контекст-меню (проще — отдельные действия).
- **`event.stopPropagation()`** как единственное действие (на карточке внутри
  кликабельного контейнера) → добавить `data-stop` атрибут, и в начале `dispatch`:
  `if (el.dataset.stop) e.stopPropagation();` Либо обрабатывать стоп внутри
  `selectTask` (там уже есть проверка `closest('.task-actions')`).
- **`this.parentElement.classList.toggle('collapsed')`** (сворачивание секции
  сайдбара) → действие `toggleCollapse`, внутри: `ctx.el.parentElement.classList.toggle('collapsed')`.
- **`${s.f}()`** в пустых состояниях (renderEmptyState) — это динамическое имя
  функции-действия. Заменить на `data-action="${s.f}"` напрямую (значение `s.f`
  уже равно имени зарегистрированного действия, напр. `openCapture`).

---

## 4. Полная таблица маршрутов (137 обработчиков)

Формат: `действие` — где встречается — сигнатура ctx — заметки.
Имена действий совпадают с именами функций, кроме «context-» обёрток.

### Навигация / вид
- `switchView` — сайдбар, дашборд-карточки — `{view}` через `data-view` — заменяет `switchView('inbox'...)`
- `openProject` — сайдбар, карточки проектов — `{id}`
- `openTag` — сайдбар, карточки тегов — `{id}`
- `setSort` — фильтры — `{arg}` (значение сортировки) через `data-arg`
- `setGroup` — фильтры — `{arg}`
- `setViewMode` — тулбар — `{arg}` ('list'|'kanban')
- `toggleCompleted` — фильтры — `{}`
- `clearFilter` — чипы фильтров — `{arg}` ('context'|'energy'|'priority')
- `toggleCollapse` — заголовок секции сайдбара — `{el}`

### Задачи (список/карточка)
- `selectTask` — карточка задачи (click) — `{id, event}`
- `toggleComplete` — чекбокс задачи — `{id, event}` — нужен stopPropagation
- `openDetail` — кнопка ↗ и календарные задачи — `{id, event}`
- `trashTask` — кнопка 🗑 — `{id, event}` — stopPropagation
- `showTaskContext` — карточка задачи (contextmenu) — через `data-action-context="showTaskContext"` + `data-id`
- `handleInlineAdd` — инлайн-добавление в списке — `{event, value}` — `data-on="enter"`
- `quickAddInList` — кнопка быстрого добавления — `{}`
- `filterCalendarDay` — день календаря — `{arg}` (дата-строка) через `data-arg`
- `changeMonth` — навигация календаря — `{arg}` ('-1'|'1'), внутри `Number(ctx.arg)`
- `goToToday` — кнопка «Сегодня» — `{}`

### Контекст-меню (обёртки, закрывают меню в конце)
- `ctxOpenDetail` — `{id}` → openDetail + hideContextMenu
- `ctxToggleComplete` — `{id}` → toggleComplete + hideContextMenu
- `duplicateFromContext` — `{id}` → state.selectedTaskId=id; duplicateTask(); hideContextMenu()
- `ctxMoveNext` / `ctxMoveSomeday` / `ctxMoveReference` — `{id}` → moveTaskTo(id, 'next'|'someday'|'reference') + hideContextMenu
- `ctxTrash` — `{id}` → trashTask + hideContextMenu

### Деталь задачи (панель)
- `updateDetailTitle` — заголовок (input) — `{value}` — `data-on="input"`
- `updateTaskField` — все поля деталей (change) — `{field, value}` — `data-field` + `data-on="change"`; поля: notes, list, projectId, date, time, priority, energy, context, timeEstimate, waitingFor
- `toggleSubtask` — чек подзадачи — `{index}`
- `updateSubtask` — текст подзадачи (change) — `{index, value}` — `data-on="change"`
- `deleteSubtask` — ✕ подзадачи — `{index}`
- `addSubtask` — поле добавления (enter) — `{value}` — `data-on="enter"`; внутри очистка input: `ctx.el.value=''`
- `addTag` — поле тега (enter/comma) — `{value}` — `data-on="enter-comma"`; внутри `.replace(',','')` и очистка
- `removeTag` — × на теге — `{tag}` через `data-tag`
- `duplicateTask` — кнопка — `{}`
- `deleteCurrentTask` — кнопка — `{}`
- `closeDetail` — крестик панели — `{}`

### Capture / Process / Review
- `openCapture` / `closeCapture` / `saveCaptureAndClose` — `{}`
- `insertCaptureText` — чип-подсказка — `{arg}` (текст) через `data-arg`
- `startProcess` / `closeProcess` / `finishProcess` — `{}`
- `processActionable` — да/нет — `{arg}` ('true'|'false'), внутри `ctx.arg==='true'`
- `processChooseAction` — `{}`
- `processDispose` — кнопки распределения — `{list}` через `data-list` (next/calendar/waiting/someday/reference/done/trash)
- `finishProcess` на Enter — поле — `data-on="enter"`
- `openReview` / `closeReview` — `{}`
- `toggleReviewItem` — пункт ревью — `{id}`

### Проекты / Теги (модалки)
- `openProjectModal` / `closeProjectModal` / `saveProject` — `{}`
- `editProject` — кнопка ✏️ (в карточке и в тулбаре) — `{id}` (в тулбаре id = state.currentProjectId, можно отдельное действие `editCurrentProject`)
- `deleteProject` — `{id}` (аналогично `deleteCurrentProject` для тулбара)
- `selectProjectColor` — свотч цвета — `{color}` через `data-color`
- `openTagModal` / `closeTagModal` / `saveTag` — `{}`
- `selectTagColor` — свотч — `{color}`
- `deleteTag` — 🗑 тега — `{id, event}` — stopPropagation

### Настройки / Бэкапы / Данные
- `openSettings` / `closeSettings` — `{}`
- `openShortcuts` / `closeShortcuts` — `{}`
- `createBackupNow` / `restoreLatestBackup` / `clearBackups` — `{}`
- `restoreBackupById` / `downloadBackupById` — `{id}`
- `exportData` / `importData` — `{}`
- `handleFileImport` — input file (change) — `{event}` — `data-on="change"`
- `exportFullBackup` / `importFullBackup` — `{}`
- `handleFullBackupImport` — input file (change) — `{event}` — `data-on="change"`
- `clearAllData` / `loadDemoData` — `{}`
- `emptyTrash` — `{}`
- `handleGlobalSearch` — поле поиска (input) — `{value, event}` — `data-on="input"`
- `promptInstallPWA` — `{}`
- `toggleSidebar` — бургер — `{}`

> Kanban drag-and-drop (`handleDragStart/DragEnd/KanbanDrop`) использует `draggable` +
> события `dragstart/dragend/drop`, не click. Их оставить как отдельную инициализацию
> в `views.js` через `addEventListener` на колонках/карточках после рендера канбана
> (не через `data-action`-click-делегирование). Передавать id через `e.dataTransfer`.

---

## 5. Порядок выполнения (по шагам, с проверкой)

1. **Бэкап-ветка.** `git checkout -b refactor-modules`. Работать в ней.
2. **Извлечь CSS.** Создать `css/styles.css` = содержимое `<style>`. В HTML заменить
   весь блок `<style>...</style>` на `<link rel="stylesheet" href="css/styles.css">`.
   Сохранить `@import` шрифта первой строкой CSS.
3. **Переименовать** `GTD_Pro_App.html` → `index.html` (`git mv`). Обновить `sw.js`
   (в списке ASSETS заменить `./GTD_Pro_App.html` на `./index.html` и `./`),
   `manifest.json` (`start_url` на `./index.html` или `./`). Проверить, что иконки
   указаны как `icons/icon-192.png` — они уже там.
4. **Создать `core.js`** с state, константами, helpers, toast, шиной. Экспортировать.
5. **Создать `actions.js`** по §3 (registry + initDelegation).
6. **Создать `storage.js`** — перенести IndexedDB/бэкапы/save как есть, добавить
   import из core, export `save`, `saveNow`, `loadAppState`, и т.д.
7. **Перенести остальные функции** по модулям из §1. Тела — без изменений, кроме
   адаптации сигнатур обработчиков под `ctx` (§3.2).
8. **Переписать разметку в `index.html`**: убрать все инлайновые `on*=""`, проставить
   `data-action` / `data-on` / `data-id` / `data-field` / `data-arg` / `data-list` /
   `data-color` / `data-tag` / `data-view` / `data-index` по таблице §4.
9. **Переписать строковые шаблоны** во всех `render*`-функциях так же — это основная
   масса (85+ обработчиков генерируются в JS). Действовать по таблице §4.
10. **`app.js`**: импортировать все модули, собрать один объект со всеми действиями,
    `registerActions(allActions)`, `initDelegation()`, затем init-логика (как в конце
    старого файла). В `index.html` оставить ровно один
    `<script type="module" src="js/app.js"></script>` перед `</body>`.
11. **Прогнать валидатор** (§6). Исправить все рассогласования.
12. **Поднять локальный сервер и проверить в браузере** (§7). Прокликать чек-лист.
13. Когда всё работает — `git add -A && git commit -m "Refactor: split monolith into ES modules with event delegation"`.
    Пуш: `git push -u origin refactor-modules`, затем merge в main через PR или локально.

---

## 6. Скрипт-валидатор связей

Создать `tools/validate-actions.mjs` и запускать `node tools/validate-actions.mjs`.
Он проверяет, что каждый `data-action` в HTML и в JS-шаблонах имеет
зарегистрированный обработчик, и предупреждает о зарегистрированных, но
неиспользуемых действиях.

```js
// tools/validate-actions.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const jsDir = 'js';
const files = ['index.html', ...readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => join(jsDir, f))];
const blob = files.map(f => readFileSync(f, 'utf8')).join('\n');

// 1) Собрать использованные действия из data-action / data-action-context
const used = new Set();
for (const m of blob.matchAll(/data-action(?:-context)?=["'`]([a-zA-Z0-9_]+)["'`]/g)) used.add(m[1]);
// учесть динамические data-action="${s.f}" — вытащить из renderEmptyState вручную если нужно

// 2) Собрать зарегистрированные действия из registerActions({...})
const registered = new Set();
const regBlocks = blob.matchAll(/registerActions\(\s*\{([\s\S]*?)\}\s*\)/g);
for (const b of regBlocks) {
  for (const m of b[1].matchAll(/([a-zA-Z0-9_]+)\s*[:(]/g)) registered.add(m[1]);
}
// если действия собираются в один объект через spread — дополнительно собрать имена
// функций-обработчиков из `export function NAME(ctx)` или из объектов-карт действий.

const missing = [...used].filter(a => !registered.has(a));
const unused  = [...registered].filter(a => !used.has(a));

console.log('Использовано действий:', used.size);
console.log('Зарегистрировано:', registered.size);
if (missing.length) { console.error('❌ НЕТ ОБРАБОТЧИКА для:', missing); process.exitCode = 1; }
else console.log('✅ Все используемые действия зарегистрированы.');
if (unused.length) console.warn('⚠️  Зарегистрированы, но не используются:', unused);
```

> Если действия регистрируются не одним `registerActions({...})`, а сбором по
> модулям — адаптируй парсер п.2 под фактический способ (например, ищи
> `export const actions = {...}` в каждом модуле). Главное — получить два множества
> (использованные vs зарегистрированные) и сравнить.

---

## 7. Локальная проверка в браузере

ES-модули требуют HTTP (через `file://` не работают из-за CORS). Подними сервер:

```
# любой из вариантов, из папки проекта:
npx serve .
# или
python -m http.server 8000
```

Открой `http://localhost:8000` (или порт, который покажет serve). Service Worker и
IndexedDB на localhost работают штатно.

### Чек-лист ручной проверки (прокликать всё):
- [ ] Приложение грузится, демо-данные на месте (или твои данные из IndexedDB).
- [ ] Переключение всех видов в сайдбаре (Входящие/Следующие/Ожидания/Календарь/
      Проекты/Когда-нибудь/Справочные/Дашборд/Сегодня/Просроченные/Корзина/Теги).
- [ ] Сворачивание секций сайдбара.
- [ ] Клик по задаче открывает деталь; редактирование заголовка, заметок, всех
      селектов (список/проект/дата/время/приоритет/энергия/контекст/оценка).
- [ ] Подзадачи: добавить (Enter), отметить, переименовать, удалить.
- [ ] Теги: добавить (Enter и запятая), удалить.
- [ ] Чекбокс выполнения; кнопка 🗑 (в корзину и навсегда); правый клик → контекст-меню,
      все его пункты.
- [ ] Быстрый ввод (Quick Capture, клавиша N), процессинг входящих (P), обзор (R).
- [ ] Создание/редактирование/удаление проекта и тега, выбор цвета.
- [ ] Календарь: смена месяца, «Сегодня», клик по дню.
- [ ] Канбан: drag-and-drop карточек между колонками.
- [ ] Настройки: бэкапы (создать/восстановить/скачать/очистить), экспорт/импорт JSON,
      полный бэкап, демо-данные, очистка всех данных.
- [ ] Глобальный поиск (Cmd/Ctrl+K), горячие клавиши (?, g+буква навигация).
- [ ] Перезагрузка страницы — данные сохранились (IndexedDB).
- [ ] DevTools → Console: нет ошибок и нет предупреждений `[action] не зарегистрировано`.

---

## 8. Что НЕ делать на этом этапе
- Не интегрировать Supabase/синхронизацию — это следующий этап (модули `sync.js`,
  `auth.js`), делается после того, как чистая структура проверена и смержена.
- Не менять бизнес-логику, тексты, стили, структуру данных задач.
- Не добавлять сборщик/зависимости (кроме `serve`/валидатора как dev-инструментов).
- Не трогать `escapeHtml` — он уже защищает от XSS, сохранить его применение везде.

---

## 9. Definition of Done
- `index.html` содержит 0 инлайновых `on*=""` обработчиков (проверить
  `grep -rE 'on(click|change|input|keydown|contextmenu|mousedown)=' index.html js/`
  — пусто).
- Валидатор §6 проходит без ❌.
- Весь чек-лист §7 пройден в браузере без ошибок в консоли.
- Поведение идентично исходному.
- Изменения закоммичены в ветке `refactor-modules` и запушены.
