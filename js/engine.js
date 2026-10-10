// Rules engine. State is plain data so it can be cloned cheaply for search.
import { CARDS } from './cards.js';

export const START_CORE = 20;
export const MAX_CORE = 25;
export const MAX_INK = 10;
export const MAX_BOARD = 5;
export const MAX_HAND = 9;
export const TURN_LIMIT = 60;

// Random numbers live inside the state (mulberry32) so clones replay identically.
export function nextRandom(state) {
  let t = (state.rs = (state.rs + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffleInPlace(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newPlayer(deckKey, cards) {
  return { deckKey, list: [...cards], core: START_CORE, ink: 0, maxInk: 0, deck: [...cards], hand: [],
           board: [], discard: [], fatigue: 0, revealed: [] };
}

export function newGame(deckA, deckB, seed, first = 0) {
  const state = { rs: seed | 0, turn: 0, active: first, first, uid: 1, winner: null, quiet: false, log: [],
                  players: [newPlayer(deckA.key, deckA.cards), newPlayer(deckB.key, deckB.cards)] };
  for (const p of state.players) shuffleInPlace(state, p.deck);
  for (let i = 0; i < 4; i++) { draw(state, 0); draw(state, 1); }
  draw(state, 1 - first); // the player going second starts with an extra card
  startTurn(state);
  return state;
}

export function cloneState(s) {
  return {
    rs: s.rs, turn: s.turn, active: s.active, first: s.first, uid: s.uid, winner: s.winner, quiet: true, log: [],
    players: s.players.map(p => ({
      deckKey: p.deckKey, list: p.list, core: p.core, ink: p.ink, maxInk: p.maxInk, deck: p.deck && p.deck.slice(),
      hand: p.hand && p.hand.slice(), board: p.board.map(u => ({ ...u })), discard: p.discard.slice(), fatigue: p.fatigue,
      revealed: p.revealed.slice(), handCount: p.handCount, deckCount: p.deckCount,
    })),
  };
}

function say(state, seat, text) {
  if (!state.quiet) state.log.push({ seat, text, turn: state.turn });
}

function draw(state, seat) {
  const p = state.players[seat];
  if (!p.deck.length) {
    p.fatigue += 1;
    p.core -= p.fatigue;
    say(state, seat, `{P} has no cards left and takes ${p.fatigue} fatigue damage.`);
    return;
  }
  const id = p.deck.pop();
  if (p.hand.length >= MAX_HAND) {
    p.discard.push(id);
    p.revealed.push(id);
    say(state, seat, `{P}'s hand is full; ${CARDS[id].name} is burned.`);
  } else {
    p.hand.push(id);
  }
}

function startTurn(state) {
  const seat = state.active;
  const p = state.players[seat];
  state.turn += 1;
  p.maxInk = Math.min(MAX_INK, p.maxInk + 1);
  p.ink = p.maxInk;
  if (!(state.turn === 1 && seat === state.first)) draw(state, seat);
  for (const u of p.board) u.ready = true;
  say(state, seat, `Turn ${state.turn}: {P} has ${p.ink} ink.`);
  checkEnd(state);
}

export function findUnit(state, uid) {
  for (let seat = 0; seat < 2; seat++) {
    const unit = state.players[seat].board.find(u => u.uid === uid);
    if (unit) return { seat, unit };
  }
  return null;
}

const hasKw = (u, k) => u.kw.includes(k);

// Returns damage actually dealt to the unit's guard.
function hitUnit(state, unit, amount) {
  if (amount <= 0) return 0;
  if (unit.shield) {
    unit.shield = false;
    say(state, null, `${CARDS[unit.id].name}'s shield absorbs the blow.`);
    return 0;
  }
  const dealt = Math.min(amount, Math.max(unit.guard, 0));
  unit.guard -= amount;
  return dealt;
}

function hitCore(state, seat, amount) {
  if (amount > 0) state.players[seat].core -= amount;
}

function heal(state, seat, amount) {
  const p = state.players[seat];
  p.core = Math.min(MAX_CORE, p.core + amount);
}

function cleanup(state) {
  for (let seat = 0; seat < 2; seat++) {
    const p = state.players[seat];
    const dead = p.board.filter(u => u.guard <= 0);
    if (!dead.length) continue;
    p.board = p.board.filter(u => u.guard > 0);
    for (const u of dead) {
      p.discard.push(u.id);
      say(state, seat, `{P}'s ${CARDS[u.id].name} is destroyed.`);
      if (hasKw(u, 'burst')) {
        hitCore(state, 1 - seat, 2);
        say(state, seat, `${CARDS[u.id].name} bursts for 2 damage to the enemy core.`);
      }
    }
  }
  checkEnd(state);
}

function checkEnd(state) {
  if (state.winner !== null) return;
  const [a, b] = state.players.map(p => p.core <= 0);
  if (a && b) state.winner = 2;
  else if (a) state.winner = 1;
  else if (b) state.winner = 0;
  else if (state.turn > TURN_LIMIT) {
    const [c0, c1] = state.players.map(p => p.core);
    state.winner = c0 === c1 ? 2 : c0 > c1 ? 0 : 1;
  }
  if (state.winner !== null) say(state, null, state.winner === 2 ? 'The duel ends in a draw.' : `{W} wins the duel.`);
}

// Target strings: 'c0'/'c1' for a core, 'u<uid>' for a unit.
function spellTargets(state, seat, card) {
  const mine = state.players[seat].board, theirs = state.players[1 - seat].board;
  if (card.target === 'any') return [...theirs, ...mine].map(u => 'u' + u.uid).concat(['c' + (1 - seat), 'c' + seat]);
  if (card.target === 'enemyUnit') return theirs.map(u => 'u' + u.uid);
  if (card.target === 'allyUnit') return mine.map(u => 'u' + u.uid);
  return [null];
}

export function attackTargets(state, seat) {
  const theirs = state.players[1 - seat].board;
  const walls = theirs.filter(u => hasKw(u, 'wall'));
  if (walls.length) return walls.map(u => 'u' + u.uid);
  return theirs.map(u => 'u' + u.uid).concat(['c' + (1 - seat)]);
}

export function legalActions(state) {
  if (state.winner !== null) return [];
  const seat = state.active;
  const p = state.players[seat];
  const actions = [];
  const seen = new Set();
  for (let h = 0; h < p.hand.length; h++) {
    const card = CARDS[p.hand[h]];
    if (card.cost > p.ink || seen.has(card.id)) continue;
    seen.add(card.id); // identical copies are one option, as in the 1st-place write-up
    if (card.type === 'unit') {
      if (p.board.length < MAX_BOARD) actions.push({ t: 'play', card: card.id });
    } else {
      for (const target of spellTargets(state, seat, card)) actions.push({ t: 'play', card: card.id, target });
    }
  }
  const targets = attackTargets(state, seat);
  for (const u of p.board) {
    if (!u.ready || u.power <= 0) continue;
    for (const target of targets) actions.push({ t: 'attack', uid: u.uid, target });
  }
  actions.push({ t: 'end' });
  return actions;
}

export const sameAction = (a, b) => a.t === b.t && a.card === b.card && a.uid === b.uid && a.target === b.target;

function targetName(state, target) {
  if (target[0] === 'c') return `{C${target[1]}}`;
  const found = findUnit(state, Number(target.slice(1)));
  return found ? CARDS[found.unit.id].name : 'nothing';
}

function damageTarget(state, target, amount) {
  if (target[0] === 'c') return hitCore(state, Number(target[1]), amount);
  const found = findUnit(state, Number(target.slice(1)));
  if (found) hitUnit(state, found.unit, amount);
}

function playCard(state, seat, action) {
  const p = state.players[seat];
  const card = CARDS[action.card];
  p.hand.splice(p.hand.indexOf(card.id), 1);
  p.ink -= card.cost;
  p.revealed.push(card.id);
  if (card.type === 'unit') {
    const unit = { uid: state.uid++, id: card.id, power: card.power, guard: card.guard, maxGuard: card.guard,
                   kw: card.kw, ready: card.kw.includes('swift'), shield: card.kw.includes('shield') };
    p.board.push(unit);
    say(state, seat, `{P} plays ${card.name}.`);
    if (card.onPlay?.ramp) p.maxInk = Math.min(MAX_INK, p.maxInk + card.onPlay.ramp);
    if (card.onPlay?.rally) for (const u of p.board) if (u !== unit) u.power += card.onPlay.rally;
    return;
  }
  p.discard.push(card.id);
  const e = card.effect;
  say(state, seat, `{P} casts ${card.name}${action.target ? ' on ' + targetName(state, action.target) : ''}.`);
  if (e.damage) damageTarget(state, action.target, e.damage);
  if (e.sweep) for (const u of state.players[1 - seat].board) hitUnit(state, u, e.sweep);
  if (e.face) hitCore(state, 1 - seat, e.face);
  if (e.bounce) {
    const found = findUnit(state, Number(action.target.slice(1)));
    const owner = state.players[found.seat];
    owner.board = owner.board.filter(u => u !== found.unit);
    if (owner.hand.length < MAX_HAND) owner.hand.push(found.unit.id);
    else owner.discard.push(found.unit.id);
  }
  if (e.heal) heal(state, seat, e.heal);
  if (e.ramp) p.maxInk = Math.min(MAX_INK, p.maxInk + e.ramp);
  if (e.buff) {
    const found = findUnit(state, Number(action.target.slice(1)));
    found.unit.power += e.buff[0];
    found.unit.guard += e.buff[1];
    found.unit.maxGuard += e.buff[1];
  }
  for (let i = 0; i < (e.draw || 0); i++) draw(state, seat);
}

function attack(state, seat, action) {
  const attacker = state.players[seat].board.find(u => u.uid === action.uid);
  attacker.ready = false;
  const name = CARDS[attacker.id].name;
  if (action.target[0] === 'c') {
    hitCore(state, 1 - seat, attacker.power);
    if (hasKw(attacker, 'drain')) heal(state, seat, attacker.power);
    say(state, seat, `{P}'s ${name} strikes {C${1 - seat}} for ${attacker.power}.`);
    return;
  }
  const { unit: defender } = findUnit(state, Number(action.target.slice(1)));
  say(state, seat, `{P}'s ${name} attacks ${CARDS[defender.id].name}.`);
  const guardBefore = Math.max(defender.guard, 0);
  const shielded = defender.shield;
  const dealt = hitUnit(state, defender, attacker.power);
  hitUnit(state, attacker, defender.power);
  if (hasKw(attacker, 'pierce') && !shielded && attacker.power > guardBefore) {
    hitCore(state, 1 - seat, attacker.power - guardBefore);
    say(state, seat, `${name} pierces for ${attacker.power - guardBefore}.`);
  }
  if (hasKw(attacker, 'drain')) heal(state, seat, dealt);
}

export function applyAction(state, action) {
  if (state.winner !== null) throw new Error('Game is over');
  const seat = state.active;
  if (action.t === 'end') {
    say(state, seat, '{P} ends the turn.');
    state.active = 1 - seat;
    startTurn(state);
    return state;
  }
  if (action.t === 'play') playCard(state, seat, action);
  else if (action.t === 'attack') attack(state, seat, action);
  else throw new Error('Unknown action ' + action.t);
  cleanup(state);
  return state;
}

// What `seat` is allowed to know: no opponent hand contents, no deck order.
export function observe(state, seat) {
  const view = cloneState(state);
  view.rs = 0;
  const opp = view.players[1 - seat];
  opp.handCount = opp.hand.length;
  opp.hand = null;
  opp.deckCount = opp.deck.length;
  opp.deck = null;
  opp.list = null;
  const me = view.players[seat];
  me.deckCount = me.deck.length;
  me.deck = null; // own list is known, order is not
  me.handCount = me.hand.length;
  return view;
}
