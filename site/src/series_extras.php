<?php
declare(strict_types=1);
/* Extrait déployé à la fin de src/pages_series.php sur le serveur (12/11/2026). */

/* ---------------- Sources, date de vérification et PDF à imprimer (12/11/2026) ---------------- */

/** URL de source d'une question : https uniquement, sans espace ni guillemet (sinon chaîne vide). */
function series_source_url(string $u): string
{
    $u = trim($u);
    if (strlen($u) > 300 || !preg_match('#^https://[a-z0-9.-]+\.[a-z]{2,}/[^\s"<>\']*$#iu', $u)) return '';
    return $u;
}

/** Lien « source » affiché après l'explication d'une question. */
function series_source_html(string $u): string
{
    if ($u === '') return '';
    $host = (string)parse_url($u, PHP_URL_HOST);
    $name = str_contains($host, 'wikipedia.org') ? 'Wikipédia' : (str_contains($host, 'wiktionary.org') ? 'Wiktionnaire' : (string)preg_replace('/^www\./', '', $host));
    return ' <small class="yq-src">(' . e(t('source')) . ' : <a href="' . e($u) . '" target="_blank" rel="noopener">' . e($name) . '</a>)</small>';
}

/** Date AAAA-MM-JJ en toutes lettres (français), telle quelle dans les autres langues. */
function series_date_fr(string $d): string
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) return '';
    if (lang() !== 'fr') return $d;
    $mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    $j = (int)$m[3];
    return $j . ($j === 1 ? 'er' : '') . ' ' . $mois[max(0, min(11, (int)$m[2] - 1))] . ' ' . $m[1];
}

/** PDF à imprimer d'une série (français) : /media/pdf/quiz-<sujet>.pdf s'il existe. */
function series_pdf_url(string $path): string
{
    if (lang() !== 'fr' || !preg_match('#^/quiz-[a-z0-9-]+$#', $path)) return '';
    $f = '/media/pdf/' . substr($path, 1) . '.pdf';
    return is_file(APP_ROOT . $f) ? $f : '';
}

/** Ligne « réponses vérifiées le … · PDF » au-dessus du corrigé. */
function series_meta_html(array $s): string
{
    $bits = [];
    $d = series_date_fr((string)($s['verified'] ?? ''));
    if ($d !== '') $bits[] = e(t('Réponses vérifiées le {date}, avec la source de chaque réponse.', ['date' => $d]));
    $pdf = series_pdf_url((string)($s['path'] ?? ''));
    if ($pdf !== '') $bits[] = '<a href="' . e($pdf) . '">' . e(t('Télécharger ce quiz en PDF à imprimer (questions + réponses)')) . '</a>';
    return $bits ? '<p class="yq-tiny">' . implode(' · ', $bits) . '</p>' : '';
}

