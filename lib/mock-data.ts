export type ClassRecord = {
  id: string;
  name: string;
  description: string;
  ageGroup: string;
  instructor: string;
};

export type SessionRecord = {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
};

export type BookingStatus = "confirmed" | "cancelled";

export type BookingRecord = {
  id: string;
  sessionId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  childName: string;
  status: BookingStatus;
};

export const SESSION_CAPACITY = 9;

export const karateClasses: ClassRecord[] = [
  {
    id: "little-dragons",
    name: "Little Dragons",
    description: "Karate fundamentals and discipline for children.",
    ageGroup: "Ages 4-6",
    instructor: "Sensei Daniels",
  },
  {
    id: "youth-beginner",
    name: "Youth Beginner",
    description: "Skill-building karate practice for kids and teens.",
    ageGroup: "Ages 7-12",
    instructor: "Sensei Patel",
  },
  {
    id: "adult-beginner",
    name: "Adult Beginner",
    description: "Fitness, focus, and self-defense for adults.",
    ageGroup: "Adults",
    instructor: "Sensei Ramirez",
  },
];

function getNextDateForWeekday(referenceDate: Date, targetWeekday: number) {
  const date = new Date(referenceDate);
  const dayOffset = (targetWeekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function toIsoDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function buildWeeklySessions(referenceDate: Date = new Date()): SessionRecord[] {
  const thursday = getNextDateForWeekday(referenceDate, 4);
  const friday = getNextDateForWeekday(referenceDate, 5);
  const saturday = getNextDateForWeekday(referenceDate, 6);

  const schedule: Array<{ classId: string; date: Date; startTime: string; endTime: string; capacity: number }> = [
    { classId: "little-dragons", date: thursday, startTime: "17:30", endTime: "18:30", capacity: SESSION_CAPACITY },
    { classId: "little-dragons", date: friday, startTime: "17:30", endTime: "18:30", capacity: SESSION_CAPACITY },
    { classId: "youth-beginner", date: thursday, startTime: "18:45", endTime: "19:45", capacity: SESSION_CAPACITY },
    { classId: "youth-beginner", date: friday, startTime: "18:45", endTime: "19:45", capacity: SESSION_CAPACITY },
    { classId: "adult-beginner", date: saturday, startTime: "08:30", endTime: "09:30", capacity: SESSION_CAPACITY },
  ];

  return schedule.map((slot, index) => ({
    id: `${slot.classId}-${toIsoDate(slot.date)}-${index + 1}`,
    classId: slot.classId,
    date: toIsoDate(slot.date),
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
  }));
}

export function buildMonthlySessions(referenceDate: Date = new Date()): SessionRecord[] {
  const firstWeekStart = new Date(referenceDate);
  firstWeekStart.setDate(firstWeekStart.getDate() + 7);

  return Array.from({ length: 4 }, (_, index) => {
    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(weekStart.getDate() + index * 7);
    return buildWeeklySessions(weekStart);
  }).flat();
}

export const initialSessions: SessionRecord[] = buildWeeklySessions();

export const initialBookings: BookingRecord[] = [];

export type BaseClassAssignment = {
  name: string;
  parentEmail?: string;
  className?: string;
  baseClassDays?: string[];
  baseClassName?: string;
  classTime?: string;
  baseClassTime?: string;
};

function normalizeClassName(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized === "earlybirds" ? "earlybirds" : normalized;
}

function getStartMinute(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period) {
    hours %= 12;
    if (period === "PM") hours += 12;
  }
  return hours * 60 + minutes;
}

export function baseAssignmentMatchesSession(assignment: BaseClassAssignment, session: SessionRecord) {
  const sessionClassName = getSessionDisplayName(
    session,
    karateClasses.find((klass) => klass.id === session.classId)?.name ?? "Class",
  );
  const assignedClassName = assignment.baseClassName || assignment.className || "";
  if (normalizeClassName(assignedClassName) !== normalizeClassName(sessionClassName)) return false;

  const weekday = new Date(`${session.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
  if (!(assignment.baseClassDays ?? []).some((day) => day.toLowerCase() === weekday.toLowerCase())) return false;

  const assignedStart = getStartMinute(assignment.baseClassTime || assignment.classTime || "");
  const sessionStart = getStartMinute(session.startTime);
  return assignedStart !== null && assignedStart === sessionStart;
}

export function getSessionAvailability(
  session: SessionRecord,
  bookings: BookingRecord[],
  guestBookings: Array<{ sessionId: string; status?: string }> = [],
  baseAssignments: BaseClassAssignment[] = [],
) {
  const assignedStudents = new Map<string, BaseClassAssignment>();
  baseAssignments.forEach((assignment) => {
    if (!assignment.name.trim() || !baseAssignmentMatchesSession(assignment, session)) return;
    const key = `${assignment.parentEmail?.trim().toLowerCase() ?? ""}|${assignment.name.trim().toLowerCase()}`;
    assignedStudents.set(key, assignment);
  });

  const bookingsForSession = bookings.filter((booking) => booking.sessionId === session.id);
  const matchesAssignment = (booking: BookingRecord, assignment: BaseClassAssignment) =>
    booking.childName.trim().toLowerCase() === assignment.name.trim().toLowerCase() &&
    (!assignment.parentEmail || booking.parentEmail.trim().toLowerCase() === assignment.parentEmail.trim().toLowerCase());
  const hasCancelledOverride = (assignment: BaseClassAssignment) =>
    bookingsForSession.some((booking) => booking.status === "cancelled" && matchesAssignment(booking, assignment));
  const confirmedAssignments = [...assignedStudents.values()].filter((assignment) => !hasCancelledOverride(assignment));
  const additionalConfirmed = bookingsForSession.filter((booking) =>
    booking.status === "confirmed" &&
    ![...assignedStudents.values()].some((assignment) => matchesAssignment(booking, assignment)),
  ).length;

  const guestConfirmed = (guestBookings || []).filter(
    (guest) => guest.sessionId === session.id && (guest.status === "confirmed" || !guest.status),
  ).length;

  const confirmed = confirmedAssignments.length + additionalConfirmed + guestConfirmed;

  return {
    confirmed,
    open: Math.max(session.capacity - confirmed, 0),
    isFull: confirmed >= session.capacity,
  };
}

export function getSessionDisplayName(session: SessionRecord, fallbackName: string) {
  const weekday = new Date(`${session.date}T00:00:00`).getDay();

  if (weekday === 4 && session.startTime === "17:30") return "Class 1";
  if (weekday === 4 && session.startTime === "18:45") return "Class 2";
  if (weekday === 5 && session.startTime === "17:30") return "Class 3";
  if (weekday === 5 && session.startTime === "18:45") return "Class 4";
  if (weekday === 6) return "Early Birds";

  return fallbackName;
}

export function sortSessionsByDateTime(sessions: SessionRecord[]) {
  return [...sessions].sort((left, right) =>
    `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`),
  );
}

export function formatSessionLabel(session: SessionRecord) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
  };

  return `${new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}`;
}
