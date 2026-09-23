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

export const karateClasses: ClassRecord[] = [
  {
    id: "little-dragons",
    name: "Class 1",
    description: "Thursday evening karate class.",
    ageGroup: "All ages",
    instructor: "Sensei Daniels",
  },
  {
    id: "youth-beginner",
    name: "Class 2",
    description: "Thursday evening karate class.",
    ageGroup: "All ages",
    instructor: "Sensei Patel",
  },
  {
    id: "adult-beginner",
    name: "Early Birds",
    description: "Saturday morning karate class.",
    ageGroup: "All ages",
    instructor: "Sensei Ramirez",
  },
  {
    id: "class-3",
    name: "Class 3",
    description: "Friday evening karate class.",
    ageGroup: "All ages",
    instructor: "Sensei Daniels",
  },
  {
    id: "class-4",
    name: "Class 4",
    description: "Friday evening karate class.",
    ageGroup: "All ages",
    instructor: "Sensei Patel",
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
    { classId: "little-dragons", date: thursday, startTime: "17:30", endTime: "18:30", capacity: 9 },
    { classId: "class-3", date: friday, startTime: "17:30", endTime: "18:30", capacity: 9 },
    { classId: "youth-beginner", date: thursday, startTime: "18:45", endTime: "19:45", capacity: 9 },
    { classId: "class-4", date: friday, startTime: "18:45", endTime: "19:45", capacity: 9 },
    { classId: "adult-beginner", date: saturday, startTime: "08:30", endTime: "09:30", capacity: 9 },
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

export function getSessionAvailability(
  session: SessionRecord,
  bookings: BookingRecord[],
  guestBookings: Array<{ sessionId: string; status?: string }> = [],
) {
  const parentConfirmed = bookings.filter(
    (booking) => booking.sessionId === session.id && booking.status === "confirmed",
  ).length;

  const guestConfirmed = (guestBookings || []).filter(
    (guest) => guest.sessionId === session.id && (guest.status === "confirmed" || !guest.status),
  ).length;

  const confirmed = parentConfirmed + guestConfirmed;

  return {
    confirmed,
    open: Math.max(session.capacity - confirmed, 0),
    isFull: confirmed >= session.capacity,
  };
}

export function getSessionDisplayName(session: SessionRecord, fallbackName: string) {
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
