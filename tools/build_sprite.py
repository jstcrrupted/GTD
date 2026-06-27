import re, urllib.request, sys

VER = "0.469.0"
BASE = f"https://unpkg.com/lucide-static@{VER}/icons/"

# symbol id (without i-) -> candidate lucide file names (first that exists wins)
ICONS = {
    "menu": ["menu"],
    "zap": ["zap"],
    "refresh": ["refresh-cw"],
    "keyboard": ["keyboard"],
    "settings": ["settings"],
    "search": ["search"],
    "upload": ["upload"],
    "download": ["download"],
    "inbox": ["inbox"],
    "list": ["clipboard-list"],
    "check": ["check"],
    "check-circle": ["circle-check", "check-circle"],
    "copy": ["copy"],
    "trash": ["trash-2"],
    "x": ["x"],
    "lightbulb": ["lightbulb"],
    "folder": ["folder"],
    "tag": ["tag"],
    "chart": ["chart-bar", "bar-chart-3", "bar-chart"],
    "star": ["star"],
    "flame": ["flame"],
    "clock": ["clock"],
    "calendar": ["calendar"],
    "cloud": ["cloud"],
    "book": ["book-open"],
    "note": ["file-text"],
    "target": ["target"],
    "map-pin": ["map-pin"],
    "user": ["user"],
    "activity": ["activity"],
    "package": ["package"],
    "puzzle": ["puzzle"],
    "rewind": ["rewind"],
    "broom": ["paintbrush"],
    "party": ["party-popper"],
    "info": ["info"],
    "alert": ["alert-circle", "circle-alert"],
    "edit": ["square-pen", "pencil"],
    "help": ["circle-help", "help-circle"],
    "rocket": ["rocket"],
    "external": ["arrow-up-right", "external-link"],
    "chevron-left": ["chevron-left"],
    "chevron-right": ["chevron-right"],
    "chevron-down": ["chevron-down"],
    "kanban": ["square-kanban", "columns-3"],
    "circle": ["circle"],
}

def fetch(name):
    url = BASE + name + ".svg"
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if r.status != 200:
            raise RuntimeError(f"{name}: {r.status}")
        return r.read().decode("utf-8")

def inner(svg):
    m = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S)
    body = m.group(1).strip()
    body = re.sub(r"\s+", " ", body)
    return body

symbols = []
fails = []
for sid, candidates in ICONS.items():
    got = None
    used = None
    for c in candidates:
        try:
            got = inner(fetch(c)); used = c; break
        except Exception as e:
            continue
    if got is None:
        fails.append(sid); continue
    symbols.append(
        f'  <symbol id="i-{sid}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{got}</symbol>'
    )
    print(f"ok  i-{sid:14s} <- {used}")

if fails:
    print("FAILED:", fails); sys.exit(1)

out = ('<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n'
       + "\n".join(symbols) + "\n</svg>\n")
open("assets/icons.svg", "w", encoding="utf-8", newline="\n").write(out)
print(f"\nWrote assets/icons.svg with {len(symbols)} symbols, {len(out)} bytes")
