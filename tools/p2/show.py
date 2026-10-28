"""show auto meanings for the hard set (sample-130 ids + function words) or random: python3 tools/p2/show.py <lang> hard|rand"""
import json,sys,random
lang,mode=sys.argv[1],sys.argv[2]
P=json.load(open('/workspace/w3g-mt/pos.json'))
M={};[M.update(json.load(open(f'data/meanings/{lang}/{l}.json'))) for l in 'A1 A2 B1 B2'.split()]
S=[l.split('\t')[0] for l in open('tools/translations.tsv') if not l.startswith('#') and l.strip()]
F=[k for k,v in P.items() if v['pos'] not in ('NOUN','VERB','ADJ','ADV')]
if mode=='hard': ks=([] if lang in('fr','ar') else S)+[k for k in F if k not in S]
elif mode=='fn': ks=[k for k in F if k not in S]
else: random.seed(int(sys.argv[3]) if len(sys.argv)>3 else 2); ks=random.sample([k for k in M if k not in S],int(sys.argv[4]) if len(sys.argv)>4 else 120)
seen=[];[seen.append(k) for k in ks if k not in seen]
print(' | '.join(f"{k}:{M[k]}" for k in seen))
