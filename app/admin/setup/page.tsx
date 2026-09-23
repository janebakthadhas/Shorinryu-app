"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSetupPage() {
  const router = useRouter();
  const [setupToken, setSetupToken] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken, email, fullName, password }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(result.error || "Unable to prepare the admin account.");
        return;
      }
      setMessage(result.message || "Admin account is ready.");
      setPassword("");
    } catch {
      setError("Unable to reach the setup service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
      <div className="w-full max-w-lg rounded-[30px] border-[6px] border-[#c7a531] bg-[#f7f2e8] p-8 shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">One-time setup</p>
        <h1 className="mt-4 text-3xl font-black uppercase text-[#111111]">Prepare admin access</h1>
        <p className="mt-3 text-sm text-[#444444]">Use the private setup token from your deployment settings.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <input required type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} placeholder="Setup token" autoComplete="off" className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm outline-none" />
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" autoComplete="email" className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm outline-none" />
          <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Admin name (optional)" autoComplete="name" className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm outline-none" />
          <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm outline-none" />
          {error ? <p className="text-sm font-semibold text-[#8b1e1e]">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-[#1e5b2d]">{message}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button type="submit" disabled={isSubmitting} className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] disabled:opacity-70">
              {isSubmitting ? "Preparing..." : "Prepare admin"}
            </button>
            <button type="button" onClick={() => router.push("/admin/login")} className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-5 py-3 text-sm font-black uppercase tracking-[0.08em]">
              Admin login
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}