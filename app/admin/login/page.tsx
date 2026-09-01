"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminEmail, adminPassword, supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState(adminPassword);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Enter your admin email and password.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (supabase) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (signInError) {
          throw signInError;
        }
      }

      if (trimmedEmail !== adminEmail || trimmedPassword !== adminPassword) {
        throw new Error("Invalid admin credentials.");
      }

      localStorage.setItem("shorinryu-role", "admin");
      router.push("/admin");
    } catch (submitError) {
      console.error("Admin login failed:", submitError);
      setError("Invalid admin credentials. Please check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
      <div className="w-full max-w-lg rounded-[30px] border-[6px] border-[#c7a531] bg-[#f7f2e8] p-8 shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Secure admin access</p>
          <h1 className="mt-4 text-3xl font-black uppercase text-[#111111]">Admin login</h1>
          <p className="mt-3 text-sm text-[#444444]">
            This route is intentionally not linked from the public page.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
              Admin email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@youracademy.com"
              className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter admin password"
              className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
            />
          </div>

          {error ? <p className="text-sm font-semibold text-[#8b1e1e]">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Open admin"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
            >
              Public view
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
