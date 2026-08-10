"""Bump CSS cache version from v=510 to v=511 on all HTML pages."""
import re
from pathlib import Path

BASE = Path('.')
HTML_FILES = sorted(BASE.glob('*.html'))

OLD = 'css/styles.css?v=510'
NEW = 'css/styles.css?v=511'

count = 0
for f in HTML_FILES:
    text = f.read_text(encoding='utf-8')
    if OLD in text:
        text = text.replace(OLD, NEW)
        f.write_text(text, encoding='utf-8')
        print(f'{f.name}: bumped to v=511')
        count += 1
    else:
        print(f'{f.name}: no v=510 found, skipping')

print(f'\nTotal: {count} files updated')
