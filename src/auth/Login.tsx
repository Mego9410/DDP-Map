import { useState } from 'react';
import { useSession } from '../data/session';
import { InlineMsg } from '../ui/Modal';

/** Night-sky welcome. The stars and arc are decoration only. */
function Sky() {
  return (
    <svg className="login-sky" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      <g fill="#FFF6DE">
        <circle cx="40" cy="90" r="1.2" opacity=".8" />
        <circle cx="96" cy="160" r=".8" opacity=".5" />
        <circle cx="150" cy="70" r="1" opacity=".7" />
        <circle cx="230" cy="130" r="1.4" opacity=".9" />
        <circle cx="300" cy="80" r=".9" opacity=".6" />
        <circle cx="350" cy="190" r="1.1" opacity=".7" />
        <circle cx="60" cy="250" r=".9" opacity=".5" />
        <circle cx="330" cy="290" r="1" opacity=".6" />
        <circle cx="190" cy="230" r=".7" opacity=".5" />
        <circle cx="120" cy="320" r="1" opacity=".6" />
        <circle cx="270" cy="360" r=".8" opacity=".5" />
        <circle cx="20" cy="400" r="1" opacity=".5" />
      </g>
      <path className="login-arc" d="M 70 196 Q 195 40 320 150" fill="none" stroke="#E2C58C" strokeOpacity=".6" strokeWidth="1.2" strokeDasharray="1 7" strokeLinecap="round" />
      <path d="M320 138 L322.4 146.6 L331 149 L322.4 151.4 L320 160 L317.6 151.4 L309 149 L317.6 146.6 Z" fill="#F3DFAE" />
    </svg>
  );
}

export function Login() {
  const { signIn, message } = useSession();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <Sky />
      <div className="login-brand">
        <div className="app-mark" aria-hidden="true">
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="26" r="15" stroke="#E2C58C" strokeWidth="2" />
            <path d="M24 11c-6 0-10.5 4.4-10.5 10 0 7.6 10.5 17 10.5 17s10.5-9.4 10.5-17c0-5.6-4.5-10-10.5-10z" fill="#F3DFAE" />
            <circle cx="24" cy="21" r="3.6" fill="#0F1B3A" />
          </svg>
        </div>
        <h1 className="wordmark">
          Park <em>Plate</em>
        </h1>
        <p className="login-sub">Every quick-service counter, every credit, every refill. Even with no signal.</p>
      </div>
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await signIn(email, passcode);
          setBusy(false);
        }}
      >
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Family passcode
          <input type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
        </label>
        <InlineMsg kind={message === 'Signed out.' ? 'info' : 'error'}>{message}</InlineMsg>
        <button type="submit" className="btn btn--gold btn--block" disabled={busy}>
          {busy ? 'Opening the gates…' : 'Sign in'}
        </button>
        <p className="login-foot">Sign in once on Wi-Fi. It keeps working in the parks.</p>
      </form>
    </main>
  );
}
