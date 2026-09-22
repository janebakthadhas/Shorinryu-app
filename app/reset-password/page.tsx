"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(supabase ? "" : "Password recovery is not available.");

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setIsReady(true);
      }
    });

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryError = hashParams.get("error_description");
    if (recoveryError) {
      setError(recoveryError.replace(/\+/g, " "));
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsReady(true);
      } else {
        setError("This recovery link is invalid or has expired. Request a new one.");
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    if (!supabase) {
      setError("Password recovery is not available.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    setPassword("");
    setConfirmPassword("");
    setMessage("Your password has been updated. You can now sign in.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
      <div className="w-full max-w-lg rounded-[30px] border-[6px] border-[#c7a531] bg-[#f7f2e8] p-8 shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Account security</p>
          <h1 className="mt-4 text-3xl font-black uppercase text-[#111111]">Set a new password</h1>
          <p className="mt-3 text-sm text-[#444444]">Choose a new password for your account.</p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              disabled={!isReady || isSubmitting}
              className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none placeholder:text-[#7c7c7c]"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={!isReady || isSubmitting}
              className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none placeholder:text-[#7c7c7c]"
              placeholder="Enter the password again"
            />
          </div>

          {error ? <p className="text-sm font-semibold text-[#8b1e1e]">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-[#1e5b2d]">{message}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="submit"
              disabled={!isReady || isSubmitting || Boolean(message)}
              className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
            >
              Admin login
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
