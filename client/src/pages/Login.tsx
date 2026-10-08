import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
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
      <div className="login-hero">
        <div className="bar" />
        <h1>NOAH</h1>
        <p className="hero-title">Delovni nalogi</p>
        <p className="hero-sub">Delo na gradbišču, na enem mestu.</p>
      </div>
      <form className="login-sheet" onSubmit={submit}>
        <h2>Prijava</h2>
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
        {error && <p className="error">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Prijavljam..." : "Prijava"}
        </button>
        <p className="muted center">Težave s prijavo? Pokliči vodjo.</p>
      </form>
    </div>
  );
}