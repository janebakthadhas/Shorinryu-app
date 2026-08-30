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
    { classId: "little-dragons", date: thursday, startTime: "17:30", endTime: "18:30", capacity: 9 },
    { classId: "little-dragons", date: friday, startTime: "17:30", endTime: "18:30", capacity: 9 },
    { classId: "youth-beginner", date: thursday, startTime: "18:45", endTime: "19:45", capacity: 9 },
    { classId: "youth-beginner", date: friday, startTime: "18:45", endTime: "19:45", capacity: 9 },
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
  return Array.from({ length: 4 }, (_, index) => {
    const weekStart = new Date(referenceDate);
    weekStart.setDate(weekStart.getDate() + index * 7);
    return buildWeeklySessions(weekStart);
  }).flat();
}

export const initialSessions: SessionRecord[] = buildWeeklySessions();

export const initialBookings: BookingRecord[] = [
  {
    id: "booking-1",
    sessionId: initialSessions[0].id,
    parentName: "Maya Lee",
    parentEmail: "maya@example.com",
    parentPhone: "(555) 212-0011",
    childName: "Ava Lee",
    status: "confirmed",
  },
  {
    id: "booking-2",
    sessionId: initialSessions[0].id,
    parentName: "Daniel Price",
    parentEmail: "daniel@example.com",
    parentPhone: "(555) 212-0012",
    childName: "Leo Price",
    status: "confirmed",
  },
  {
    id: "booking-3",
    sessionId: initialSessions[2].id,
    parentName: "Priya Shah",
    parentEmail: "priya@example.com",
    parentPhone: "(555) 212-0033",
    childName: "Rohan Shah",
    status: "confirmed",
  },
  {
    id: "booking-4",
    sessionId: initialSessions[4].id,
    parentName: "Olivia Hart",
    parentEmail: "olivia@example.com",
    parentPhone: "(555) 212-0044",
    childName: "N/A",
    status: "confirmed",
  },
  {
    id: "booking-5",
    sessionId: initialSessions[4].id,
    parentName: "Evan Ross",
    parentEmail: "evan@example.com",
    parentPhone: "(555) 212-0045",
    childName: "N/A",
    status: "confirmed",
  },
  {
    id: "booking-6",
    sessionId: initialSessions[4].id,
    parentName: "Alicia Gomez",
    parentEmail: "alicia@example.com",
    parentPhone: "(555) 212-0046",
    childName: "N/A",
    status: "cancelled",
  },
];

export function getSessionAvailability(session: SessionRecord, bookings: BookingRecord[]) {
  const confirmed = bookings.filter(
    (booking) => booking.sessionId === session.id && booking.status === "confirmed",
  ).length;

  return {
    confirmed,
    open: Math.max(session.capacity - confirmed, 0),
    isFull: confirmed >= session.capacity,
  };
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
