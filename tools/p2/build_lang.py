"""Phase 2: build data/meanings/<lang>/<LEVEL>.json for one language. Resumable & idempotent.
Priority per word: tools/p2/<lang>.tsv (manual overrides, id<TAB>meaning)  >  hand-made sample (tools/translations.tsv, fr/ar)
                   >  auto pick from Google dictionary dump /workspace/w3g-mt/gdict/<lang>/<id>.json (POS-matched, 1-2 senses).
Writes tools/p2/<lang>.review.tsv (flags) and prints a validation summary.  Usage: python3 tools/p2/build_lang.py de"""
import json, re, sys, os, unicodedata
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(R))
lang = sys.argv[1]
G = '/workspace/w3g-mt/gdict/' + lang
POS = json.load(open('/workspace/w3g-mt/pos.json'))
SEP1, SEP2 = (('، ', '؛ ') if lang in ('ar', 'fa') else (', ', '; '))
PM = {'NOUN': ['noun'], 'PROPN': ['noun'], 'VERB': ['verb'], 'AUX': ['auxiliary verb', 'verb'], 'ADJ': ['adjective'], 'ADV': ['adverb'],
      'PRON': ['pronoun'], 'ADP': ['preposition'], 'CCONJ': ['conjunction'], 'SCONJ': ['conjunction'], 'DET': ['article', 'pronoun', 'adjective'],
      'INTJ': ['interjection'], 'NUM': ['noun', 'adjective'], 'PART': ['particle', 'adverb']}
SCRIPT = {'ar': r'[\u0600-\u06FF]', 'ru': r'[\u0400-\u04FF]', 'uk': r'[\u0400-\u04FF]', 'bg': r'[\u0400-\u04FF]', 'el': r'[\u0370-\u03FF]', 'he': r'[\u0590-\u05FF]',
          'hi': r'[\u0900-\u097F]', 'th': r'[\u0E00-\u0E7F]', 'zh': r'[\u4E00-\u9FFF]', 'ja': r'[\u3040-\u30FF\u4E00-\u9FFF]', 'ko': r'[\uAC00-\uD7AF]'}
NONLATIN = lang in SCRIPT
# fix POS tags that came out as PROPN/None/DET for ordinary words (use kaikki's first entry)
KP = {'noun': 'NOUN', 'name': 'NOUN', 'verb': 'VERB', 'adj': 'ADJ', 'adv': 'ADV', 'intj': 'INTJ'}
for k, v in POS.items():
    if v['pos'] in ('PROPN', None) or k in ('thick', 'theme'):
        try: v['pos'] = KP.get(json.load(open(f'/workspace/w3g-mt/kaikki/{k}.json'))['entries'][0]['pos'], v['pos'])
        except Exception: pass
POS['bye']['pos'] = 'INTJ'
# never allow vulgar senses
VULGAR = re.compile(r'\b(baise[rs]?|putain|merde|salope|bite|chatte|ficken|fick|schei(ß|ss)e|arsch|follar|coger|puta|mierda|polla|coño|блядь|хуй|ебать|трахать|жопа|сука|sik(mek|tir)?|orospu|amcık|göt|نيك|جماع|عاهرة|قحبة)\b', re.I)
def load_tsv(p, col=1):
    out = {}
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            if l.strip() and not l.startswith('#'):
                c = l.rstrip('\n').split('\t'); out[c[0]] = c[col]
    return out
over = load_tsv(f'{R}/{lang}.tsv')
sample = {}
if lang in ('fr', 'ar'): sample = load_tsv(f'{ROOT}/tools/translations.tsv', 1 if lang == 'fr' else 2)
fa = {}
for lv in ['A1', 'A2', 'B1', 'B2']: fa.update(json.load(open(f'{ROOT}/data/meanings/fa/{lv}.json')))
def norm(s): return s.strip().casefold()
def toks(s): return {norm(t) for t in re.split(r'[،؛,;]', re.sub(r'\(.*?\)', '', s)) if t.strip()}
def fmt(e, pos):
    w = e['word']
    if lang == 'de' and pos == 'noun' and e.get('previous_word') in ('der', 'die', 'das'): w = e['previous_word'] + ' ' + w
    return w
