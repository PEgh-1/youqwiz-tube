<?php
declare(strict_types=1);
/**
 * Inclus par pull-episodes.php (11/11/2026) : rapatrie les fiches « minute culture » data/minutes/AAAA-MM-JJ.json du dépôt
 * vers youqwiz-data/minutes/ (page /minute du site). Utilise gh(), $token, $dir et $now du script appelant.
 * Une fiche inchangée (même sha) n'est pas retéléchargée ; on ne regarde que les 21 derniers jours.
 */
$mdir = "$dir/minutes";
if (!is_dir($mdir)) @mkdir($mdir, 0755, true);
$minutesWritten = [];
$lst = is_dir($mdir) ? gh('data/minutes', $token, false) : null;
$files = $lst ? json_decode($lst['body'], true) : null;
if (is_array($files)) {
    $shaFile = "$mdir/sha.idx";
    $shas = is_file($shaFile) ? (json_decode((string)file_get_contents($shaFile), true) ?: []) : [];
    foreach ($files as $fi) {
        $name = (string)($fi['name'] ?? '');
        if (!preg_match('/^(\d{4}-\d{2}-\d{2})\.json$/', $name, $mm)) continue;
        $ts = strtotime($mm[1]);
        if (!$ts || $ts < $now - 21 * 86400) continue;
        $sha = (string)($fi['sha'] ?? '');
        if ($sha !== '' && ($shas[$name] ?? '') === $sha && is_file("$mdir/$name")) continue;
        $res = gh("data/minutes/$name", $token, true);
        $d = $res ? json_decode($res['body'], true) : null;
        if (!is_array($d) || empty($d['minutes']) || ($d['date'] ?? '') !== $mm[1]) { fwrite(STDERR, date('c') . " minute $name illisible\n"); continue; }
        $keep = ['date' => $d['date'], 'minutes' => []];
        foreach ((array)$d['minutes'] as $m) {
            $keep['minutes'][] = ['slot' => (int)($m['slot'] ?? 0), 'question' => (string)($m['question'] ?? ''), 'choices' => array_values((array)($m['choices'] ?? [])),
                'correct' => (int)($m['correct'] ?? -1), 'fact' => (string)($m['fact'] ?? '')];
        }
        file_put_contents("$mdir/$name", json_encode($keep, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        $shas[$name] = $sha;
        $minutesWritten[] = $mm[1];
    }
    if ($minutesWritten) {
        file_put_contents($shaFile, json_encode($shas), LOCK_EX);
        echo date('c') . ' minutes culture : ' . implode(', ', $minutesWritten) . "\n";
    }
}
