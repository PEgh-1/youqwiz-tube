# youqwiz-tube

Production automatisée des vidéos quiz de la chaîne YouTube YouQwiz : une vidéo longue et un Short par jour,
rendus avec [Remotion](https://remotion.dev) et mis en ligne par GitHub Actions.

## Chaîne de production

```
generate  →  tts  →  chapters  →  render  →  qc  →  upload
 épisode     voix     ffprobe     Remotion     contrôle   YouTube Data API
 du jour     off      chapitres   long/short   qualité    (publication programmée,
 (JSON)                           + miniatures            miniature, playlist, Short)
```

- `data/rotation.json` : rotation hebdomadaire des thèmes, heures de publication, poids des banques, durée cible.
- `data/banks/*.json` : banques de questions (animaux, drapeaux, pays sans voyelles, culture générale, tu préfères…).
- `data/variants.json` : textes de l'habillage (pré-roll, accroche, cartes, score, outro, packshot).
- `data/episodes/<date>-<slug>.json` : l'épisode généré (questions, titre, description, tags, miniature).
- `data/state/` : items déjà publiés et file de programmation (commités par le bot).
- `src/` : gabarits Remotion (`DevineEn3s`, `DevineShort`, `Versus`, `QuizQCM`, `Intrus`, `Thumbnail`).
- `public/` : drapeaux, mascottes, voix off en cache ; polices, émojis Twemoji (CC-BY 4.0) et bruitages générés par
  `npm install`.
- `site/`, `www/` : intégration avec le site youqwiz.com (quiz jouables, pages thématiques).

Chaque épisode a son propre habillage (palette, motif, chrono, animation, piste musicale), ses propres textes et une
durée cible de 10 à 20 min. Le contrôle qualité (`scripts/qc.mjs`) vérifie notamment l'unicité des titres et
descriptions.

## Musique de fond

Les pistes musicales ne sont pas versionnées. `scripts/get-music.mjs` les télécharge au moment du rendu depuis l'URL
définie dans le secret `MUSIC_URL` (un `.mp3`, ou un `.zip` contenant des `music*.mp3`). Sans ce secret, la vidéo est
rendue sans musique.

## En local

```bash
npm install                 # prépare public/ (polices, émojis, sons)
npm run studio              # aperçu Remotion
npm run generate -- --pillar devine --bank animaux --items 20
npm run render && npm run qc
npm run upload              # simulation tant que les secrets YT_* ne sont pas définis
```

Chromium déjà installé : `REMOTION_BROWSER_EXECUTABLE=/chemin/vers/chrome`.

## Secrets GitHub (Settings → Secrets → Actions)

| Secret | Usage |
|---|---|
| `YT_CLIENT_ID`, `YT_CLIENT_SECRET` | Identifiant OAuth Google Cloud (API YouTube Data v3) |
| `YT_REFRESH_TOKEN` | Obtenu une fois avec `node scripts/auth.mjs` |
| `YT_PLAYLIST_ID` | (optionnel) playlist des nouvelles vidéos |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | (optionnel) voix off |
| `MUSIC_URL` | (optionnel) URL privée des pistes musicales |
| `SITE_SYNC_KEY`, `SITE_SYNC_URL` | (optionnel) publication des quiz sur youqwiz.com |
| `YOUQWIZ_EXPORT_URL` | (optionnel) export de la banque de questions du site |

## File tampon

Chaque exécution programme la vidéo au prochain jour libre. Pour constituer de l'avance, lancer le workflow
« Vidéo du jour » à la main (`workflow_dispatch`) ; le cron quotidien maintient ensuite l'avance.
