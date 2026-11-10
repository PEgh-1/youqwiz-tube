<?php
declare(strict_types=1);
/**
 * Rapatrie les « Quiz du jour » depuis le dépôt GitHub youqwiz-tube (lecture seule) vers le dossier de données du site.
 * Filet de sécurité : l'envoi direct depuis GitHub Actions (POST signé /api/episodes) est parfois bloqué par l'anti-bot
 * de l'hébergeur (page « Test de sécurité » 503). Ici c'est le serveur qui va chercher, donc aucune dépendance aux IP GitHub.
 *
 * Emplacement : /home/<compte>/youqwiz-data/pull-episodes.php (hors web), à côté de github.token (jeton fine-grained,
 * dépôt PEgh-1/youqwiz-tube, permission Contents : lecture seule).
 * Cron cPanel : *\/15 * * * *  php /home/<compte>/youqwiz-data/pull-episodes.php >> /home/<compte>/youqwiz-data/pull.log 2>&1
 *
 * Même format de fichier que l'API (episode, longId, shortId, publishAt, receivedAt) + source/sourceSha ; index.json reconstruit à l'identique.
 * Les épisodes déjà publiés et identiques ne sont pas retéléchargés ; ceux à venir sont comparés par sha (refonte détectée).
 * 10/11/2026 : une passe par chaîne — data/ → dossier racine (français), data-en/ → sous-dossier en/ ("lang": "en", pages /en/daily-quiz/).
 */
const REPO = 'PEgh-1/youqwiz-tube';
const BRANCH = 'main';
const KEEP_DAYS = 30; // on ne regarde pas les épisodes publiés il y a plus de 30 jours

$dir = __DIR__;
$token = trim((string)@file_get_contents("$dir/github.token"));
if ($token === '') { fwrite(STDERR, date('c') . " github.token manquant dans $dir\n"); exit(1); }

