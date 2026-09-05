"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildMonthlySessions,
  formatSessionLabel,
  getSessionAvailability,
  getSessionDisplayName,
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
  updateSupabaseBooking,
} from "@/lib/supabase";

const PARENT_REGISTRY_KEY = "shorinryu-parent-registry";

type ParentChildRecord = {
  name: string;
  age?: string;
  belt?: string;
  className?: string;
  classTime?: string;
};

type ParentRegistryEntry = {
  email: string;
  name: string;
  password: string;
  children: ParentChildRecord[];
};

function getParentRegistry(): ParentRegistryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(PARENT_REGISTRY_KEY);
    if (!stored) {
      localStorage.setItem(PARENT_REGISTRY_KEY, JSON.stringify([]));
      return [];
    }

    const parsed = JSON.parse(stored) as ParentRegistryEntry[];
    const realEntries = Array.isArray(parsed)
      ? parsed.filter((entry) => !entry.email.endsWith("@example.com") && entry.email !== "parent@demo.com")
      : [];
    localStorage.setItem(PARENT_REGISTRY_KEY, JSON.stringify(realEntries));
    return realEntries;
  } catch {
    localStorage.removeItem(PARENT_REGISTRY_KEY);
    return [];
  }
}

function saveParentRegistry(entries: ParentRegistryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(PARENT_REGISTRY_KEY, JSON.stringify(entries));
}

function getParentChildrenForEmail(email: string) {
  const registry = getParentRegistry();
  const entry = registry.find((parent) => parent.email.toLowerCase() === email.toLowerCase());
  return entry?.children ?? [];
}

