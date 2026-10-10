// Self-play training and arena, following the staged recipe of the 1st-place write-up:
// stage 1 broad self-play over every deck, stage 2 single-deck specialists against a
// frozen ladder, then a round-robin arena that produces the matchup table on the site.
// Search replaces their PPO-trained Transformer: what is learned here is the evaluator.
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { DECKS } from '../js/cards.js';
import { DEFAULT_WEIGHTS, FEATURES, makeRandom } from '../js/ai.js';

const DECK_KEYS = Object.keys(DECKS);
const workers = Array.from({ length: Math.max(1, cpus().length - 1) }, () => new Worker(new URL('./worker.mjs', import.meta.url)));
const pending = new Map();
let nextId = 0, gamesPlayed = 0;
for (const w of workers) w.on('message', ({ id, result }) => { pending.get(id)(result); pending.delete(id); });

function run(job, worker) {
  return new Promise(resolve => {
    const id = nextId++;
    pending.set(id, resolve);
    worker.postMessage({ id, job });
  });
}

async function playMany(jobs) {
  const results = new Array(jobs.length);
  let cursor = 0;
  await Promise.all(workers.map(async w => {
    while (cursor < jobs.length) {
      const i = cursor++;
      results[i] = await run(jobs[i], w);
    }
  }));
  gamesPlayed += jobs.length;
  return results;
}

const wilson = (wins, n) => {
  const z = 1.96, p = wins / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [c - r, c + r];
};

// Score of agent A (draws count half), seats alternate, seeds shared between candidates.
async function score(agentA, agentB, pairs, gamesPerPair, seedBase) {
  const jobs = [];
  pairs.forEach(([da, db], p) => {
    for (let g = 0; g < gamesPerPair; g++) {
      const seat = g % 2, seed = seedBase + p * 1000 + g;
      jobs.push({ seat, job: { decks: seat === 0 ? [da, db] : [db, da], agents: seat === 0 ? [agentA, agentB] : [agentB, agentA], seed, first: (g >> 1) % 2 } });
    }
  });
  const results = await playMany(jobs.map(j => j.job));
  let points = 0;
  results.forEach((r, i) => { points += r.winner === 2 ? 0.5 : r.winner === jobs[i].seat ? 1 : 0; });
  return { rate: points / results.length, games: results.length, points };
}

function mutate(weights, rand, sigma) {
  const out = { ...weights };
  for (const k of FEATURES) {
    if (rand() < 0.5) {
      const gauss = Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
      out[k] = Math.max(0, +(out[k] + gauss * sigma * Math.max(0.3, Math.abs(out[k]))).toFixed(4));
    }
  }
  return out;
}

const allPairs = DECK_KEYS.flatMap(a => DECK_KEYS.map(b => [a, b]));
const LEVEL = 'adept';
const rand = makeRandom(2026);
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const stages = [];

// Stage 1: broad self-play, all decks, candidate vs incumbent champion.
let general = { ...DEFAULT_WEIGHTS };
{
  const generations = Number(process.env.GEN1 || 30), mutants = 10, perPair = 16;
  let accepted = 0;
  for (let gen = 0; gen < generations; gen++) {
    const sigma = 0.35 * (1 - gen / generations) + 0.08;
    const champ = { level: LEVEL, weights: general };
    const candidates = Array.from({ length: mutants }, () => mutate(general, rand, sigma));
    const scores = [];
    for (const c of candidates) scores.push(await score({ level: LEVEL, weights: c }, champ, allPairs, perPair, gen * 1e6));
    const best = scores.reduce((b, s, i) => (s.rate > scores[b].rate ? i : b), 0);
    if (scores[best].rate > 0.53) {
      const check = await score({ level: LEVEL, weights: candidates[best] }, champ, allPairs, 32, 9e8 + gen * 1e5);
      if (check.rate > 0.52) { general = candidates[best]; accepted++; log(`stage 1 gen ${gen}: accepted (${(100 * check.rate).toFixed(1)}% vs incumbent)`); continue; }
    }
    log(`stage 1 gen ${gen}: kept incumbent (best mutant ${(100 * scores[best].rate).toFixed(1)}%)`);
  }
  stages.push({ stage: 'Broad self-play', detail: `${generations} generations × ${mutants} challengers, every deck pairing`, accepted });
}

