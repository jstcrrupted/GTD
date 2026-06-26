# tools/validate_actions.py
# Python-эквивалент validate-actions.mjs (на машине нет Node).
# Проверяет соответствие используемых data-action и зарегистрированных обработчиков.
import os, re, sys

js_dir = 'js'
files = ['index.html'] + [os.path.join(js_dir, f) for f in sorted(os.listdir(js_dir)) if f.endswith('.js')]
blob = '\n'.join(open(f, 'r', encoding='utf-8').read() for f in files)

# 1) Использованные действия из data-action / data-action-context
used = set(re.findall(r'data-action(?:-context)?=["\'`]([a-zA-Z0-9_]+)["\'`]', blob))

# 2) Зарегистрированные действия из registerActions({...})
registered = set()
for block in re.findall(r'registerActions\(\s*\{([\s\S]*?)\}\s*\)', blob):
    for m in re.findall(r'^\s*([a-zA-Z0-9_]+)\s*:', block, re.M):
        registered.add(m)

missing = sorted(a for a in used if a not in registered)
unused = sorted(a for a in registered if a not in used)

print('Использовано действий:', len(used))
print('Зарегистрировано:', len(registered))
if missing:
    print('NO HANDLER for:', missing)
    sys.exit(1)
else:
    print('OK: все используемые действия зарегистрированы.')
if unused:
    print('WARN зарегистрированы, но не используются:', unused)
