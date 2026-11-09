<?php
declare(strict_types=1);

/**
 * Quiz du jour de la chaîne YouTube, rejoués sur le site : /quiz-du-jour/ et /quiz-du-jour/{id}
 * + API /api/episodes (réception signée depuis GitHub Actions, lecture publique, votes « Tu préfères »).
 * Données : fichiers JSON dans EPISODES_DIR (hors web), aucune table SQL.
 * Un épisode n'est visible qu'à partir de son heure de publication YouTube (17 h 30 Paris).
 */

const EPISODES_DIR = APP_ROOT . '/../youqwiz-data';
const EPISODES_THEMES = [
    ['name' => 'chaud',  'bg' => 'linear-gradient(135deg,#FFD23F 0%,#FF7A59 45%,#FF4D8D 100%)', 'accent' => '#FF4D8D', 'soft' => '#FFD23F'],
    ['name' => 'menthe', 'bg' => 'linear-gradient(135deg,#7CF0E3 0%,#1BB5A8 55%,#FFD23F 100%)', 'accent' => '#0E8C82', 'soft' => '#7CF0E3'],
    ['name' => 'violet', 'bg' => 'linear-gradient(135deg,#7B5CFF 0%,#FF4D8D 55%,#FFB800 100%)', 'accent' => '#7B5CFF', 'soft' => '#FFB800'],
];
const EPISODES_PILLARS = ['devine' => 'Devine en 5 secondes', 'choix' => 'Tu préfères… ?', 'culture' => 'Culture générale', 'generations' => 'Quiz Générations', 'emojis' => 'Émojis & intrus', 'site' => 'Spécial youqwiz.com'];
const EPISODES_CHANNEL = 'https://www.youtube.com/@youqwiz?sub_confirmation=1';
/** Pages hub par pilier : /quiz-du-jour/{slug} (SEO 07/11/2026). */
const EPISODES_PILLAR_SLUGS = [
    'devine-en-5-secondes' => 'devine', 'tu-preferes' => 'choix', 'culture-generale' => 'culture',
    'generations' => 'generations', 'emojis-et-intrus' => 'emojis', 'special-youqwiz' => 'site',
];
const EPISODES_PILLAR_INTRO = [
    'devine' => "Une image, une silhouette ou un indice, et 5 secondes pour trouver la réponse : animaux, drapeaux, pays sans voyelles, fruits et légumes… Les premières questions sont faciles, les dernières beaucoup moins. Joue seul ou lance le défi à tes proches et comparez vos points.",
    'choix' => "Des dilemmes impossibles à trancher, 5 secondes pour choisir. Après chaque choix, tu vois ce qu'ont répondu les autres joueurs. Parfait pour lancer le débat en famille, entre amis ou en soirée.",
    'culture' => "Des quiz de culture générale de facile à impossible : histoire, géographie, sciences, langue française, cinéma, chanson… Chaque réponse est accompagnée d'une explication pour apprendre en jouant. Un nouveau quiz chaque semaine, toutes les réponses en bas de page.",
    'generations' => "Le quiz qui fait se rencontrer les générations : objets d'autrefois, expressions, télé, chansons et jeux d'enfance. Idéal pour jouer avec ses parents ou ses grands-parents et voir qui s'en sort le mieux.",
    'emojis' => "Films en émojis, mots en émojis, intrus à repérer : des quiz visuels et rapides où il faut décoder avant la fin du chrono. Fun à plusieurs, addictif en solo.",
    'site' => "Le meilleur des quiz de youqwiz.com chaque samedi : les questions les plus jouées de la semaine réunies dans un seul quiz.",
];

/** Titre SEO lisible, distinct du titre YouTube (sans émojis ni capitales criardes). */
function episode_seo_title(array $ep, int $n, bool $isChoice): string
{
    $raw = (string)($ep['intro']['hook'] ?? $ep['title']);
    $raw = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}\x{200D}]/u', '', $raw) ?? $raw;
    $raw = trim(preg_replace('/\s+/u', ' ', $raw) ?? $raw);
    // mots tout en capitales (≥ 2 lettres) → minuscules, puis majuscule initiale
    $raw = preg_replace_callback('/\b\p{Lu}{2,}\b/u', fn($m) => mb_strtolower($m[0]), $raw) ?? $raw;
    $raw = mb_strtoupper(mb_substr($raw, 0, 1)) . mb_substr($raw, 1);
    $raw = trim($raw, " !?.…");
    $labels = ['devine' => 'devinette', 'choix' => 'tu préfères', 'culture' => 'culture générale', 'generations' => 'générations', 'emojis' => 'émojis', 'site' => 'YouQwiz'];
    $label = $labels[$ep['pillar'] ?? ''] ?? '';
    if (mb_stripos($raw, 'quiz') === false && mb_stripos($raw, 'tu préfères') === false && $label !== '') $raw = "Quiz $label : $raw";
    if (mb_strlen($raw) > 58) { $raw = mb_substr($raw, 0, 58); $raw = mb_substr($raw, 0, (int)mb_strrpos($raw, ' ')) . '…'; }
    return $raw . ' | YouQwiz';
}
function episode_pillar_slug(string $pillar): string { return (string)(array_search($pillar, EPISODES_PILLAR_SLUGS, true) ?: ''); }

