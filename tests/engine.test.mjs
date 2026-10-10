import assert from 'node:assert/strict';
import test from 'node:test';
import { CARDS, DECKS } from '../js/cards.js';
import { applyAction, cloneState, legalActions, newGame, observe } from '../js/engine.js';
import { chooseAction, determinize, makeRandom } from '../js/ai.js';

const deck = key => ({ key, cards: DECKS[key].cards });

test('every deck has 30 known cards', () => {
  for (const d of Object.values(DECKS)) {
    assert.equal(d.cards.length, 30);
    for (const id of d.cards) assert.ok(CARDS[id], id);
  }
});

test('random games always finish with legal actions', () => {
  const keys = Object.keys(DECKS);
  for (let g = 0; g < 200; g++) {
    const rand = makeRandom(g);
    const s = newGame(deck(keys[g % 4]), deck(keys[(g >> 2) % 4]), g, g % 2);
    let steps = 0;
    while (s.winner === null) {
      const actions = legalActions(s);
      assert.ok(actions.some(a => a.t === 'end'));
      applyAction(s, actions[Math.floor(rand() * actions.length)]);
      assert.ok(++steps < 5000, 'game did not terminate');
      for (const p of s.players) {
        assert.ok(p.board.length <= 5 && p.hand.length <= 9);
        assert.ok(p.board.every(u => u.guard > 0));
      }
    }
    assert.ok([0, 1, 2].includes(s.winner));
  }
});

test('walls must be attacked first', () => {
  const s = newGame(deck('ember'), deck('tide'), 7, 0);
  s.players[0].board.push({ uid: 900, id: 'cinder', power: 3, guard: 2, maxGuard: 2, kw: [], ready: true, shield: false });
  s.players[1].board.push({ uid: 901, id: 'ripple', power: 1, guard: 3, maxGuard: 3, kw: ['wall'], ready: false, shield: false });
  const attacks = legalActions(s).filter(a => a.t === 'attack');
  assert.deepEqual(attacks.map(a => a.target), ['u901']);
});

test('clones are independent and replay identically', () => {
  const s = newGame(deck('grove'), deck('storm'), 11, 1);
  const a = cloneState(s), b = cloneState(s);
  applyAction(a, { t: 'end' });
  applyAction(b, { t: 'end' });
  assert.deepEqual(a.players, b.players);
  assert.notDeepEqual(a.players, s.players);
});

test('observation hides opponent hand and deck order', () => {
  const s = newGame(deck('ember'), deck('tide'), 3, 0);
  const view = observe(s, 0);
  assert.equal(view.players[1].hand, null);
  assert.equal(view.players[1].deck, null);
  assert.equal(view.players[0].deck, null);
  assert.equal(view.players[1].handCount, s.players[1].hand.length);
});

test('AI decisions do not depend on the hidden opponent hand', () => {
  const s = newGame(deck('storm'), deck('grove'), 5, 0);
  const t = cloneState(s);
  t.players[1].hand = t.players[1].hand.map(() => 'leviathan');
  for (const level of ['adept', 'master']) {
    const a = chooseAction(observe(s, 0), { level, rand: makeRandom(1) }).action;
    const b = chooseAction(observe(t, 0), { level, rand: makeRandom(1) }).action;
    assert.deepEqual(a, b);
  }
});

test('determinized worlds keep public facts and counts', () => {
  const s = newGame(deck('tide'), deck('ember'), 9, 0);
  const view = observe(s, 0);
  const w = determinize(view, 0, makeRandom(2));
  assert.equal(w.players[1].hand.length, s.players[1].hand.length);
  assert.equal(w.players[1].deck.length, s.players[1].deck.length);
  assert.equal(w.players[0].deck.length, s.players[0].deck.length);
  assert.deepEqual(w.players[0].hand, s.players[0].hand);
});
