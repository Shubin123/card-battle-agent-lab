import { CARDS, DECKS, KEYWORDS, SCHOOLS } from './cards.js';
import { applyAction, findUnit, legalActions, newGame, observe, sameAction } from './engine.js';
import { chooseAction, DEFAULT_WEIGHTS, LEVELS, makeRandom } from './ai.js';
import { icon } from './icons.js';
import { TRAINED } from './trained.js';

const $ = id => document.getElementById(id);
const HUMAN = 0, RIVAL = 1;
const KW_ICON = { swift: 'swift', wall: 'wall', pierce: 'pierce', drain: 'drain', burst: 'burst', shield: 'shield' };
const pct = v => (100 * v).toFixed(1) + '%';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let choice = { deck: 'ember', rival: 'random', level: 'adept' };
let state = null, selected = null, busy = false, rivalDeck = null, rand = null, logCount = 0, hint = null;

// ---------- tabs ----------
for (const name of ['play', 'arena', 'how']) {
  $('tab-' + name).addEventListener('click', () => {
    for (const other of ['play', 'arena', 'how']) {
      $('tab-' + other).setAttribute('aria-selected', String(other === name));
      $('panel-' + other).hidden = other !== name;
    }
  });
}

// ---------- setup ----------
$('brand-icon').innerHTML = icon('swords');
$('think-icon').innerHTML = icon('brain');
$('log-icon').innerHTML = icon('scroll');

