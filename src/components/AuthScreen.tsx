import { useState } from "react";
import { useAuth } from "../lib/auth/AuthContext";

export default function AuthScreen() {
  const { signIn, signUp, backend } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignUp = mode === "signup";

  async function submit() {
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    const err = isSignUp ? await signUp(name, email, password) : await signIn(email, password);
    setBusy(false);
    setError(err);
  }

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-glow" />
        <div className="brand">
          <span className="brand-mark">
            <i className="ph ph-planet" />
          </span>
          <span>Orbit</span>
        </div>
        <div className="auth-pitch">
          <h1>Every task, every list, laid across your day.</h1>
          <p>
            Filter by list, plan the week, then drag what matters onto a timeline that already knows
            what time it is.
          </p>
        </div>
        <div className="auth-meta">
          <span>Lists</span>
          <span>Board · List · Cards</span>
          <span>Day timeline</span>
        </div>
      </aside>

      <section className="auth-form">
        <div className="auth-card">
          <h2>{isSignUp ? "Create your account" : "Welcome back"}</h2>
          <p className="muted small">
            {isSignUp ? "Two minutes to a planned week." : "Sign in to pick up where you left off."}
          </p>

          {isSignUp && (
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@email.com"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="••••••••"
            />
          </label>

          {error && <div className="notice">{error}</div>}

          <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy ? "Working…" : isSignUp ? "Create account" : "Sign in"}
          </button>

          <div className="switch small muted">
            {isSignUp ? "Already have an account?" : "New to Orbit?"}{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setError(null);
                setMode(isSignUp ? "signin" : "signup");
              }}
            >
              {isSignUp ? "Sign in" : "Create one"}
            </a>
          </div>

          <div className="backend-note small muted">
            {backend === "supabase"
              ? "Signing in against Supabase."
              : "Offline account, stored on this Mac. Add Supabase keys in .env to sync."}
          </div>
        </div>
      </section>
    </div>
  );
}
