"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const supabase = createClient();

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }

    router.push("/bigfive");
  }

  return (
    <main className="vn-page" style={{ maxWidth: "24rem" }}>
      <p className="vn-eyebrow">Verdic Nimai</p>
      <h1 className="vn-heading">{mode === "signin" ? "Sign in" : "Create an account"}</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={status === "loading"} className="vn-btn">
          {status === "loading" ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        {status === "error" && <p className="vn-error">{errorMsg}</p>}
      </form>
      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="vn-link mt-4 text-sm"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
