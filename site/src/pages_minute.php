<?php
declare(strict_types=1);

/**
 * « La minute culture générale » (11/11/2026) : page d'arrivée des Shorts quotidiens de 8 h 10 et 20 h 40 → /minute
 * La question du Short, jouable (3 propositions, réponse et anecdote), puis le grand quiz du soir et les quiz par thème.
 * Données : fiches youqwiz-data/minutes/AAAA-MM-JJ.json, rapatriées du dépôt youqwiz-tube par pull-episodes.php
 * (pull-minutes.inc.php). Une minute n'apparaît qu'à partir de l'heure de publication de son Short. Français seulement.
 * Sans JavaScript : la réponse s'affiche en CSS (boutons radio), voir assets/css/minute.css.
 * Contient aussi les petits blocs « chaîne YouTube » de l'accueil et le libellé daté du dernier quiz du jour.
 */

const MINUTE_SLOTS = [1 => '08:10', 2 => '20:40'];
const MINUTE_TZ = 'Europe/Paris';

/** Minutes déjà publiées, de la plus récente à la plus ancienne. */
function minute_list(int $max = 12): array
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        $tz = new DateTimeZone(MINUTE_TZ);
        $now = new DateTimeImmutable('now', $tz);
        $files = glob(episodes_dir() . '/minutes/*.json') ?: [];
        rsort($files);
        foreach (array_slice($files, 0, 21) as $f) {
            $date = basename($f, '.json');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) continue;
            $d = json_decode((string)@file_get_contents($f), true);
            if (!is_array($d) || empty($d['minutes']) || !is_array($d['minutes'])) continue;
            foreach ($d['minutes'] as $m) {
                $slot = (int)($m['slot'] ?? 0);
                $ch = array_values(array_filter((array)($m['choices'] ?? []), 'is_string'));
                $ok = (int)($m['correct'] ?? -1);
                $q = trim((string)($m['question'] ?? ''));
                if (!isset(MINUTE_SLOTS[$slot]) || count($ch) !== 3 || $ok < 0 || $ok > 2 || $q === '') continue;
                $at = new DateTimeImmutable($date . ' ' . MINUTE_SLOTS[$slot], $tz);
                if ($at > $now) continue;
                $cache[] = ['key' => str_replace('-', '', $date) . $slot, 'date' => $date, 'slot' => $slot, 'at' => $at->getTimestamp(),
                    'question' => $q, 'choices' => $ch, 'correct' => $ok, 'fact' => trim((string)($m['fact'] ?? ''))];
            }
        }
        usort($cache, fn($a, $b) => $b['at'] <=> $a['at']);
    }
    return array_slice($cache, 0, $max);
}

/** Libellé « Ce matin », « Ce soir », « Hier soir », sinon la date. */
function minute_when(array $m): string
{
    $tz = new DateTimeZone(MINUTE_TZ);
    $today = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
    $yest = (new DateTimeImmutable('yesterday', $tz))->format('Y-m-d');
    $soir = $m['slot'] === 2;
    if ($m['date'] === $today) return $soir ? 'Ce soir' : 'Ce matin';
    if ($m['date'] === $yest) return $soir ? 'Hier soir' : 'Hier matin';
    return fr_date($m['date']) . ($soir ? ', le soir' : ', le matin');
}

