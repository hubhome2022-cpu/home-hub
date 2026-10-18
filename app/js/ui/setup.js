// First run on a device: pair with a 6-digit code from a device that's already set up,
// or enter the household key (the first device only).
import { html, useState } from '../vendor.js';
import { Icon } from './icons.js';

export function Setup(props) {
  const [way, setWay] = useState('code');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await props.onConnect(way, value.trim());
    } catch (err) {
      setError(messageFor(err));
      setBusy(false);
    }
  };

  const code = way === 'code';
  const ready = code ? /^\d{6}$/.test(value.trim()) : value.trim().length >= 32;

  return html`<main class="setup">
    <div class="stack" style="gap:1.2rem">
      <img src="icons/icon.svg" alt="" width="64" height="64" style="width:calc(var(--tap) * 1.2);height:calc(var(--tap) * 1.2)" />
      <h1 class="h1">Set up Home Hub</h1>
      <p class="muted" style="line-height:1.45">Connect this ${props.mode === 'hub' ? 'screen' : 'phone'} to your household. You only do this once.</p>
    </div>

    <div class="seg" role="tablist" aria-label="How to connect">
      <button role="tab" aria-selected=${code ? 'true' : 'false'} onClick=${() => { setWay('code'); setValue(''); setError(''); }}>Pairing code</button>
      <button role="tab" aria-selected=${code ? 'false' : 'true'} onClick=${() => { setWay('key'); setValue(''); setError(''); }}>Household key</button>
    </div>

    <form class="stack" style="gap:var(--gap)" onSubmit=${submit} novalidate>
      ${code
        ? html`<div class="field" key="code-field">
            <label for="code">Pairing code</label>
            <input id="code" class="input input-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
              value=${value} onInput=${(e) => setValue(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            <span class="small muted">On a phone that's already set up: Settings › Add another device.</span>
          </div>`
        : html`<div class="field" key="key-field">
            <label for="key">Household key</label>
            <input id="key" class="input" autocomplete="off" autocapitalize="off" spellcheck="false"
              value=${value} onInput=${(e) => setValue(e.target.value)} placeholder="Paste the key" />
            <span class="small muted">In the Sheet (hub account): Home Hub › Show household key. Best done on a phone, where you can paste it.</span>
          </div>`}
      ${error ? html`<div class="banner" role="alert">${error}</div>` : null}
      <button type="submit" class="btn btn-ink btn-block" disabled=${busy || !ready}>
        ${busy ? 'Connecting…' : html`Connect <${Icon} name="chevronRight" size="var(--icon-s)" />`}
      </button>
    </form>

    <a class="small" href="?demo" style="text-align:center;font-weight:600">Just looking? Try it with sample data</a>
  </main>`;
}

function messageFor(err) {
  switch (err && err.code) {
    case 'bad_code': return 'That code is wrong or has expired. Make a new one and try again.';
    case 'too_many_attempts': return 'Too many wrong codes. Wait 10 minutes, then make a new code.';
    case 'bad_key': return 'That key doesn\'t match. Copy it again from Home Hub › Show household key.';
    case 'offline': return 'Can\'t reach the hub. Check this device is online and try again.';
    case 'unknown_action': return 'The Sheet\'s script needs updating for pairing. Use the household key for now.';
    case 'not_json': return err.message;
    default: return (err && err.message) || 'Something went wrong. Try again.';
  }
}
