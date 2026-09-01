"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionAvailability,
  initialBookings,
  initialSessions,
  karateClasses,
  type BookingRecord,
  type SessionRecord,
} from "@/lib/mock-data";
import { adminEmail, adminPassword, supabase } from "@/lib/supabase";

function LogoMark() {
  return (
    <img
      src="https://www.shorinryubukenkan.com/storage/images/logo.png"
      alt="Shorin-Ryu Bukenkan logo"
      className="h-20 w-20 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.2)] sm:h-24 sm:w-24"
    />
  );
}

function BookingCard({
  session,
  classInfo,
  bookings,
  onBook,
  onCancel,
  currentParentName,
}: {
  session: SessionRecord;
  classInfo: (typeof karateClasses)[number];
  bookings: BookingRecord[];
  onBook: (sessionId: string) => void;
  onCancel: (sessionId: string) => void;
  currentParentName: string;
}) {
  const availability = getSessionAvailability(session, bookings);
  const myBooking = bookings.find(
    (booking) =>
      booking.sessionId === session.id &&
      booking.status === "confirmed" &&
      booking.parentName === currentParentName,
  );
  const statusTone = availability.isFull
    ? "bg-[#f6d9d9] text-[#7d1f1f] border-[#bf4d4d]"
    : "bg-[#e4f5e3] text-[#1e5b2d] border-[#4aa55d]";

  const buttonLabel = myBooking ? "Cancel booking" : availability.isFull ? "Closed" : "Book slot";

  return (
    <div className="rounded-2xl border-2 border-[#d4ae3e] bg-[#f9f4ea] p-4 shadow-[inset_0_0_0_1px_rgba(212,174,62,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5d4408]">
            {classInfo.name}
          </p>
          <h3 className="mt-2 text-xl font-black text-[#111111]">
            {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#272727]">
            {new Date(`2000-01-01T${session.startTime}:00`).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
            –
            {new Date(`2000-01-01T${session.endTime}:00`).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        </div>

        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusTone}`}>
          {availability.isFull ? "Closed" : `${availability.open} open`}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-[#363636]">
          <p className="font-bold">{classInfo.instructor}</p>
          <p>{classInfo.ageGroup}</p>
        </div>

        <button
          type="button"
          className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-[#bbb] disabled:bg-[#d8d8d8] disabled:text-[#666]"
          disabled={availability.isFull && !myBooking}
          onClick={() => (myBooking ? onCancel(session.id) : onBook(session.id))}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_PARENT_ACCOUNTS = [
  { email: "maya@example.com", password: "parent123", name: "Maya Lee" },
  { email: "daniel@example.com", password: "parent123", name: "Daniel Price" },
  { email: "priya@example.com", password: "parent123", name: "Priya Shah" },
];

function getParentAccounts() {
  if (typeof window === "undefined") {
    return DEFAULT_PARENT_ACCOUNTS;
  }

  const stored = localStorage.getItem("shorinryu-parent-accounts");
  if (!stored) {
    localStorage.setItem("shorinryu-parent-accounts", JSON.stringify(DEFAULT_PARENT_ACCOUNTS));
    return DEFAULT_PARENT_ACCOUNTS;
  }

  try {
    return JSON.parse(stored) as Array<{ email: string; password: string; name: string }>;
  } catch {
    localStorage.setItem("shorinryu-parent-accounts", JSON.stringify(DEFAULT_PARENT_ACCOUNTS));
    return DEFAULT_PARENT_ACCOUNTS;
  }
}

export default function Home() {
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBookings);
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showParentLogin, setShowParentLogin] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentError, setParentError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedGuestSession, setSelectedGuestSession] = useState<string>(initialSessions[0]?.id ?? "");
  const [guestFlow, setGuestFlow] = useState<"intro" | "details" | "success">("intro");
  const [guestToken, setGuestToken] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedRole = localStorage.getItem("shorinryu-role");
    if (savedRole === "parent") {
      router.push("/parent");
    }
  }, [router]);

  const handleAdminLogin = async () => {
    if (adminCode.trim() !== "admin123") {
      setAdminError("Invalid admin access code.");
      return;
    }

    if (supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword,
        });

        if (error) {
          throw error;
        }

        localStorage.setItem("shorinryu-role", "admin");
        setAdminError("");
        router.push("/admin");
        return;
      } catch (error) {
        console.error("Admin sign-in failed:", error);
      }
    }

    localStorage.setItem("shorinryu-role", "admin");
    setAdminError("");
    router.push("/admin");
  };

  const handleParentLogin = async () => {
    const trimmedEmail = parentEmail.trim();
    const trimmedPassword = parentPassword.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setParentError("Please enter your email and password.");
      return;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (error) {
          throw error;
        }

        const parentName =
          data.user.user_metadata?.full_name ||
          data.user.email?.split("@")?.[0] ||
          "Parent";

        localStorage.setItem(
          "shorinryu-parent",
          JSON.stringify({
            name: parentName,
            email: trimmedEmail,
          }),
        );
        localStorage.setItem("shorinryu-role", "parent");
        setParentError("");
        router.push("/parent");
        return;
      } catch (error) {
        console.error("Parent sign-in failed:", error);
      }
    }

    const parentAccount = getParentAccounts().find(
      (account) =>
        account.email.toLowerCase() === trimmedEmail.toLowerCase() &&
        account.password === trimmedPassword,
    );

    if (!parentAccount) {
      setParentError("Invalid parent email or password.");
      return;
    }

    localStorage.setItem(
      "shorinryu-parent",
      JSON.stringify({
        name: parentAccount.name,
        email: parentAccount.email,
      }),
    );
    localStorage.setItem("shorinryu-role", "parent");
    setParentError("");
    router.push("/parent");
  };

  const handleCreateAccount = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = parentEmail.trim();
    const trimmedPassword = parentPassword.trim();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail || !trimmedPassword) {
      setParentError("Please complete all fields to create your account.");
      return;
    }

    if (supabase) {
      const fullName = `${trimmedFirst} ${trimmedLast}`;

      try {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword,
          options: {
            data: {
              full_name: fullName,
              role: "parent",
            },
          },
        });

        if (error) {
          throw error;
        }

        const userName = data.user?.user_metadata?.full_name || fullName;

        localStorage.setItem(
          "shorinryu-parent",
          JSON.stringify({
            name: userName,
            email: trimmedEmail,
          }),
        );
        localStorage.setItem("shorinryu-role", "parent");
        setParentError("");
        setShowCreateAccount(false);
        setShowParentLogin(false);
        setFirstName("");
        setLastName("");
        setParentEmail("");
        setParentPassword("");
        router.push("/parent");
        return;
      } catch (error) {
        console.error("Parent account creation failed:", error);
      }
    }

    const accounts = getParentAccounts();
    const alreadyExists = accounts.some(
      (account) => account.email.toLowerCase() === trimmedEmail.toLowerCase(),
    );

    if (alreadyExists) {
      setParentError("An account already exists with this email.");
      return;
    }

    const newAccount = {
      email: trimmedEmail,
      password: trimmedPassword,
      name: `${trimmedFirst} ${trimmedLast}`,
    };

    const updatedAccounts = [...accounts, newAccount];
    localStorage.setItem("shorinryu-parent-accounts", JSON.stringify(updatedAccounts));
    localStorage.setItem(
      "shorinryu-parent",
      JSON.stringify({
        name: newAccount.name,
        email: newAccount.email,
      }),
    );
    localStorage.setItem("shorinryu-role", "parent");

    setParentError("");
    setShowCreateAccount(false);
    setShowParentLogin(false);
    setFirstName("");
    setLastName("");
    setParentEmail("");
    setParentPassword("");
    router.push("/parent");
  };

  const handleGuestBooking = () => {
    const trimmedName = guestName.trim();
    const trimmedEmail = guestEmail.trim();
    const selectedSession = initialSessions.find((session) => session.id === selectedGuestSession);

    if (!trimmedName || !trimmedEmail || !selectedSession) {
      setParentError("Please fill in your name, email, and choose a class.");
      return;
    }

    const token = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const guestBooking = {
      id: token,
      sessionId: selectedSession.id,
      guestName: trimmedName,
      guestEmail: trimmedEmail,
      childName: "Guest attendee",
      status: "confirmed",
      token,
    };

    const existingGuestBookings = JSON.parse(localStorage.getItem("shorinryu-guest-bookings") ?? "[]") as Array<
      typeof guestBooking
    >;
    localStorage.setItem(
      "shorinryu-guest-bookings",
      JSON.stringify([...existingGuestBookings, guestBooking]),
    );
    setGuestToken(token);
    setGuestFlow("success");
    setParentError("");
  };

  const handleBook = (sessionId: string) => {
    setBookings((current) => {
      if (
        current.some(
          (booking) =>
            booking.sessionId === sessionId &&
            booking.parentName === "Maya Lee" &&
            booking.status === "confirmed",
        )
      ) {
        return current;
      }

      const newId = `booking-${Date.now()}`;
      return [
        ...current,
        {
          id: newId,
          sessionId,
          parentName: "Maya Lee",
          parentEmail: "maya@example.com",
          parentPhone: "(555) 212-0011",
          childName: "Ava Lee",
          status: "confirmed",
        },
      ];
    });
  };

  const handleCancel = (sessionId: string) => {
    setBookings((current) =>
      current.map((booking) =>
        booking.sessionId === sessionId &&
        booking.parentName === "Maya Lee" &&
        booking.status === "confirmed"
          ? { ...booking, status: "cancelled" }
          : booking,
      ),
    );
  };

  const sessionsByClass = useMemo(() => {
    return karateClasses.map((klass) => ({
      classInfo: klass,
      sessions: initialSessions.filter((session) => session.classId === klass.id),
    }));
  }, []);

  return (
    <main className="min-h-screen bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
      <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[30px] border-[6px] border-[#c7a531] bg-[#f7f2e8] shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
        <div className="site-pattern relative p-5 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <header className="mb-8 rounded-[18px] border border-[#c7a531] bg-[#f5f0e5] px-4 py-6 shadow-[0_0_0_3px_rgba(199,165,49,0.2)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-center gap-4 sm:justify-start">
                  <LogoMark />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#583f09] sm:text-sm">
                      Okinawa Shorin-Ryu
                    </p>
                    <h1 className="mt-2 text-xl font-black uppercase text-[#111111] sm:text-2xl">
                      Shorin-Ryu Karate
                    </h1>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowParentLogin(true);
                    setShowCreateAccount(false);
                    setParentError("");
                  }}
                  className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#171717] transition hover:brightness-110"
                >
                  Parent login
                </button>
              </div>
            </header>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Shorin-Ryu Do Karate Bukenkan</p>
                  <h2 className="mt-4 text-4xl font-black uppercase leading-tight text-[#111111] sm:text-5xl">
                    Classes for families, beginners, and first-time guests.
                  </h2>
                  <p className="mt-4 max-w-xl text-base text-[#323232]">
                    Weekly karate classes in St. Johns County for kids, teens, and adults. Explore the schedule, create a parent account, or book a single guest trial session.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateAccount(true);
                        setShowParentLogin(false);
                        setParentError("");
                      }}
                      className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestFlow("details")}
                      className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                    >
                      Book as guest
                    </button>
                  </div>
                </div>

                <div className="rounded-[24px] border-2 border-[#c7a531] bg-[#fffdf8] p-5 shadow-[0_0_0_3px_rgba(199,165,49,0.18)]">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#5a4309]">Quick access</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-[#d9bb5c] bg-[#f6f0e5] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4309]">Next class</p>
                      <p className="mt-2 text-lg font-black text-[#111111]">Little Dragons</p>
                      <p className="text-sm text-[#444444]">Thursday · 5:30 PM</p>
                    </div>
                    <div className="rounded-2xl border border-[#d9bb5c] bg-[#f6f0e5] p-3">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5a4309]">Location</p>
                      <p className="mt-2 text-lg font-black text-[#111111]">St. Johns County</p>
                      <p className="text-sm text-[#444444]">Community training space</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#f5f0e5] p-5 text-[#111111]">
              <div className="mb-5 text-center">
                <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Returning parent</p>
                <h3 className="mt-2 text-3xl font-black uppercase text-[#111111]">Signed in already?</h3>
              </div>

              {showParentLogin ? (
                <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr_auto]">
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(event) => setParentEmail(event.target.value)}
                    placeholder="Parent email"
                    className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                  />
                  <input
                    type="password"
                    value={parentPassword}
                    onChange={(event) => setParentPassword(event.target.value)}
                    placeholder="Password"
                    className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                  />
                  <button
                    type="button"
                    onClick={handleParentLogin}
                    className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                  >
                    Login
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-[#444444]">
                  Returning families can sign in here to view upcoming bookings and manage recurring classes.
                </p>
              )}

              {showCreateAccount ? (
                <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
                  <input
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                  />
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(event) => setParentEmail(event.target.value)}
                    placeholder="Parent email"
                    className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c] sm:col-span-2"
                  />
                  <input
                    type="password"
                    value={parentPassword}
                    onChange={(event) => setParentPassword(event.target.value)}
                    placeholder="Create password"
                    className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c] sm:col-span-2"
                  />
                  <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                      type="button"
                      onClick={handleCreateAccount}
                      className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                    >
                      Create account
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateAccount(false)}
                      className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {parentError ? <p className="mt-3 text-sm font-semibold text-[#8b1e1e]">{parentError}</p> : null}
            </section>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="mb-5 text-center">
                <p className="text-sm font-black uppercase tracking-[0.26em] text-[#5a4309]">Public schedule</p>
                <h3 className="mt-2 text-3xl font-black uppercase text-[#111111] sm:text-4xl">Upcoming classes</h3>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sessionsByClass.map(({ classInfo, sessions }) => (
                  <div key={classInfo.id} className="rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                    <div className="mb-4 border-b border-[#c7a531] pb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5a4309]">
                        {classInfo.ageGroup}
                      </p>
                      <h4 className="mt-2 text-2xl font-black uppercase text-[#111111]">{classInfo.name}</h4>
                    </div>

                    <div className="space-y-3">
                      {sessions.map((session) => {
                        const availability = getSessionAvailability(session, bookings);
                        return (
                          <div key={session.id} className="rounded-2xl border border-[#d9bb5c] bg-[#f7f2ea] p-3">
                            <p className="text-sm font-black text-[#111111]">
                              {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="mt-1 text-sm text-[#323232]">
                              {new Date(`2000-01-01T${session.startTime}:00`).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                              –
                              {new Date(`2000-01-01T${session.endTime}:00`).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </p>
                            <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                              {availability.isFull ? "Closed" : `${availability.open} spots open`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {guestFlow !== "intro" ? (
              <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#f5f0e5] p-5 text-[#111111]">
                {guestFlow === "details" ? (
                  <>
                    <div className="mb-4 text-center">
                      <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Book as guest</p>
                      <h3 className="mt-2 text-3xl font-black uppercase text-[#111111]">One-time trial booking</h3>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <input
                        type="text"
                        value={guestName}
                        onChange={(event) => setGuestName(event.target.value)}
                        placeholder="Guest name"
                        className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                      />
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(event) => setGuestEmail(event.target.value)}
                        placeholder="Email address"
                        className="rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                        Select class
                      </label>
                      <select
                        value={selectedGuestSession}
                        onChange={(event) => setSelectedGuestSession(event.target.value)}
                        className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0"
                      >
                        {initialSessions.map((session) => {
                          const classInfo = karateClasses.find((klass) => klass.id === session.classId);
                          return (
                            <option key={session.id} value={session.id}>
                              {classInfo?.name} · {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <button
                        type="button"
                        onClick={handleGuestBooking}
                        className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                      >
                        Confirm guest booking
                      </button>
                      <button
                        type="button"
                        onClick={() => setGuestFlow("intro")}
                        className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                      >
                        Back
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Booking confirmed</p>
                    <h3 className="mt-3 text-3xl font-black uppercase text-[#111111]">You’re on the list.</h3>
                    <p className="mt-3 text-base text-[#323232]">
                      A magic-link confirmation would be sent to <span className="font-bold">{guestEmail}</span> with a secure way to view or cancel this single booking.
                    </p>
                    <p className="mt-4 text-sm font-semibold text-[#3b3b3b]">
                      Booking token: <span className="font-black text-[#171717]">{guestToken}</span>
                    </p>
                    <div className="mt-5 rounded-2xl border border-[#d9bb5c] bg-[#fffdf8] p-4 text-left text-sm text-[#323232]">
                      Want a faster path for future bookings? Create an account to manage your child profile, recurring sessions, and booking history.
                    </div>
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setGuestFlow("intro");
                          setGuestName("");
                          setGuestEmail("");
                          setGuestToken("");
                        }}
                        className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                      >
                        Book another guest slot
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            <div className="mt-8 rounded-[26px] border-4 border-[#c7a531] bg-[#f5f0e5] p-5 text-center text-[#111111]">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">About the academy</p>
              <div className="mt-4 grid gap-3 text-left md:grid-cols-3">
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Location</p>
                  <p className="mt-2 text-base font-bold">St. Johns County</p>
                  <p className="mt-2 text-sm text-[#4d4d4d]">Community training space and family-friendly karate classes.</p>
                </div>
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Who it’s for</p>
                  <p className="mt-2 text-base font-bold">Kids, teens, and adults</p>
                  <p className="mt-2 text-sm text-[#4d4d4d]">Beginner-friendly instruction and structured belt progression.</p>
                </div>
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Contact</p>
                  <p className="mt-2 text-base font-bold">908-552-9895</p>
                  <p className="mt-2 text-sm text-[#4d4d4d]">Questions about schedule, class fit, or trial classes.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[26px] border-4 border-[#c7a531] bg-[#f5f0e5] p-5 text-center text-[#111111]">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Admin access</p>
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                <input
                  type="password"
                  value={adminCode}
                  onChange={(event) => setAdminCode(event.target.value)}
                  placeholder="Enter admin code"
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c] sm:max-w-xs"
                />
                <button
                  type="button"
                  onClick={handleAdminLogin}
                  className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
                >
                  Open admin
                </button>
              </div>
              {adminError ? <p className="mt-3 text-sm font-semibold text-[#8b1e1e]">{adminError}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
