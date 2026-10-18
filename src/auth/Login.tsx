import { useState } from 'react';
import { useSession } from '../data/session';
import { InlineMsg } from '../ui/Modal';

export function Login() {
  const { signIn, message } = useSession();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await signIn(email, passcode);
          setBusy(false);
        }}
      >
        <img src="/icons/icon.svg" alt="" width={72} height={72} />
        <h1>Park Plate</h1>
        <p className="login-sub">Family dining map. Sign in once on Wi-Fi and it keeps working in the parks.</p>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Family passcode
          <input type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
        </label>
        <InlineMsg kind={message === 'Signed out.' ? 'info' : 'error'}>{message}</InlineMsg>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
