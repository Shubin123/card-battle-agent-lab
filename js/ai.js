// Rival AI: determinized lookahead over a learned linear board evaluator.
// It only ever sees observe(state, seat); hidden cards are re-sampled from facts.
import { CARDS, DECKS } from './cards.js';
import { applyAction, cloneState, legalActions } from './engine.js';

export const FEATURES = ['core', 'power', 'guard', 'units', 'hand', 'ink', 'walls', 'shields', 'pressure', 'deck'];

export const DEFAULT_WEIGHTS = { core: 1, power: 0.8, guard: 0.5, units: 1.5, hand: 0.7, ink: 0.6, walls: 0.8,
                                 shields: 0.5, pressure: 4, deck: 0.5 };

export const LEVELS = {
  novice: { label: 'Novice', depth: 'takes the best-looking single move, with some noise, using hand-set weights', samples: 1, trained: false },
  adept: { label: 'Adept', depth: 'plans the rest of its turn using hand-set weights', samples: 1, trained: false },
  master: { label: 'Master', depth: 'uses its self-play-trained specialist evaluator, plans its turn with beam search, and checks your reply across 4 guessed hands', samples: 4, trained: true },
};

export function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (units, key) => units.reduce((total, u) => total + u[key], 0);

export function features(state, seat) {
  const m = state.players[seat], o = state.players[1 - seat];
  const handOf = p => (p.hand ? p.hand.length : p.handCount);
  const deckOf = p => (p.deck ? p.deck.length : p.deckCount);
  return {
    core: m.core - o.core,
    power: sum(m.board, 'power') - sum(o.board, 'power'),
    guard: sum(m.board, 'guard') - sum(o.board, 'guard'),
    units: m.board.length - o.board.length,
    hand: handOf(m) - handOf(o),
    ink: m.maxInk - o.maxInk,
    walls: m.board.filter(u => u.kw.includes('wall')).length - o.board.filter(u => u.kw.includes('wall')).length,
    shields: m.board.filter(u => u.shield).length - o.board.filter(u => u.shield).length,
    pressure: Math.min(sum(m.board, 'power') / Math.max(1, o.core), 2) - Math.min(sum(o.board, 'power') / Math.max(1, m.core), 2),
    deck: Math.min(deckOf(m), 5) - Math.min(deckOf(o), 5),
  };
}

export function evaluate(state, seat, weights) {
  if (state.winner !== null) return state.winner === 2 ? 0 : state.winner === seat ? 1000 - state.turn : -1000 + state.turn;
  const f = features(state, seat);
  let value = 0;
  for (const k of FEATURES) value += (weights[k] ?? 0) * f[k];
  return value;
}

function removeOnce(pool, id) {
  const i = pool.indexOf(id);
  if (i >= 0) pool.splice(i, 1);
  return i >= 0;
}

