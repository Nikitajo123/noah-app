import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../auth";
import { IconCheck, IconLogout } from "../components/Icons";

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState("");

  const change = useMutation({
    mutationFn: () =>
      api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      }),
    onSuccess: () => {
      setDone("Geslo je spremenjeno.");
      setCurrent("");
      setNext("");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setDone("");
    change.mutate();
  }

  return (
    <form onSubmit={submit}>
      <h3>Sprememba gesla</h3>
      {done && (
        <div className="okmsg" role="status">
          <IconCheck size={18} />
          {done}
        </div>
      )}
      <label className="field">
        Trenutno geslo
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        Novo geslo (vsaj 8 znakov)
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {change.error && <p className="error">{change.error.message}</p>}
      <button className="btn-secondary" disabled={change.isPending || !current || next.length < 8}>
        Spremeni geslo
      </button>
    </form>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const initials = user!.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="page profile">
      <div className="profile-card">
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <h2>{user!.name}</h2>
        <p className="muted">
          {user!.email}, {user!.role === "VODJA" ? "vodja" : "delavec"}
        </p>
      </div>
      <ChangePassword />
      <button className="btn-secondary" onClick={logout}>
        <IconLogout size={20} />
        Odjava
      </button>
    </div>
  );
}