/** Page /quiz-a-imprimer : toutes les séries disponibles en PDF, par thème. */
function page_print_hub(): void
{
    $labels = ['geographie' => 'Géographie', 'histoire' => 'Histoire', 'sciences' => 'Sciences', 'nature' => 'Nature et animaux',
               'sport' => 'Sport', 'culture' => 'Culture et loisirs', 'langue' => 'Langue française', 'cinema' => 'Cinéma et séries',
               'musique' => 'Musique'];
    $rows = [];
    foreach (series_all('fr') as $p => $s) {
        $pdf = series_pdf_url($p);
        if ($pdf === '') continue;
        $th = (string)($s['theme'] ?? '');
        $rows[isset($labels[$th]) ? $labels[$th] : 'Divers'][] = [$p, $s, $pdf];
    }
    ksort($rows);
    $n = array_sum(array_map('count', $rows));
    $canonical = url('/quiz-a-imprimer');
    $faq = [
        ['Les quiz à imprimer sont-ils gratuits ?', 'Oui. Chaque PDF est gratuit, sans inscription ni adresse e-mail à donner. Tu peux l\'imprimer autant de fois que tu veux pour une soirée en famille, une animation en club, en maison de retraite ou en classe. Seule la revente des PDF est interdite.'],
        ['Les réponses sont-elles incluses ?', 'Oui. Chaque PDF contient d\'abord les 20 questions avec leurs propositions, puis une page séparée avec les réponses et une courte explication. Tu peux donc distribuer les questions et garder le corrigé pour l\'animateur ou pour la fin de la partie.'],
        ['Comment organiser un quiz avec ces PDF ?', 'Imprime une feuille de questions par joueur ou par équipe, lis les questions à voix haute ou laisse chacun répondre seul, puis corrige ensemble avec la page des réponses. Compte environ 15 minutes par quiz de 20 questions. Tu peux aussi jouer en ligne sur la même page avec un chrono et des points.'],
    ];
    ob_start(); ?>
<div class="yq" id="yq">
  <header class="yq-hero">
    <p class="yq-kicker"><a href="<?= e(lpath('/culture-generale')) ?>">Culture générale</a> · <?= $n ?> quiz en PDF</p>
    <h1>Quiz de culture générale à imprimer, avec les réponses</h1>
    <p class="yq-sub">Tous nos quiz de culture générale existent en PDF gratuit à imprimer : 20 questions à choix multiple par quiz, de facile à expert, et une page de réponses avec une courte explication pour chaque question. Pratique pour une soirée en famille, un repas entre amis, une animation en club ou en maison de retraite, ou un moment en classe. Choisis ton thème ci-dessous, télécharge le PDF et imprime-le. Tu préfères jouer sur écran ? Chaque quiz se joue aussi en ligne, avec un chrono et des points.</p>
  </header>
<?php foreach ($rows as $label => $list): ?>
  <section class="yq-card yq-related">
    <h2><?= e($label) ?></h2>
    <ul class="yq-list">
<?php foreach ($list as [$p, $s, $pdf]): ?>
      <li><a href="<?= e($pdf) ?>"><span class="yq-list-emoji">🖨️</span><span class="yq-list-main"><b><?= e(trim((string)preg_replace('/\s*:.*$/u', '', $s['h1']))) ?></b><small><?= count($s['questions']) ?> questions + réponses</small></span><span class="yq-list-go">PDF</span></a></li>
<?php endforeach; ?>
    </ul>
  </section>
<?php endforeach; ?>
  <section class="yq-card yq-seo">
    <h2>Questions fréquentes</h2>
<?php foreach ($faq as [$fq, $fa]): ?>    <h3><?= e($fq) ?></h3><p><?= e($fa) ?></p>
<?php endforeach; ?>
  </section>
  <nav class="yq-more"><a href="<?= e(lpath('/culture-generale')) ?>">← Culture générale</a> · <a href="<?= e(lpath('/quiz-du-jour/')) ?>">Quiz du jour</a></nav>
</div>
<?php
    $body = ob_get_clean();
    $ld = ['@context' => 'https://schema.org', '@graph' => [
        ['@type' => 'CollectionPage', 'name' => 'Quiz de culture générale à imprimer', 'url' => $canonical, 'inLanguage' => 'fr'],
        breadcrumb_ld([['Accueil', lurl('/')], ['Culture générale', lurl('/culture-generale')], ['Quiz à imprimer', $canonical]]),
        ['@type' => 'FAQPage', 'mainEntity' => array_map(fn($f) => ['@type' => 'Question', 'name' => $f[0], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f[1]]], $faq)],
    ]];
    render_page([
        'title' => 'Quiz culture générale à imprimer (PDF gratuit avec réponses) | YouQwiz',
        'description' => 'Quiz de culture générale à imprimer en PDF gratuit : 20 questions par thème, de facile à expert, avec une page de réponses expliquées.',
        'canonical' => $canonical,
        'styles' => ['landing.css', 'episodes.css'],
        'body_class' => 'landing skin pal-menthe yq-page',
        'jsonld' => $ld,
    ], $body);
}
