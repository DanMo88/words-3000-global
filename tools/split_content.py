"""Split the full word data into the PUBLIC part (this repo / GitHub Pages) and the PREMIUM part (Supabase only).
Usage: python3 tools/split_content.py /path/to/private/full-copy   (has data/, audio/, img/ with ALL words; never commit it)
Public: the first FREE lessons of every level (= everything a free user can ever reach: lessons unlock in order and only
FREE.lessons may be completed without Premium), their meanings in every language, their audio/images, sfx.
Premium (lesson index >= FREE): uploaded to Supabase tables content_lessons / content_meanings and the private bucket
premium-media (see PROGRESS.md 'Premium content'); removed from here. If FREE.lessons in app.js changes, re-run this
and re-import the premium part."""
import json, os, shutil, sys
FREE = 5
SRC = sys.argv[1]
os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
ix = json.load(open(f'{SRC}/data/index.json'))
ix['version'] += 1; ix['free'] = FREE; ix['pv'] = 1
pub = set()
for l in ix['levels']:
    d = json.load(open(f"{SRC}/data/{l['id']}.json"))
    l['lessons'] = len(d['lessons'])
    keep = d['lessons'][:FREE]
    for ls in keep: pub.update(w[0] for w in ls)
    json.dump({'level': d['level'], 'n': len(d['lessons']), 'free': FREE, 'lessons': keep}, open(f"data/{l['id']}.json", 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(ix, open('data/index.json', 'w'), separators=(',', ':'))
for lang in sorted(os.listdir(f'{SRC}/data/meanings')):
    os.makedirs(f'data/meanings/{lang}', exist_ok=True)
    for f in sorted(os.listdir(f'{SRC}/data/meanings/{lang}')):
        m = json.load(open(f'{SRC}/data/meanings/{lang}/{f}'))
        json.dump({k: v for k, v in m.items() if k in pub}, open(f'data/meanings/{lang}/{f}', 'w'), ensure_ascii=False, separators=(',', ':'))
removed = 0
for d, ext in (('audio', '.mp3'), ('img', '.webp')):
    for f in os.listdir(d):
        wid = f[:-len(ext)].removesuffix('-ex') if f.endswith(ext) else None
        if f.startswith('sfx-') or wid in pub: continue
        os.remove(f'{d}/{f}'); removed += 1
print('public words', len(pub), 'media files removed', removed, 'index version', ix['version'])
