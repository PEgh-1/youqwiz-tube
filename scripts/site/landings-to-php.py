#!/usr/bin/env python3
"""Convertit site/content/landings/*.json en src/data/seo_pages_lot3.php (format seo_pages du site)."""
import json, glob, html, sys, os
src = sys.argv[1]; out = sys.argv[2]
TYPE = {'/famille/': 'famille', '/couple/': 'couple', '/maries/': 'maries', '/anniversaire/': 'anniversaire',
        '/papy-mamie/': 'papy-mamie', '/retraite/': 'retraite', 'detecteur.youqwiz.com': 'detecteur-faux-amis'}
KICK = {'famille': 'En famille', 'couple': 'À deux', 'maries': 'Mariage', 'anniversaire': 'Anniversaire',
        'papy-mamie': 'Grands-parents', 'retraite': 'Entre collègues', 'detecteur-faux-amis': 'Entre amies'}
NOMS = {'famille': ['Camille'], 'couple': ['Léa'], 'maries': ['Julie', 'Karim'], 'anniversaire': ['Camille'],
        'papy-mamie': ['Mamie Josette'], 'retraite': ['Martine'], 'detecteur-faux-amis': ['Inès']}
pages = {}
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    t = next(v for k, v in TYPE.items() if k in d['cta_url'])
    E = lambda s: html.escape(s, quote=False)
    steps = '<ol>' + ''.join(f"<li><b>{E(s['title'])}</b> : {E(s['text'])}</li>" for s in d['steps']) + '</ol>'
    tips = '<ul>' + ''.join(f"<li><b>{E(s['title'])}</b> : {E(s['text'])}</li>" for s in d['tips']) + '</ul>'
    sections = [['Comment ça marche', steps], ['Nos conseils', tips]]
    ideas = d.get('ideas') or []
    if ideas:
        sections.append(['Idées de sujets pour lancer la conversation',
                         '<p>Le quiz pioche ses 10 questions dans notre banque. Pour prolonger le jeu pendant la fête, voici quelques sujets à lancer à voix haute :</p><ul>'
                         + ''.join(f"<li>{E(i['q'])}</li>" for i in ideas) + '</ul>'])
    pages['/' + d['slug']] = {
        'type': t, 'title': d['title'].replace(' | YouQwiz', '').strip(), 'description': d['description'],
        'h1': d['h1'], 'kicker': KICK[t], 'exemple_noms': NOMS[t], 'intro': d['intro'],
        'sections': sections, 'faq': [[x['q'], x['a']] for x in d['faq']], 'related': [{'quiz-retraite': 'quiz-depart-retraite', 'quiz-promo': 'quiz-famille'}.get(r, r) for r in d.get('related', [])],
    }
def php(v, ind=0):
    p = '    ' * ind
    if isinstance(v, dict):
        return '[\n' + ''.join(f"{p}    {php(k)} => {php(x, ind + 1)},\n" for k, x in v.items()) + p + ']'
    if isinstance(v, list):
        return '[' + ', '.join(php(x, ind + 1) for x in v) + ']'
    return "'" + str(v).replace('\\', '\\\\').replace("'", "\\'") + "'"
open(out, 'w', encoding='utf-8').write("<?php\n// Landings SEO lot 3 (07/11/2026), générées depuis youqwiz-tube/site/content/landings par scripts/site/landings-to-php.py.\nreturn " + php(pages) + ";\n")
print(len(pages), 'pages ->', out)
