// Small shared pieces.
import { html } from '../vendor.js';

/** A member's photo or initial in their color. */
export function Avatar(props) {
  const m = props.member;
  const style = 'background-color:' + (m ? m.color || '#5E625F' : '#8A8F8B') +
    (m && m.avatar_url ? ';background-image:url(' + JSON.stringify(m.avatar_url) + ')' : '') +
    (props.size ? ';width:' + props.size + ';height:' + props.size : '');
  return html`<span class="avatar" style=${style} aria-hidden="true">${m && !m.avatar_url ? (m.initial || m.name.charAt(0)) : ''}</span>`;
}
