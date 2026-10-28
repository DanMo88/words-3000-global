"""print entries worth a human look: python3 tools/p2/lowconf.py <lang> [start] [n] [--hi = the confident ones instead]"""
import json,sys,os
HI='--hi' in sys.argv; sys.argv=[a for a in sys.argv if a!='--hi']
lang=sys.argv[1]; st=int(sys.argv[2]) if len(sys.argv)>2 else 0; n=int(sys.argv[3]) if len(sys.argv)>3 else 99999
P=json.load(open('/workspace/w3g-mt/pos.json'))
M={};[M.update(json.load(open(f'data/meanings/{lang}/{l}.json'))) for l in 'A1 A2 B1 B2'.split()]
over=set(l.split('\t')[0] for l in open(f'tools/p2/{lang}.tsv')) if os.path.exists(f'tools/p2/{lang}.tsv') else set()
S=set(l.split('\t')[0] for l in open('tools/translations.tsv') if not l.startswith('#')) if lang in('fr','ar') else set()
out=[]
for k,m in M.items():
    if k in over or k in S: continue
    g=json.load(open(f'/workspace/w3g-mt/gdict/{lang}/{k}.json'))['d']; w=P[k]['w'].casefold()
    conf=False
    for b in g.get('dict') or []:
        e=(b.get('entry') or [{}])[0]
        if [x.casefold() for x in e.get('reverse_translation',[])][:1]==[w] and e.get('score',0)>.1: conf=True
        break
    low = not conf or ';' in m or '؛' in m
    if low != HI: out.append(f"{k}={m}")
print(len(out)); print(' | '.join(out[st:st+n]))