/** URL à ajouter au sitemap (hub, hubs piliers, épisodes publiés) avec lastmod. */
function episodes_sitemap_urls(): array
{
    $list = episodes_published();
    $out = [['loc' => url('/quiz-du-jour/'), 'lastmod' => $list ? substr((string)$list[0]['publishAt'], 0, 10) : null]];
    foreach (EPISODES_PILLAR_SLUGS as $slug => $p) {
        $last = null;
        foreach ($list as $e) if ($e['pillar'] === $p) { $last = substr((string)$e['publishAt'], 0, 10); break; }
        if ($last) $out[] = ['loc' => url('/quiz-du-jour/' . $slug), 'lastmod' => $last];
    }
    foreach ($list as $e) $out[] = ['loc' => url('/quiz-du-jour/' . $e['id']), 'lastmod' => substr((string)$e['publishAt'], 0, 10)];
    return $out;
}

function episodes_dir(): string
{
    $d = (string)cfg('EPISODES_DIR', EPISODES_DIR);
    if (!is_dir($d)) @mkdir($d, 0755, true);
    return $d;
}
function episodes_key(): string
{
    $k = (string)cfg('SITE_SYNC_KEY', '');
    if ($k === '' && is_file(episodes_dir() . '/sync.key')) $k = trim((string)file_get_contents(episodes_dir() . '/sync.key'));
    return $k;
}
function episode_safe_id(string $id): string { return preg_replace('/[^a-z0-9-]/', '', strtolower($id)) ?? ''; }