/** Une question jouable : 3 boutons radio masqués, leurs étiquettes en boutons, puis la réponse révélée en CSS. */
function minute_question_html(array $m, bool $big): string
{
    $k = 'mn' . $m['key'];
    $h = '<form class="yq-card mn-q' . ($big ? ' mn-big' : '') . '" action="#" onsubmit="return false">'
        . '<p class="mn-when"><span class="yq-pill">🎙️ ' . e(minute_when($m)) . '</span></p>'
        . '<' . ($big ? 'h2' : 'h3') . ' class="mn-hook" id="' . $k . '">' . e($m['question']) . '</' . ($big ? 'h2' : 'h3') . '>';
    foreach ($m['choices'] as $i => $c) {
        $h .= '<input class="mn-r mn-r' . $i . ($i === $m['correct'] ? ' mn-ok' : ' mn-ko') . '" type="radio" name="' . $k . '" id="' . $k . $i . '" aria-describedby="' . $k . '">';
    }
    foreach ($m['choices'] as $i => $c) {
        $h .= '<label class="mn-l mn-l' . $i . ($i === $m['correct'] ? ' mn-good' : '') . '" for="' . $k . $i . '"><b>' . 'ABC'[$i] . '</b> ' . e($c) . '</label>';
    }
    $h .= '<div class="mn-reveal"><p class="mn-verdict"><span class="mn-yes">✅ Bien joué !</span><span class="mn-no">❌ Raté !</span> La bonne réponse : <b>' . e($m['choices'][$m['correct']]) . '</b></p>'
        . ($m['fact'] !== '' ? '<p class="mn-fact">💡 ' . e($m['fact']) . '</p>' : '') . '</div></form>';
    return $h;
}

/** /minute */
function page_minute(): void
{
    if (lang() !== 'fr') redirect(base_url() . '/minute', 302);
    $list = minute_list(11);
    $eps = episodes_published();
    $ep = $eps[0] ?? null;
    $channel = episodes_channel();
    $th = EPISODES_THEMES[0];
    ob_start(); ?>
<div class="yq mn" style="--yq-bg:<?= $th['bg'] ?>;--yq-accent:<?= $th['accent'] ?>;--yq-soft:<?= $th['soft'] ?>">
  <header class="yq-hero">
    <p class="yq-kicker">La minute culture générale</p>
    <h1>Aujourd'hui, scroller va te rendre plus malin</h1>
    <p class="yq-sub">Une question, trois propositions, une anecdote : la question de la vidéo, à jouer ici. Nouvelle minute chaque jour à 8 h 10 et à 20 h 40.</p>
  </header>
<?php if (!$list): ?>
  <section class="yq-card yq-center">
    <p class="yq-big">La prochaine minute arrive à 8 h 10 ⏰</p>
    <p>En attendant, le grand quiz du jour et les quiz par thème sont juste en dessous.</p>
  </section>
<?php else: ?>
  <?= minute_question_html($list[0], true) ?>
<?php endif; ?>

  <section class="yq-card yq-center mn-next">
    <p class="yq-kicker">Tu en veux encore ?</p>
<?php if ($ep): ?>
    <p class="yq-big"><?= e($ep['emoji']) ?> Le grand quiz du jour</p>
    <p><?= e($ep['hook'] ?: $ep['title']) ?> · <?= e(episode_count_label((int)$ep['count'], !empty($ep['choice']))) ?>, de facile à impossible.</p>
    <p><a class="yq-btn" href="<?= e(lpath('/quiz-du-jour/' . $ep['id'])) ?>">Jouer au grand quiz ▶</a></p>
<?php else: ?>
    <p class="yq-big">Le grand quiz du jour</p>
    <p><a class="yq-btn" href="<?= e(lpath('/quiz-du-jour/')) ?>">Voir les quiz du jour ▶</a></p>
<?php endif; ?>
    <p class="mn-sub">Chaque soir à 17 h 30, un nouveau grand quiz sur la chaîne YouTube YouQwiz.</p>
    <p><a class="yq-btn yq-btn-red" href="<?= e($channel) ?>" target="_blank" rel="noopener">🔔 S'abonner à la chaîne</a></p>
  </section>

<?php if (count($list) > 1): ?>
  <h2 class="yq-h2">Les minutes précédentes</h2>
<?php foreach (array_slice($list, 1) as $m) echo minute_question_html($m, false); ?>
<?php endif; ?>

  <section class="yq-card mn-themes">
<?= cg_themes_html(null, 'Culture générale par thème') ?>
    <p class="mn-sub">10 questions par série, avec la correction et une explication à chaque réponse. Gratuit, sans inscription.</p>
  </section>
  <nav class="yq-more"><a href="<?= e(lpath('/quiz-du-jour/')) ?>">Tous les quiz du jour</a> · <a href="<?= e(lpath('/')) ?>">Créer mon quiz entre proches</a></nav>
</div>
<?php
    $body = ob_get_clean();
    render_page([
        'jsonld' => episodes_breadcrumb([['La minute culture générale', url('/minute')]]),
        'title' => 'La minute culture générale : la question du jour, la réponse et l\'anecdote | YouQwiz',
        'description' => 'La question de culture générale du jour, vue sur YouTube, Instagram, Facebook ou TikTok : trois propositions, la réponse et une anecdote. Puis le grand quiz du soir, gratuit et sans inscription.',
        'canonical' => url('/minute'),
        'styles' => ['landing.css', 'episodes.css', 'minute.css'],
        'body_class' => 'landing skin pal-menthe yq-page',
        'alternates' => [],
    ], $body);
}

