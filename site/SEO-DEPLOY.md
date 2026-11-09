# SEO YouQwiz — déploiement (plan du 07/11/2026)

Plan complet : Google Doc « YouQwiz — Plan SEO (v1, 07/11/2026) ».

## Lot A1 — Quiz du jour (prêt)
1. Sauvegarder `src/pages_episodes.php` et `assets/css/episodes.css` sur le serveur (`/home/<compte>/youqwiz.com`).
2. Déposer les versions de ce dépôt (`site/src/pages_episodes.php`, `site/assets/css/episodes.css`).
3. Le routeur envoie déjà `/quiz-du-jour/{x}` vers `page_episode($x)`. Les hubs par pilier (`tu-preferes`, `culture-generale`…) sont pris en charge directement dans cette fonction. Vérifier que le motif de la route accepte les tirets et les lettres.
4. Sitemap (`src/pages.php` ou `src/pages_lot2.php`) : remplacer la boucle des épisodes par `episodes_sitemap_urls()`, qui fournit loc et lastmod.
5. Contrôles : `/quiz-du-jour/`, un épisode « tu préfères », un épisode QCM, `/quiz-du-jour/tu-preferes`, puis le test des résultats enrichis Google sur un épisode.

## Lot A2 — Reste du site (sur le serveur)
- `render_page` accepte déjà `jsonld`. Ajouter :
  - WebSite et Organization sur l'accueil ;
  - BreadcrumbList partout ;
  - FAQPage et Quiz sur `/culture-generale/{theme}` et sur les landings `/quiz-*`.
- Sitemap : retirer les URL `/culture-generale/quiz-du-jour/AAAA-MM-JJ`, ajouter les lastmod, créer un sitemap index.
- Pages de jeu `/maries/`, `/couple/`… : canonical vers la landing `/quiz-*` ou noindex,follow, après comparaison des deux pages.

## Lot C — Landings
Contenus dans `site/content/landings/*.json`. Le gabarit est celui de `/quiz-maries`, à généraliser pour qu'il lise ces JSON. Ajouter les landings au sitemap et créer leurs images OG.

## Décisions du 07/11/2026 (soir), à exécuter lors de la session sur le PC
Ordre d'exécution :
1. Déployer A1 (quiz du jour), puis A2, puis la landing `quiz-noel-famille` en premier (pic le 24/12), puis les 11 autres.
2. Avant de publier les landings, lire dans le code du serveur le fonctionnement réel de chaque jeu et corriger les FAQ :
   - suppression des réponses ;
   - effacement des quiz inactifs après 12 mois ;
   - nombre de joueurs illimité ;
   - possibilité de jouer à plusieurs.
3. Créer un jeton API cPanel limité au compte d'hébergement / dossier youqwiz.com. Le stocker en secret GitHub `CPANEL_TOKEN` et créer `.github/workflows/deploy-site.yml` (déploiement de `site/`). Créer ensuite la tâche planifiée hebdomadaire de l'agent SEO YouQwiz (Sonnet).
4. Silo culture générale : relever les volumes de chaque sous-thème dans Google Keyword Planner (Playwright, compte Ad-Works). Garder les sous-thèmes avec de la demande. Extraire la banque de 1 500 questions du serveur, puis produire les séries par lots de 20.
