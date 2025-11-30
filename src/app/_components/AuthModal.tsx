"use client";

import React, { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { createPortal } from "react-dom";
import Image from "next/image";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  callbackUrl?: string;
};

export default function AuthModal({ open, onClose, callbackUrl = "/" }: AuthModalProps) {
  if (!open) return null;

  return createPortal(
    <div id="auth-modal" className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="Close auth modal"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <AuthDialogBody onClose={onClose} callbackUrl={callbackUrl} />
    </div>,
    document.body,
  );
}

type Mode = "login" | "register";

function AuthDialogBody({ onClose, callbackUrl }: { onClose: () => void; callbackUrl: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Clear form when switching modes
    setError(null);
    setSuccess(null);
    setPassword("");
    setConfirmPassword("");
  }, [mode]);

  const title = useMemo(
    () => (mode === "login" ? "Sign in to Daddy Games" : "Create your Daddy Games account"),
    [mode],
  );

  const canSubmit = useMemo(() => {
    const basic = email.trim().length > 3 && password.length >= 6;
    if (mode === "register") return basic && confirmPassword === password;
    return basic;
  }, [email, password, confirmPassword, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === "register") {
        // Call your register endpoint
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Registration failed");
        }
        setSuccess("Account created. You can sign in now.");
        setMode("login");
      } else {
        // NextAuth Credentials sign-in
        const result = await signIn("credentials", {
          redirect: false,
          email: email.trim(),
          password,
          callbackUrl,
        });
        if (result?.error) throw new Error(result.error);
        // When redirect=false, NextAuth returns a URL to navigate to
        window.location.href = result?.url || callbackUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <button
          aria-label="Close"
          onClick={onClose}
          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-lg border border-white/10">
        <button
          className={`${
            mode === "login" ? "bg-white/10 text-white" : "bg-transparent text-white/70 hover:bg-white/5"
          } px-3 py-2 text-sm font-medium transition`}
          onClick={() => setMode("login")}
          aria-pressed={mode === "login"}
        >
          Login
        </button>
        <button
          className={`${
            mode === "register" ? "bg-white/10 text-white" : "bg-transparent text-white/70 hover:bg-white/5"
          } px-3 py-2 text-sm font-medium transition`}
          onClick={() => setMode("register")}
          aria-pressed={mode === "register"}
        >
          Create account
        </button>
      </div>

      {/* Email/Password form */}
      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/20"
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-white/80">Password</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/20"
            placeholder={mode === "login" ? "Your password" : "At least 6 characters"}
            minLength={6}
            required
          />
        </label>
        {mode === "register" && (
          <label className="grid gap-1 text-sm">
            <span className="text-white/80">Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-white/20"
              placeholder="Re-enter password"
              minLength={6}
              required
            />
          </label>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {mode === "register" && confirmPassword && confirmPassword !== password && (
          <p className="text-sm text-amber-400">Passwords do not match.</p>
        )}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3 text-xs text-white/40">
        <div className="h-px flex-1 bg-white/10" />
        <span>or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* OAuth options (optional, still available) */}
      <div className="grid gap-3">
        <button
          onClick={() => signIn("discord", { callbackUrl })}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 font-medium text-white hover:opacity-90"
        >
          <Image src="icons/discord.svg" alt="Discord" width={20} height={20} className="invert brightness-0" />
          Continue with Discord
        </button>
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
        >
          <Image src="icons/google.svg" alt="Google" width={20} height={20} />
          Continue with Google
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-white/40">
        By continuing you agree to our Terms and Privacy Policy.
      </p>
    </div>
  );
}
