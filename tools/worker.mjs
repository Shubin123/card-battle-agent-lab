// Plays games on request; one worker per CPU core.
import { parentPort } from 'node:worker_threads';
import { DECKS } from '../js/cards.js';
import { applyAction, legalActions, newGame, observe, sameAction } from '../js/engine.js';
import { chooseAction, makeRandom } from '../js/ai.js';

export function playGame({ decks, agents, seed, first }) {
  const s = newGame({ key: decks[0], cards: DECKS[decks[0]].cards }, { key: decks[1], cards: DECKS[decks[1]].cards }, seed, first);
  const rands = [makeRandom(seed * 7 + 1), makeRandom(seed * 7 + 2)];
  let decisions = 0;
  while (s.winner === null) {
    const seat = s.active;
    const agent = agents[seat];
    const { action } = chooseAction(observe(s, seat), { level: agent.level, weights: agent.weights, rand: rands[seat] });
    if (!legalActions(s).some(a => sameAction(a, action))) throw new Error('AI chose an illegal action');
    applyAction(s, action);
    if (++decisions > 3000) return { winner: 2, decisions };
  }
  return { winner: s.winner, decisions, turns: s.turn };
}

if (parentPort) parentPort.on('message', ({ id, job }) => parentPort.postMessage({ id, result: playGame(job) }));
