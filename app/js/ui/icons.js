// One stroke-icon set for the whole app (Lucide-style, 24-unit grid).
import { html } from '../vendor.js';

const P = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20h14V9.5', 'M10 20v-6h4v6'],
  calendar: ['M16 2.5v4M8 2.5v4M3 10h18'],
  meals: ['M7 3v18', 'M4.5 3v5a2.5 2.5 0 0 0 5 0V3', 'M17.5 21V3c-2 0-3.5 2.5-3.5 6v4h3.5'],
  chores: ['M3 6.5l2 2 3.5-3.5M3 15.5l2 2 3.5-3.5M12 7h9M12 16h9'],
  fitness: ['M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11'],
  devices: ['M9 18h6M10 21h4', 'M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z'],
  plus: ['M12 5v14M5 12h14'],
  close: ['M6 6l12 12M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 5l7 7-7 7'],
  back: ['M15 5l-7 7 7 7'],
  cart: ['M2.5 3.5h3l2.4 11.5h11l2-8H6.6'],
  note: ['M5 3.5h14v11l-5 5H5z', 'M14 19.5v-5h5'],
  refresh: ['M20 11a8 8 0 0 0-14.3-4.9L4 8', 'M4 3.5V8h4.5', 'M4 13a8 8 0 0 0 14.3 4.9L20 16', 'M20 20.5V16h-4.5'],
  cloudOff: ['M3 3l18 18', 'M8.5 7.6A5 5 0 0 1 16.8 10a3.5 3.5 0 0 1 3 5.6', 'M17 19H8a4 4 0 0 1-1.3-7.8'],
  gear: ['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z'],
  key: ['M15.5 7.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M10.3 9.7 3 17v4h4v-2h2v-2h2l1.5-1.5'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  flame: ['M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.6-5.6-3.6-8.8-1.6 1.2-2.4 3-2.4 4.6-1.3-.8-2-2.3-2-3.9C8 8.6 5.5 11.4 5.5 14.8 5.5 18.4 8.1 21 12 21z'],
  sparkle: ['M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4']
};

const EXTRA = {
  calendar: html`<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"></rect>`,
  cart: html`<circle cx="9" cy="20" r="1.4"></circle><circle cx="18" cy="20" r="1.4"></circle>`
};

/** <${Icon} name="home" size="var(--icon)" /> — decorative unless a label is given. */
export function Icon(props) {
  const size = props.size || 'var(--icon)';
  const paths = P[props.name] || [];
  const label = props.label;
  return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${props.stroke || 2}
    stroke-linecap="round" stroke-linejoin="round" style=${'width:' + size + ';height:' + size + ';flex-shrink:0'}
    aria-hidden=${label ? null : 'true'} role=${label ? 'img' : null} aria-label=${label || null}>
    ${EXTRA[props.name] || null}
    ${paths.map((d) => html`<path d=${d}></path>`)}
  </svg>`;
}
