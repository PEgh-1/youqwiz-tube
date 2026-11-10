// Pose des écrans de fin YouTube « vidéo longue v2 » (10/11/2026) — à exécuter par Claude dans le navigateur Playwright
// (serveur playwright-a, profil connecté à YouTube Studio), via browser_run_code_unsafe, en remplaçant IDS_PLACEHOLDER par la
// liste des identifiants YouTube des vidéos longues (queue.json → longId, entrées sans endScreen).
//
// Disposition = carte « Prochain quiz » (src/components.tsx → NEXT_SCREEN) : modèle « 2 vidéos » dont les deux éléments sont
// remontés en haut de la zone autorisée (y 141→490), plus un élément « S'abonner » ajouté et glissé en bas au centre (813, 619,
// rond de 296 px). YouTube n'accepte les éléments qu'entre 13,1 % et 84,7 % de la hauteur.
// Les vidéos d'avant la v2 (packshot 1 vidéo + S'abonner, bas gauche / bas droite) se posent avec le 1er modèle (voir
// la version précédente de ce script dans l'historique de la session).
async (page) => {
  const ids = IDS_PLACEHOLDER;
  const out = [];
  const measure = () => page.evaluate(() => {
    const vr = document.querySelector("video").getBoundingClientRect();
    return [...document.querySelectorAll("ytve-endscreen-editor-preview-overlay-item")].map((e) => { const b = e.getBoundingClientRect(); const t = e.querySelector(".ytp-ce-element"); return { cls: t ? t.className.replace(/style-scope.*/, "").slice(0, 40) : "", x: Math.round((b.left - vr.left) / vr.width * 1920), y: Math.round((b.top - vr.top) / vr.height * 1080), w: Math.round(b.width / vr.width * 1920), h: Math.round(b.height / vr.height * 1080) }; }).filter((e) => e.w > 0);
  });
  const drag = async (vr, item, cx, cy) => {
    const b = await item.boundingBox();
    const sx = b.x + b.width / 2, sy = b.y + b.height / 2;
    const tx = vr.left + (cx / 1920) * vr.width, ty = vr.top + (cy / 1080) * vr.height;
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.waitForTimeout(200);
    for (let k = 1; k <= 12; k++) { await page.mouse.move(sx + ((tx - sx) * k) / 12, sy + ((ty - sy) * k) / 12); await page.waitForTimeout(60); }
    await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(1000);
  };
  for (const id of ids) {
    await page.goto(`https://studio.youtube.com/video/${id}/editor`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    let txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    if (/Validez votre identité/.test(txt)) { out.push(id + ": identité à valider par Pierre-Éloi"); break; }
    if (/Contenu adapté au spectateur/.test(txt)) { out.push(id + ": déjà présent"); continue; }
    await page.evaluate(() => { const b = document.querySelector('ytcp-button[label="Premiers pas"]'); if (b) b.click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const t = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent.trim() === "Écran de fin"); if (t) t.click(); });
    await page.waitForTimeout(3000);
    const ok = await page.evaluate(() => { const t = document.querySelector('tp-yt-paper-item[test-id="APPLY_TEMPLATE"]'); if (t) { t.click(); return true; } return false; });
    if (!ok) { out.push(id + ": menu absent"); continue; }
    await page.waitForTimeout(2500);
    // modèle « 2 vidéos » (4e carte)
    const cards = page.locator('[role="gridcell"].card');
    if ((await cards.count()) < 4) { out.push(id + ": modèle 2 vidéos absent"); continue; }
    await cards.nth(3).click();
    await page.waitForTimeout(3500);
    // + élément S'abonner
    const elBtn = page.locator("ytcp-button", { hasText: /^Élément$/ }).first();
    await elBtn.click(); await page.waitForTimeout(1500);
    await page.evaluate(() => { const i = [...document.querySelectorAll("tp-yt-paper-item")].find((x) => /S.abonner/.test(x.innerText)); if (i) i.click(); });
    await page.waitForTimeout(3000);
    const vr = await page.evaluate(() => { const b = document.querySelector("video").getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; });
    const items = page.locator("ytve-endscreen-editor-preview-overlay-item");
    const n = await items.count(); const vids = []; let sub = null;
    for (let i = 0; i < n; i++) { const c = await items.nth(i).evaluate((e) => (e.querySelector(".ytp-ce-element") || {}).className || ""); if (/ytp-ce-video/.test(c)) vids.push(items.nth(i)); else if (/ytp-ce-channel/.test(c)) sub = items.nth(i); }
    if (vids.length < 2 || !sub) { out.push(id + `: éléments inattendus (${vids.length} vidéos, abonner=${!!sub})`); continue; }
    if (sub) await drag(vr, sub, 813 + 148, 619 + 148);
    await drag(vr, vids[0], 45 + 310, 141 + 175);
    await drag(vr, vids[1], 1014 + 310, 141 + 175);
    const geo = await measure();
    const saved = await page.evaluate(() => { const bs = [...document.querySelectorAll("ytcp-button")].filter((b) => /Enregistrer/.test(b.innerText) && b.getAttribute("aria-disabled") !== "true"); const b = bs[bs.length - 1]; if (b) { b.click(); return true; } return false; });
    await page.waitForTimeout(5000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    out.push(id + ": save=" + saved + " " + (/Contenu adapté au spectateur/.test(txt) && /S.abonner: YouQwiz/.test(txt) ? "OK" : "à vérifier") + " " + JSON.stringify(geo));
  }
  return out.join(" | ");
}
