"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionAvailability,
  initialBookings,
  initialSessions,
  karateClasses,
  type BookingRecord,
} from "@/lib/mock-data";
import { getSupabaseBookings, getSupabaseUserRole, supabase } from "@/lib/supabase";

function LogoMark() {
  return (
    <img
      src="https://www.shorinryubukenkan.com/storage/images/logo.png"
      alt="Shorin-Ryu Bukenkan logo"
      className="h-16 w-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.2)] sm:h-20 sm:w-20"
    />
  );
}

export default function AdminPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBookings);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hydrateAdminAccess = async () => {
      const storedRole = localStorage.getItem("shorinryu-role");

      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const role = (await getSupabaseUserRole()) || session.user.user_metadata?.role;

          if (role === "admin") {
            setIsAdmin(true);
            const nextBookings = await getSupabaseBookings();
            if (nextBookings.length > 0) {
              setBookings(nextBookings);
            }
            return;
          }
        }
      }

      setIsAdmin(storedRole === "admin");
    };

    void hydrateAdminAccess();
  }, []);

  const totalCapacity = initialSessions.reduce((sum, session) => sum + session.capacity, 0);
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;
  const openSeats = initialSessions.reduce(
    (sum, session) => sum + getSessionAvailability(session, bookings).open,
    0,
  );

  const sessionsByClass = useMemo(() => {
    return karateClasses.map((klass) => ({
      classInfo: klass,
      sessions: initialSessions.filter((session) => session.classId === klass.id),
    }));
  }, []);

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
        <div className="w-full max-w-lg rounded-[28px] border-[6px] border-[#c7a531] bg-[#f7f2e8] p-8 text-center shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Restricted access</p>
          <h1 className="mt-4 text-3xl font-black uppercase text-[#111111]">Admin only</h1>
          <p className="mt-4 text-base text-[#444444]">
            This dashboard is restricted to authorized staff. Use the parent view or enter the admin code to continue.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
            >
              Parent view
            </button>
          </div>
        </div>
      </main>
    );
  }

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
                    Admin Dashboard
                  </h1>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6d510c] sm:text-sm">
                    Scheduling & Planning
                  </p>
                </div>
                <LogoMark />
              </div>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={async () => {
                    if (supabase) {
                      await supabase.auth.signOut();
                    }

                    localStorage.removeItem("shorinryu-role");
                    router.push("/");
                  }}
                  className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#171717]"
                >
                  Log out
                </button>
              </div>
            </header>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="mb-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a4309]">Total capacity</p>
                  <p className="mt-3 text-3xl font-black text-[#111111]">{totalCapacity}</p>
                </div>
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a4309]">Confirmed</p>
                  <p className="mt-3 text-3xl font-black text-[#111111]">{confirmedCount}</p>
                </div>
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a4309]">Cancelled</p>
                  <p className="mt-3 text-3xl font-black text-[#111111]">{cancelledCount}</p>
                </div>
                <div className="rounded-2xl border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a4309]">Open seats</p>
                  <p className="mt-3 text-3xl font-black text-[#111111]">{openSeats}</p>
                </div>
              </div>

              <div className="mb-8 overflow-hidden rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#f5f0e5] text-[#5a4309]">
                      <tr>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Class</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Day</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Time</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Capacity</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Confirmed</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Cancelled</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Open</th>
                        <th className="px-4 py-3 font-black uppercase tracking-[0.12em]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialSessions.map((session) => {
                        const classInfo = karateClasses.find((klass) => klass.id === session.classId)!;
                        const availability = getSessionAvailability(session, bookings);
                        const confirmedCountPerSession = bookings.filter(
                          (booking) => booking.sessionId === session.id && booking.status === "confirmed",
                        ).length;
                        const cancelledCountPerSession = bookings.filter(
                          (booking) => booking.sessionId === session.id && booking.status === "cancelled",
                        ).length;
                        const status = availability.isFull ? "Closed" : "Open";

                        return (
                          <tr key={session.id} className="border-t border-[#eadcb0]">
                            <td className="px-4 py-3 font-bold text-[#111111]">{classInfo.name}</td>
                            <td className="px-4 py-3 text-[#2f2f2f]">
                              {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3 text-[#2f2f2f]">
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
                            </td>
                            <td className="px-4 py-3 text-[#2f2f2f]">{session.capacity}</td>
                            <td className="px-4 py-3 text-[#2f2f2f]">{confirmedCountPerSession}</td>
                            <td className="px-4 py-3 text-[#2f2f2f]">{cancelledCountPerSession}</td>
                            <td className="px-4 py-3 text-[#2f2f2f]">{availability.open}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                                  availability.isFull
                                    ? "border-[#bf4d4d] bg-[#f6d9d9] text-[#7d1f1f]"
                                    : "border-[#4aa55d] bg-[#e4f5e3] text-[#1e5b2d]"
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                <h4 className="mb-3 text-xl font-black uppercase text-[#111111]">Recent bookings</h4>
                <div className="space-y-3">
                  {bookings.map((booking) => {
                    const matchingSession = initialSessions.find((session) => session.id === booking.sessionId);
                    const matchingClass = matchingSession ? karateClasses.find((klass) => klass.id === matchingSession.classId) : null;

                    return (
                      <div key={booking.id} className="flex flex-col gap-2 rounded-xl border border-[#eadcb0] bg-[#f9f4ea] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#5a4309]">
                            {matchingClass?.name ?? "Class"}
                          </p>
                          <p className="mt-1 text-sm text-[#2f2f2f]">
                            {booking.childName} • {booking.parentName}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5a4309]">
                            {booking.status}
                          </p>
                          <p className="text-xs text-[#4a4a4a]">
                            {matchingSession
                              ? new Date(`${matchingSession.date}T00:00:00`).toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
