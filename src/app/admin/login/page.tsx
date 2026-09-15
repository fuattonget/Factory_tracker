"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(searchParams.get("next") ?? "/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Factory Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to the admin panel</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

// useSearchParams() requires a Suspense boundary for prerendering (Next.js
// bails out of static generation otherwise) -- unrelated to the rest of
// this file's logic, just the required wrapper shape.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
