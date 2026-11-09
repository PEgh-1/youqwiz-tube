<?php
declare(strict_types=1);
/**
 * Rapatrie les « Quiz du jour » depuis le dépôt GitHub youqwiz-tube (lecture seule) vers le dossier de données du site,
 * et les Shorts (mp4) vers /media/shorts pour le relais Instagram / Facebook / TikTok (Metricool).
 * Filet de sécurité : l'envoi direct depuis GitHub Actions (POST signé /api/episodes) est parfois bloqué par l'anti-bot
 * de l'hébergeur (page « Test de sécurité » 503). Ici c'est le serveur qui va chercher, donc aucune dépendance aux IP GitHub.
 *
 * Emplacement : /home/depi9957/youqwiz-data/pull-episodes.php (hors web), à côté de github.token (jeton fine-grained,
 * dépôt PEgh-1/youqwiz-tube, permission Contents : lecture seule). Copie versionnée : site/pull-episodes.php du dépôt.
 * Cron cPanel : *\/15 * * * *  php /home/depi9957/youqwiz-data/pull-episodes.php >> /home/depi9957/youqwiz-data/pull.log 2>&1
 *
 * Même format de fichier que l'API (episode, longId, shortId, publishAt, receivedAt) + source/sourceSha ; index.json reconstruit à l'identique.
 * Les épisodes déjà publiés et identiques ne sont pas retéléchargés ; ceux à venir sont comparés par sha (refonte détectée).
 * 09/11/2026 : shortId2 / short2PublishAt (2e Short à 19 h) et téléchargement des mp4 depuis la release GitHub de l'épisode
 * (https://github.com/PEgh-1/youqwiz-tube/releases/download/<id>/short.mp4) vers youqwiz.com/media/shorts/<id>.mp4 et <id>-2.mp4.
 */
const REPO = 'PEgh-1/youqwiz-tube';
const BRANCH = 'main';
const KEEP_DAYS = 30; // on ne regarde pas les épisodes publiés il y a plus de 30 jours
const MEDIA_DIR = '/home/depi9957/youqwiz.com/media/shorts';
const MEDIA_KEEP_DAYS = 60;

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

/** Télécharge un mp4 de release (public, sans jeton) vers $dest ; vrai si un fichier valide est en place. */
function fetchMedia(string $url, string $dest): bool
{
    $tmp = $dest . '.part';
    $fh = fopen($tmp, 'wb');
    if (!$fh) return false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_FILE => $fh, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5, CURLOPT_TIMEOUT => 120, CURLOPT_USERAGENT => 'youqwiz-site-pull']);
    $ok = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    fclose($fh);
    $head = is_file($tmp) ? (string)file_get_contents($tmp, false, null, 0, 12) : '';
    if ($ok === false || $code !== 200 || filesize($tmp) < 20000 || substr($head, 4, 4) !== 'ftyp') { @unlink($tmp); return false; }
    return rename($tmp, $dest);
}

$q = gh('data/state/queue.json', $token, true);
if (!$q) exit(1);
$queue = json_decode($q['body'], true);
if (!is_array($queue) || empty($queue['published'])) { fwrite(STDERR, date('c') . " queue.json illisible\n"); exit(1); }

