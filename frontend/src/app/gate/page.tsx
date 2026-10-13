"use client";

import React, { useState, useEffect } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function GatePage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/status");
        if (res.ok) {
          const data = await res.json();
          if (!data.gate_active || data.authenticated) {
            window.location.href = "/";
          }
        }
      } catch (e) {
        // Ignore during initial load
      }
    }
    checkAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: passcode.trim() }),
      });

      if (res.ok) {
        // Authenticated! Redirect to requested path or home
        const params = new URLSearchParams(window.location.search);
        const returnUrl = params.get("return") || "/";
        window.location.href = returnUrl;
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Invalid passcode. Please check the terminal output.");
      }
    } catch (err: any) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-neutral-800/80 border border-neutral-700/60 rounded-2xl flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Access Gate</h1>
          <p className="text-sm text-neutral-400 mt-2">
            This instance is protected by a secure access code. Check your terminal output to find the passcode.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Passcode
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter passcode"
              className="w-full px-4 py-3 bg-neutral-950/80 border border-neutral-800 rounded-xl text-center text-xl font-mono tracking-widest text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passcode.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.99]"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Unlock Studio</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-neutral-800/60 flex items-center justify-center gap-2 text-xs text-neutral-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Encrypted Session · On-Device Processing</span>
        </div>
      </div>
    </div>
  );
}