// Stage 2: one specialist per deck against a frozen ladder of the generalist on every deck.
const specialists = {};
{
  const generations = Number(process.env.GEN2 || 20), mutants = 8, perPair = 48;
  let accepted = 0;
  for (const deck of DECK_KEYS) {
    let incumbent = { ...general };
    const ladder = { level: LEVEL, weights: general };
    const pairs = DECK_KEYS.map(o => [deck, o]);
    for (let gen = 0; gen < generations; gen++) {
      const seed = 5e8 + gen * 1e5;
      const base = await score({ level: LEVEL, weights: incumbent }, ladder, pairs, perPair, seed);
      const sigma = 0.25 * (1 - gen / generations) + 0.05;
      let best = null;
      for (let m = 0; m < mutants; m++) {
        const c = mutate(incumbent, rand, sigma);
        const s = await score({ level: LEVEL, weights: c }, ladder, pairs, perPair, seed);
        if (s.rate > base.rate + 0.02 && (!best || s.rate > best.s.rate)) best = { c, s };
      }
      if (best) {
        const verifyNew = await score({ level: LEVEL, weights: best.c }, ladder, pairs, 96, 7e8 + gen * 1e5);
        const verifyOld = await score({ level: LEVEL, weights: incumbent }, ladder, pairs, 96, 7e8 + gen * 1e5);
        if (verifyNew.rate > verifyOld.rate) { incumbent = best.c; accepted++; }
      }
    }
    specialists[deck] = incumbent;
    log(`stage 2: ${deck} specialist ready`);
  }
  stages.push({ stage: 'Single-deck specialists', detail: `${generations} generations × ${mutants} challengers per deck vs a frozen ladder`, accepted });
}

// Arena: specialists round-robin, generalist-vs-specialist gain, and search-depth ladder.
const ARENA_GAMES = Number(process.env.ARENA || 400);
const matrix = {};
for (const a of DECK_KEYS) {
  matrix[a] = {};
  for (const b of DECK_KEYS) {
    const s = await score({ level: LEVEL, weights: specialists[a] }, { level: LEVEL, weights: specialists[b] }, [[a, b]], ARENA_GAMES, 3e8);
    matrix[a][b] = { rate: +s.rate.toFixed(4), games: s.games };
  }
}
log('arena done');

const specialistGain = {};
for (const d of DECK_KEYS) {
  const field = DECK_KEYS.map(o => [d, o]);
  const asGeneral = await score({ level: LEVEL, weights: general }, { level: LEVEL, weights: general }, field, 200, 4e8);
  const asSpecialist = await score({ level: LEVEL, weights: specialists[d] }, { level: LEVEL, weights: general }, field, 200, 4e8);
  specialistGain[d] = { general: +asGeneral.rate.toFixed(4), specialist: +asSpecialist.rate.toFixed(4), games: asSpecialist.games };
}

const levels = [];
for (const [a, b] of [['master', 'adept'], ['adept', 'novice'], ['master', 'novice']]) {
  const s = await score({ level: a, weights: general }, { level: b, weights: general }, allPairs, 50, 6e8);
  levels.push({ a, b, rate: +s.rate.toFixed(4), games: s.games, ci: wilson(s.points, s.games).map(v => +v.toFixed(4)) });
  log(`${a} vs ${b}: ${(100 * s.rate).toFixed(1)}%`);
}
const baseline = await score({ level: LEVEL, weights: general }, { level: LEVEL, weights: DEFAULT_WEIGHTS }, allPairs, 50, 8e8);

const trained = {
  updated: new Date().toISOString().slice(0, 10),
  gamesPlayed,
  weights: { general, specialists },
  stages,
  arena: { level: LEVEL, matrix },
  specialistGain,
  levels,
  vsHandTuned: { rate: +baseline.rate.toFixed(4), games: baseline.games, ci: wilson(baseline.points, baseline.games).map(v => +v.toFixed(4)) },
};
writeFileSync(new URL('../js/trained.js', import.meta.url),
  `// Generated by tools/train.mjs from ${gamesPlayed} self-play games. Do not edit by hand.\nexport const TRAINED = ${JSON.stringify(trained, null, 2)};\n`);
log(`wrote js/trained.js after ${gamesPlayed} games; trained vs hand-tuned: ${(100 * baseline.rate).toFixed(1)}%`);
await Promise.all(workers.map(w => w.terminate()));
