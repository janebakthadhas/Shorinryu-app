"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildMonthlySessions,
  getSessionAvailability,
  initialBookings,
  initialSessions,
  karateClasses,
  type BookingRecord,
  type SessionRecord,
} from "@/lib/mock-data";
import {
  cancelSupabaseBooking,
  createSupabaseBooking,
  getSupabaseBookingsForParent,
  supabase,
} from "@/lib/supabase";

const PARENT_ACCOUNTS = [
  {
    email: "maya@example.com",
    password: "parent123",
    name: "Maya Lee",
  },
  {
    email: "daniel@example.com",
    password: "parent123",
    name: "Daniel Price",
  },
  {
    email: "priya@example.com",
    password: "parent123",
    name: "Priya Shah",
  },
];

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

type PendingAction = {
  type: "book" | "cancel";
  sessionId: string;
  sessionLabel: string;
};

export default function ParentDashboardPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBookings);
  const [currentParent, setCurrentParent] = useState<{ name: string; email: string } | null>(null);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hydrateParentSession = async () => {
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const nextParent = {
            name: session.user.user_metadata?.full_name || session.user.email?.split("@")?.[0] || "Parent",
            email: session.user.email || "",
          };

          setCurrentParent(nextParent);
          localStorage.setItem("shorinryu-parent", JSON.stringify(nextParent));
          localStorage.setItem("shorinryu-role", "parent");
          return;
        }
      }

      const storedUser = localStorage.getItem("shorinryu-parent");
      if (!storedUser) {
        router.push("/");
        return;
      }

      try {
        setCurrentParent(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("shorinryu-parent");
        router.push("/");
      }
    };

    void hydrateParentSession();
  }, [router]);

  useEffect(() => {
    const syncBookings = async () => {
      if (!currentParent?.email) {
        setBookings(initialBookings);
        return;
      }

      if (supabase) {
        const nextBookings = await getSupabaseBookingsForParent(currentParent.email);
        if (nextBookings.length > 0) {
          setBookings(nextBookings);
          return;
        }
      }

      setBookings(initialBookings);
    };

    void syncBookings();
  }, [currentParent?.email]);

  const currentParentName = currentParent?.name ?? "Maya Lee";

  const handleBook = (sessionId: string) => {
    const session = [...initialSessions, ...buildMonthlySessions()].find((item) => item.id === sessionId);
    if (!session) {
      return;
    }

    const classInfo = karateClasses.find((item) => item.id === session.classId);
    const sessionLabel = `${classInfo?.name ?? "Class"} · ${new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })} · ${new Date(`2000-01-01T${session.startTime}:00`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;

    setPendingAction({ type: "book", sessionId, sessionLabel });
  };

  const handleCancel = (sessionId: string) => {
    const session = [...initialSessions, ...buildMonthlySessions()].find((item) => item.id === sessionId);
    if (!session) {
      return;
    }

    const classInfo = karateClasses.find((item) => item.id === session.classId);
    const sessionLabel = `${classInfo?.name ?? "Class"} · ${new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    })} · ${new Date(`2000-01-01T${session.startTime}:00`).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;

    setPendingAction({ type: "cancel", sessionId, sessionLabel });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    const parentEmail = currentParent?.email ?? "maya@example.com";

    if (pendingAction.type === "book") {
      if (supabase) {
        const result = await createSupabaseBooking({
          sessionId: pendingAction.sessionId,
          parentName: currentParentName,
          parentEmail,
          parentPhone: undefined,
          childName: "Ava Lee",
        });

        if (!result.ok) {
          setPendingAction(null);
          return;
        }
      }

      setBookings((current) => {
        if (
          current.some(
            (booking) =>
              booking.sessionId === pendingAction.sessionId &&
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
            sessionId: pendingAction.sessionId,
            parentName: currentParentName,
            parentEmail,
            parentPhone: "(555) 212-0011",
            childName: "Ava Lee",
            status: "confirmed",
          },
        ];
      });
    }

    if (pendingAction.type === "cancel") {
      const bookingToCancel = bookings.find(
        (booking) =>
          booking.sessionId === pendingAction.sessionId &&
          booking.parentName === currentParentName &&
          booking.status === "confirmed",
      );

      if (supabase && bookingToCancel) {
        const result = await cancelSupabaseBooking(bookingToCancel.id);
        if (!result.ok) {
          setPendingAction(null);
          return;
        }
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.sessionId === pendingAction.sessionId &&
          booking.parentName === currentParentName &&
          booking.status === "confirmed"
            ? { ...booking, status: "cancelled" }
            : booking,
        ),
      );
    }

    setPendingAction(null);
  };

  const visibleSessions = useMemo(() => {
    return viewMode === "monthly" ? buildMonthlySessions() : initialSessions;
  }, [viewMode]);

  const sessionsByClass = useMemo(() => {
    return karateClasses.map((klass) => ({
      classInfo: klass,
      sessions: visibleSessions.filter((session) => session.classId === klass.id),
    }));
  }, [visibleSessions]);

  const monthCells = useMemo(() => {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const gridStart = new Date(currentMonthStart);
    gridStart.setDate(1 - currentMonthStart.getDay());
    const monthCellsArray: Array<{
      key: string;
      date: Date;
      sessions: SessionRecord[];
    }> = [];

    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const matchingSessions = visibleSessions.filter((session) => session.date === dateKey);

      monthCellsArray.push({
        key: `${dateKey}-${index}`,
        date,
        sessions: matchingSessions,
      });
    }

    return monthCellsArray;
  }, [visibleSessions]);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    localStorage.removeItem("shorinryu-parent");
    localStorage.removeItem("shorinryu-role");
    router.push("/");
  };

  if (!currentParent) {
    return null;
  }

  return (
    <>
      {pendingAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4">
          <div className="w-full max-w-md rounded-[26px] border-4 border-[#c7a531] bg-[#fffdf8] p-6 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#5a4309]">
              {pendingAction.type === "book" ? "Confirm booking" : "Cancel booking"}
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase text-[#111111]">
              {pendingAction.type === "book" ? "Book this session?" : "Cancel this session?"}
            </h3>
            <p className="mt-3 text-sm text-[#3f3f3f]">{pendingAction.sessionLabel}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                {pendingAction.type === "book" ? "Confirm" : "Cancel booking"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-h-screen bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
        <div className="mx-auto max-w-[1200px] overflow-hidden rounded-[30px] border-[6px] border-[#c7a531] bg-[#f7f2e8] shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
        <div className="site-pattern relative p-5 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <header className="mb-8 rounded-[18px] border border-[#c7a531] bg-[#f5f0e5] px-4 py-6 shadow-[0_0_0_3px_rgba(199,165,49,0.2)]">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 sm:gap-6">
                  <LogoMark />
                  <div className="text-center sm:text-left">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#583f09] sm:text-sm">
                      Okinawa Shorin-Ryu
                    </p>
                    <h1 className="mt-2 text-xl font-black uppercase leading-[0.95] text-[#111111] sm:text-2xl lg:text-3xl">
                      Okinawa Shorin-Ryu Karate Do Bukenkan of USA
                    </h1>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6d510c] sm:text-sm">
                      Parent portal
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#171717]"
                >
                  Log out
                </button>
              </div>
            </header>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="mb-5 text-center">
                <p className="text-sm font-black uppercase tracking-[0.26em] text-[#5a4309]">Parent booking</p>
                <div className="mt-4 flex justify-center">
                  <div className="inline-flex rounded-full border-2 border-[#c7a531] bg-[#f5f0e5] p-1">
                    {[
                      { id: "weekly", label: "Weekly view" },
                      { id: "monthly", label: "Monthly view" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setViewMode(tab.id as "weekly" | "monthly")}
                        className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                          viewMode === tab.id
                            ? "bg-[#d9b344] text-[#171717]"
                            : "bg-transparent text-[#5a4309]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="mt-4 text-3xl font-black uppercase text-[#111111] sm:text-4xl">
                  {viewMode === "weekly" ? "Weekly session availability" : "Monthly session availability"}
                </h3>
                <p className="mt-3 text-sm font-medium text-[#3f3f3f]">
                  {viewMode === "weekly"
                    ? "View open slots for the next week and reserve a spot quickly."
                    : "Plan ahead for the upcoming month and choose the best session for your family."}
                </p>
              </div>

              {viewMode === "monthly" ? (
                <div className="overflow-hidden rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8]">
                  <div className="border-b border-[#c7a531] bg-[#f3ead4] px-4 py-3 text-center text-sm font-black uppercase tracking-[0.18em] text-[#5a4309]">
                    {monthLabel}
                  </div>
                  <div className="grid grid-cols-7 border-b border-[#c7a531] bg-[#f5f0e5] text-center text-[10px] font-black uppercase tracking-[0.18em] text-[#5a4309]">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="border-r border-[#c7a531] px-2 py-3 last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {monthCells.map((cell) => {
                      const isCurrentMonth = cell.date.getMonth() === new Date().getMonth();

                      return (
                        <div
                          key={cell.key}
                          className={`min-h-[150px] border-r border-b border-[#e4d7a8] bg-[#fffdf8] p-2 last:border-r-0 ${
                            !isCurrentMonth ? "bg-[#f7f2e8] text-[#7a7a7a]" : "text-[#191919]"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-black">{cell.date.getDate()}</span>
                          </div>

                          <div className="space-y-2">
                            {cell.sessions.map((session) => {
                              const availability = getSessionAvailability(session, bookings);
                              const myBooking = bookings.some(
                                (booking) =>
                                  booking.sessionId === session.id &&
                                  booking.status === "confirmed" &&
                                  booking.parentName === currentParentName,
                              );
                              const classInfo = karateClasses.find((item) => item.id === session.classId);
                              const shortLabel = classInfo?.name ?? "Class";

                              return (
                                <button
                                  key={session.id}
                                  type="button"
                                  onClick={() => (myBooking ? handleCancel(session.id) : handleBook(session.id))}
                                  disabled={availability.isFull && !myBooking}
                                  className={`w-full rounded-lg border px-2 py-1 text-left text-[10px] font-black uppercase tracking-[0.08em] transition ${
                                    myBooking
                                      ? "border-[#4aa55d] bg-[#e4f5e3] text-[#1e5b2d]"
                                      : availability.isFull
                                        ? "border-[#bf4d4d] bg-[#f6d9d9] text-[#7d1f1f]"
                                        : "border-[#c7a531] bg-[#f7f1d7] text-[#5a4309]"
                                  } disabled:cursor-not-allowed disabled:opacity-70`}
                                >
                                  <div className="truncate">{shortLabel}</div>
                                  <div className="mt-0.5 truncate">
                                    {new Date(`2000-01-01T${session.startTime}:00`).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
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
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
