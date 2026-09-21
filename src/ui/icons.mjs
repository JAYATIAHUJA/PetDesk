// icons.mjs — PetDesk's hand-drawn icon set (renderer-side).
// Paths are sketched slightly off-axis on a 24×24 grid; a turbulence filter adds the pencil wobble.
const FILTER_ID = 'petdesk-sketch';

const ICONS = {
  paw: '<path d="M12 12.8c-3.1.1-5.3 2.4-5 4.8.2 1.9 2 2.5 5.1 2.4 3-.1 4.8-.7 4.9-2.5.2-2.4-2.1-4.8-5-4.7z"/><ellipse cx="6.4" cy="10.6" rx="1.6" ry="2.1" transform="rotate(-14 6.4 10.6)"/><ellipse cx="10" cy="6.7" rx="1.7" ry="2.3" transform="rotate(-5 10 6.7)"/><ellipse cx="14.2" cy="6.6" rx="1.7" ry="2.3" transform="rotate(6 14.2 6.6)"/><ellipse cx="17.7" cy="10.5" rx="1.6" ry="2.1" transform="rotate(15 17.7 10.5)"/>',
  calendar: '<path d="M4.4 6.5c0-.9.6-1.4 1.4-1.4l12.3-.2c.9 0 1.5.6 1.5 1.4l.1 12.2c0 .9-.6 1.5-1.4 1.5l-12.4.1c-.9 0-1.4-.6-1.4-1.5z"/><path d="M4.6 9.9l14.9-.2M8.2 3.3l.1 3.3M15.7 3.2l.1 3.3"/><path d="M8.3 13.6h.1M12 13.5h.1M15.7 13.4h.1M8.3 16.9h.1M12 16.8h.1" stroke-width="2.4"/>',
  cat: '<path d="M5.1 9.6 4.5 4.1l4.4 2.7c2-.7 4.3-.7 6.3 0l4.3-2.8-.5 5.6c1.3 3.1-.1 9.5-7 9.5s-8.2-6.4-6.9-9.5z"/><path d="M9.2 12.3v.9M14.9 12.2v.9"/><path d="M11.2 15.2l.8.7.9-.7M12 15.9v1.1"/><path d="M3 13.8l3 .5M2.9 16.8l3.1-.6M21 13.7l-3 .6M21.1 16.7l-3.1-.5" stroke-width="1.2"/>',
  sliders: '<path d="M3.9 7.1l8.8-.1M17.3 6.9l2.9.1M3.8 12.1l3 .1M11.3 12l8.9-.1M3.9 17.2l10.8-.2M19.2 17l1 .1"/><circle cx="15" cy="7" r="2.1"/><circle cx="9" cy="12.1" r="2.1"/><circle cx="17" cy="17" r="2.1"/>',
  timer: '<path d="M12 6.3c4 0 7.2 3.2 7.1 7.3 0 4-3.2 7.1-7.2 7.1s-7.1-3.3-7-7.2c0-4 3.2-7.2 7.1-7.2z"/><path d="M12 13.5l.1-4M12.1 13.5l2.6 1.7M9.9 3.1l4.2-.1M12 3.1v3.1M18.3 7.3l1.4-1.4"/>',
  minus: '<path d="M5 12.2l14-.3"/>',
  close: '<path d="M5.6 5.4l12.9 13.3M18.5 5.5L5.5 18.6"/>',
  plus: '<path d="M12 4.8l.1 14.4M4.8 12.1l14.4-.2"/>',
  check: '<path d="M4.6 12.7l4.7 5 10.2-11.2"/>',
  trash: '<path d="M4.5 6.8l15-.2M9.3 6.6l.4-2.5 4.5-.1.5 2.5M6.3 6.9l.9 12.2c.1.8.6 1.3 1.4 1.3l6.7-.1c.8 0 1.3-.5 1.4-1.3l1-12.2"/><path d="M10 10.5l.2 6M14 10.4l-.2 6"/>',
  save: '<path d="M12 3.8l.1 11M7.6 10.7l4.5 4.3 4.4-4.4"/><path d="M4.3 15.5l.1 3.2c0 .9.6 1.5 1.5 1.5l12.3-.1c.9 0 1.4-.6 1.4-1.5l-.1-3.2"/>',
  sparkle: '<path d="M11.5 3.5c.4 4.4 1.8 6.3 6.5 7.1-4.6.7-6.1 2.5-6.6 7.1-.5-4.5-1.9-6.4-6.5-7 4.6-.8 6.1-2.7 6.6-7.2z"/><path d="M18.5 15.5c.2 1.8.8 2.6 2.5 2.9-1.7.3-2.3 1.1-2.5 2.8-.2-1.7-.8-2.5-2.5-2.8 1.7-.3 2.3-1.1 2.5-2.9z" stroke-width="1.3"/>',
  target: '<path d="M12 4c4.5 0 8.1 3.6 8 8.1 0 4.4-3.7 8-8.1 7.9-4.4 0-8-3.6-7.9-8.1C4 7.5 7.6 3.9 12 4z"/><path d="M12 8c2.3 0 4.1 1.8 4 4.1 0 2.2-1.9 4-4.1 3.9-2.2 0-4-1.8-3.9-4.1C8 9.7 9.8 7.9 12 8z"/><path d="M12 11.9v.2" stroke-width="2.8"/>',
  moon: '<path d="M15.5 4.2c-4.6.3-8 4.3-7.3 8.9.6 3.8 3.9 6.7 7.8 6.7 1.5 0 2.9-.4 4-1.1-5.3-.7-8.3-6.1-5.9-10.8.4-.8.9-1.5 1.4-3.7z" transform="translate(-2.5 .3)"/><path d="M16.5 4.5h3.3l-3.2 3.7 3.4-.1" stroke-width="1.4"/>',
  swirl: '<path d="M12.3 12.2c-.9-.9.4-2.3 1.7-1.5 1.9 1.1 1.3 3.9-.8 4.7-2.8 1-5.5-1.3-5.2-4.2.4-3.6 4.2-5.7 7.6-4.4 3.9 1.5 5.3 6.3 3.1 9.8-1.4 2.2-3.8 3.5-6.4 3.5"/>',
  party: '<path d="M4 20.2l3.7-10.5 6.7 6.8z"/><path d="M6.3 13.8l3.8 4M13.5 9.5c1.3-1.5 1.2-3.5-.2-5M15.8 11.3c1.7-.8 3.6-.5 4.8.8M11 6.5v.1M18 7l.1-.1M19.5 15.5v.1" /><path d="M16.5 3.8l.3 1.7 1.7.3-1.7.4-.3 1.6-.4-1.6-1.6-.4 1.6-.3z" stroke-width="1.2"/>',
};

function sketchFilter() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${FILTER_ID}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5"/></filter></svg>`;
}

function icon(name, size = 18) {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#${FILTER_ID})" aria-hidden="true">${body}</svg>`;
}

// Replaces every <span data-icon="name" data-size="18"> placeholder inside `root` with its drawing
function hydrateIcons(root = document) {
  if (!document.getElementById(FILTER_ID)) document.body.insertAdjacentHTML('afterbegin', sketchFilter());
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 18);
  });
}

export { icon, hydrateIcons };
