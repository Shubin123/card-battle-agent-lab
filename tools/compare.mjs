// Measures Master search variants against Adept with the trained evaluator.
import { DECKS } from '../js/cards.js';
import { MASTER } from '../js/ai.js';
import { playGame } from './worker.mjs';
import { TRAINED } from '../js/trained.js';

const keys = Object.keys(DECKS);
const ALL = [{ plies: 2, mix: 1 }, { plies: 2, mix: 0.5 }, { plies: 3, mix: 1 }, { plies: 3, mix: 0.5 },
  { plies: 2, mix: 0.5, samples: 12, topK: 10 }, { plies: 3, mix: 0.5, samples: 12, topK: 10 },
  { plies: 1, beam: 3, samples: 1, topK: 8 }, { plies: 1, beam: 6, samples: 1, topK: 12 }, { plies: 2, mix: 0.5, beam: 4, samples: 4, topK: 6 }];
const variants = process.argv[2] ? [ALL[Number(process.argv[2])]] : ALL;
const games = Number(process.argv[3] || 256);
for (const v of variants) {
  Object.assign(MASTER, { plies: 2, mix: 1, samples: 6, topK: 6, beam: 0 }, v);
  let points = 0;
  const t = performance.now();
  for (let g = 0; g < games; g++) {
    const da = keys[g % 4], db = keys[(g >> 2) % 4], seat = (g >> 4) % 2;
    const master = { level: 'master', weights: TRAINED.weights.specialists[da] };
    const adept = { level: 'adept', weights: TRAINED.weights.specialists[db] };
    const r = playGame({ decks: seat === 0 ? [da, db] : [db, da], agents: seat === 0 ? [master, adept] : [adept, master], seed: 77000 + g, first: (g >> 5) % 2 });
    points += r.winner === 2 ? 0.5 : r.winner === seat ? 1 : 0;
  }
  console.log(JSON.stringify(v), (100 * points / games).toFixed(1) + '%', ((performance.now() - t) / games).toFixed(0) + 'ms/game');
}