$now = time();
$written = [];
$media = [];
if (!is_dir(MEDIA_DIR)) @mkdir(MEDIA_DIR, 0755, true);
foreach ($queue['published'] as $r) {
    if (empty($r['id']) || empty($r['longId']) || empty($r['publishAt'])) continue;
    $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string)$r['id'])) ?? '';
    if ($id === '' || $id !== $r['id']) continue;
    $pub = strtotime((string)$r['publishAt']);
    if (!$pub || $pub < $now - KEEP_DAYS * 86400) continue;
    $shortId = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($r['shortId'] ?? ''));
    $shortId2 = preg_replace('/[^A-Za-z0-9_-]/', '', (string)($r['shortId2'] ?? ''));

    // Shorts mp4 (relais réseaux) : téléchargés une fois par identifiant YouTube ; un nouvel identifiant (refonte) remplace le fichier.
    if (is_dir(MEDIA_DIR)) {
        $side = MEDIA_DIR . "/$id.json";
        $have = is_file($side) ? (json_decode((string)file_get_contents($side), true) ?: []) : [];
        $want = array_filter(['short' => $shortId, 'short2' => $shortId2]);
        $got = $have;
        foreach ($want as $k => $vid) {
            $dest = MEDIA_DIR . '/' . $id . ($k === 'short2' ? '-2' : '') . '.mp4';
            if (($have[$k] ?? '') === $vid && is_file($dest)) continue;
            $url = 'https://github.com/' . REPO . '/releases/download/' . $id . '/' . ($k === 'short2' ? 'short2' : 'short') . '.mp4';
            if (fetchMedia($url, $dest)) { $got[$k] = $vid; $media[] = basename($dest); }
            else unset($got[$k]);
        }
        if ($got !== $have) file_put_contents($side, json_encode($got), LOCK_EX);
    }

    $f = "$dir/$id.json";
    $local = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    $sameRecord = $local
        && ($local['longId'] ?? '') === $r['longId']
        && ($local['shortId'] ?? '') === $shortId
        && ($local['shortId2'] ?? '') === $shortId2
        && ($local['publishAt'] ?? '') === $r['publishAt'];
    // Déjà publié et même enregistrement : rien à faire (le contenu d'un épisode public ne change plus).
    if ($sameRecord && $pub <= $now) continue;
    // Métadonnées du fichier épisode (sha) : évite de retélécharger un épisode à venir inchangé.
    $meta = gh("data/episodes/$id.json", $token, false);
    if (!$meta) continue;
    $m = json_decode($meta['body'], true);
    $sha = (string)($m['sha'] ?? '');
    if ($sameRecord && $sha !== '' && $sha === ($local['sourceSha'] ?? '')) continue;
    $content = isset($m['content']) && ($m['encoding'] ?? '') === 'base64' ? base64_decode(str_replace("\n", '', (string)$m['content']), true) : false;
    if ($content === false || $content === '') { $rawRes = gh("data/episodes/$id.json", $token, true); $content = $rawRes['body'] ?? ''; }
    $ep = json_decode((string)$content, true);
    if (!is_array($ep) || empty($ep['items']) || ($ep['id'] ?? '') !== $id) { fwrite(STDERR, date('c') . " épisode $id illisible\n"); continue; }
    unset($ep['voice'], $ep['variants']);
    foreach ($ep['items'] as &$it) unset($it['voice']);
    unset($it);
    $rec = [
        'episode' => $ep,
        'longId' => preg_replace('/[^A-Za-z0-9_-]/', '', (string)$r['longId']),
        'shortId' => $shortId,
        'shortId2' => $shortId2,
        'publishAt' => (string)$r['publishAt'],
        'short2PublishAt' => (string)($r['short2PublishAt'] ?? ''),
        'receivedAt' => gmdate('c'),
        'source' => 'github-pull',
        'sourceSha' => $sha,
    ];
    file_put_contents($f, json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    $written[] = $id;
}

// Ménage des mp4 de plus de 60 jours.
if (is_dir(MEDIA_DIR)) {
    foreach (glob(MEDIA_DIR . '/*.{mp4,json}', GLOB_BRACE) ?: [] as $f) {
        if (filemtime($f) < $now - MEDIA_KEEP_DAYS * 86400) @unlink($f);
    }
}

if ($written) {
    // index.json : même construction que pages_episodes.php::episodes_rebuild_index()
    $out = [];
    foreach (glob("$dir/*.json") ?: [] as $f) {
        $b = basename($f, '.json');
        if ($b === 'index' || str_starts_with($b, 'votes-')) continue;
        $rec = json_decode((string)file_get_contents($f), true);
        if (!$rec || empty($rec['episode']['items'])) continue;
        $ep = $rec['episode'];
        $out[] = [
            'id' => $ep['id'], 'title' => $ep['title'], 'pillar' => $ep['pillar'] ?? '', 'template' => $ep['template'] ?? '',
            'choice' => ($ep['items'][0]['prompt']['type'] ?? '') === 'choices',
            'count' => count($ep['items']), 'theme' => (int)($ep['theme'] ?? 0), 'hook' => $ep['intro']['hook'] ?? '',
            'emoji' => $ep['meta']['thumbnail']['emoji'] ?? '🧠', 'publishAt' => $rec['publishAt'], 'longId' => $rec['longId'] ?? '',
        ];
    }
    usort($out, fn($a, $b) => strcmp((string)$b['publishAt'], (string)$a['publishAt']));
    file_put_contents("$dir/index.json", json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
if ($written || $media) echo date('c') . ' mis à jour : ' . implode(', ', $written) . ($media ? ' · shorts : ' . implode(', ', $media) : '') . "\n";