/** Accueil : carte « La minute culture » (dernière question publiée), en français seulement. */
function minute_home_card_html(): string
{
    if (lang() !== 'fr') return '';
    $list = minute_list(1);
    if (!$list) return '';
    return '<a class="hm-daily" href="/minute" style="background:linear-gradient(135deg,#B3261E,#E4572E);box-shadow:0 10px 26px rgba(179,38,30,.3)">'
        . '<span style="flex:0 0 104px;font-size:60px;line-height:104px;text-align:center" aria-hidden="true">🎙️</span>'
        . '<span><span class="hm-tag">La minute culture · ' . e(mb_strtolower(minute_when($list[0]))) . '</span><b>' . e($list[0]['question']) . '</b>'
        . '<span class="hm-meta">Trois propositions, la réponse et une anecdote. Une minute, pas plus.</span><span class="hm-cta">Répondre ➜</span></span></a>';
}

/** Accueil : lien d'abonnement à la chaîne YouTube de la langue. */
function youtube_home_line_html(): string
{
    return '<p style="margin:0;padding:4px 18px 14px;text-align:center"><a href="' . e(episodes_channel()) . '" target="_blank" rel="noopener" '
        . 'style="display:inline-block;background:#E62117;color:#fff;font:900 15px/20px var(--font-title);padding:9px 16px;border-radius:14px;text-decoration:none;box-shadow:0 3px 0 rgba(0,0,0,.2)">▶ '
        . e(t('Un grand quiz chaque jour sur YouTube : s\'abonner')) . '</a></p>';
}

/**
 * Index des quiz du jour : libellé daté du dernier quiz (« Aujourd'hui », « Hier », sinon « Dernier quiz ») et, tant que le quiz
 * du jour n'est pas sorti, attente avant le prochain (même heure que le dernier, fuseau de la chaîne).
 * @return array{0:string,1:string} [libellé, attente ou '']
 */
function episodes_latest_label(array $ep): array
{
    $tz = new DateTimeZone(EPISODES_TZ[episodes_lang()] ?? EPISODES_TZ['fr']);
    $now = new DateTimeImmutable('now', $tz);
    $pub = (new DateTimeImmutable((string)$ep['publishAt']))->setTimezone($tz);
    $days = (int)$pub->setTime(0, 0)->diff($now->setTime(0, 0))->days;
    $date = episode_date((string)$ep['publishAt']);
    if ($days <= 0) return [t('Aujourd\'hui · {date}', ['date' => $date]), ''];
    $label = $days === 1 ? t('Hier · {date}', ['date' => $date]) : t('Dernier quiz · {date}', ['date' => $date]);
    $next = $now->setTime((int)$pub->format('G'), (int)$pub->format('i'));
    if ($next <= $now) return [$label, ''];
    $min = max(1, intdiv($next->getTimestamp() - $now->getTimestamp() + 59, 60));
    $wait = $min >= 60 ? t('⏰ Nouveau quiz dans {h} h {m}', ['h' => intdiv($min, 60), 'm' => str_pad((string)($min % 60), 2, '0', STR_PAD_LEFT)]) : t('⏰ Nouveau quiz dans {m} min', ['m' => $min]);
    return [$label, $wait];
}
