// tools/validate-actions.mjs
// Проверяет, что каждый data-action в HTML и JS-шаблонах имеет зарегистрированный
// обработчик, и предупреждает о зарегистрированных, но неиспользуемых действиях.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const jsDir = 'js';
const files = ['index.html', ...readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => join(jsDir, f))];
const blob = files.map(f => readFileSync(f, 'utf8')).join('\n');

// 1) Собрать использованные действия из data-action / data-action-context
const used = new Set();
for (const m of blob.matchAll(/data-action(?:-context)?=["'`]([a-zA-Z0-9_]+)["'`]/g)) used.add(m[1]);

// 2) Собрать зарегистрированные действия из registerActions({...})
const registered = new Set();
const regBlocks = blob.matchAll(/registerActions\(\s*\{([\s\S]*?)\}\s*\)/g);
for (const b of regBlocks) {
  for (const m of b[1].matchAll(/^\s*([a-zA-Z0-9_]+)\s*:/gm)) registered.add(m[1]);
}

const missing = [...used].filter(a => !registered.has(a));
const unused  = [...registered].filter(a => !used.has(a));

console.log('Использовано действий:', used.size);
console.log('Зарегистрировано:', registered.size);
if (missing.length) { console.error('❌ НЕТ ОБРАБОТЧИКА для:', missing); process.exitCode = 1; }
else console.log('✅ Все используемые действия зарегистрированы.');
if (unused.length) console.warn('⚠️  Зарегистрированы, но не используются:', unused);
