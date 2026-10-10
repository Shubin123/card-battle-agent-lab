// Small line icons (24×24, currentColor). Original drawings.
const P = {
  ember: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 1.5 2.5 3 3 0-3-1.5-5 0-8z"/>',
  tide: '<path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  grove: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>',
  storm: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
  power: '<path d="M14.5 4H20v5.5L10 19.5 4.5 14z"/><path d="m7 17-3 3"/><path d="m3.5 13.5 7 7"/>',
  guard: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>',
  core: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  ink: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  hand: '<rect x="4" y="6" width="10" height="14" rx="1.5"/><path d="M9 4h9.5A1.5 1.5 0 0 1 20 5.5V18"/>',
  deck: '<rect x="5" y="8" width="14" height="12" rx="1.5"/><path d="M7 5h10M9 2.5h6"/>',
  swift: '<path d="M4 12h11"/><path d="M4 7h7"/><path d="M4 17h7"/><path d="m15 7 5 5-5 5"/>',
  wall: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 15h18M9 5v5M15 5v5M6 10v5M12 10v5M18 10v5M9 15v4M15 15v4"/>',
  pierce: '<path d="M4 20 20 4"/><path d="M12 4h8v8"/>',
  drain: '<path d="M12 3s5 5.5 5 9.5a5 5 0 0 1-10 0C7 8.5 12 3 12 3z"/><path d="M12 10v5M9.5 12.5h5"/>',
  burst: '<path d="m12 2 2 6 6-2-4 5 5 3-6 1 1 6-4-4-4 4 1-6-6-1 5-3-4-5 6 2z"/>',
  shield: '<circle cx="12" cy="12" r="8"/><path d="M8.5 9.5a5 5 0 0 1 4-2.5"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z"/><path d="M9 12h6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m11 19-6-6M8 16l-4 4M5 21l-2-2"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 2 2v1h-4"/><path d="M16 6v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10"/><path d="M8 9h5M8 13h5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
};

export function icon(name, label) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${P[name]}</svg>`;
}
