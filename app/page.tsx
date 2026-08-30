"use client";

import { useMemo, useState } from "react";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [parentError, setParentError] = useState("");
  const currentParentName = "Maya Lee";
  const router = useRouter();

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
    setFirstName("");
    setLastName("");
    setParentEmail("");
    setParentPassword("");
    router.push("/parent");
  };

  const handleBook = (sessionId: string) => {
    setBookings((current) => {
      if (
        current.some(
          (booking) =>
            booking.sessionId === sessionId &&
            booking.parentName === currentParentName &&
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
          parentName: currentParentName,
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
        booking.parentName === currentParentName &&
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
            <header className="mb-8 rounded-[18px] border border-[#c7a531] bg-[#f5f0e5] px-4 py-6 text-center shadow-[0_0_0_3px_rgba(199,165,49,0.2)]">
              <div className="mb-4 flex items-center justify-center gap-4 sm:gap-6">
                <LogoMark />
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#583f09] sm:text-sm">
                    Okinawa Shorin-Ryu
                  </p>
                  <h1 className="mt-2 text-2xl font-black uppercase leading-[0.95] text-[#111111] sm:text-5xl">
                    Shorin-Ryu Karate Class Scheduler
                  </h1>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6d510c] sm:text-sm">
                    Thursday • Friday • Saturday
                  </p>
                </div>
                <LogoMark />
              </div>
            </header>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="mb-5 text-center">
                <p className="text-sm font-black uppercase tracking-[0.26em] text-[#5a4309]">Class Scheduler</p>
                <h3 className="mt-2 text-3xl font-black uppercase text-[#111111] sm:text-4xl">
                  Weekly session availability
                </h3>
                <p className="mt-3 text-sm font-medium text-[#3f3f3f]">
                  Parents can view open slots, reserve a spot, and cancel if needed.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {sessionsByClass.map(({ classInfo, sessions }) => (
                  <div key={classInfo.id} className="rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                    <div className="mb-4 border-b border-[#c7a531] pb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5a4309]">
                        {classInfo.ageGroup}
                      </p>
                      <h4 className="mt-2 text-2xl font-black uppercase text-[#111111]">
                        {classInfo.name}
                      </h4>
                      <p className="mt-2 text-sm text-[#434343]">{classInfo.description}</p>
                    </div>

                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <BookingCard
                          key={session.id}
                          session={session}
                          classInfo={classInfo}
                          bookings={bookings}
                          onBook={handleBook}
                          onCancel={handleCancel}
                          currentParentName={currentParentName}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-8 rounded-[26px] border-4 border-[#c7a531] bg-[#f5f0e5] p-5 text-center text-[#111111]">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">
                {showCreateAccount ? "Create account" : "Parent login"}
              </p>

              {showCreateAccount ? (
                <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
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
                      Back to login
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr_1fr_auto]">
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
                      Parent login
                    </button>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateAccount(true);
                        setParentError("");
                      }}
                      className="text-sm font-black uppercase tracking-[0.14em] text-[#5a4309] underline decoration-[#c7a531] underline-offset-4"
                    >
                      Create account
                    </button>
                  </div>
                </>
              )}
              {parentError ? <p className="mt-3 text-sm font-semibold text-[#8b1e1e]">{parentError}</p> : null}
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

            <div className="mt-8 rounded-[26px] border-4 border-[#c7a531] bg-[#f5f0e5] p-5 text-center text-[#111111]">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Ready to start your journey?</p>
              <p className="mt-2 text-3xl font-black uppercase sm:text-5xl">Contact us today</p>
              <p className="mt-4 text-3xl font-black tracking-[0.08em] sm:text-5xl text-[#5a4309]">908-552-9895</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