function renderSetup() {
  $('deck-choices').innerHTML = Object.entries(DECKS).map(([key, d]) => `
    <button class="deck-choice" role="radio" aria-checked="${key === choice.deck}" data-deck="${key}" style="--school: var(--${d.school})">
      <span class="name">${icon(d.school)} ${esc(d.name)}</span>
      <span class="meta">${esc(SCHOOLS[d.school].blurb)}</span>
    </button>`).join('');
  $('rival-deck').innerHTML = `<option value="random">Random</option>` +
    Object.entries(DECKS).map(([k, d]) => `<option value="${k}" ${k === choice.rival ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  $('levels').innerHTML = '<legend>Rival strength</legend>' + Object.entries(LEVELS).map(([k, l]) =>
    `<button type="button" data-level="${k}" aria-pressed="${k === choice.level}" title="${esc(l.depth)}">${esc(l.label)}</button>`).join('');
  $('keyword-list').innerHTML = Object.entries(KEYWORDS).map(([k, t]) => `<div>${icon(KW_ICON[k])}<span>${esc(t)}</span></div>`).join('');
}
$('deck-choices').addEventListener('click', e => {
  const b = e.target.closest('[data-deck]');
  if (b) { choice.deck = b.dataset.deck; renderSetup(); $(`deck-choices`).querySelector(`[data-deck="${choice.deck}"]`).focus(); }
});
$('rival-deck').addEventListener('change', e => { choice.rival = e.target.value; });
$('levels').addEventListener('click', e => {
  const b = e.target.closest('[data-level]');
  if (b) { choice.level = b.dataset.level; renderSetup(); }
});
renderSetup();

// ---------- game flow ----------
function rivalWeights() {
  if (!LEVELS[choice.level].trained) return DEFAULT_WEIGHTS;
  return TRAINED?.weights?.specialists?.[rivalDeck] || TRAINED?.weights?.general || DEFAULT_WEIGHTS;
}

function startGame() {
  const seed = (Math.random() * 2 ** 31) | 0;
  rand = makeRandom(seed ^ 0x5eed);
  const keys = Object.keys(DECKS);
  rivalDeck = choice.rival === 'random' ? keys[Math.floor(rand() * keys.length)] : choice.rival;
  const first = rand() < 0.5 ? HUMAN : RIVAL;
  state = newGame({ key: choice.deck, cards: DECKS[choice.deck].cards }, { key: rivalDeck, cards: DECKS[rivalDeck].cards }, seed, first);
  selected = null; hint = null; logCount = 0;
  $('log').innerHTML = '';
  $('thoughts').innerHTML = '';
  $('think-meta').textContent = `${LEVELS[choice.level].label}: it ${LEVELS[choice.level].depth}. It's playing ${DECKS[rivalDeck].name}. Higher values mean a better-looking board for the rival.`;
  $('setup').hidden = true;
  $('game').hidden = false;
  $('result').hidden = true;
  addLog({ seat: null, text: `${first === HUMAN ? 'You go' : 'The rival goes'} first. The player going second starts with an extra card.` });
  render();
  if (state.active === RIVAL) rivalTurn();
}
$('start').addEventListener('click', startGame);
$('again').addEventListener('click', () => { $('result').hidden = true; startGame(); });
$('forfeit').addEventListener('click', () => { state = null; $('game').hidden = true; $('setup').hidden = false; });

function words(entry) {
  const you = entry.seat === HUMAN;
  const verbs = { plays: 'play', casts: 'cast', ends: 'end', has: 'have', takes: 'take', wins: 'win' };
  let t = entry.text
    .replace(/\{C(\d)\}/g, (_, s) => (Number(s) === HUMAN ? 'your core' : "the rival's core"))
    .replace(/\{W\} wins/, state && state.winner === HUMAN ? 'You win' : 'The rival wins');
  t = t.replace(/\{P\}'s/g, you ? 'your' : "the rival's").replace(/\{P\} (\w+)/g, (_, v) => (you ? 'you ' + (verbs[v] || v) : 'the rival ' + v));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function addLog(entry) {
  const li = document.createElement('li');
  if (entry.seat === HUMAN) li.className = 'you';
  li.textContent = words(entry);
  $('log').prepend(li);
}

function flushLog() {
  for (; logCount < state.log.length; logCount++) addLog(state.log[logCount]);
}

function act(action) {
  const before = new Map(state.players.flatMap(p => p.board.map(u => [u.uid, u.guard])));
  applyAction(state, action);
  selected = null; hint = null;
  flushLog();
  render(before);
  if (state.winner !== null) return finish();
  if (state.active === RIVAL) rivalTurn();
}

const pause = ms => new Promise(r => setTimeout(r, ms));

async function rivalTurn() {
  busy = true;
  render();
  await pause(450);
  while (state && state.winner === null && state.active === RIVAL) {
    const result = chooseAction(observe(state, RIVAL), { level: choice.level, weights: rivalWeights(), rand });
    if (!legalActions(state).some(a => sameAction(a, result.action))) throw new Error('Rival chose an illegal action');
    showThoughts(result);
    const before = new Map(state.players.flatMap(p => p.board.map(u => [u.uid, u.guard])));
    applyAction(state, result.action);
    flushLog();
    render(before);
    await pause(result.action.t === 'end' ? 250 : 650);
  }
  busy = false;
  render();
  if (state && state.winner !== null) finish();
}

function describe(action, viewer = RIVAL) {
  if (action.t === 'end') return 'End the turn';
  const tname = t => {
    if (!t) return '';
    if (t[0] === 'c') return Number(t[1]) === viewer ? 'its own core' : (viewer === RIVAL ? 'your core' : "the rival's core");
    const f = findUnit(state, Number(t.slice(1)));
    return f ? `${f.seat === HUMAN ? 'your' : (viewer === RIVAL ? 'its' : "the rival's")} ${CARDS[f.unit.id].name}` : 'a unit';
  };
  if (action.t === 'play') return `${CARDS[action.card].type === 'unit' ? 'Play' : 'Cast'} ${CARDS[action.card].name}${action.target ? ' on ' + tname(action.target) : ''}`;
  const f = findUnit(state, action.uid);
  return `Attack ${tname(action.target)} with ${f ? CARDS[f.unit.id].name : 'a unit'}`;
}

function showThoughts(result) {
  const top = result.candidates;
  $('thoughts').innerHTML = top.map(c => `<li>${esc(describe(c.action))}<span class="val">${c.value.toFixed(1)}</span></li>`).join('');
}

function finish() {
  render();
  const w = state.winner;
  $('result-icon').innerHTML = icon(w === HUMAN ? 'trophy' : w === 2 ? 'scroll' : 'swords');
  $('result-title').textContent = w === HUMAN ? 'Victory' : w === 2 ? 'Draw' : 'Defeat';
  $('result-text').textContent = `Turn ${state.turn}. Your core ${Math.max(0, state.players[HUMAN].core)}, rival core ${Math.max(0, state.players[RIVAL].core)}.`;
  $('result').hidden = false;
  $('again').focus();
}

// ---------- rendering ----------
function unitHtml(u, seat, targets, attackers, changed) {
  const card = CARDS[u.id];
  const t = 'u' + u.uid;
  const classes = ['unit'];
  if (seat === HUMAN && attackers.has(u.uid)) classes.push('ready');
  if (u.shield) classes.push('shielded');
  if (selected?.uid === u.uid) classes.push('selected');
  if (targets.has(t)) classes.push('target');
  if (hint?.uid === u.uid) classes.push('hint');
  if (changed && changed.has(u.uid) && changed.get(u.uid) > u.guard) classes.push('hit');
  const kws = card.kw.map(k => `<span title="${esc(KEYWORDS[k])}">${icon(KW_ICON[k], k)}</span>`).join('');
  const label = `${seat === HUMAN ? 'Your' : 'Rival'} ${card.name}, power ${u.power}, guard ${u.guard} of ${u.maxGuard}${card.kw.length ? ', ' + card.kw.join(', ') : ''}${u.shield ? ', shielded' : ''}`;
  return `<button class="${classes.join(' ')}" data-unit="${u.uid}" style="--school: var(--${card.school})" aria-label="${esc(label)}">
    <span class="title">${icon(card.school)}${esc(card.name)}</span>
    <span class="stats"><span>${icon('power')} ${u.power}</span><span class="${u.guard < u.maxGuard ? 'hurt' : ''}">${icon('guard')} ${u.guard}</span></span>
    <span class="kws">${kws}</span>
  </button>`;
}

function cardHtml(id, playable) {
  const card = CARDS[id];
  const classes = ['card'];
  if (playable) classes.push('playable');
  if (selected?.card === id) classes.push('selected');
  if (hint?.card === id) classes.push('hint');
  const stats = card.type === 'unit' ? `<span class="stats"><span>${icon('power')} ${card.power}</span><span>${icon('guard')} ${card.guard}</span></span>` : '';
  const kws = card.kw.map(k => `<span title="${esc(KEYWORDS[k])}">${icon(KW_ICON[k], k)}</span>`).join('');
  return `<button class="${classes.join(' ')}" data-card="${id}" style="--school: var(--${card.school})" ${playable ? '' : 'aria-disabled="true"'}
      aria-label="${esc(`${card.name}, ${card.type}, costs ${card.cost} ink. ${card.text} ${card.kw.map(k => KEYWORDS[k]).join(' ')}`)}">
    <span class="cost">${icon('ink')}${card.cost}</span>
    <span class="title">${icon(card.school)}${esc(card.name)}</span>
    <span class="type">${card.type}</span>
    ${stats}<span class="kws">${kws}</span>
    <span class="text">${esc(card.text)}</span>
  </button>`;
}

function barHtml(seat, coreTarget) {
  const p = state.players[seat];
  const deck = DECKS[p.deckKey];
  const who = seat === HUMAN ? 'You' : 'Rival';
  const core = `${icon('core')} ${Math.max(0, p.core)}`;
  const coreEl = coreTarget
    ? `<button class="stat core target" data-target="c${seat}" aria-label="Target ${seat === HUMAN ? 'your' : "the rival's"} core, ${p.core} left">${core}</button>`
    : `<span class="stat core" title="Core">${core}</span>`;
  return `<span class="who" style="color: var(--${deck.school})">${icon(deck.school)} ${who} · ${esc(deck.name)}</span>
    ${coreEl}
    <span class="stat ink" title="Ink">${icon('ink')} ${p.ink}/${p.maxInk}</span>
    <span class="stat" title="Cards in hand">${icon('hand')} ${p.hand.length}</span>
    <span class="stat" title="Cards in deck">${icon('deck')} ${p.deck.length}</span>`;
}

function humanActions() {
  return state && state.winner === null && state.active === HUMAN && !busy ? legalActions(state) : [];
}

function currentTargets(actions) {
  if (!selected) return new Set();
  return new Set(actions.filter(a => (selected.card ? a.card === selected.card : a.uid === selected.uid) && a.target).map(a => a.target));
}

function render(before) {
  if (!state) return;
  const actions = humanActions();
  const targets = currentTargets(actions);
  const attackers = new Set(actions.filter(a => a.t === 'attack').map(a => a.uid));
  const playable = new Set(actions.filter(a => a.t === 'play').map(a => a.card));
  $('rival-bar').innerHTML = barHtml(RIVAL, targets.has('c' + RIVAL));
  $('your-bar').innerHTML = barHtml(HUMAN, targets.has('c' + HUMAN));
  $('rival-board').innerHTML = state.players[RIVAL].board.map(u => unitHtml(u, RIVAL, targets, attackers, before)).join('');
  $('your-board').innerHTML = state.players[HUMAN].board.map(u => unitHtml(u, HUMAN, targets, attackers, before)).join('');
  $('hand').innerHTML = state.players[HUMAN].hand.map(id => cardHtml(id, playable.has(id))).join('');
  $('turn-pill').textContent = `Turn ${state.turn} · ${state.active === HUMAN ? 'your move' : 'rival thinking'}`;
  $('status').textContent = state.winner !== null ? 'The duel is over.'
    : state.active === RIVAL ? 'The rival is taking its turn.'
    : selected ? 'Choose a highlighted target, or press Escape to cancel.'
    : playable.size || attackers.size ? 'Play a card or pick a ready unit to attack with.' : 'Nothing left to do. End your turn.';
  $('end-turn').disabled = !actions.length;
  $('coach').disabled = !actions.length;
  $('cancel').hidden = !selected;
}

// ---------- input ----------
function clickCard(id) {
  const actions = humanActions().filter(a => a.t === 'play' && a.card === id);
  if (!actions.length) return;
  if (actions.length === 1 && !actions[0].target) return act(actions[0]);
  selected = { card: id };
  render();
}

function clickUnit(uid) {
  const actions = humanActions();
  if (selected) {
    const match = actions.find(a => (selected.card ? a.card === selected.card : a.uid === selected.uid) && a.target === 'u' + uid);
    if (match) return act(match);
  }
  if (actions.some(a => a.t === 'attack' && a.uid === uid)) { selected = { uid }; render(); }
}

function clickTarget(target) {
  const match = humanActions().find(a => selected && (selected.card ? a.card === selected.card : a.uid === selected.uid) && a.target === target);
  if (match) act(match);
}

$('game').addEventListener('click', e => {
  const card = e.target.closest('[data-card]');
  const unit = e.target.closest('[data-unit]');
  const target = e.target.closest('[data-target]');
  if (card) clickCard(card.dataset.card);
  else if (unit) clickUnit(Number(unit.dataset.unit));
  else if (target) clickTarget(target.dataset.target);
});
$('end-turn').addEventListener('click', () => { if (humanActions().length) act({ t: 'end' }); });
$('cancel').addEventListener('click', () => { selected = null; render(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) { selected = null; render(); } });
$('coach').addEventListener('click', () => {
  const result = chooseAction(observe(state, HUMAN), { level: 'master', weights: TRAINED?.weights?.specialists?.[choice.deck] || DEFAULT_WEIGHTS, rand });
  hint = result.action;
  $('status').textContent = `Coach suggests: ${describe(result.action, HUMAN)}.`;
  const keep = $('status').textContent;
  render();
  $('status').textContent = keep;
});

// ---------- arena ----------
function renderArena() {
  if (!TRAINED) { $('arena-intro').textContent = 'No training results yet.'; return; }
  const keys = Object.keys(DECKS);
  $('arena-intro').textContent = `${TRAINED.gamesPlayed.toLocaleString()} self-play games, trained and measured ${TRAINED.updated}. Arena games use Adept search with each deck's specialist evaluator, and seats alternate.`;
  const head = keys.map(k => `<th scope="col" style="--school: var(--${DECKS[k].school})">${icon(DECKS[k].school)}<br>${esc(DECKS[k].name)}</th>`).join('');
  const rows = keys.map(a => `<tr><th scope="row" style="--school: var(--${DECKS[a].school})">${icon(DECKS[a].school)} ${esc(DECKS[a].name)}</th>` + keys.map(b => {
    const c = TRAINED.arena.matrix[a][b];
    const shade = Math.round(Math.abs(c.rate - 0.5) * 200);
    return `<td style="background: color-mix(in srgb, var(${c.rate >= 0.5 ? '--cell-high' : '--cell-low'}) ${Math.min(100, shade * 2)}%, transparent)" title="${c.games} games">${pct(c.rate)}</td>`;
  }).join('') + '</tr>').join('');
  $('matrix').innerHTML = `<table class="matrix"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  const bar = (label, value, ci, alt) => `<div class="bar-row"><div class="head"><span>${label}</span><span>${pct(value)}</span></div>
    <div class="track"><div class="fill ${alt ? 'alt' : ''}" style="width:${pct(value)}"></div><div class="half"></div>${ci ? `<div class="ci" style="left:${pct(ci[0])};width:${pct(ci[1] - ci[0])}"></div>` : ''}</div></div>`;
  const gains = keys.map(k => TRAINED.specialistGain[k].specialist - TRAINED.specialistGain[k].general);
  const meanGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  $('gain').innerHTML = `<p class="meta">Average change from specialising: ${meanGain >= 0 ? '+' : ''}${(100 * meanGain).toFixed(1)} points. ${Math.abs(meanGain) < 0.02 ? 'Within noise: unlike the write-up, a ten-feature evaluator leaves little for a specialist to learn.' : ''}</p>` + keys.map(k => {
    const g = TRAINED.specialistGain[k];
    return `<p><strong style="color: var(--${DECKS[k].school})">${icon(DECKS[k].school)} ${esc(DECKS[k].name)}</strong></p>` +
      bar('General evaluator', g.general, null, true) + bar('Specialist evaluator', g.specialist);
  }).join('');
  $('depth').innerHTML = TRAINED.levels.map(l => bar(`${LEVELS[l.a].label} vs ${LEVELS[l.b].label} (${l.games} games)`, l.rate, l.ci)).join('') +
    bar(`Trained vs hand-set weights, both Adept (${TRAINED.vsHandTuned.games} games)`, TRAINED.vsHandTuned.rate, TRAINED.vsHandTuned.ci) +
    (TRAINED.searchOnly ? bar(`Master's search vs Adept's, same trained evaluator (${TRAINED.searchOnly.games} games)`, TRAINED.searchOnly.rate, TRAINED.searchOnly.ci) : '');
  $('stages').innerHTML = TRAINED.stages.map(s => `<li><strong>${esc(s.stage)}</strong>: ${esc(s.detail)}. ${s.accepted} challengers replaced the incumbent.</li>`).join('') +
    '<li><strong>Arena</strong>: each pair of specialists played a round-robin to fill the table.</li>';
}
renderArena();
