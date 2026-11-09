// Génère la banque « maths » (calcul mental) de façon déterministe : data/banks/new-maths.json
// Usage : node scripts/gen-maths.mjs [--n 220]  puis  node scripts/validate-bank.mjs data/banks/new-maths.json --merge
import { argv, p, rng, writeJson } from "./lib.mjs";

const N = Number(argv("n", 220));
const rand = rng("maths-2026");
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const fmt = (n) => n.toLocaleString("fr-FR").replace(/ /g, " ");

const makers = {
  facile: [
    () => { const a = ri(2, 30), b = ri(2, 30); return [`${a} + ${b}`, a + b]; },
    () => { const a = ri(10, 40), b = ri(1, a - 1); return [`${a} − ${b}`, a - b]; },
    () => { const a = ri(2, 9), b = ri(2, 9); return [`${a} × ${b}`, a * b]; },
    () => { const b = ri(2, 9), r = ri(2, 9); return [`${b * r} ÷ ${b}`, r]; },
    () => { const a = ri(1, 9) * 10, b = ri(1, 9) * 10; return [`${a} + ${b}`, a + b]; },
  ],
  moyen: [
    () => { const a = ri(25, 99), b = ri(25, 99); return [`${a} + ${b}`, a + b]; },
    () => { const a = ri(50, 150), b = ri(11, 49); return [`${a} − ${b}`, a - b]; },
    () => { const a = ri(11, 19), b = ri(3, 9); return [`${a} × ${b}`, a * b]; },
    () => { const b = ri(3, 12), r = ri(6, 15); return [`${b * r} ÷ ${b}`, r]; },
    () => { const a = ri(3, 12); return [`${a}²`, a * a]; },
    () => { const a = pick([50, 100, 200, 300, 400, 500, 1000]), pct = pick([10, 20, 25, 50]); return [`${pct} % de ${a}`, (a * pct) / 100]; },
    () => { const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9); return [`${a} + ${b} + ${c}`, a + b + c]; },
  ],
  difficile: [
    () => { const a = ri(100, 499), b = ri(100, 499); return [`${a} + ${b}`, a + b]; },
    () => { const a = ri(300, 999), b = ri(100, 299); return [`${a} − ${b}`, a - b]; },
    () => { const a = ri(12, 25), b = ri(11, 19); return [`${a} × ${b}`, a * b]; },
    () => { const b = ri(12, 25), r = ri(12, 30); return [`${b * r} ÷ ${b}`, r]; },
    () => { const a = ri(13, 20); return [`${a}²`, a * a]; },
    () => { const a = pick([80, 120, 150, 240, 360, 450, 640, 750]), pct = pick([5, 15, 30, 40, 60, 75]); return [`${pct} % de ${a}`, (a * pct) / 100]; },
    () => { const a = ri(10, 60), b = ri(10, 60), c = ri(10, 60); return [`${a} + ${b} + ${c}`, a + b + c]; },
    () => { const a = ri(3, 9); return [`${a}³`, a * a * a]; },
  ],
  impossible: [
    () => { const a = ri(500, 999), b = ri(500, 999); return [`${a} + ${b}`, a + b]; },
    () => { const a = ri(1000, 4999), b = ri(500, 999); return [`${a} − ${b}`, a - b]; },
    () => { const a = ri(21, 49), b = ri(21, 49); return [`${a} × ${b}`, a * b]; },
    () => { const b = ri(13, 40), r = ri(21, 60); return [`${b * r} ÷ ${b}`, r]; },
    () => { const a = ri(21, 35); return [`${a}²`, a * a]; },
    () => { const a = pick([160, 350, 420, 680, 840, 960, 1250, 2400]), pct = pick([12, 35, 45, 65, 85, 95]); return [`${pct} % de ${a}`, (a * pct) / 100]; },
    () => { const a = ri(100, 300), b = ri(100, 300), c = ri(100, 300); return [`${a} + ${b} + ${c}`, a + b + c]; },
    () => { const a = ri(11, 19); return [`${a}³`, a * a * a]; },
  ],
};
const share = { facile: 0.3, moyen: 0.3, difficile: 0.25, impossible: 0.15 };
const items = [];
const seen = new Set();
for (const [level, part] of Object.entries(share)) {
  const want = Math.round(N * part);
  let guard = 0;
  while (items.filter((i) => i.level === level).length < want && guard++ < 10000) {
    const [expr, val] = pick(makers[level])();
    if (!Number.isInteger(val) || seen.has(expr)) continue;
    seen.add(expr);
    items.push({ prompt: { type: "text", value: expr }, answer: fmt(val), level });
  }
}
writeJson(p("data/banks/new-maths.json"), items);
console.log(`maths : ${items.length} calculs générés → data/banks/new-maths.json`);