function shuffled(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Fill hidden zones with cards consistent with everything observed so far.
export function determinize(view, seat, rand) {
  const s = cloneState(view);
  s.rs = Math.floor(rand() * 2 ** 31);
  const me = s.players[seat], opp = s.players[1 - seat];
  const mine = view.players[seat];
  const pool = [...mine.list];
  for (const id of [...me.hand, ...me.board.map(u => u.id), ...me.discard]) removeOnce(pool, id);
  me.deck = shuffled(pool, rand).slice(0, mine.deckCount);

  // Opponent: public deck catalog filtered by revealed cards (facts), never their real hand.
  const oppView = view.players[1 - seat];
  const revealed = {};
  for (const id of oppView.revealed) revealed[id] = (revealed[id] || 0) + 1;
  const fits = Object.values(DECKS).filter(d => Object.entries(revealed).every(([id, n]) => d.cards.filter(c => c === id).length >= n));
  let source;
  if (fits.length) {
    source = [...fits[Math.floor(rand() * fits.length)].cards];
    for (const id of [...opp.board.map(u => u.id), ...opp.discard]) removeOnce(source, id);
  } else {
    const schools = new Set(oppView.revealed.map(id => CARDS[id].school));
    source = Object.values(CARDS).filter(c => !schools.size || schools.has(c.school)).flatMap(c => [c.id, c.id, c.id, c.id]);
  }
  shuffled(source, rand);
  const need = oppView.handCount + oppView.deckCount;
  while (source.length < need) source.push(source[Math.floor(rand() * source.length)] || 'cinder');
  opp.hand = source.slice(0, oppView.handCount);
  opp.deck = source.slice(oppView.handCount, need);
  opp.list = null;
  return s;
}

function step(state, action) {
  return applyAction(cloneState(state), action);
}

// Greedy: keep taking the single best-looking action until ending the turn looks best.
export function greedyTurn(state, seat, weights, limit = 20) {
  let s = state;
  for (let i = 0; i < limit && s.winner === null && s.active === seat; i++) {
    let best = null, bestValue = evaluate(s, seat, weights);
    for (const a of legalActions(s)) {
      if (a.t === 'end') continue;
      const next = step(s, a);
      const v = evaluate(next, seat, weights);
      if (v > bestValue + 1e-9) { bestValue = v; best = next; }
    }
    if (!best) break;
    s = best;
  }
  return s;
}

// Beam search over orderings of the rest of the turn; keeps the best state seen.
export function beamTurn(state, seat, weights, width = 4, limit = 12) {
  let best = state, bestValue = evaluate(state, seat, weights);
  let frontier = [state];
  for (let depth = 0; depth < limit && frontier.length; depth++) {
    const children = [];
    for (const s of frontier) {
      if (s.winner !== null || s.active !== seat) continue;
      for (const a of legalActions(s)) {
        if (a.t === 'end') continue;
        const next = step(s, a);
        const v = evaluate(next, seat, weights);
        children.push({ next, v });
        if (v > bestValue) { bestValue = v; best = next; }
      }
    }
    children.sort((x, y) => y.v - x.v);
    frontier = children.slice(0, width).map(c => c.next);
  }
  return best;
}

function lookahead(state, action, seat, level, weights, oppWeights) {
  // Below Master, compare every option at the moment before the turn passes.
  if (action.t === 'end' && level !== 'master') return evaluate(state, seat, weights);
  let s = step(state, action);
  if (level === 'novice') return evaluate(s, seat, weights);
  if (action.t !== 'end') s = level === 'master' && MASTER.beam ? beamTurn(s, seat, weights, MASTER.beam) : greedyTurn(s, seat, weights);
  if (level === 'adept' || s.winner !== null || (level === 'master' && MASTER.plies === 1)) return evaluate(s, seat, weights);
  const own = evaluate(s, seat, weights);
  if (s.active === seat) s = applyAction(s, { t: 'end' });
  s = greedyTurn(s, 1 - seat, oppWeights);
  if (MASTER.plies === 3 && s.winner === null) {
    if (s.active !== seat) s = applyAction(s, { t: 'end' });
    s = greedyTurn(s, seat, weights);
  }
  return (1 - MASTER.mix) * own + MASTER.mix * evaluate(s, seat, weights);
}

// Master search shape; tools/compare.mjs picks these by measured strength.
export const MASTER = { plies: 2, mix: 0.5, samples: 4, topK: 6, beam: 4 };

export function chooseAction(view, { level = 'adept', weights = DEFAULT_WEIGHTS, oppWeights, rand = Math.random, topK = 6 } = {}) {
  const seat = view.active;
  oppWeights = oppWeights || weights;
  const samples = level === 'master' ? MASTER.samples : LEVELS[level].samples;
  if (level === 'master') topK = MASTER.topK;
  const worlds = Array.from({ length: samples }, () => determinize(view, seat, rand));
  const actions = legalActions(worlds[0]);
  if (actions.length === 1) return { action: actions[0], candidates: [{ action: actions[0], value: 0 }] };
  // Quick pass ranks every action; the deep pass (Master) re-scores the best few.
  let scored = actions.map(action => ({ action, value: lookahead(worlds[0], action, seat, level === 'novice' ? 'novice' : 'adept', weights, oppWeights) }));
  if (level === 'novice') for (const c of scored) c.value += (rand() - 0.5) * 6;
  if (level === 'master') {
    scored.sort((a, b) => b.value - a.value);
    const shortlist = scored.slice(0, topK);
    if (!shortlist.some(c => c.action.t === 'end')) shortlist.push(scored.find(c => c.action.t === 'end'));
    scored = shortlist.map(({ action }) => ({
      action,
      value: worlds.reduce((total, w) => total + lookahead(w, action, seat, 'master', weights, oppWeights), 0) / worlds.length,
    }));
  }
  scored.sort((a, b) => b.value - a.value);
  return { action: scored[0].action, candidates: scored.slice(0, 5), samples };
}