/** Enregistrement complet {episode, longId, shortId, publishAt} si publié (ou $force), sinon null. */
function episode_load(string $id, bool $force = false): ?array
{
    $f = episodes_dir() . "/$id.json";
    if ($id === '' || !is_file($f)) return null;
    $rec = json_decode((string)file_get_contents($f), true);
    if (!$rec || empty($rec['episode']['items'])) return null;
    if (!$force && strtotime((string)$rec['publishAt']) > time()) return null;
    return $rec;
}
function episodes_published(): array
{
    $idx = episodes_dir() . '/index.json';
    if (!is_file($idx)) episodes_rebuild_index();
    $all = json_decode((string)@file_get_contents($idx), true) ?: [];
    $now = time();
    return array_values(array_filter($all, fn($e) => strtotime((string)$e['publishAt']) <= $now));
}
function episodes_rebuild_index(): void
{
    $out = [];
    foreach (glob(episodes_dir() . '/*.json') ?: [] as $f) {
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
    file_put_contents(episodes_dir() . '/index.json', json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}
function episode_date(string $iso): string { return fr_date((new DateTimeImmutable($iso))->setTimezone(new DateTimeZone('Europe/Paris'))->format('Y-m-d')); }

/* ---------------- API : /api/episodes ---------------- */
function api_episodes(string $method): void
{
    header('Cache-Control: no-store');
    if ($method === 'POST' && isset($_GET['vote'])) {
        $id = episode_safe_id((string)$_GET['vote']);
        $rec = episode_load($id);
        if (!$rec) json_error('épisode inconnu', 404);
        if (!rate_limit('episode_vote', 120, 600)) json_error('trop de votes', 429);
        $body = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
        $i = (int)($body['i'] ?? -1);
        $c = (int)($body['c'] ?? -1);
        if ($i < 0 || $i >= count($rec['episode']['items']) || !in_array($c, [0, 1], true)) json_error('vote invalide');
        $f = episodes_dir() . "/votes-$id.json";
        $fh = fopen($f, 'c+');
        flock($fh, LOCK_EX);
        $votes = json_decode(stream_get_contents($fh) ?: '[]', true) ?: [];
        $votes[$i] = $votes[$i] ?? [0, 0];
        $votes[$i][$c]++;
        ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($votes)); fflush($fh); flock($fh, LOCK_UN); fclose($fh);
        json_out(['ok' => true, 'votes' => $votes[$i]]);
    }
    if ($method === 'POST' && (isset($_GET['seo']) || preg_match('/^\{"(pages|series)"/', (string)file_get_contents('php://input')))) { api_seo_sync(); }
    if ($method === 'POST') {
        $key = episodes_key();
        if ($key === '') json_error('SITE_SYNC_KEY non configurée', 503);
        $raw = file_get_contents('php://input') ?: '';
        $sig = (string)($_SERVER['HTTP_X_YOUQWIZ_SIGNATURE'] ?? '');
        if (!hash_equals('sha256=' . hash_hmac('sha256', $raw, $key), $sig)) json_error('signature invalide', 401);
        $body = json_decode($raw, true);
        if (!is_array($body) || !isset($body['episode']['id'], $body['episode']['items'])) json_error('corps invalide');
        $ep = $body['episode'];
        $id = episode_safe_id((string)$ep['id']);
        if ($id === '' || $id !== $ep['id']) json_error('id invalide');
        if (!strtotime((string)($body['publishAt'] ?? ''))) json_error('publishAt invalide');
        unset($ep['voice'], $ep['variants']);
        foreach ($ep['items'] as &$it) unset($it['voice']);
        unset($it);
        $rec = [
            'episode' => $ep,
            'longId' => preg_replace('/[^A-Za-z0-9_-]/', '', (string)($body['longId'] ?? '')),
            'shortId' => preg_replace('/[^A-Za-z0-9_-]/', '', (string)($body['shortId'] ?? '')),
            'publishAt' => (string)$body['publishAt'],
            'receivedAt' => gmdate('c'),
        ];
        file_put_contents(episodes_dir() . "/$id.json", json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        episodes_rebuild_index();
        json_out(['ok' => true, 'id' => $id, 'url' => url('/quiz-du-jour/' . $id)]);
    }
    if (isset($_GET['id'])) {
        $rec = episode_load(episode_safe_id((string)$_GET['id']));
        if (!$rec) json_error('pas encore disponible', 404);
        json_out($rec);
    }
    json_out(['episodes' => episodes_published()]);
}

/* ---------------- Synchro des pages SEO gérées par l'agent (POST signé /api/episodes?seo=1) ---------------- */
/** Fichier JSON des pages SEO poussées depuis le dépôt youqwiz-tube (www/seo_pages_agent.json). */
function seo_agent_file(): string { return episodes_dir() . '/seo_pages_agent.json'; }
function seo_agent_pages(): array
{
    $f = seo_agent_file();
    return is_file($f) ? (json_decode((string)file_get_contents($f), true) ?: []) : [];
}
function api_seo_sync(): void
{
    $key = episodes_key();
    if ($key === '') json_error('SITE_SYNC_KEY non configurée', 503);
    $raw = file_get_contents('php://input') ?: '';
    $sig = (string)($_SERVER['HTTP_X_YOUQWIZ_SIGNATURE'] ?? '');
    if (!hash_equals('sha256=' . hash_hmac('sha256', $raw, $key), $sig)) json_error('signature invalide', 401);
    $body = json_decode($raw, true);
    if (!is_array($body)) json_error('corps invalide');
    $res = ['ok' => true];
    if (is_array($body['series'] ?? null) && function_exists('series_clean')) {
        if (count($body['series']) > 500) json_error('trop de séries');
        $ser = [];
        foreach ($body['series'] as $path => $sx) {
            $c = series_clean((string)$path, $sx);
            if ($c === null) json_error("série refusée : $path");
            $ser[$path] = $c;
        }
        file_put_contents(series_file(), json_encode($ser, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
        $res['series'] = count($ser);
    }
    if (!is_array($body['pages'] ?? null)) { if (isset($res['series'])) json_out($res); json_error('corps invalide'); }
    if (count($body['pages']) > 500) json_error('corps invalide');
    $txt = fn($v) => trim(strip_tags((string)$v));
    $html = fn($v) => strip_tags((string)$v, '<p><ul><ol><li><b><i><em><strong><br>');
    $out = [];
    foreach ($body['pages'] as $path => $pg) {
        if (!preg_match('#^/(quiz-[a-z0-9-]{3,80}|culture-generale/[a-z0-9-]{2,60}/[a-z0-9-]{2,80})$#', (string)$path)) json_error("chemin refusé : $path");
        if (!is_array($pg) || !quiz_type((string)($pg['type'] ?? ''))) json_error("type inconnu : $path");
        $out[$path] = [
            'type' => (string)$pg['type'], 'title' => $txt($pg['title'] ?? ''), 'description' => $txt($pg['description'] ?? ''),
            'h1' => $txt($pg['h1'] ?? ''), 'kicker' => $txt($pg['kicker'] ?? ''), 'intro' => $txt($pg['intro'] ?? ''),
            'exemple_noms' => array_map($txt, array_slice((array)($pg['exemple_noms'] ?? ['Alex']), 0, 2)),
            'sections' => array_map(fn($x) => [$txt($x[0] ?? ''), $html($x[1] ?? '')], array_slice((array)($pg['sections'] ?? []), 0, 12)),
            'faq' => array_map(fn($x) => [$txt($x[0] ?? ''), $txt($x[1] ?? '')], array_slice((array)($pg['faq'] ?? []), 0, 12)),
            'related' => array_map($txt, array_slice((array)($pg['related'] ?? []), 0, 8)),
        ];
        if ($out[$path]['title'] === '' || $out[$path]['h1'] === '') json_error("titre manquant : $path");
    }
    file_put_contents(seo_agent_file(), json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
    json_out($res + ['pages' => count($out)]);
}

/* ---------------- Pages ---------------- */
function page_episodes_index(): void
{
    $list = episodes_published();
    $th = EPISODES_THEMES[0];
    ob_start(); ?>
<div class="yq" style="--yq-bg:<?= $th['bg'] ?>;--yq-accent:<?= $th['accent'] ?>;--yq-soft:<?= $th['soft'] ?>">
  <header class="yq-hero">
    <p class="yq-kicker">Quiz du jour</p>
    <h1>Un quiz par jour, de facile à impossible</h1>
    <p class="yq-sub">Le quiz de la vidéo du jour, à jouer ici : 5 secondes par question, de 100 à 500 points. Nouveau quiz chaque jour à 17 h 30.</p>
  </header>
  <nav class="yq-pillars" aria-label="Types de quiz">
  <?php foreach (EPISODES_PILLAR_SLUGS as $slug => $p): ?><a class="yq-pill" href="/quiz-du-jour/<?= $slug ?>"><?= e(EPISODES_PILLARS[$p]) ?></a> <?php endforeach; ?>
  </nav>
<?php if (!$list): ?>
  <section class="yq-card yq-center"><p class="yq-big">Le premier quiz arrive à 17 h 30 ⏰</p><p><a class="yq-btn yq-btn-red" href="<?= EPISODES_CHANNEL ?>" target="_blank" rel="noopener">🔔 S'abonner à la chaîne</a></p></section>
<?php else: $t = $list[0]; ?>
  <a class="yq-card yq-today" href="/quiz-du-jour/<?= e($t['id']) ?>">
    <span class="yq-pill">Aujourd'hui · <?= e(episode_date($t['publishAt'])) ?></span>
    <span class="yq-today-emoji"><?= e($t['emoji']) ?></span>
    <span class="yq-today-title"><?= e($t['hook'] ?: $t['title']) ?></span>
    <span class="yq-today-sub"><?= (int)$t['count'] ?> <?= !empty($t['choice']) ? 'choix' : 'questions' ?> · <?= e(EPISODES_PILLARS[$t['pillar']] ?? '') ?></span>
    <span class="yq-btn">Jouer ▶</span>
  </a>
  <?php if (count($list) > 1): ?>
  <h2 class="yq-h2">Les quiz précédents</h2>
  <ul class="yq-list">
  <?php foreach (array_slice($list, 1) as $e): ?>
    <li><a href="/quiz-du-jour/<?= e($e['id']) ?>" style="--yq-accent:<?= EPISODES_THEMES[$e['theme'] % 3]['accent'] ?>">
      <span class="yq-list-emoji"><?= e($e['emoji']) ?></span>
      <span class="yq-list-main"><b><?= e($e['hook'] ?: $e['title']) ?></b><small><?= e(episode_date($e['publishAt'])) ?> · <?= (int)$e['count'] ?> <?= !empty($e['choice']) ? 'choix' : 'questions' ?></small></span>
      <span class="yq-list-go">Jouer</span>
    </a></li>
  <?php endforeach; ?>
  </ul>
  <?php endif; ?>
<?php endif; ?>
  <section class="yq-card yq-seo">
    <h2>Comment marche le quiz du jour ?</h2>
    <p>Chaque jour à 17 h 30, la chaîne YouTube YouQwiz publie un nouveau quiz : devinettes en 5 secondes, « tu préfères », culture générale, quiz générations ou émojis. Le même quiz est jouable ici, gratuitement et sans inscription. Les questions vont de facile à impossible et rapportent de 100 à 500 points ; enchaîne les bonnes réponses pour faire monter ta série 🔥. À la fin, partage ton score à tes proches ou écris-le en commentaire sous la vidéo : le meilleur de la semaine est cité le lundi.</p>
    <p>Tous les anciens quiz restent jouables, classés par type ci-dessus. Pour un quiz plus personnel, <a href="/">crée ton quiz « Qui me connaît le mieux ? »</a> et envoie-le à ta famille ou à tes amis.</p>
  </section>
  <nav class="yq-more"><a href="/culture-generale">Culture générale par thème</a> · <a href="/">Créer mon quiz entre proches</a></nav>
</div>
<?php
    $body = ob_get_clean();
    render_page([
        'jsonld' => episodes_breadcrumb([['Quiz du jour', url('/quiz-du-jour/')]]),
        'title' => 'Quiz du jour : un nouveau quiz chaque jour, de facile à impossible | YouQwiz',
        'description' => 'Chaque jour à 17 h 30, le quiz de la chaîne YouQwiz en version jouable : drapeaux, culture générale, tu préfères, intrus… 5 secondes par question, compte tes points et défie tes proches.',
        'canonical' => url('/quiz-du-jour/'),
        'og_image' => url('/og/quiz-du-jour.png'),
        'styles' => ['landing.css', 'episodes.css'],
        'body_class' => 'landing skin pal-menthe yq-page',
    ], $body);
}

function episodes_breadcrumb(array $trail): array
{
    $items = [['@type' => 'ListItem', 'position' => 1, 'name' => 'Accueil', 'item' => base_url() . '/']];
    foreach ($trail as $i => [$name, $u]) $items[] = ['@type' => 'ListItem', 'position' => $i + 2, 'name' => $name, 'item' => $u];
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items];
}

function page_episodes_pillar(string $slug): void
{
    $p = EPISODES_PILLAR_SLUGS[$slug];
    $name = EPISODES_PILLARS[$p];
    $h = ['devine' => 'Quiz devinettes en 5 secondes', 'choix' => 'Quiz « Tu préfères »', 'culture' => 'Quiz de culture générale', 'generations' => 'Quiz générations', 'emojis' => 'Quiz émojis et intrus', 'site' => 'Spécial youqwiz.com'][$p];
    $list = array_values(array_filter(episodes_published(), fn($e) => $e['pillar'] === $p));
    $th = EPISODES_THEMES[1];
    ob_start(); ?>
<div class="yq" style="--yq-bg:<?= $th['bg'] ?>;--yq-accent:<?= $th['accent'] ?>;--yq-soft:<?= $th['soft'] ?>">
  <header class="yq-hero">
    <p class="yq-kicker"><a href="/quiz-du-jour/">Quiz du jour</a> · <?= e($name) ?></p>
    <h1><?= e($h) ?> : tous les quiz du jour</h1>
    <p class="yq-sub"><?= e(EPISODES_PILLAR_INTRO[$p]) ?></p>
  </header>
<?php if (!$list): ?>
  <section class="yq-card yq-center"><p class="yq-big">Le premier quiz de cette série arrive bientôt ⏰</p><p><a class="yq-btn" href="/quiz-du-jour/">Voir tous les quiz du jour</a></p></section>
<?php else: ?>
  <ul class="yq-list">
  <?php foreach ($list as $e): ?>
    <li><a href="/quiz-du-jour/<?= e($e['id']) ?>" style="--yq-accent:<?= EPISODES_THEMES[$e['theme'] % 3]['accent'] ?>">
      <span class="yq-list-emoji"><?= e($e['emoji']) ?></span>
      <span class="yq-list-main"><b><?= e($e['hook'] ?: $e['title']) ?></b><small><?= e(episode_date($e['publishAt'])) ?> · <?= (int)$e['count'] ?> <?= !empty($e['choice']) ? 'choix' : 'questions' ?></small></span>
      <span class="yq-list-go">Jouer</span>
    </a></li>
  <?php endforeach; ?>
  </ul>
<?php endif; ?>
  <nav class="yq-pillars" aria-label="Autres types de quiz">
  <?php foreach (EPISODES_PILLAR_SLUGS as $s2 => $p2): if ($p2 === $p) continue; ?><a class="yq-pill" href="/quiz-du-jour/<?= $s2 ?>"><?= e(EPISODES_PILLARS[$p2]) ?></a> <?php endforeach; ?>
  </nav>
  <nav class="yq-more"><a href="/quiz-du-jour/">← Tous les quiz du jour</a> · <a href="/culture-generale">Culture générale par thème</a> · <a href="/">Créer mon quiz</a></nav>
</div>
<?php
    $body = ob_get_clean();
    $canonical = url('/quiz-du-jour/' . $slug);
    render_page(($list ? [] : ['robots' => 'noindex']) + [
        'title' => "$h : tous les quiz du jour | YouQwiz",
        'description' => mb_substr(EPISODES_PILLAR_INTRO[$p], 0, 150),
        'canonical' => $canonical,
        'og_image' => url('/og/quiz-du-jour.png'),
        'styles' => ['landing.css', 'episodes.css'],
        'body_class' => 'landing skin pal-menthe yq-page',
        'jsonld' => ['@context' => 'https://schema.org', '@graph' => [
            ['@type' => 'CollectionPage', 'name' => $h, 'url' => $canonical, 'inLanguage' => 'fr'],
            ['@type' => 'ItemList', 'itemListElement' => array_map(fn($e, $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'url' => url('/quiz-du-jour/' . $e['id'])], array_slice($list, 0, 30), array_keys(array_slice($list, 0, 30)))],
            array_diff_key(episodes_breadcrumb([['Quiz du jour', url('/quiz-du-jour/')], [$name, $canonical]]), ['@context' => 1]),
        ]],
    ], $body);
}

function page_episode(string $id): void
{
    if (isset(EPISODES_PILLAR_SLUGS[$id])) { page_episodes_pillar($id); return; }
    $id = episode_safe_id($id);
    $rec = episode_load($id);
    if (!$rec) {
        $soon = episode_load($id, true);
        if ($soon) {
            http_response_code(404);
            $body = '<div class="yq"><section class="yq-card yq-center"><h1>Ce quiz arrive à 17 h 30 ⏰</h1><p>Reviens à l\'heure de la vidéo pour y jouer.</p><p><a class="yq-btn" href="/quiz-du-jour/">Voir tous les quiz du jour</a></p></section></div>';
            render_page(['title' => 'Bientôt disponible | YouQwiz', 'robots' => 'noindex', 'styles' => ['landing.css', 'episodes.css'], 'body_class' => 'landing skin pal-menthe yq-page'], $body);
            return;
        }
        page_404('Ce quiz du jour n\'existe pas.');
        return;
    }
    $ep = $rec['episode'];
    $th = EPISODES_THEMES[((int)($ep['theme'] ?? 0)) % 3];
    $n = count($ep['items']);
    $isChoice = ($ep['items'][0]['prompt']['type'] ?? '') === 'choices';
    $hook = $ep['intro']['hook'] ?? $ep['title'];
    $title = episode_seo_title($ep, $n, $isChoice);
    $all = episodes_published();
    $pos = array_search($id, array_column($all, 'id'), true);
    $newer = ($pos !== false && $pos > 0) ? $all[$pos - 1] : null;
    $older = ($pos !== false && isset($all[$pos + 1])) ? $all[$pos + 1] : null;
    $same = array_slice(array_values(array_filter($all, fn($e) => $e['pillar'] === ($ep['pillar'] ?? '') && $e['id'] !== $id)), 0, 4);
    $pslug = episode_pillar_slug((string)($ep['pillar'] ?? ''));
    foreach ($all as $o) {
        if ($o['id'] !== $id && episode_seo_title(['title' => $o['title'], 'intro' => ['hook' => $o['hook']], 'pillar' => $o['pillar']], 0, false) === $title) {
            $title = preg_replace('/ \| YouQwiz$/', ' (' . (new DateTimeImmutable((string)$rec['publishAt']))->setTimezone(new DateTimeZone('Europe/Paris'))->format('d/m/Y') . ') | YouQwiz', $title);
            break;
        }
    }
    $desc = $isChoice
        ? "$n dilemmes impossibles à trancher en 5 secondes. Choisis, compare avec tout le monde et défie tes proches."
        : "$n questions de facile à impossible, 5 secondes chacune, 100 à 500 points. Compte tes points et partage ton score.";
    $canonical = url('/quiz-du-jour/' . $id);
    $votes = $isChoice && is_file(episodes_dir() . "/votes-$id.json") ? (json_decode((string)file_get_contents(episodes_dir() . "/votes-$id.json"), true) ?: []) : [];
    $longId = (string)$rec['longId'];
    ob_start(); ?>
<div class="yq" id="yq" style="--yq-bg:<?= $th['bg'] ?>;--yq-accent:<?= $th['accent'] ?>;--yq-soft:<?= $th['soft'] ?>">
  <header class="yq-hero"><meta charset="utf-8">
    <p class="yq-kicker"><a href="/quiz-du-jour/">Quiz du jour</a> · <?= e(episode_date($rec['publishAt'])) ?> · <?= e(EPISODES_PILLARS[$ep['pillar'] ?? ''] ?? '') ?></p>
    <h1><?= e($hook) ?></h1>
    <p class="yq-sub"><?= e($ep['intro']['sub'] ?? '') ?></p>
  </header>

  <section class="yq-card yq-center" id="yq-start">
    <div class="yq-stickers" aria-hidden="true"><img src="/assets/img/mascottes/chat-joue.webp" alt="" width="120" height="120"><img src="/assets/img/mascottes/poussin-clin.webp" alt="" width="110" height="110"></div>
    <p class="yq-big"><?= $n ?> <?= $isChoice ? 'choix' : 'questions' ?></p>
    <p><?= $isChoice ? 'Choisis vite, puis découvre ce que les autres ont répondu.' : 'De <b>facile</b> à <b>impossible</b> · 5 secondes par question · 100 à 500 points.' ?></p>
    <button class="yq-btn yq-btn-xl" type="button" id="yq-go">Jouer ▶</button>
    <p class="yq-tiny">Même quiz que la vidéo du jour<?= $longId ? ' · <a href="#yq-video">regarder la vidéo</a>' : '' ?>.</p>
  </section>

  <section class="yq-card" id="yq-game" hidden>
    <div class="yq-top">
      <span class="yq-pill" id="yq-progress">1 / <?= $n ?></span>
      <span class="yq-pill yq-level" id="yq-level">FACILE</span>
      <span class="yq-pill" id="yq-score">0 pts</span>
      <span class="yq-pill yq-streak" id="yq-streak" hidden>🔥 ×0</span>
    </div>
    <div class="yq-timer"><div class="yq-timer-bar" id="yq-bar"></div></div>
    <p class="yq-question" id="yq-question"></p>
    <div class="yq-stage" id="yq-stage"></div>
    <div class="yq-actions" id="yq-actions"></div>
    <p class="yq-fact" id="yq-fact" hidden></p>
  </section>

  <section class="yq-card yq-center yq-levelcard" id="yq-levelcard" hidden>
    <p class="yq-big" id="yq-levelcard-title"></p>
    <p id="yq-levelcard-sub"></p>
    <button class="yq-btn" type="button" id="yq-levelcard-go">C'est parti</button>
  </section>

  <section class="yq-card yq-center" id="yq-end" hidden>
    <p class="yq-kicker">Ton résultat</p>
    <p class="yq-huge" id="yq-final"></p>
    <p class="yq-big" id="yq-rank"></p>
    <p class="yq-grid" id="yq-emojigrid"></p>
    <div class="yq-row">
      <button class="yq-btn" type="button" id="yq-share">Partager mon score</button>
      <button class="yq-btn yq-btn-ghost" type="button" id="yq-again">Rejouer</button>
    </div>
    <p class="yq-tiny" id="yq-copied" hidden>Copié ! Colle-le à tes proches 👇</p>
    <p><a class="yq-btn yq-btn-red" href="<?= EPISODES_CHANNEL ?>" target="_blank" rel="noopener">🔔 S'abonner à la chaîne</a></p>
    <p class="yq-tiny">Écris ton score en commentaire sous la vidéo : le meilleur de la semaine est cité lundi 👑</p>
  </section>

<?php if ($longId): ?>
  <section class="yq-card" id="yq-video">
    <h2>La vidéo du jour</h2>
    <div class="yq-embed" data-yt="<?= e($longId) ?>">
      <img src="https://i.ytimg.com/vi/<?= e($longId) ?>/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">
      <button class="yq-play" type="button" aria-label="Lire la vidéo">▶</button>
    </div>
    <p class="yq-tiny">Un nouveau quiz chaque jour à 17 h 30 sur <a href="<?= EPISODES_CHANNEL ?>" target="_blank" rel="noopener">YouTube @youqwiz</a>.</p>
  </section>
<?php endif; ?>

<?php if (!$isChoice): ?>
  <details class="yq-card yq-answers">
    <summary>Voir toutes les réponses (<?= $n ?>)</summary>
    <ol>
    <?php foreach ($ep['items'] as $it): $p = $it['prompt']; ?>
      <li><span class="yq-ans-q"><?= $p['type'] === 'qcm' ? e($p['value']) : ($p['type'] === 'letter' ? e("Lettre {$p['value']} — {$p['category']}") : e((string)$p['value'])) ?></span> → <b><?= e((string)$it['answer']) ?></b><?= !empty($it['level']) ? ' <small>(' . e($it['level']) . ')</small>' : '' ?></li>
    <?php endforeach; ?>
    </ol>
  </details>
<?php endif; ?>

<?php if ($isChoice): ?>
  <details class="yq-card yq-answers">
    <summary>Voir les <?= $n ?> dilemmes<?= $votes ? ' et les votes' : '' ?></summary>
    <ol>
    <?php foreach ($ep['items'] as $i => $it): $v = (array)($it['prompt']['value'] ?? []); $vt = $votes[$i] ?? null; $tot = $vt ? max(1, $vt[0] + $vt[1]) : 0; ?>
      <li><?= e((string)($v[0] ?? '')) ?> <b>ou</b> <?= e((string)($v[1] ?? '')) ?><?= $vt ? ' <small>(' . round(100 * $vt[0] / $tot) . ' % / ' . round(100 * $vt[1] / $tot) . ' %)</small>' : '' ?></li>
    <?php endforeach; ?>
    </ol>
  </details>
<?php endif; ?>

  <section class="yq-card yq-related">
    <h2>Encore un quiz ?</h2>
    <div class="yq-row">
      <?php if ($older): ?><a class="yq-btn yq-btn-ghost" href="/quiz-du-jour/<?= e($older['id']) ?>">← Quiz précédent</a><?php endif; ?>
      <?php if ($newer): ?><a class="yq-btn yq-btn-ghost" href="/quiz-du-jour/<?= e($newer['id']) ?>">Quiz suivant →</a><?php endif; ?>
    </div>
    <?php if ($same): ?>
    <ul class="yq-list">
    <?php foreach ($same as $e): ?>
      <li><a href="/quiz-du-jour/<?= e($e['id']) ?>"><span class="yq-list-emoji"><?= e($e['emoji']) ?></span><span class="yq-list-main"><b><?= e($e['hook'] ?: $e['title']) ?></b><small><?= e(episode_date($e['publishAt'])) ?></small></span><span class="yq-list-go">Jouer</span></a></li>
    <?php endforeach; ?>
    </ul>
    <?php endif; ?>
    <?php if ($pslug): ?><p><a href="/quiz-du-jour/<?= $pslug ?>">Tous les quiz <?= e(mb_strtolower(EPISODES_PILLARS[$ep['pillar']])) ?></a></p><?php endif; ?>
  </section>

  <nav class="yq-more"><a href="/quiz-du-jour/">← Tous les quiz du jour</a> · <a href="/culture-generale">Culture générale par thème</a> · <a href="/">Créer mon quiz</a></nav>
</div>
<?php
    $body = ob_get_clean();
    $jsonld = [
        '@context' => 'https://schema.org', '@type' => 'Quiz', 'name' => preg_replace('/\s*\|\s*YouQwiz$/', '', $title), 'description' => $desc, 'url' => $canonical,
        'inLanguage' => 'fr', 'datePublished' => gmdate('c', strtotime((string)$rec['publishAt'])), 'numberOfQuestions' => $n,
        'publisher' => ['@type' => 'Organization', 'name' => 'YouQwiz', 'url' => base_url()],
    ];
    $graph = [array_diff_key($jsonld, ['@context' => 1])];
    if ($longId) $graph[] = ['@type' => 'VideoObject', 'name' => preg_replace('/\s*\|\s*YouQwiz$/', '', $title), 'description' => $desc, 'thumbnailUrl' => ["https://i.ytimg.com/vi/$longId/maxresdefault.jpg", "https://i.ytimg.com/vi/$longId/hqdefault.jpg"], 'uploadDate' => gmdate('c', strtotime((string)$rec['publishAt'])), 'embedUrl' => "https://www.youtube.com/embed/$longId", 'contentUrl' => "https://www.youtube.com/watch?v=$longId", 'publisher' => ['@type' => 'Organization', 'name' => 'YouQwiz', 'url' => base_url()]];
    $trail = [['Quiz du jour', url('/quiz-du-jour/')]];
    if ($pslug) $trail[] = [EPISODES_PILLARS[$ep['pillar']], url('/quiz-du-jour/' . $pslug)];
    $trail[] = [preg_replace('/\s*\|\s*YouQwiz$/', '', $title), $canonical];
    $b = episodes_breadcrumb($trail); unset($b['@context']); $graph[] = $b;
    $jsonld = ['@context' => 'https://schema.org', '@graph' => $graph];
    render_page([
        'title' => $title,
        'description' => $desc,
        'canonical' => $canonical,
        'og_title' => $hook . ' — quiz jouable',
        'og_image' => $longId ? "https://i.ytimg.com/vi/$longId/maxresdefault.jpg" : url('/og/quiz-du-jour.png'),
        'styles' => ['landing.css', 'episodes.css'],
        'body_class' => 'landing skin pal-menthe yq-page',
        'scripts' => ['episodes.js'],
        'data' => ['page' => 'episode', 'episode' => $ep, 'votes' => $votes, 'url' => $canonical, 'longId' => $longId],
        'jsonld' => $jsonld,
    ], $body);
}
