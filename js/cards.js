// Original card set: every card is just a word, a school, a cost and a rule.
// Targets: 'any' (any unit or core), 'enemyUnit', 'allyUnit'.

export const SCHOOLS = {
  ember: { name: 'Ember', blurb: 'Fast and reckless. Burns through defences early.' },
  tide: { name: 'Tide', blurb: 'Patient walls, card draw and tricks that undo tempo.' },
  grove: { name: 'Grove', blurb: 'Grows extra ink, then lands huge units.' },
  storm: { name: 'Storm', blurb: 'Swift strikers, shields and precise removal.' },
};

const list = [
  // Ember
  { id: 'kindle', name: 'Kindle', school: 'ember', cost: 1, type: 'unit', power: 2, guard: 1, kw: ['swift'] },
  { id: 'cinder', name: 'Cinder', school: 'ember', cost: 2, type: 'unit', power: 3, guard: 2, kw: [] },
  { id: 'blaze', name: 'Blaze', school: 'ember', cost: 3, type: 'unit', power: 3, guard: 3, kw: ['burst'] },
  { id: 'pyre', name: 'Pyre', school: 'ember', cost: 5, type: 'unit', power: 5, guard: 4, kw: ['pierce'] },
  { id: 'flare', name: 'Flare', school: 'ember', cost: 1, type: 'spell', target: 'any', effect: { damage: 2 } },
  { id: 'scorch', name: 'Scorch', school: 'ember', cost: 3, type: 'spell', target: 'any', effect: { damage: 4 } },
  { id: 'wildfire', name: 'Wildfire', school: 'ember', cost: 4, type: 'spell', effect: { sweep: 2 } },
  // Tide
  { id: 'ripple', name: 'Ripple', school: 'tide', cost: 1, type: 'unit', power: 1, guard: 3, kw: ['wall'] },
  { id: 'current', name: 'Current', school: 'tide', cost: 2, type: 'unit', power: 2, guard: 3, kw: [] },
  { id: 'undertow', name: 'Undertow', school: 'tide', cost: 4, type: 'unit', power: 3, guard: 5, kw: ['wall', 'drain'] },
  { id: 'leviathan', name: 'Leviathan', school: 'tide', cost: 7, type: 'unit', power: 7, guard: 7, kw: ['wall'] },
  { id: 'riptide', name: 'Riptide', school: 'tide', cost: 2, type: 'spell', target: 'enemyUnit', effect: { bounce: true } },
  { id: 'mend', name: 'Mend', school: 'tide', cost: 2, type: 'spell', effect: { heal: 4, draw: 1 } },
  { id: 'insight', name: 'Insight', school: 'tide', cost: 2, type: 'spell', effect: { draw: 2 } },
  // Grove
  { id: 'sprout', name: 'Sprout', school: 'grove', cost: 1, type: 'unit', power: 1, guard: 2, kw: [], onPlay: { ramp: 1 } },
  { id: 'bramble', name: 'Bramble', school: 'grove', cost: 2, type: 'unit', power: 2, guard: 3, kw: ['wall'] },
  { id: 'oakheart', name: 'Oakheart', school: 'grove', cost: 4, type: 'unit', power: 4, guard: 6, kw: [] },
  { id: 'ancient', name: 'Ancient', school: 'grove', cost: 6, type: 'unit', power: 6, guard: 8, kw: ['shield'] },
  { id: 'worldroot', name: 'Worldroot', school: 'grove', cost: 8, type: 'unit', power: 8, guard: 9, kw: ['wall'], onPlay: { rally: 1 } },
  { id: 'bloom', name: 'Bloom', school: 'grove', cost: 2, type: 'spell', effect: { ramp: 1, draw: 1 } },
  { id: 'bolster', name: 'Bolster', school: 'grove', cost: 2, type: 'spell', target: 'allyUnit', effect: { buff: [2, 2] } },
  // Storm
  { id: 'gust', name: 'Gust', school: 'storm', cost: 1, type: 'unit', power: 2, guard: 1, kw: ['swift'] },
  { id: 'herald', name: 'Herald', school: 'storm', cost: 3, type: 'unit', power: 2, guard: 3, kw: [], onPlay: { rally: 1 } },
  { id: 'squall', name: 'Squall', school: 'storm', cost: 3, type: 'unit', power: 3, guard: 2, kw: ['swift', 'shield'] },
  { id: 'tempest', name: 'Tempest', school: 'storm', cost: 5, type: 'unit', power: 4, guard: 4, kw: ['swift', 'pierce'] },
  { id: 'thunder', name: 'Thunder', school: 'storm', cost: 3, type: 'spell', target: 'enemyUnit', effect: { damage: 4 } },
  { id: 'static', name: 'Static', school: 'storm', cost: 2, type: 'spell', effect: { sweep: 1, face: 1 } },
  { id: 'surge', name: 'Surge', school: 'storm', cost: 1, type: 'spell', target: 'allyUnit', effect: { buff: [2, 1] } },
];

export const KEYWORDS = {
  swift: 'Swift: can attack the turn it is played.',
  wall: 'Wall: enemies must attack a Wall before anything else.',
  pierce: 'Pierce: damage beyond the target\'s guard hits the enemy core.',
  drain: 'Drain: heals your core by the damage it deals.',
  burst: 'Burst: when destroyed, deals 2 damage to the enemy core.',
  shield: 'Shield: ignores the first damage it would take.',
};

function describe(card) {
  const parts = [];
  if (card.onPlay?.ramp) parts.push(`On play: +${card.onPlay.ramp} max ink.`);
  if (card.onPlay?.rally) parts.push(`On play: other allies get +${card.onPlay.rally} power.`);
  const e = card.effect || {};
  if (e.damage) parts.push(`Deal ${e.damage} damage to ${card.target === 'any' ? 'any unit or core' : 'an enemy unit'}.`);
  if (e.sweep) parts.push(`Deal ${e.sweep} damage to every enemy unit${e.face ? ` and ${e.face} to their core` : ''}.`);
  if (e.bounce) parts.push('Return an enemy unit to its owner\'s hand.');
  if (e.heal) parts.push(`Heal your core by ${e.heal}.`);
  if (e.ramp) parts.push(`+${e.ramp} max ink.`);
  if (e.draw) parts.push(`Draw ${e.draw}.`);
  if (e.buff) parts.push(`Give an ally +${e.buff[0]} power and +${e.buff[1]} guard.`);
  return parts.join(' ');
}

export const CARDS = Object.fromEntries(list.map(c => [c.id, { kw: [], ...c, text: describe(c) }]));

const build = counts => Object.entries(counts).flatMap(([id, n]) => Array(n).fill(id));

export const DECKS = {
  ember: { name: 'Ember Rush', school: 'ember', cards: build({ kindle: 5, cinder: 5, flare: 4, blaze: 4, scorch: 4, pyre: 4, wildfire: 4 }) },
  tide: { name: 'Tidewall', school: 'tide', cards: build({ ripple: 5, current: 5, riptide: 4, mend: 4, insight: 4, undertow: 4, leviathan: 4 }) },
  grove: { name: 'Deep Grove', school: 'grove', cards: build({ sprout: 5, bramble: 5, bloom: 4, bolster: 4, oakheart: 4, ancient: 4, worldroot: 4 }) },
  storm: { name: 'Stormcall', school: 'storm', cards: build({ gust: 5, surge: 5, static: 4, herald: 4, squall: 4, thunder: 4, tempest: 4 }) },
};
