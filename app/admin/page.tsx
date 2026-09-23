"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildMonthlySessions,
  formatSessionLabel,
  getSessionDisplayName,
  getSessionAvailability,
  initialBookings,
  initialSessions,
  karateClasses,
  sortSessionsByDateTime,
  type BookingRecord,
} from "@/lib/mock-data";
import {
  cancelSupabaseBooking,
  createSupabaseBookingAsAdmin,
  createSupabaseStudent,
  getSupabaseBookings,
  getSupabaseSessions,
  getSupabaseStudents,
  getSupabaseUserRole,
  supabase,
  updateSupabaseBooking,
} from "@/lib/supabase";

function LogoMark() {
  return (
    <img
      src="https://www.shorinryubukenkan.com/storage/images/logo.png"
      alt="Shorin-Ryu Bukenkan logo"
      className="h-16 w-16 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.2)] sm:h-20 sm:w-20"
    />
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

type GuestBooking = {
  id: string;
  sessionId: string;
  guestName: string;
  guestEmail: string;
  childName: string;
  status: string;
  token: string;
};

type StudentRecord = {
  name: string;
  parent: string;
  registeredStudentId?: string;
  parentEmail?: string;
  parentPhone?: string;
  belt: string;
  className: string;
  classDate?: string;
  classTime: string;
  baseClassDays?: string[];
  baseClassName?: string;
  baseClassTime?: string;
};

const STUDENT_SESSION_OPTIONS = [...initialSessions, ...buildMonthlySessions()].map((session) => {
  const classInfo = karateClasses.find((klass) => klass.id === session.classId);
  const startTime = new Date(`2000-01-01T${session.startTime}:00`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = new Date(`2000-01-01T${session.endTime}:00`).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return {
    id: session.id,
    date: session.date,
    name: getSessionDisplayName(session, classInfo?.name ?? "Class"),
    time: `${startTime} - ${endTime}`,
  };
});

const BOOKINGS_STORAGE_KEY = "shorinryu-admin-bookings";
const GUEST_BOOKINGS_STORAGE_KEY = "shorinryu-guest-bookings";
type RegisteredStudent = {
  id: string;
  name: string;
  age?: string;
  parent: string;
  parentEmail: string;
};
const DEFAULT_STUDENT_ROSTER: StudentRecord[] = [];

export default function AdminPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>(initialBookings);
  const [guestBookings] = useState<GuestBooking[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(GUEST_BOOKINGS_STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [studentRoster, setStudentRoster] = useState<StudentRecord[]>(DEFAULT_STUDENT_ROSTER);
  const [supabaseSessions, setSupabaseSessions] = useState<Awaited<ReturnType<typeof getSupabaseSessions>>>([]);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [registeredParents, setRegisteredParents] = useState<Array<{ name: string; email: string; children: string[] }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedTile, setSelectedTile] = useState<string | null>("Bookings");
  const [scheduleView, setScheduleView] = useState<"weekly" | "monthly">("weekly");
  const [bookingError, setBookingError] = useState("");
  const [bookingEditor, setBookingEditor] = useState<{
    mode: "create" | "edit";
    draft: BookingDraft;
  } | null>(null);
  const [detailModal, setDetailModal] = useState<{
    title: string;
    subtitle: string;
    body: string;
  } | null>(null);
  const [studentEditor, setStudentEditor] = useState<{
    mode: "create";
    draft: StudentRecord;
  } | null>(null);
  const [studentError, setStudentError] = useState("");
  const router = useRouter();

  const allSessions = useMemo(
    () => (supabaseSessions.length > 0 ? supabaseSessions : [...initialSessions, ...buildMonthlySessions()]),
    [supabaseSessions],
  );

  useEffect(() => {
    const loadParentRegistry = () => {
      try {
        const raw = localStorage.getItem("shorinryu-parent-registry");
        if (!raw) {
          setRegisteredParents([]);
          return;
        }

        const parsed = JSON.parse(raw) as Array<{
          name: string;
          email: string;
          children?: Array<{ name: string; age?: string }>;
        }>;
        setRegisteredParents(
          (parsed ?? []).map((entry) => ({
            name: entry.name,
            email: entry.email,
            children: (entry.children ?? []).map((child) => child.name),
          })),
        );
        setRegisteredStudents(
          (parsed ?? []).flatMap((entry) =>
            (entry.children ?? []).map((child) => ({
              id: `${entry.email}:${child.name}`,
              name: child.name,
              age: child.age,
              parent: entry.name,
              parentEmail: entry.email,
            })),
          ),
        );
      } catch {
        setRegisteredParents([]);
        setRegisteredStudents([]);
      }
    };

    loadParentRegistry();
  }, []);

  useEffect(() => {
    const hydrateAdminAccess = async () => {
      const storedRole = localStorage.getItem("shorinryu-role");

      if (!supabase && storedRole === "admin") {
        const storedBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
        if (storedBookings) {
          try {
            const parsed = JSON.parse(storedBookings) as BookingRecord[];
            const realBookings = Array.isArray(parsed)
              ? parsed.filter((booking) => !booking.id.match(/^booking-[1-6]$/) && !booking.parentEmail.endsWith("@example.com"))
              : [];
            if (realBookings.length > 0) {
              setBookings(realBookings);
              localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(realBookings));
            } else {
              localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify([]));
            }
          } catch {
            localStorage.removeItem(BOOKINGS_STORAGE_KEY);
          }
        }
      }

      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const role = (await getSupabaseUserRole()) || session.user.user_metadata?.role;

          if (role === "admin") {
            setIsAdmin(true);
            setSupabaseSessions(await getSupabaseSessions());
            const persistedStudents = await getSupabaseStudents();
            setStudentRoster(persistedStudents.map((student) => ({
              name: student.name,
              parent: student.parentName,
              parentEmail: student.parentEmail,
              parentPhone: student.parentPhone,
              belt: student.belt,
              className: student.baseClassName,
              classTime: student.baseClassTime,
              baseClassDays: student.baseClassDays,
              baseClassName: student.baseClassName,
              baseClassTime: student.baseClassTime,
            })));
            const nextBookings = await getSupabaseBookings();
            setBookings(nextBookings);
            localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextBookings));
            return;
          }
        }
      }

      if (!supabase && storedRole === "admin") {
        setIsAdmin(true);
        return;
      }

      localStorage.removeItem("shorinryu-role");
      router.push("/admin/login");
    };

    void hydrateAdminAccess();
  }, [router]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    const refreshSchedule = async () => {
      const [nextSessions, nextBookings] = await Promise.all([
        getSupabaseSessions(),
        getSupabaseBookings(),
      ]);
      setSupabaseSessions(nextSessions);
      setBookings(nextBookings);
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void refreshSchedule();
    };
    const channel = client
      .channel("admin-capacity-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refreshSchedule())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => void refreshSchedule())
      .subscribe();

    window.addEventListener("focus", refreshSchedule);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      window.removeEventListener("focus", refreshSchedule);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
      void client.removeChannel(channel);
    };
  }, []);

  const activeSessions = useMemo(
    () => {
      if (scheduleView === "monthly") return sortSessionsByDateTime(allSessions);

      const sortedSessions = sortSessionsByDateTime(allSessions);
      const today = new Date();
      const nextSession = sortedSessions.find((session) => session.date >= today.toISOString().slice(0, 10));
      const referenceDate = nextSession ? new Date(`${nextSession.date}T00:00:00`) : today;
      const weekStart = new Date(referenceDate);
      weekStart.setDate(referenceDate.getDate() - referenceDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const startDate = weekStart.toISOString().slice(0, 10);
      const endDate = weekEnd.toISOString().slice(0, 10);

      return sortedSessions.filter((session) => session.date >= startDate && session.date <= endDate);
    },
    [scheduleView, allSessions],
  );

  const totalCapacity = activeSessions.reduce((sum, session) => sum + session.capacity, 0);
  const parentConfirmed = bookings.filter((booking) => booking.status === "confirmed").length;
  const guestConfirmed = guestBookings.filter((guest) => guest.status === "confirmed" || !guest.status).length;
  const confirmedCount = parentConfirmed + guestConfirmed;

  const parentCancelled = bookings.filter((booking) => booking.status === "cancelled").length;
  const guestCancelled = guestBookings.filter((guest) => guest.status === "cancelled").length;
  const cancelledCount = parentCancelled + guestCancelled;

  const openSeats = activeSessions.reduce(
    (sum, session) => sum + getSessionAvailability(session, bookings, guestBookings).open,
    0,
  );

  const tileActions: Record<string, { label: string; detail: string; targetId: string }> = {
    Schedule: { label: "Open schedule view", detail: "Review class slots, edit recurring templates, and manage capacity changes.", targetId: "schedule-section" },
    Bookings: { label: "Open booking roster", detail: "Review parent reservations, update status, and manage the live waitlist.", targetId: "bookings-section" },
    Students: { label: "Open student records", detail: "Review family records, link parent contact data, and update belt or age-based notes.", targetId: "students-section" },
    Notifications: { label: "Open notifications", detail: "Send updates to class families, review announcements, and check delivery logs.", targetId: "notifications-section" },
  };

  const handleTileAction = (title: string) => {
    const nextSelected = selectedTile === title ? null : title;
    setSelectedTile(nextSelected);

    if (nextSelected) {
      const target = document.getElementById(tileActions[title].targetId);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const knownParentProfiles = useMemo(() => {
    const map = new Map<string, { parentEmail: string; parentPhone: string; childNames: string[] }>();

    bookings.forEach((booking) => {
      if (!booking.parentName) {
        return;
      }

      const key = booking.parentName.trim().toLowerCase();
      const profile = map.get(key) ?? { parentEmail: "", parentPhone: "", childNames: [] };
      if (booking.parentEmail) profile.parentEmail = booking.parentEmail;
      if (booking.parentPhone) profile.parentPhone = booking.parentPhone;
      if (booking.childName && !profile.childNames.includes(booking.childName)) profile.childNames.push(booking.childName);
      map.set(key, profile);
    });

    studentRoster.forEach((student) => {
      if (!student.parent) {
        return;
      }

      const key = student.parent.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          parentEmail: student.parentEmail ?? "",
          parentPhone: student.parentPhone ?? "",
          childNames: student.name && student.name !== "N/A" ? [student.name] : [],
        });
      } else if (student.name && student.name !== "N/A") {
        const profile = map.get(key)!;
        if (!profile.childNames.includes(student.name)) profile.childNames.push(student.name);
      }
    });

    registeredParents.forEach((parent) => {
      const key = parent.name.trim().toLowerCase();
      const profile = map.get(key) ?? { parentEmail: parent.email, parentPhone: "", childNames: [] };
      profile.parentEmail ||= parent.email;
      parent.children.forEach((child) => {
        if (child && !profile.childNames.includes(child)) profile.childNames.push(child);
      });
      map.set(key, profile);
    });

    return [...map.entries()].map(([parentName, profile]) => ({
      parentName,
      ...profile,
    }));
  }, [bookings, registeredParents, studentRoster]);

  const selectedBookingParent = knownParentProfiles.find(
    (profile) => profile.parentName === bookingEditor?.draft.parentName.trim().toLowerCase(),
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

  const bookingsByClass = useMemo(() => {
    const groups = new Map<string, { className: string; bookings: BookingRecord[] }>();

    bookings.forEach((booking) => {
      const session = allSessions.find((item) => item.id === booking.sessionId);
      const classInfo = session ? karateClasses.find((klass) => klass.id === session.classId) : null;
      const className = session
        ? getSessionDisplayName(session, classInfo?.name ?? "Class")
        : "Class unavailable";
      const group = groups.get(className) ?? { className, bookings: [] };
      group.bookings.push(booking);
      groups.set(className, group);
    });

    return [...groups.values()].sort((left, right) => {
      const leftSession = allSessions.find((session) => session.id === left.bookings[0]?.sessionId);
      const rightSession = allSessions.find((session) => session.id === right.bookings[0]?.sessionId);
      const leftDateTime = leftSession ? `${leftSession.date}T${leftSession.startTime}` : "9999-12-31T23:59";
      const rightDateTime = rightSession ? `${rightSession.date}T${rightSession.startTime}` : "9999-12-31T23:59";
      return leftDateTime.localeCompare(rightDateTime) || left.className.localeCompare(right.className);
    }).map((group) => ({
      ...group,
      bookings: [...group.bookings].sort((left, right) => {
        const leftSession = allSessions.find((session) => session.id === left.sessionId);
        const rightSession = allSessions.find((session) => session.id === right.sessionId);
        const leftDateTime = leftSession ? `${leftSession.date}T${leftSession.startTime}` : "9999-12-31T23:59";
        const rightDateTime = rightSession ? `${rightSession.date}T${rightSession.startTime}` : "9999-12-31T23:59";
        return leftDateTime.localeCompare(rightDateTime) || left.childName.localeCompare(right.childName);
      }),
    }));
  }, [bookings, allSessions]);

  const baseClassRosterByName = useMemo(() => {
    const classOrder = ["Class 1", "Class 2", "Class 3", "Class 4", "Early Birds"];
    const groups = new Map<string, StudentRecord[]>();

    studentRoster.forEach((student) => {
      const className = student.baseClassName || student.className || "Unassigned";
      groups.set(className, [...(groups.get(className) ?? []), student]);
    });

    return [...groups.entries()].sort(([left], [right]) => {
      const leftIndex = classOrder.indexOf(left);
      const rightIndex = classOrder.indexOf(right);
      return (leftIndex < 0 ? classOrder.length : leftIndex) - (rightIndex < 0 ? classOrder.length : rightIndex) || left.localeCompare(right);
    });
  }, [studentRoster]);

  const baseAssignmentBookingIds = useMemo(() => {
    const ids = new Set<string>();

    bookings.forEach((booking) => {
      const session = allSessions.find((item) => item.id === booking.sessionId);
      if (!session) return;

      const sessionClassName = getSessionDisplayName(
        session,
        karateClasses.find((klass) => klass.id === session.classId)?.name ?? "Class",
      );
      const sessionDay = new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });
      const matchesAssignment = studentRoster.some((student) =>
        student.name.trim().toLowerCase() === booking.childName.trim().toLowerCase() &&
        (student.baseClassName || student.className) === sessionClassName &&
        (student.baseClassDays ?? []).includes(sessionDay),
      );

      if (matchesAssignment) ids.add(booking.id);
    });

    return ids;
  }, [allSessions, bookings, studentRoster]);

  const additionalBookingsByClass = useMemo(
    () => bookingsByClass
      .map((group) => ({
        ...group,
        bookings: group.bookings.filter((booking) => !baseAssignmentBookingIds.has(booking.id)),
      }))
      .filter((group) => group.bookings.length > 0),
    [baseAssignmentBookingIds, bookingsByClass],
  );

  const openCreateBooking = () => {
    setBookingError("");
    setBookingEditor({
      mode: "create",
      draft: {
        sessionId: allSessions[0]?.id ?? "",
        parentName: "",
        parentEmail: "",
        parentPhone: "",
        childName: "",
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
    const nextParentEmail = draft.parentEmail.trim();
    const nextChildName = draft.childName.trim();

    if (!draft.sessionId || !nextParentName || !nextParentEmail || !nextChildName) {
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

    const nextBooking: BookingRecord = {
      id: draft.id ?? `booking-admin-${Date.now()}`,
      sessionId: draft.sessionId,
      parentName: nextParentName,
      parentEmail: nextParentEmail,
      parentPhone: draft.parentPhone.trim() || undefined,
      childName: nextChildName,
      status: draft.status === "cancelled" ? "cancelled" : "confirmed",
    };

    if (supabase) {
      const result = draft.id
        ? await updateSupabaseBooking({ bookingId: draft.id, sessionId: nextBooking.sessionId, childName: nextBooking.childName, status: nextBooking.status })
        : await createSupabaseBookingAsAdmin(nextBooking);
      if (!result.ok) {
        setBookingError(result.message ?? "Unable to save booking.");
        return;
      }
    }

    setBookings((current) => {
      const filtered = current.filter((booking) => booking.id !== nextBooking.id);
      const nextList = [...filtered, nextBooking];
      localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextList));
      return nextList;
    });

    setBookingEditor(null);
    setBookingError("");
  };

  const handleDeleteBooking = async (bookingId: string) => {
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
    setBookingEditor(null);
  };

  const openCreateStudent = () => {
    setStudentError("");
    setStudentEditor({
      mode: "create",
      draft: {
        name: "",
        parent: "",
        registeredStudentId: "",
        parentEmail: "",
        parentPhone: "",
        belt: "White",
        classDate: STUDENT_SESSION_OPTIONS[0]?.date ?? "",
        className: STUDENT_SESSION_OPTIONS[0]?.name ?? "",
        classTime: STUDENT_SESSION_OPTIONS[0]?.time ?? "",
        baseClassDays: STUDENT_SESSION_OPTIONS[0]?.date
          ? [new Date(`${STUDENT_SESSION_OPTIONS[0].date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })]
          : [],
        baseClassName: STUDENT_SESSION_OPTIONS[0]?.name ?? "Class 1",
        baseClassTime: STUDENT_SESSION_OPTIONS[0]?.time ?? "",
      },
    });
  };

  const saveStudentChanges = async () => {
    if (!studentEditor) {
      return;
    }

    const draft = studentEditor.draft;
    const nextName = draft.name.trim();
    const nextParent = draft.parent.trim();
    const nextParentEmail = draft.parentEmail?.trim() ?? "";

    if (!nextName || !nextParent) {
      return;
    }

    if (!draft.baseClassDays?.length || !draft.baseClassName || !draft.baseClassTime) {
      setStudentError("Assign at least one Base Class day and time.");
      return;
    }

    const baseSlotKey = `${draft.baseClassDays.join(",")}|${draft.baseClassName}|${draft.baseClassTime}`;
    const assignedCount = studentRoster.filter((student) =>
      `${student.baseClassDays?.join(",") ?? ""}|${student.baseClassName ?? student.className}|${student.baseClassTime ?? student.classTime}` === baseSlotKey,
    ).length;
    if (assignedCount >= 9) {
      setStudentError("This Base Class slot is full. Choose another class or time.");
      return;
    }

    if (supabase) {
      const result = await createSupabaseStudent({
        name: nextName,
        parentName: nextParent,
        parentEmail: nextParentEmail,
        parentPhone: draft.parentPhone?.trim() || undefined,
        belt: draft.belt || "White",
        baseClassDays: draft.baseClassDays,
        baseClassName: draft.baseClassName,
        baseClassTime: draft.baseClassTime,
      });
      if (!result.ok) {
        setStudentError(result.message ?? "Unable to save student.");
        return;
      }
    }

    const selectedBaseDay = draft.baseClassDays[0]?.toLowerCase();
    const selectedBaseClassName = draft.baseClassName.toLowerCase();
    const selectedSession = allSessions.find((session) => {
      const sessionDay = new Date(`${session.date}T00:00:00`)
        .toLocaleDateString(undefined, { weekday: "long" })
        .toLowerCase();
      return selectedBaseDay === sessionDay &&
        getSessionDisplayName(session, "Class").toLowerCase() === selectedBaseClassName;
    });
    setStudentRoster((current) => [
      {
        name: nextName,
        parent: nextParent,
        registeredStudentId: draft.registeredStudentId,
        parentEmail: nextParentEmail,
        parentPhone: draft.parentPhone?.trim() || undefined,
        belt: draft.belt || "White",
        classDate: draft.classDate,
        className: draft.className || "Class 1",
        classTime: draft.classTime || "",
        baseClassDays: draft.baseClassDays,
        baseClassName: draft.baseClassName,
        baseClassTime: draft.baseClassTime,
      },
      ...current,
    ]);

    try {
      const registry = JSON.parse(localStorage.getItem("shorinryu-parent-registry") ?? "[]") as Array<{
        name: string;
        email: string;
        password?: string;
        children?: Array<Record<string, unknown>>;
      }>;
      const parentEntry = registry.find((entry) => entry.email.toLowerCase() === nextParentEmail.toLowerCase());
      if (parentEntry) {
        const existingChild = (parentEntry.children ?? []).some((child) => String(child.name).toLowerCase() === nextName.toLowerCase());
        parentEntry.children = existingChild
          ? (parentEntry.children ?? []).map((child) =>
              String(child.name).toLowerCase() === nextName.toLowerCase()
                ? { ...child, baseClassDays: draft.baseClassDays, baseClassName: draft.baseClassName, baseClassTime: draft.baseClassTime }
                : child,
            )
          : [...(parentEntry.children ?? []), { name: nextName, age: "Not set", baseClassDays: draft.baseClassDays, baseClassName: draft.baseClassName, baseClassTime: draft.baseClassTime }];
        localStorage.setItem("shorinryu-parent-registry", JSON.stringify(registry));
      }
    } catch {
      // Keep the local student record usable if the optional registry is unavailable.
    }

    if (selectedSession) {
      const alreadyBooked = bookings.some(
        (booking) =>
          booking.sessionId === selectedSession.id &&
          booking.parentName.toLowerCase() === nextParent.toLowerCase() &&
          booking.childName.toLowerCase() === nextName.toLowerCase(),
      );

      if (!alreadyBooked) {
        const studentBooking: Omit<BookingRecord, "id"> = {
          sessionId: selectedSession.id,
          parentName: nextParent,
          parentEmail: nextParentEmail,
          parentPhone: draft.parentPhone?.trim() || undefined,
          childName: nextName,
          status: "confirmed",
        };
        let persistedBookingId: string | undefined;
        if (supabase) {
          const bookingResult = await createSupabaseBookingAsAdmin(studentBooking);
          if (!bookingResult.ok) {
            setStudentError(bookingResult.message ?? "Unable to save the Base Class booking.");
            return;
          }
          persistedBookingId = bookingResult.bookingId;
        }
        setBookings((current) => {
          const nextList = [...current, { ...studentBooking, id: persistedBookingId ?? `booking-admin-${Date.now()}` }];
          localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextList));
          return nextList;
        });
      }
    }

    setStudentEditor(null);
  };

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#ece7dc] px-4 py-8 text-[#1d1d1d]">
        <div className="w-full max-w-lg rounded-[28px] border-[6px] border-[#c7a531] bg-[#f7f2e8] p-8 text-center shadow-[0_0_0_10px_rgba(199,165,49,0.18)]">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#5a4309]">Restricted access</p>
          <h1 className="mt-4 text-3xl font-black uppercase text-[#111111]">Admin only</h1>
          <p className="mt-4 text-base text-[#444444]">
            This dashboard is restricted to authorized staff. Redirecting to the secure admin login page.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="rounded-full border border-[#b88a17] bg-[#d9b344] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#171717] transition hover:brightness-110"
            >
              Go to admin login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      {bookingEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4">
          <div className="w-full max-w-xl rounded-[26px] border-4 border-[#c7a531] bg-[#fffdf8] p-6 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#5a4309]">
              {bookingEditor.mode === "create" ? "New booking" : "Edit booking"}
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase text-[#111111]">
              {bookingEditor.mode === "create" ? "Create reservation" : "Update reservation"}
            </h3>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Session</label>
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
                  {allSessions.map((session) => {
                    const classInfo = karateClasses.find((klass) => klass.id === session.classId);
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
                          {getSessionDisplayName(session, classInfo?.name ?? "Class")} · {formatSessionLabel(session)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Parent name</label>
                <div className="flex gap-2">
                  <input
                    list="parent-name-options"
                    value={bookingEditor.draft.parentName}
                    onChange={(event) => {
                      setBookingError("");
                      const nextParentName = event.target.value;
                      const match = knownParentProfiles.find(
                        (profile) => profile.parentName === nextParentName.trim().toLowerCase(),
                      );

                      setBookingEditor((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          draft: {
                            ...current.draft,
                            parentName: nextParentName,
                            parentEmail: match?.parentEmail || current.draft.parentEmail,
                            parentPhone: match?.parentPhone || current.draft.parentPhone,
                            childName: match?.childNames[0] || current.draft.childName,
                          },
                        };
                      });
                    }}
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBookingEditor((current) =>
                        current
                          ? {
                              ...current,
                              draft: {
                                ...current.draft,
                                parentName: "",
                                parentEmail: "",
                                parentPhone: "",
                                childName: "",
                              },
                            }
                          : current,
                      )
                    }
                    className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                  >
                    Clear selection
                  </button>
                </div>
                <datalist id="parent-name-options">
                  {knownParentProfiles.map((profile) => (
                    <option key={profile.parentName} value={profile.parentName} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Parent email</label>
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
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Phone</label>
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
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Child name</label>
                {selectedBookingParent && selectedBookingParent.childNames.length > 0 ? (
                  <select
                    value={bookingEditor.draft.childName}
                    onChange={(event) =>
                      (setBookingError(""), setBookingEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, childName: event.target.value } }
                          : current,
                      ))
                    }
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {selectedBookingParent.childNames.map((childName) => (
                      <option key={childName} value={childName}>
                        {childName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={bookingEditor.draft.childName}
                    onChange={(event) =>
                      setBookingEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, childName: event.target.value } }
                          : current,
                      )
                    }
                    placeholder="Student name"
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  />
                )}
                {bookingError ? <p className="mt-2 text-sm font-semibold text-[#8b1e1e]">{bookingError}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Status</label>
                <select
                  value={bookingEditor.draft.status}
                  onChange={(event) =>
                    setBookingEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              status: event.target.value === "cancelled" ? "cancelled" : "confirmed",
                            },
                          }
                        : current,
                    )
                  }
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
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

      {detailModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4">
          <div className="w-full max-w-lg rounded-[26px] border-4 border-[#c7a531] bg-[#fffdf8] p-6 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#5a4309]">Details</p>
            <h3 className="mt-3 text-2xl font-black uppercase text-[#111111]">{detailModal.title}</h3>
            <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-[#5a4309]">{detailModal.subtitle}</p>
            <p className="mt-4 text-sm leading-6 text-[#3b3b3b]">{detailModal.body}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {studentEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[26px] border-4 border-[#c7a531] bg-[#fffdf8] p-6 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#5a4309]">Student record</p>
                <h3 className="mt-3 text-2xl font-black uppercase text-[#111111]">Add student</h3>
              </div>
              <button
                type="button"
                onClick={() => setStudentEditor(null)}
                aria-label="Close add student dialog"
                className="rounded-full border border-[#b88a17] bg-[#f5f0e5] px-3 py-2 text-sm font-black text-[#171717]"
              >
                X
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Registered student</label>
                <select
                  value={studentEditor.draft.registeredStudentId ?? ""}
                  onChange={(event) => {
                    const selectedStudent = registeredStudents.find((student) => student.id === event.target.value);

                    setStudentEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: selectedStudent
                              ? {
                                  ...current.draft,
                                  registeredStudentId: selectedStudent.id,
                                  name: selectedStudent.name,
                                  parent: selectedStudent.parent,
                                  parentEmail: selectedStudent.parentEmail,
                                }
                              : {
                                  ...current.draft,
                                  registeredStudentId: "",
                                  name: "",
                                  parent: "",
                                  parentEmail: "",
                                  parentPhone: "",
                                },
                          }
                        : current,
                    );
                  }}
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                >
                  <option value="">New student</option>
                  {registeredStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} - {student.parent}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-[#4a4a4a]">
                  {registeredStudents.length > 0
                    ? "Choose a registered child or select New student."
                    : "No registered students yet. Enter a new student below."}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Student name</label>
                <input
                  value={studentEditor.draft.name}
                  onChange={(event) =>
                    setStudentEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, name: event.target.value } }
                        : current,
                    )
                  }
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  placeholder="Student full name"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Parent name</label>
                <input
                  value={studentEditor.draft.parent}
                  onChange={(event) =>
                    setStudentEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, parent: event.target.value } }
                        : current,
                    )
                  }
                  className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  placeholder="Parent or guardian"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Parent email</label>
                  <input
                    type="email"
                    value={studentEditor.draft.parentEmail ?? ""}
                    onChange={(event) =>
                      setStudentEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, parentEmail: event.target.value } }
                          : current,
                      )
                    }
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                    placeholder="parent@example.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Parent phone</label>
                  <input
                    type="tel"
                    value={studentEditor.draft.parentPhone ?? ""}
                    onChange={(event) =>
                      setStudentEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, parentPhone: event.target.value } }
                          : current,
                      )
                    }
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="rounded-[18px] border-2 border-[#c7a531] bg-[#f7f2ea] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5a4309]">Base Class assignment</p>
                <p className="mt-2 text-xs text-[#4a4a4a]">Recurring weekly schedule set by the admin. Maximum capacity is 9 students per slot.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setStudentEditor((current) => {
                        if (!current) return current;
                        const days = current.draft.baseClassDays ?? [];
                        return { ...current, draft: { ...current.draft, baseClassDays: days.includes(day) ? days.filter((item) => item !== day) : [...days, day] } };
                      })}
                      className={`rounded-full border px-3 py-2 text-xs font-black ${studentEditor.draft.baseClassDays?.includes(day) ? "border-[#a57a10] bg-[#d9b344]" : "border-[#d9bb5c] bg-[#fffdf8]"}`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <select
                    value={studentEditor.draft.baseClassName ?? "Class 1"}
                    onChange={(event) => setStudentEditor((current) => current ? { ...current, draft: { ...current.draft, baseClassName: event.target.value } } : current)}
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {["Class 1", "Class 2", "Class 3", "Class 4", "Early birds"].map((label) => <option key={label} value={label}>{label}</option>)}
                  </select>
                  <select
                    value={studentEditor.draft.baseClassTime ?? ""}
                    onChange={(event) => setStudentEditor((current) => current ? { ...current, draft: { ...current.draft, baseClassTime: event.target.value } } : current)}
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {[...new Set(STUDENT_SESSION_OPTIONS.map((option) => option.time))].map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </div>
                {studentError ? <p className="mt-3 text-sm font-bold text-[#8b1e1e]">{studentError}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Belt</label>
                  <select
                    value={studentEditor.draft.belt}
                    onChange={(event) =>
                      setStudentEditor((current) =>
                        current
                          ? { ...current, draft: { ...current.draft, belt: event.target.value } }
                          : current,
                      )
                    }
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {[
                      "White",
                      "Yellow",
                      "Orange",
                      "Green",
                      "Blue",
                      "Purple",
                      "Brown",
                      "Black",
                    ].map((belt) => (
                      <option key={belt} value={belt}>
                        {belt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Class date</label>
                  <select
                    value={studentEditor.draft.classDate ?? ""}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      const firstSession = STUDENT_SESSION_OPTIONS.find((option) => option.date === nextDate);

                      setStudentEditor((current) =>
                        current && firstSession
                          ? {
                              ...current,
                              draft: {
                                ...current.draft,
                                classDate: firstSession.date,
                                className: firstSession.name,
                                classTime: firstSession.time,
                              },
                            }
                          : current,
                      );
                    }}
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {[...new Set(STUDENT_SESSION_OPTIONS.map((option) => option.date))].map((date) => (
                      <option key={date} value={date}>
                        {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Class</label>
                  <select
                    value={studentEditor.draft.className}
                    onChange={(event) =>
                      setStudentEditor((current) =>
                        current
                          ? (() => {
                              const selectedSession = STUDENT_SESSION_OPTIONS.find(
                                (option) => option.name === event.target.value && option.date === current.draft.classDate,
                              );

                              return selectedSession
                                ? {
                                    ...current,
                                    draft: {
                                      ...current.draft,
                                      classDate: selectedSession.date,
                                      className: selectedSession.name,
                                      classTime: selectedSession.time,
                                    },
                                  }
                                : current;
                            })()
                          : current,
                      )
                    }
                    className="w-full rounded-full border-2 border-[#c7a531] bg-[#fffdf8] px-4 py-3 text-sm text-[#111111] outline-none"
                  >
                    {STUDENT_SESSION_OPTIONS
                      .filter((option) => option.date === studentEditor.draft.classDate)
                      .map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-[#5a4309]">Class time</label>
                <div className="w-full rounded-full border-2 border-[#d9bb5c] bg-[#f5f0e5] px-4 py-3 text-sm font-semibold text-[#3b3b3b]">
                  {studentEditor.draft.classTime || "Select a class"}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setStudentEditor(null)}
                className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveStudentChanges}
                className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-[#171717]"
              >
                Save student
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
                    <h1 className="text-lg font-black uppercase leading-[0.95] text-[#111111] sm:text-xl lg:text-2xl">
                      Okinawa Shorin-Ryu Karate Do Bukenkan of USA
                    </h1>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6d510c] sm:text-sm">
                      Admin Dashboard
                    </p>
                  </div>
                </div>

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
              <div className="mb-5 text-center">
                <p className="text-sm font-black uppercase tracking-[0.26em] text-[#5a4309]">Operations overview</p>
                <h2 className="mt-2 text-xl font-black uppercase text-[#111111] sm:text-2xl">Admin command center</h2>
              </div>

              <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {[
                  { title: "Schedule", subtitle: "Create/edit sessions", detail: "Recurring templates, capacity overrides, cancellations" },
                  { title: "Bookings", subtitle: "Manage roster", detail: "Walk-in entries, waitlist, reschedule actions" },
                  { title: "Students", subtitle: "Family records", detail: "Parent links, belt updates, archive profiles" },
                  { title: "Notifications", subtitle: "Announcements", detail: "Send to class or belt groups, review delivery logs" },
                ].map((item) => {
                  const isSelected = selectedTile === item.title;

                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleTileAction(item.title)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-[#a57a10] bg-[#f7e8b2] shadow-[0_0_0_3px_rgba(199,165,49,0.18)]"
                          : "border-[#d9bb5c] bg-[#fffdf8] hover:border-[#a57a10] hover:bg-[#fffaf0]"
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5a4309]">{item.title}</p>
                      <p className="mt-2 text-base font-black text-[#111111]">{item.subtitle}</p>
                      <p className="mt-2 text-sm text-[#3b3b3b]">{item.detail}</p>
                    </button>
                  );
                })}
              </div>

              {selectedTile ? (
                <div className="mt-6 rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5a4309]">Selected action</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-2xl font-black uppercase text-[#111111]">{selectedTile}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const tile = tileActions[selectedTile];
                        const target = document.getElementById(tile.targetId);
                        target?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                    >
                      {tileActions[selectedTile].label}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[#3b3b3b]">{tileActions[selectedTile].detail}</p>
                </div>
              ) : null}
            </section>

            <section id="notifications-section" className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-sm font-black uppercase tracking-[0.26em] text-[#5a4309]">Announcements</p>
                  <h3 className="mt-2 text-xl font-black uppercase text-[#111111] sm:text-2xl">Notifications center</h3>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <p className="text-sm text-[#3b3b3b]">No notifications yet.</p>
              </div>
            </section>

            <section id="schedule-section" className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.26em] text-[#5a4309]">Booking schedule</p>
                  <h3 className="mt-2 text-xl font-black uppercase text-[#111111] sm:text-2xl">
                    {scheduleView === "weekly" ? "Weekly view" : "Monthly view"}
                  </h3>
                </div>
                <div className="inline-flex rounded-full border-2 border-[#c7a531] bg-[#f5f0e5] p-1">
                  {[
                    { id: "weekly", label: "Weekly" },
                    { id: "monthly", label: "Monthly" },
                  ].map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setScheduleView(view.id as "weekly" | "monthly")}
                      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                        scheduleView === view.id ? "bg-[#d9b344] text-[#171717]" : "text-[#5a4309]"
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6 overflow-hidden rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8]">
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
                      {activeSessions.map((session) => {
                        const classInfo = karateClasses.find((klass) => klass.id === session.classId);
                        const availability = getSessionAvailability(session, bookings, guestBookings);
                        const confirmedCountPerSession = availability.confirmed;
                        const cancelledCountPerSession = bookings.filter(
                          (booking) => booking.sessionId === session.id && booking.status === "cancelled",
                        ).length;
                        const status = availability.isFull ? "Full" : "Open";
                        const statusClass = availability.isFull
                          ? "border-[#bf4d4d] bg-[#f6d9d9] text-[#7d1f1f]"
                          : "border-[#4aa55d] bg-[#e4f5e3] text-[#1e5b2d]";

                        return (
                          <tr key={session.id} className="border-t border-[#eadcb0]">
                            <td className="px-4 py-3 font-bold text-[#5a4309]">
                              {getSessionDisplayName(session, classInfo?.name ?? "Class")}
                            </td>
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
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass}`}
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
            </section>

            <section id="bookings-section" className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-black uppercase text-[#111111]">Additional Class bookings</h4>
                    <p className="mt-1 text-xs text-[#4a4a4a]">{bookings.length} reservation{bookings.length === 1 ? "" : "s"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateBooking}
                    className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#171717]"
                  >
                    New Additional Class
                  </button>
                </div>
                <div className="space-y-3">
                  {additionalBookingsByClass.length > 0 ? additionalBookingsByClass.map((group) => (
                    <div key={group.className} className="rounded-xl border border-[#d9bb5c] bg-[#f7f2ea] p-3">
                      <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#d9bb5c] pb-2">
                        <p className="text-sm font-black uppercase tracking-[0.12em] text-[#5a4309]">{group.className}</p>
                        <span className="text-xs font-bold text-[#4a4a4a]">
                          {group.bookings.length} booking{group.bookings.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {group.bookings.map((booking) => {
                          const matchingSession = allSessions.find((session) => session.id === booking.sessionId);

                          return (
                            <div key={booking.id} className="flex flex-col gap-3 rounded-lg border border-[#eadcb0] bg-[#fffdf8] p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-[#2f2f2f]">
                                  {booking.childName} • {booking.parentName}
                                </p>
                                <p className="mt-1 text-xs text-[#4a4a4a]">{matchingSession ? formatSessionLabel(matchingSession) : "Session unavailable"}</p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#5a4309]">
                                  Source: Persisted booking · Date: {matchingSession?.date ?? "Unavailable"}
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5a4309]">{booking.status}</p>
                                <div className="mt-2 flex justify-start gap-2 sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => openEditBooking(booking)}
                                    className="rounded-full border border-[#b88a17] bg-[#fffdf8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBooking(booking.id)}
                                    className="rounded-full border border-[#8a2424] bg-[#f6d9d9] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )) : <p className="text-sm text-[#4a4a4a]">No parent bookings yet.</p>}
                </div>
              </div>
            </section>

            <section id="students-section" className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="text-xl font-black uppercase text-[#111111]">Student and parent roster</h4>
                  <button
                    type="button"
                    onClick={openCreateStudent}
                    className="rounded-full border border-[#b88a17] bg-[#d9b344] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                  >
                    Add student
                  </button>
                </div>

                <div className="mb-5 rounded-[18px] border border-[#d9bb5c] bg-[#f7f2ea] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5a4309]">Registered families</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {registeredParents.length > 0 ? (
                      registeredParents.map((parent) => (
                        <div key={parent.email} className="rounded-2xl border border-[#eadcb0] bg-[#fffdf8] p-3">
                          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#111111]">{parent.name}</p>
                          <p className="mt-1 text-xs text-[#3b3b3b]">{parent.email}</p>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#5a4309]">
                            Children: {parent.children.length > 0 ? parent.children.join(", ") : "None"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#3b3b3b]">No registered parent accounts yet.</p>
                    )}
                  </div>
                </div>

                {baseClassRosterByName.length > 0 ? (
                  <div className="space-y-4">
                    {baseClassRosterByName.map(([className, students]) => (
                      <div key={className} className="rounded-[18px] border border-[#d9bb5c] bg-[#f7f2ea] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#d9bb5c] pb-2">
                          <p className="text-sm font-black uppercase tracking-[0.12em] text-[#5a4309]">{className}</p>
                          <span className="text-xs font-bold text-[#4a4a4a]">{students.length} student{students.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {students.map((student) => (
                            <div key={`${className}-${student.name}-${student.parent}`} className="rounded-2xl border border-[#eadcb0] bg-[#f9f4ea] p-4">
                              <span className="rounded-full border border-[#c7a531] bg-[#fffdf8] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#171717]">{student.belt}</span>
                              <p className="mt-3 text-lg font-black text-[#111111]">{student.name}</p>
                              <p className="mt-1 text-sm text-[#3b3b3b]">Parent: {student.parent}</p>
                              <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#5a4309]">Base Class: {className}</p>
                              <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[#5a4309]">{student.classTime}</p>
                              <button
                                type="button"
                                onClick={() => setDetailModal({ title: student.name === "N/A" ? student.parent : student.name, subtitle: student.belt, body: "This record includes the current belt level, parent contact summary, and class assignment. Use this section to review family details, send notes, or update the student profile." })}
                                className="mt-3 rounded-full border border-[#b88a17] bg-[#fffdf8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#171717]"
                              >
                                View details
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-[#3b3b3b]">No student records yet. Add a student to begin building the roster.</p>}
              </div>
            </section>

            <section className="mb-8 rounded-[26px] border-4 border-[#c7a531] bg-[#faf7f0] p-5 sm:p-6">
              <div className="rounded-[20px] border-2 border-[#c7a531] bg-[#fffdf8] p-4">
                <div className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5a4309]">Guest registration details</p>
                  <h4 className="mt-2 text-xl font-black uppercase text-[#111111]">Guest bookings</h4>
                </div>
                <div className="space-y-3">
                  {guestBookings.length > 0 ? (
                    guestBookings.map((guestBooking) => {
                      const matchingSession = allSessions.find((session) => session.id === guestBooking.sessionId);

                      return (
                        <div key={guestBooking.id} className="rounded-xl border border-[#eadcb0] bg-[#f9f4ea] p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-[#111111]">{guestBooking.guestName}</p>
                              <p className="mt-1 text-sm text-[#2f2f2f]">{guestBooking.guestEmail}</p>
                              <p className="mt-1 text-sm text-[#2f2f2f]">{guestBooking.childName}</p>
                              <p className="mt-1 text-xs text-[#4a4a4a]">
                                {matchingSession ? formatSessionLabel(matchingSession) : "Session unavailable"}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5a4309]">{guestBooking.status}</p>
                              <p className="mt-2 text-xs text-[#4a4a4a]">Token: {guestBooking.token}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[#4a4a4a]">No guest bookings yet.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