def candidates(i):
    """returns list of senses: [primary_candidates(list of str ranked), secondary_candidates]"""
    p = f'{G}/{i}.json'
    if not os.path.exists(p): return None
    d = json.load(open(p))['d']; word = POS[i]['w'].casefold(); want = PM.get(POS[i]['pos'] or '', [])
    blocks = d.get('dict') or []
    sent = (d.get('sentences') or [{}])[0].get('trans', '')
    if not blocks: return [[sent] if sent else [], []]
    prim = next((b for w in want for b in blocks if b['pos'] == w), blocks[0])
    def rank(b):
        es = b.get('entry') or [{'word': t, 'score': 0, 'reverse_translation': [word]} for t in b.get('terms', [])]
        top = max([e.get('score', 0) for e in es] + [1e-9])
        def key(e):
            rv = [x.casefold() for x in e.get('reverse_translation', [])]
            boost = 2 if rv[:1] == [word] else (1.3 if word in rv[:3] else 1)
            return -(e.get('score', 0) / top) * boost
        es = sorted(es, key=key)
        return [(fmt(e, b['pos']), e.get('score', 0) / top, word in [x.casefold() for x in e.get('reverse_translation', [])][:3]) for e in es]
    pr = rank(prim)
    # prefer the sentence translation as head when it is one of the block's terms
    if sent and any(norm(x[0].split(' ', 1)[-1] if lang == 'de' else x[0]) == norm(sent) for x in pr):
        k = next(j for j, x in enumerate(pr) if norm(x[0].split(' ', 1)[-1] if lang == 'de' else x[0]) == norm(sent)); pr.insert(0, pr.pop(k))
    sec = []
    if '؛' in fa.get(i, ''):
        others = [b for b in blocks if b is not prim]
        if others: sec = [x[0] for x in rank(others[0])][:3]
    return [pr, sec]
ids = []
for lv in ['A1', 'A2', 'B1', 'B2']:
    for li, L in enumerate(json.load(open(f'{ROOT}/data/{lv}.json'))['lessons']):
        for i, *_ in L: ids.append((lv, li, i))
out, src, review = {}, {}, []
by_lesson = {}
for lv, li, i in ids:
    used = set().union(*[toks(out[j]) for j in by_lesson.get((lv, li), [])]) if by_lesson.get((lv, li)) else set()
    if i in over: m, s = over[i], 'over'
    elif i in sample: m, s = sample[i], 'sample'
    else:
        c = candidates(i); s = 'auto'
        if c is None: m = ''; s = 'missing'
        else:
            pr, sec = c
            if pr and isinstance(pr[0], str): pr = [(pr[0], 1, True)]
            pick = [x for x in pr if not (toks(x[0]) & used)]
            if not pick and pr: pick = pr; review.append((i, 'clash-unresolved'))
            elif pr and pick[0][0] != pr[0][0]: review.append((i, 'clash-resolved: skipped ' + pr[0][0]))
            head = [pick[0][0]] if pick else []
            enw = POS[i]['w'].casefold()
            bare = lambda t: norm(t.split(' ', 1)[-1] if lang == 'de' and t.split(' ', 1)[0] in ('der', 'die', 'das') else t)
            for x in pick[1:3]:
                if bare(x[0]) == enw and bare(head[0]) != enw: continue
                if len(head) < 2 and x[1] >= .25 and x[2] and len(SEP1.join(head + [x[0]])) <= 28 and not (toks(x[0]) & used): head.append(x[0])
            m = SEP1.join(head)
            sec = [x for x in sec if not (toks(x) & (used | toks(m))) and bare(x) != enw]
            if sec and len(m) + len(sec[0]) <= 34: m = m + SEP2 + sec[0]
    out[i] = m; src[i] = s; by_lesson.setdefault((lv, li), []).append(i)
# validate
bad = []
for lv, li, i in ids:
    m = out[i]
    if not m.strip(): bad.append((i, 'EMPTY')); continue
    if VULGAR.search(m): bad.append((i, 'VULGAR'))
    letters = [ch for ch in m if ch.isalpha()]
    if NONLATIN:
        foreign = [ch for ch in letters if not re.match(SCRIPT[lang], ch)]
        if foreign: bad.append((i, 'script: ' + ''.join(foreign)))
    else:
        foreign = [ch for ch in letters if not unicodedata.name(ch, '').startswith('LATIN')]
        if foreign: bad.append((i, 'script: ' + ''.join(foreign)))
    en = POS[i]['w'].casefold()
    if en in {t.split(' ', 1)[-1] if lang == 'de' else t for t in toks(m)} and src[i] == 'auto': review.append((i, 'same-as-english (loanword?)'))
for (lv, li), L in by_lesson.items():
    for a in range(len(L)):
        for b in range(a + 1, len(L)):
            if toks(out[L[a]]) & toks(out[L[b]]): bad.append((L[b], f'dup-in-lesson {lv}-{li+1} with {L[a]}'))
os.makedirs(f'{ROOT}/data/meanings/{lang}', exist_ok=True)
for lv in ['A1', 'A2', 'B1', 'B2']:
    m = {i: out[i] for l2, li, i in ids if l2 == lv}
    json.dump(m, open(f'{ROOT}/data/meanings/{lang}/{lv}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
with open(f'{R}/{lang}.review.tsv', 'w', encoding='utf-8') as f:
    for i, why in review + bad: f.write(f'{i}\t{POS[i]["w"]}\t{POS[i]["pos"]}\t{out[i]}\t{fa.get(i,"")}\t{why}\n')
from collections import Counter
print(lang, 'words', len(out), 'src', dict(Counter(src.values())), 'review', len(review), 'BAD', len(bad))
for x in bad[:40]: print('  BAD', x, out[x[0]])
sys.exit(1 if bad else 0)
