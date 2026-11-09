# youqwiz.com — rubrique « Quiz du jour » (quiz de la chaîne YouTube, jouables sur le site)

Intégré au routeur PHP du site (`/home/<compte>/youqwiz.com`, compte cPanel de l'hébergement) le 05/11/2026 :

```
src/pages_episodes.php       ← pages /quiz-du-jour/ et /quiz-du-jour/{id}, API /api/episodes (POST signé, lecture, votes)
assets/css/episodes.css      ← style « Pop sticker » scopé .yq (utilise l'en-tête/pied du site via render_page)
assets/js/episodes.js        ← moteur de jeu (lit window.YQ.episode)
index.php                    ← +require pages_episodes.php, +route /api/episodes, +routes /quiz-du-jour, redirections 301 de /culture-generale/quiz-du-jour(/archives)
src/view.php, src/pages.php, src/pages_lot2.php ← liens « Quiz du jour » → /quiz-du-jour/, sitemap avec les épisodes
```
Sauvegarde des 4 fichiers modifiés : `/home/<compte>/backup-quiz-du-jour-20261105/`.

## Données
Les épisodes sont stockés en JSON (pas de MySQL) dans `/home/<compte>/youqwiz-data/` (hors web, créé automatiquement ; surcharge possible par `EPISODES_DIR` dans `config.local.php`).

## Clé de synchronisation
Générer une clé (ex. `openssl rand -hex 32`) et la poser **aux deux endroits** :
- côté site : fichier `/home/<compte>/youqwiz-data/sync.key` (contenu = la clé, une ligne) **ou** `SITE_SYNC_KEY` dans `config.local.php` ;
- côté GitHub (dépôt youqwiz-tube → Settings → Secrets → Actions) : `SITE_SYNC_KEY` (même valeur). `SITE_SYNC_URL` est facultatif (défaut `https://youqwiz.com/api/episodes`).

## Mise en route
1. (fait le 05/11/2026) Fichiers déposés, dossier de données et clé posés.
2. Rattraper la file déjà publiée : lancer le workflow « Maintenance de la file » avec `script = publish-site.mjs --all`
   (ou en local : `SITE_SYNC_KEY=… node scripts/publish-site.mjs --all`).
3. Vérifier `https://youqwiz.com/quiz-du-jour/` : les épisodes n'apparaissent qu'à partir de leur heure de publication YouTube (17 h 30 Paris), jamais avant.
4. Ensuite c'est automatique : chaque run quotidien envoie l'épisode juste après l'envoi YouTube (étape « Publier le quiz jouable sur youqwiz.com »).

## Choix faits
- Les pages passent par `render_page` : en-tête, pied, thème, Matomo, AdSense et bandeau cookies du site s'appliquent.
- `/culture-generale/quiz-du-jour` et `/archives` redirigent en 301 vers `/quiz-du-jour/` ; les anciens quiz datés `/culture-generale/quiz-du-jour/AAAA-MM-JJ` restent lisibles.
- Les vidéos YouTube sont intégrées en `youtube-nocookie.com` au clic (pas de requête avant consentement).

## Liens depuis YouTube
Depuis cette version, la description de chaque vidéo, le commentaire épinglé et le commentaire du Short pointent vers `https://youqwiz.com/quiz-du-jour/<id>` (page de l'épisode) au lieu de l'accueil.

## Rapatriement depuis GitHub (08/11/2026)
L'anti-bot d'o2switch (« Test de sécurité », 503) bloque par intermittence le POST signé venant des serveurs GitHub Actions.
Filet de sécurité : le serveur va chercher lui-même les épisodes.
- `cron/pull-episodes.php` (copie du dépôt) est déployé en `/home/<compte>/youqwiz-data/pull-episodes.php`, avec `github.token`
  (jeton fine-grained lecture seule, dépôt youqwiz-tube, permission Contents) dans le même dossier.
- Cron cPanel : `*/15 * * * * /usr/local/bin/php /home/<compte>/youqwiz-data/pull-episodes.php >> /home/<compte>/youqwiz-data/pull.log 2>&1`.
- Le POST direct reste en place (immédiat quand il passe) ; le cron rattrape le reste dans le quart d'heure. Journal : `pull.log`.
