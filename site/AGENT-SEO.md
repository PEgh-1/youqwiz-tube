# Agent SEO hebdomadaire YouQwiz — règles

Plan : Google Doc « YouQwiz — Plan SEO (v1, 07/11/2026) ».
Volumes : fichier Keyword Planner (France, 12 mois) conservé hors dépôt public.

## Ce que l'agent peut publier seul
Uniquement des pages « crée ton quiz » dans `www/seo_pages_agent.json`, au format suivant :
type, title (sans « | YouQwiz »), description, h1, kicker, intro, exemple_noms, sections [[titre, html]], faq [[q, r]], related.
- Le push sur main déclenche le workflow « Pages SEO youqwiz.com (agent SEO) » : POST signé, puis contrôle HTTP 200 de chaque page.
- Le serveur refuse le code et n'accepte que les chemins `/quiz-…`. Le HTML est limité à p, ul, ol, li, b, i, em, strong, br.
- Le type doit être l'un de : famille, papy-mamie, couple, maries, retraite, anniversaire, promo, detecteur-faux-amis.

## Vérité produit (ne jamais promettre autre chose)
- 10 questions tirées d'une banque par type. On ne peut pas écrire ses propres questions ; « Changer de question » écarte une question.
- Modes de jeu :
  - « soi » (famille, anniversaire, couple, détecteur) : la personne répond sur elle-même.
  - papy-mamie : Papy ou Mamie répond sur lui ou elle-même.
  - maries : un témoin saisit les deux prénoms et répond à leur place.
  - retraite : un collègue répond à la place du partant.
- Tableau de bord privé du créateur : il y supprime les réponses et le quiz. Un quiz inactif 12 mois est supprimé. Aucune limite de joueurs. Gratuit, sans compte.
- Aucun chiffre inventé (nombre de joueurs, notes, etc.).

## Routine
1. Santé : sitemap.xml, échantillon de pages en 200, titres des 7 derniers quiz du jour lisibles.
2. Deux pages par semaine maximum, choisies dans le CSV des volumes par ordre de demande, et seulement sur une intention « créer un quiz entre proches ». Les saisonnières passent 6 à 8 semaines avant leur pic.
3. Rapport court dans le Google Doc du plan (section « Journal de l'agent »).

## Séries culture générale (depuis le 08/11/2026)
- Une série par fichier : `www/series/<slug>.json`. Le format est dans `site/SERIES-FORMAT.md` ; la page est publiée sur `/quiz-<sujet>`.
- 125 séries en ligne au 12/11/2026, toutes sourcées (`source` par question, `verified` par série). Le push sur main publie aussi les séries.
- L'agent peut ajouter au plus 1 série par semaine, prise dans le CSV des volumes, sans doublon.
- Il relit chaque fait avant publication et retire toute question au moindre doute ; chaque question porte une `source` vérifiée (page existante, pas d'homonymie) et la série une date `verified`.
- Le PDF d'une nouvelle série n'existe pas tant qu'il n'est pas déposé sur le serveur : le signaler dans le rapport (dépôt groupé lors d'une session cPanel).
