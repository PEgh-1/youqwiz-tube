// Sauvegarde de l'état sans écraser le travail des autres exécutions (fusion à trois voies de queue.json).
// Avant : « git pull --rebase -X theirs » sur un JSON entier → une exécution démarrée tôt remettait
// des identifiants périmés (incident du 02/11/2026) ou produisait un JSON invalide.
// Ici : base = état au début de l'exécution (HEAD), local = fichier modifié, distant = origin/main.
// On rejoue sur le distant uniquement les entrées que CETTE exécution a ajoutées, modifiées ou retirées.
// Usage : node scripts/save-state.mjs --message "état : …" [--paths "data/state data/episodes"]
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { argv } from "./lib.mjs";

const sh = (c, opt = {}) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opt }).trim();
const message = argv("message", "état : mise à jour");
const paths = argv("paths", "data/state").split(/\s+/).filter(Boolean);
const Q = "data/state/queue.json";
const show = (ref) => { try { return JSON.parse(sh(`git show ${ref}:${Q}`)); } catch { return null; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

sh(`git config user.name "youqwiz-bot"`);
sh(`git config user.email "bot@youqwiz.com"`);
const base = show("HEAD");
const local = existsSync(Q) ? JSON.parse(readFileSync(Q, "utf8")) : null;

// Fichiers autres que queue.json : copie de côté, on les réapplique après la mise à jour.
// -z : chemins non échappés ; pas de trim() (le " M " d'un fichier suivi commence par une espace — bug du 06/11/2026 :
// la première ligne perdait son premier caractère de chemin et le fichier n'était jamais enregistré).
const others = execSync(`git status --porcelain -z --untracked-files=all -- ${paths.join(" ")}`, { encoding: "utf8" })
  .split("\0").filter(Boolean).map((l) => l.slice(3)).filter((f) => f !== Q && existsSync(f));
const saved = Object.fromEntries(others.map((f) => [f, readFileSync(f)]));

for (let attempt = 1; attempt <= 5; attempt++) {
  sh("git fetch -q origin main");
  sh("git reset -q --hard origin/main");
  for (const [f, buf] of Object.entries(saved)) { execSync(`mkdir -p "$(dirname '${f}')"`); writeFileSync(f, buf); }
  if (local) {
    const remote = show("origin/main") ?? { published: [] };
    const byId = (arr) => new Map((arr ?? []).map((r) => [r.id, r]));
    const b = byId(base?.published), l = byId(local.published), out = byId(remote.published);
    for (const [id, r] of l) if (!same(b.get(id), r)) out.set(id, r);   // ajouté ou modifié ici
    for (const id of b.keys()) if (!l.has(id)) out.delete(id);           // retiré ici
    remote.published = [...out.values()].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    const bp = base?.pending ?? {}, lp = local.pending ?? {};
    remote.pending ??= {};
    for (const [k, v] of Object.entries(lp)) if (!same(bp[k], v)) remote.pending[k] = v;
    for (const k of Object.keys(bp)) if (!(k in lp)) delete remote.pending[k];
    const dates = remote.published.map((r) => r.date).filter(Boolean).sort();
    remote.lastScheduled = dates.at(-1) ?? remote.lastScheduled ?? null;
    for (const k of Object.keys(local)) if (!["published", "pending", "lastScheduled"].includes(k) && !same(base?.[k], local[k])) remote[k] = local[k];
    writeFileSync(Q, JSON.stringify(remote, null, 2) + "\n");
  }
  sh(`git add -A -- ${paths.join(" ")}`);
  if (!sh("git diff --cached --name-only")) { console.log("état : rien à enregistrer"); process.exit(0); }
  sh(`git commit -q -m ${JSON.stringify(message)}`);
  try { sh("git push -q origin HEAD:main"); console.log(`état enregistré (essai ${attempt})`); process.exit(0); }
  catch (e) { console.warn(`push refusé (essai ${attempt}), nouvelle fusion…`); }
}
throw new Error("état non enregistré après 5 essais");
