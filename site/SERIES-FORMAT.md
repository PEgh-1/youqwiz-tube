# Format des séries de quiz culture générale (pages /quiz-…)

Un fichier JSON par page dans `www/series/<slug>.json` :

```json
{
  "path": "/quiz-capitales",
  "theme": "geographie",
  "title": "Quiz capitales du monde : 20 questions",
  "description": "≤ 155 caractères, avec le mot-clé",
  "h1": "Quiz capitales : connais-tu les capitales du monde ?",
  "intro": "80 à 120 mots : ce que couvre le quiz, niveau, durée (5 s par question), ton chaleureux, tutoiement.",
  "questions": [
    {"q": "Quelle est la capitale de l'Australie ?", "choices": ["Sydney", "Canberra", "Melbourne", "Perth"], "answer": 1,
     "explication": "1 à 2 phrases qui apprennent quelque chose.", "level": "facile|moyen|expert", "flag": "au",
     "source": "https://fr.wikipedia.org/wiki/Canberra"}
  ],
  "faq": [["Question ?", "Réponse de 40 à 70 mots."]],
  "related": ["/quiz-drapeaux", "/quiz-geographie"],
  "verified": "2026-11-12"
}
```

Règles :
- 20 questions exactement, 4 choix, une seule bonne réponse (`answer` = index 0-3), réponses mélangées (la bonne pas toujours au même rang).
- Progression facile → expert : 8 faciles, 8 moyennes, 4 expert.
- Uniquement des faits stables et certains : pas de « champion actuel », record récent, chiffre qui change ou fait douteux. Dans le doute, on retire la question.
- `flag` : seulement pour les questions de drapeaux, code ISO 3166-1 alpha-2 en minuscules (le site affiche le drapeau, la question ne le décrit donc pas).
- `title` ≤ 55 caractères (le site ajoute « | YouQwiz »). 3 questions de FAQ. 3 à 5 liens `related` vers d'autres séries.
- Aucun texte copié d'un site tiers.
- `source` (depuis le 12/11/2026) : URL https d'une page qui confirme la réponse (Wikipédia FR de préférence, titre précis, jamais une page d'homonymie). Affichée sous l'explication dans le corrigé.
- `verified` : date AAAA-MM-JJ de la dernière vérification des réponses ; affichée au-dessus du corrigé (« Réponses vérifiées le … »).
- Format vrai ou faux (fichiers `quiz-vrai-ou-faux*`) : `q` est une affirmation, `choices` = ["Vrai", "Faux"], 10 vraies et 10 fausses.
- Contrôle des liens : liste des titres puis API Wikipédia (`action=query&redirects=1&prop=pageprops&ppprop=disambiguation`) depuis un navigateur ; le shell de Claude ne joint pas Wikipédia.

## PDF à imprimer (depuis le 12/11/2026)
`python3 scripts/site/make-pdfs.py out/pdf` génère un PDF par série (questions, puis page des réponses). Les PDF sont déposés dans `/media/pdf/` sur le serveur (cPanel depi9957). La page `/quiz-a-imprimer` et le lien « Version PDF » d'une série n'apparaissent que si le PDF existe : après toute nouvelle série ou correction, régénérer et redéposer les PDF concernés.
