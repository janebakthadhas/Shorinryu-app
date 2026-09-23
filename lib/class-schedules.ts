export type BaseClassAssignment = {
  studentId: string;
  classId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
};

export type AdditionalClassAssignment = BaseClassAssignment & {
  id: string;
  startDate: string;
  endDate: string;
  status: "confirmed" | "cancelled";
};

export type ScheduleOverride = {
  id: string;
  studentId: string;
  overrideDate: string;
  classId?: string;
  startTime?: string;
  endTime?: string;
  action: "replace" | "cancel";
  reason?: string;
};

export function formatWeekdays(weekdays: number[]) {
  return weekdays
    .slice()
    .sort((left, right) => left - right)
    .map((day) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] ?? "Day")
    .join(" & ");
}

export function scheduleDaysLabel(schedule: BaseClassAssignment) {
  return `${formatWeekdays(schedule.weekdays)}, ${schedule.startTime}–${schedule.endTime}`;
}