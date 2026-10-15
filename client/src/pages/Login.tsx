import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useMedia } from "../useMedia";

const img = (name: string) => ({
  src: `/photos/${name}-800.webp`,
  srcSet: `/photos/${name}-800.webp 800w, /photos/${name}-1600.webp 1600w`,
});

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      {now.toLocaleTimeString("sl-SI", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Ljubljana",
      })}
    </>
  );
}

function PhoneHero() {
  return (
    <div className="login-photo">
      <img className="bg" {...img("house-real")} sizes="100vw" alt="" />
      <div className="login-brand">
        <img src="/noah-logo-light.png" alt="NOAH Houses" />
      </div>
      <div className="login-tag">
        <h1>Delovni nalogi</h1>
        <p>Delo na gradbišču, na enem mestu.</p>
      </div>
    </div>
  );
}

function DesktopArt() {
  return (
    <div className="login-art" aria-hidden="true">
      <img className="art-logo" src="/noah-logo-dark.png" alt="" />
      <img className="a1" {...img("house-real")} sizes="30vw" alt="" />
      <img className="a2" {...img("house-render-b")} sizes="30vw" alt="" />
      <img className="a3" {...img("house-render-a")} sizes="28vw" alt="" />
      <p className="art-meta">
        <span>MB</span>
        <span>
          <Clock />
        </span>
      </p>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const desktop = useMedia("(min-width: 900px)");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Napaka");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      {desktop ? <DesktopArt /> : <PhoneHero />}
      <form className="login-sheet" onSubmit={submit}>
        <h2>Prijava</h2>
        {desktop && <p className="login-lead">Delovni nalogi. Delo na gradbišču, na enem mestu.</p>}
        <label>
          E-pošta
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Geslo
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="error form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary btn-lg" disabled={busy}>
          {busy ? "Prijavljam..." : "Prijava"}
        </button>
        <p className="muted center">Težave s prijavo? Pokliči vodjo.</p>
      </form>
    </div>
  );
}