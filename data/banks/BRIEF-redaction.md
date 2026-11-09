# Brief rédaction des banques de questions YouQwiz (31/10/2026)

Chaîne YouTube de quiz en français, public familial (enfants, parents, grands-parents), tutoiement, ton fun.
Dépôt : /home/claude/youqwiz-tube. Banques existantes : data/banks/<slug>.json (objet { ..., items: [...] }).

## Règles absolues
- Aucune marque, aucun personnage sous licence, aucun jeu vidéo/film/dessin animé (liste noire : data/blacklist.json ; dans le doute, on évite). Pas de politique, religion, sexe, violence, alcool/drogue.
- Français correct, accents inclus. Réponses courtes. Pas de doublon avec la banque existante (même réponse = doublon).
- Émojis : uniquement des émojis Unicode standard existant dans Twemoji (public/emoji/*.svg). Pas de séquences exotiques ; drapeaux = paire d'indicateurs régionaux (🇫🇷).
- Niveaux (quand requis) : "facile" | "moyen" | "difficile" | "impossible", répartition ~30 / 30 / 25 / 15 %.
- Écrire le résultat dans data/banks/new-<slug>.json : un TABLEAU JSON d'items (pas d'objet autour).
- Valider soi-même : `node scripts/validate-bank.mjs data/banks/new-<slug>.json` (sans --merge). Corriger jusqu'à 0 rejet, ou retirer les items rejetés. NE PAS fusionner, ne pas toucher aux banques existantes, ne pas faire de git.

## Schémas par banque (copier exactement)
- animaux / fruits-legumes / drapeaux : `{"prompt":{"type":"emoji","value":"🐯"},"answer":"Le tigre"}` (1 seul émoji ; pas de level). Réponse avec article pour animaux/fruits ; nom du pays seul pour drapeaux.
- pays-sans-voyelles : `{"prompt":{"type":"text","value":"FR_NC_"},"answer":"France"}` — nom usuel du pays en MAJUSCULES, chaque voyelle (A E I O U Y, accentuées comprises) remplacée par `_`, espaces/tirets conservés. Pas de level.
- tu-preferes : `{"prompt":{"type":"choices","value":["Option A 🍫","Option B 🧀"]},"answer":""}` — 2 options de force égale, ≤ 60 caractères chacune, 1 émoji en fin d'option, dilemmes variés (vie quotidienne, super-pouvoirs, nourriture, voyages, école/travail, famille, absurde). Pas de level.
- culture-generale : `{"prompt":{"type":"qcm","value":"Question ?","choices":["A","B","C","D"],"correct":2},"answer":"C","level":"facile"}` — 4 choix plausibles ≤ 40 car., question ≤ 110 car., `answer` = texte exact du bon choix, index `correct` réparti sur 0-3. Thèmes : géographie, sciences, histoire, langue française, maths simples, corps humain, nature, sport (règles, pas de joueurs actuels), arts classiques, inventions. VÉRIFIER chaque fait (recherche web) : une erreur = commentaires moqueurs.
- generations : même schéma qcm, `level` obligatoire. Souvenirs France 1960-1995 : objets du quotidien, émissions et chansons de l'époque (titres/interprètes historiques OK), publicités cultes sans citer de marque actuelle protégée… (préférer objets, pratiques, prix en francs, école, jeux de cour, technologies disparues). Vérifier les dates.
- intrus : `{"prompt":{"type":"emoji","value":"🐶🐶🐶🐱🐶🐶🐶🐶🐶🐶🐶🐶"},"answer":"Case 4","level":"facile"}` — exactement 12 émojis, 11 identiques + 1 différent, `answer` = "Case N" (position 1-12 de l'intrus). Difficulté = ressemblance visuelle (facile : 🐶/🐱 ; impossible : 🚕/🚖, 😀/😃, 🌝/🌕). Varier la position.
- mots-emojis : `{"prompt":{"type":"emoji","value":"🌞🌻"},"answer":"Tournesol","level":"facile"}` — 2 à 4 émojis qui forment un mot, une expression ou un titre libre de droits (proverbes, fables, lieux, métiers, objets composés). Pas de titres de films/séries/jeux sous licence.