function upsertParentRegistryEntry(parent: { email: string; name: string; password: string; children?: ParentChildRecord[] }) {
  const registry = getParentRegistry();
  const nextEntry: ParentRegistryEntry = {
    email: parent.email,
    name: parent.name,
    password: parent.password,
    children: parent.children?.length ? parent.children : getParentChildrenForEmail(parent.email),
  };

  const existingIndex = registry.findIndex(
    (entry) => entry.email.toLowerCase() === parent.email.toLowerCase(),
  );

  if (existingIndex >= 0) {
    registry.splice(existingIndex, 1, nextEntry);
  } else {
    registry.push(nextEntry);
  }

  saveParentRegistry(registry);
}

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
  guestBookings = [],
  onBook,
  onCancel,
  currentParentName,
}: {
  session: SessionRecord;
  classInfo: (typeof karateClasses)[number];
  bookings: BookingRecord[];
  guestBookings?: Array<{ sessionId: string; status?: string }>;
  onBook: (sessionId: string) => void;
  onCancel: (sessionId: string) => void;
  currentParentName: string;
}) {
  const availability = getSessionAvailability(session, bookings, guestBookings);
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
            {getSessionDisplayName(session, classInfo.name)}
          </p>
          <h3 className="mt-2 text-xl font-black text-[#111111]" suppressHydrationWarning>
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

type BookingDraft = {
  id?: string;
  sessionId: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  status: "confirmed" | "cancelled";
};

const BOOKINGS_STORAGE_KEY = "shorinryu-admin-bookings";

export default function ParentDashboardPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBookings);
  const [guestBookings, setGuestBookings] = useState<Array<{ sessionId: string; status?: string }>>([]);
  const [currentParent, setCurrentParent] = useState<{ name: string; email: string } | null>(null);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [bookingEditor, setBookingEditor] = useState<{
    mode: "create" | "edit";
    draft: BookingDraft;
  } | null>(null);
  const [cancelSelection, setCancelSelection] = useState<{
    sessionId: string;
    options: BookingRecord[];
  } | null>(null);
  const [bookingError, setBookingError] = useState("");
  const [childNameDraft, setChildNameDraft] = useState("");
  const [childAgeDraft, setChildAgeDraft] = useState("");
  const [children, setChildren] = useState<ParentChildRecord[]>([]);
  const router = useRouter();

  useEffect(() => {
    const hydrateParentSession = async () => {
      const storedUser = localStorage.getItem("shorinryu-parent");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as { name?: string; email?: string };
          if (parsedUser.email) {
            const parentObj = {
              name: parsedUser.name || "Parent",
              email: parsedUser.email,
            };
            setCurrentParent(parentObj);
            setChildren(getParentChildrenForEmail(parentObj.email));
            localStorage.setItem("shorinryu-role", "parent");
            return;
          }
        } catch {
          localStorage.removeItem("shorinryu-parent");
        }
      }

      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const metadataRole = session.user.user_metadata?.role;
          if (metadataRole === "parent") {
            const nextParent = {
              name: session.user.user_metadata?.full_name || session.user.email?.split("@")?.[0] || "Parent",
              email: session.user.email || "",
            };

            setCurrentParent(nextParent);
            setChildren(getParentChildrenForEmail(nextParent.email));
            localStorage.setItem("shorinryu-parent", JSON.stringify(nextParent));
            localStorage.setItem("shorinryu-role", "parent");
            return;
          }
        }
      }

      router.push("/");
    };

    void hydrateParentSession();
  }, [router]);

  useEffect(() => {
    const syncBookings = async () => {
      if (!currentParent?.email) {
        setBookings(initialBookings);
        return;
      }

      try {
        const storedBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
        if (storedBookings) {
          const parsedBookings = JSON.parse(storedBookings) as BookingRecord[];
          const realBookings = Array.isArray(parsedBookings)
            ? parsedBookings.filter((booking) => !booking.id.match(/^booking-[1-6]$/) && !booking.parentEmail.endsWith("@example.com"))
            : [];
          if (realBookings.length > 0) {
            setBookings(realBookings);
            localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(realBookings));
            return;
          }
        }
      } catch {
        localStorage.removeItem(BOOKINGS_STORAGE_KEY);
      }

      if (supabase) {
        try {
          const nextBookings = await getSupabaseBookingsForParent(currentParent.email);
          if (nextBookings.length > 0) {
            setBookings(nextBookings);
            localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextBookings));
            return;
          }
        } catch {
          // fall back to local state when Supabase data is unavailable
        }
      }

      setBookings(initialBookings);
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(initialBookings));
    };

    const loadGuestBookings = () => {
      try {
        const storedGuests = localStorage.getItem("shorinryu-guest-bookings");
        if (storedGuests) {
          const parsed = JSON.parse(storedGuests);
          if (Array.isArray(parsed)) setGuestBookings(parsed);
        }
      } catch {}
    };

    void syncBookings();
    loadGuestBookings();
  }, [currentParent?.email]);

  const currentParentName = currentParent?.name ?? "Parent";
  const allSessions = useMemo(() => [...initialSessions, ...buildMonthlySessions()], []);
  const allowedBookingDates = useMemo(
    () =>
      [...new Set(
        allSessions
          .filter((session) => {
            const day = new Date(`${session.date}T00:00:00`).getDay();
            return day !== 0 && day !== 1 && day !== 2 && day !== 3;
          })
          .map((session) => session.date),
      )].sort(),
    [allSessions],
  );
  const myBookings = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          booking.parentEmail === (currentParent?.email ?? "maya@example.com") ||
          booking.parentName === currentParentName,
      ),
    [bookings, currentParent?.email, currentParentName],
  );
  const isDuplicateBooking = Boolean(
    bookingEditor &&
      bookingEditor.draft.status === "confirmed" &&
      bookingEditor.draft.childName.trim() &&
      bookings.some(
        (booking) =>
          booking.id !== bookingEditor.draft.id &&
          booking.sessionId === bookingEditor.draft.sessionId &&
          booking.childName.trim().toLowerCase() === bookingEditor.draft.childName.trim().toLowerCase() &&
          booking.status === "confirmed",
      ),
  );

  const familyChildren = useMemo(() => {
    const namesFromChildren = children.map((c) => c.name.trim()).filter(Boolean);
    const namesFromBookings = bookings
      .filter(
        (b) =>
          b.parentName === currentParentName ||
          (currentParent?.email && b.parentEmail.toLowerCase() === currentParent.email.toLowerCase()),
      )
      .map((b) => b.childName.trim())
      .filter(Boolean);

    return [...new Set([...namesFromChildren, ...namesFromBookings])];
  }, [children, bookings, currentParentName, currentParent]);

  const openCreateBooking = (sessionId?: string) => {
    setBookingError("");
    const defaultDate = allowedBookingDates[0] ?? "";
    const defaultSession = sessionId
      ? allSessions.find((session) => session.id === sessionId) ?? allSessions.find((session) => session.date === defaultDate)
      : allSessions.find((session) => session.date === defaultDate) ?? allSessions[0];

    setBookingEditor({
      mode: "create",
      draft: {
        sessionId: defaultSession?.id ?? "",
        parentName: currentParentName,
        parentEmail: currentParent?.email ?? "maya@example.com",
        parentPhone: "",
        childName: familyChildren[0] ?? "",
        status: "confirmed",
      },
    });
  };

  const openEditBooking = (booking: BookingRecord) => {
    setBookingError("");
    setBookingEditor({
      mode: "edit",
      draft: {
        id: booking.id,
        sessionId: booking.sessionId,
        parentName: booking.parentName,
        parentEmail: booking.parentEmail,
        parentPhone: booking.parentPhone ?? "",
        childName: booking.childName,
        status: booking.status,
      },
    });
  };

  const saveBookingChanges = async () => {
    if (!bookingEditor) {
      return;
    }

    const draft = bookingEditor.draft;
    const nextParentName = draft.parentName.trim();
    const nextEmail = draft.parentEmail.trim() || currentParent?.email || "maya@example.com";
    const nextChildName = draft.childName.trim();

    if (!draft.sessionId || !nextParentName || !nextChildName) {
      return;
    }

    const duplicateBooking = bookings.some(
      (booking) =>
        booking.id !== draft.id &&
        booking.sessionId === draft.sessionId &&
        booking.childName.trim().toLowerCase() === nextChildName.toLowerCase() &&
        booking.status === "confirmed",
    );

    if (duplicateBooking) {
      setBookingError("This student is already booked for the selected session.");
      return;
    }

    let persistedBookingId = draft.id;
    if (supabase) {
      const result = draft.id
        ? await updateSupabaseBooking({ bookingId: draft.id, sessionId: draft.sessionId, childName: nextChildName })
        : await createSupabaseBooking({
            sessionId: draft.sessionId,
            parentName: nextParentName,
            parentEmail: nextEmail,
            parentPhone: draft.parentPhone.trim() || undefined,
            childName: nextChildName,
          });

      if (!result.ok) {
        setBookingError(result.message ?? "Unable to save booking.");
        return;
      }

      persistedBookingId = "bookingId" in result && typeof result.bookingId === "string"
        ? result.bookingId
        : draft.id;
    }

    const nextBooking: BookingRecord = {
      id: persistedBookingId ?? `booking-${Date.now()}`,
      sessionId: draft.sessionId,
      parentName: nextParentName,
      parentEmail: nextEmail,
      parentPhone: draft.parentPhone.trim() || undefined,
      childName: nextChildName,
      status: draft.status === "cancelled" ? "cancelled" : "confirmed",
    };

    setBookings((current) => {
      const filtered = current.filter((booking) => booking.id !== nextBooking.id);
      const nextList = [...filtered, nextBooking];
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextList));
      return nextList;
    });

    setBookingEditor(null);
    setBookingError("");
  };

  const handleBook = (sessionId: string) => {
    openCreateBooking(sessionId);
  };

  const handleCancel = async (sessionId: string) => {
    const matchingBookings = bookings.filter(
      (booking) =>
        booking.sessionId === sessionId &&
        booking.parentName === currentParentName &&
        booking.status === "confirmed",
    );

    if (matchingBookings.length > 1) {
      setCancelSelection({ sessionId, options: matchingBookings });
      return;
    }

    if (matchingBookings.length === 1) {
      const bookingId = matchingBookings[0].id;
      if (supabase) {
        const result = await cancelSupabaseBooking(bookingId);
        if (!result.ok) {
          setBookingError(result.message ?? "Unable to cancel booking.");
          return;
        }
      }
      setBookings((current) => {
        const nextList = current.filter((booking) => booking.id !== bookingId);
        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextList));
        return nextList;
      });
      return;
    }
  };

  const handleEditBooking = (bookingId: string) => {
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking) {
      openEditBooking(booking);
    }
  };

  const handleDeleteBooking = (bookingId: string) => {
    setBookings((current) => {
      const nextList = current.filter((booking) => booking.id !== bookingId);
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextList));
      return nextList;
    });
    setBookingEditor(null);
  };

  const handleAddChild = () => {
    const trimmedChild = childNameDraft.trim();
    const trimmedAge = childAgeDraft.trim();
    if (!trimmedChild || !currentParent?.email) {
      return;
    }

    const registry = getParentRegistry();
    const existingEntry = registry.find(
      (entry) => entry.email.toLowerCase() === currentParent.email.toLowerCase(),
    );

    const nextChildren = existingEntry?.children ?? children;
    const alreadyExists = nextChildren.some((child) => child.name.toLowerCase() === trimmedChild.toLowerCase());

    if (alreadyExists) {
      setChildNameDraft("");
      setChildAgeDraft("");
      return;
    }

    const updatedChildren = [...nextChildren, {
      name: trimmedChild,
      age: trimmedAge || "Not set",
      belt: "White",
      className: "Class 1",
      classTime: "Thursday 5:30 PM - 6:30 PM",
    }];

    upsertParentRegistryEntry({
      email: currentParent.email,
      name: currentParent.name,
      password: "",
      children: updatedChildren,
    });

    setChildren(updatedChildren);
    setChildNameDraft("");
    setChildAgeDraft("");
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
      {cancelSelection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4">
          <div className="w-full max-w-lg rounded-[26px] border-4 border-[#c7a531] bg-[#fffdf8] p-6 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#5a4309]">Cancel booking</p>
            <h3 className="mt-3 text-2xl font-black uppercase text-[#111111]">Which child are you canceling?</h3>
            <div className="mt-5 space-y-3">
              {cancelSelection.options.map((booking) => {
                const session = allSessions.find((item) => item.id === booking.sessionId);
                const classInfo = karateClasses.find((klass) => klass.id === session?.classId);

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => {
                      setBookings((current) => {
                        const nextList = current.filter((item) => item.id !== booking.id);
                        localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextList));
                        return nextList;
                      });
                      setCancelSelection(null);
                    }}
                    className="w-full rounded-2xl border border-[#c7a531] bg-[#f9f4ea] p-4 text-left"
                  >
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-[#5a4309]">
                      {session && classInfo ? getSessionDisplayName(session, classInfo.name) : "Class"}
                    </p>
                    <p className="mt-2 text-lg font-black text-[#111111]">{booking.childName}</p>
                    <p className="mt-1 text-sm text-[#3b3b3b]">
                      {session ? formatSessionLabel(session) : "Session details unavailable"}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCancelSelection(null)}
                className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bookingEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4">
          <div className="w-full max-w-xl rounded-[26px] border-4 border-[#c7a531] bg-[#fffdf8] p-6 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#5a4309]">
              {bookingEditor.mode === "create" ? "New booking" : "Edit booking"}
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase text-[#111111]">
              {bookingEditor.mode === "create" ? "Book a class" : "Update reservation"}
            </h3>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                  Date
                </label>
                <select
                  value={
                    allSessions.find((session) => session.id === bookingEditor.draft.sessionId)?.date ??
                    allowedBookingDates[0] ??
                    ""
                  }
                  onChange={(event) => {
                    setBookingError("");
                    const nextDate = event.target.value;
                    const firstSessionForDate = allSessions
                      .filter((session) => session.date === nextDate)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

                    setBookingEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              sessionId: firstSessionForDate?.id ?? "",
                            },
                          }
                        : current,
                    );
                  }}
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                >
                  {allowedBookingDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                  Session
                </label>
                <select
                  value={bookingEditor.draft.sessionId}
                  onChange={(event) => {
                    setBookingError("");
                    setBookingEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, sessionId: event.target.value } }
                        : current,
                    );
                  }}
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                >
                  {allSessions
                    .filter(
                      (session) =>
                        session.date ===
                        (allSessions.find((item) => item.id === bookingEditor.draft.sessionId)?.date ?? allowedBookingDates[0] ?? ""),
                    )
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((session) => {
                      const classInfo = karateClasses.find((item) => item.id === session.classId);
                      return (
                        <option
                          key={session.id}
                          value={session.id}
                          disabled={bookings.some(
                            (booking) =>
                              booking.id !== bookingEditor.draft.id &&
                              booking.sessionId === session.id &&
                              booking.childName.trim().toLowerCase() === bookingEditor.draft.childName.trim().toLowerCase() &&
                              booking.status === "confirmed",
                          )}
                        >
                          {classInfo ? getSessionDisplayName(session, classInfo.name) : "Class"} · {formatSessionLabel(session)}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                  Parent name
                </label>
                <input
                  value={bookingEditor.draft.parentName}
                  onChange={(event) =>
                    setBookingEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, parentName: event.target.value } }
                        : current,
                    )
                  }
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                  Parent email
                </label>
                <input
                  type="email"
                  value={bookingEditor.draft.parentEmail}
                  onChange={(event) =>
                    setBookingEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, parentEmail: event.target.value } }
                        : current,
                    )
                  }
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                  Phone
                </label>
                <input
                  value={bookingEditor.draft.parentPhone}
                  onChange={(event) =>
                    setBookingEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, parentPhone: event.target.value } }
                        : current,
                    )
                  }
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">
                  Child name
                </label>
                {familyChildren.length > 0 ? (
                  <select
                    value={bookingEditor.draft.childName}
                    onChange={(event) => {
                      setBookingError("");
                      const val = event.target.value;
                      setBookingEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, childName: val } }
                          : current,
                      );
                    }}
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {familyChildren.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={bookingEditor.draft.childName}
                    onChange={(event) =>
                      (setBookingError(""), setBookingEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, childName: event.target.value } }
                          : current,
                      ))
                    }
                    placeholder="Child or family member name"
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  />
                )}
                {bookingError ? <p className="mt-2 text-sm font-semibold text-[#8b1e1e]">{bookingError}</p> : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              {bookingEditor.mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => handleDeleteBooking(bookingEditor.draft.id ?? "")}
                  className="rounded-full border border-[#8a2424] bg-[#f6d9d9] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setBookingEditor(null)}
                className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={saveBookingChanges}
                disabled={isDuplicateBooking}
                className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717] disabled:cursor-not-allowed disabled:border-[#bbb] disabled:bg-[#d8d8d8] disabled:text-[#666]"
              >
                {bookingEditor.mode === "edit" ? "Update booking" : "Save booking"}
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
              <div className="mb-5 rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black uppercase text-[#111111]">My children</h3>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {children.length > 0 ? (
                    children.map((child) => (
                      <div key={`${child.name}-${child.age}`} className="rounded-2xl border border-[#d9bb5c] bg-[#f7f2ea] p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5a4309]">Student</p>
                        <p className="mt-2 text-lg font-black text-[#111111]">{child.name}</p>
                        <p className="mt-1 text-sm text-[#3b3b3b]">Age: {child.age || "Not set"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#3b3b3b]">No children added yet. Add your child or family member below to auto-fill future bookings.</p>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_0.7fr_auto]">
                  <input
                    type="text"
                    value={childNameDraft}
                    onChange={(event) => setChildNameDraft(event.target.value)}
                    placeholder="Child or family member name"
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                  />
                  <input
                    type="text"
                    value={childAgeDraft}
                    onChange={(event) => setChildAgeDraft(event.target.value)}
                    placeholder="Age"
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none ring-0 placeholder:text-[#7c7c7c]"
                  />
                  <button
                    type="button"
                    onClick={handleAddChild}
                    className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
                  >
                    Add child / family member
                  </button>
                </div>
              </div>

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

              <div className="mb-6 flex justify-start sm:justify-end">
                <button
                  type="button"
                  onClick={() => openCreateBooking()}
                  className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
                >
                  New booking
                </button>
              </div>

              {myBookings.length > 0 ? (
                <div className="mb-6 rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5a4309]">My bookings</p>
                      <h4 className="mt-2 text-2xl font-black uppercase text-[#111111]">Upcoming reservations</h4>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {myBookings.map((booking) => {
                      const session = allSessions.find((item) => item.id === booking.sessionId) ?? initialSessions[0];
                      const classInfo = karateClasses.find((item) => item.id === session.classId) ?? karateClasses[0];

                      return (
                        <div key={booking.id} className="rounded-2xl border-2 border-[#d4ae3e] bg-[#f9f4ea] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5a4309]">
                            {getSessionDisplayName(session, classInfo.name)}
                          </p>
                          <h5 className="mt-2 text-lg font-black text-[#111111]">Child: {booking.childName}</h5>
                          <p className="mt-1 text-sm text-[#3c3c3c]">Session: {formatSessionLabel(session)}</p>
                          <p className="mt-1 text-sm text-[#3c3c3c]">Status: {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}</p>

                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditBooking(booking.id)}
                              className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(booking.sessionId)}
                              className="rounded-full border border-[#8a2424] bg-[#f6d9d9] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-[20px] border-2 border-dashed border-[#c7a531] bg-[#fffdf8] p-5 text-center">
                  <p className="text-sm font-semibold text-[#3b3b3b]">No bookings yet.</p>
                  <p className="mt-1 text-sm text-[#5a5a5a]">Choose a session below to reserve a spot for a family member.</p>
                </div>
              )}

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
                              const shortLabel = classInfo ? getSessionDisplayName(session, classInfo.name) : "Class";

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
                      <div className="space-y-3">
                        {sessions.map((session) => (
                          <BookingCard
                            key={session.id}
                            session={session}
                            classInfo={classInfo}
                            bookings={bookings}
                            guestBookings={guestBookings}
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