function gh(string $path, string $token, bool $raw): ?array
{
    $ch = curl_init('https://api.github.com/repos/' . REPO . '/contents/' . $path . '?ref=' . BRANCH);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => [
            'Accept: ' . ($raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json'),
            'Authorization: Bearer ' . $token, 'X-GitHub-Api-Version: 2022-11-28', 'User-Agent: youqwiz-site-pull',
        ],
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($body === false || $code !== 200) { fwrite(STDERR, date('c') . " GitHub $path → HTTP $code\n"); return null; }
    return ['code' => $code, 'body' => (string)$body];
}

// Chaînes (10/11/2026) : langue => [dossier du dépôt, sous-dossier local]. Le français reste à la racine (inchangé),
// l'anglais va dans en/ avec "lang": "en" dans chaque enregistrement (même stockage que l'API /api/episodes).
const CHANNELS = ['fr' => ['data', ''], 'en' => ['data-en', '/en']];

/** index.json d'un dossier : même construction que pages_episodes.php::episodes_rebuild_index(), langue du dossier seulement. */
function rebuild_index(string $out, string $lang): void
{
    $list = [];
    foreach (glob("$out/*.json") ?: [] as $f) {
        $b = basename($f, '.json');
        if ($b === 'index' || str_starts_with($b, 'votes-')) continue;
        $rec = json_decode((string)file_get_contents($f), true);
        if (!$rec || empty($rec['episode']['items'])) continue;
        if (($rec['lang'] ?? 'fr') !== $lang) continue;
        $ep = $rec['episode'];
        $list[] = [
            'id' => $ep['id'], 'title' => $ep['title'], 'pillar' => $ep['pillar'] ?? '', 'template' => $ep['template'] ?? '',
            'choice' => ($ep['items'][0]['prompt']['type'] ?? '') === 'choices',
            'count' => count($ep['items']), 'theme' => (int)($ep['theme'] ?? 0), 'hook' => $ep['intro']['hook'] ?? '',
            'emoji' => $ep['meta']['thumbnail']['emoji'] ?? '🧠', 'publishAt' => $rec['publishAt'], 'longId' => $rec['longId'] ?? '',
        ];
    }
    usort($list, fn($a, $b) => strcmp((string)$b['publishAt'], (string)$a['publishAt']));
    file_put_contents("$out/index.json", json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

$now = time();
$writtenAll = [];
$failed = 0;
foreach (CHANNELS as $lang => [$src, $sub]) {
    $out = $dir . $sub;
    if (!is_dir($out)) @mkdir($out, 0755, true);
    $q = gh("$src/state/queue.json", $token, true);
    if (!$q) { $failed++; continue; } // une chaîne en panne ne bloque pas l'autre
    $queue = json_decode($q['body'], true);
    if (!is_array($queue)) { fwrite(STDERR, date('c') . " $src/state/queue.json illisible\n"); $failed++; continue; }
    if (empty($queue['published'])) continue; // file vide (chaîne anglaise au démarrage) : normal

    $written = [];
    foreach ($queue['published'] as $r) {
        if (empty($r['id']) || empty($r['longId']) || empty($r['publishAt'])) continue;
        $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string)$r['id'])) ?? '';
        if ($id === '' || $id !== $r['id']) continue;
        $pub = strtotime((string)$r['publishAt']);
        if (!$pub || $pub < $now - KEEP_DAYS * 86400) continue;
        $f = "$out/$id.json";
        $local = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
        $sameRecord = $local
            && ($local['longId'] ?? '') === $r['longId']
            && ($local['shortId'] ?? '') === (string)($r['shortId'] ?? '')
            && ($local['publishAt'] ?? '') === $r['publishAt'];
        // Déjà publié et même enregistrement : rien à faire (le contenu d'un épisode public ne change plus).
        if ($sameRecord && $pub <= $now) continue;
        // Métadonnées du fichier épisode (sha) : évite de retélécharger un épisode à venir inchangé.
        $meta = gh("$src/episodes/$id.json", $token, false);
        if (!$meta) continue;
        $m = json_decode($meta['body'], true);
        $sha = (string)($m['sha'] ?? '');
        if ($sameRecord && $sha !== '' && $sha === ($local['sourceSha'] ?? '')) continue;
        $content = isset($m['content']) && ($m['encoding'] ?? '') === 'base64' ? base64_decode(str_replace("\n", '', (string)$m['content']), true) : false;
        if ($content === false || $content === '') { $rawRes = gh("$src/episodes/$id.json", $token, true); $content = $rawRes['body'] ?? ''; }
        $ep = json_decode((string)$content, true);
        if (!is_array($ep) || empty($ep['items']) || ($ep['id'] ?? '') !== $id) { fwrite(STDERR, date('c') . " épisode $lang/$id illisible\n"); continue; }
        unset($ep['voice'], $ep['variants']);
        foreach ($ep['items'] as &$it) unset($it['voice']);
        unset($it);
        $rec = [
            'episode' => $ep,
            'longId' => preg_replace('/[^A-Za-z0-9_-]/', '', (string)$r['longId']),
            'shortId' => preg_replace('/[^A-Za-z0-9_-]/', '', (string)($r['shortId'] ?? '')),
            'publishAt' => (string)$r['publishAt'],
            'receivedAt' => gmdate('c'),
            'source' => 'github-pull',
            'sourceSha' => $sha,
        ];
        if ($lang !== 'fr') $rec['lang'] = $lang; // enregistrements français inchangés (lang absent = fr)
        file_put_contents($f, json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        $written[] = $id;
    }
    if ($written) { rebuild_index($out, $lang); $writtenAll[] = "$lang: " . implode(', ', $written); }
}

if ($writtenAll) echo date('c') . ' mis à jour : ' . implode(' · ', $writtenAll) . "\n";
if ($failed === count(CHANNELS)) exit(1); // GitHub injoignable pour toutes les chaînes
