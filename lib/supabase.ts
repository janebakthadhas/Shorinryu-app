import { createClient } from "@supabase/supabase-js";
import { karateClasses, type BookingRecord, type SessionRecord } from "@/lib/mock-data";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const normalizedSupabaseUrl = rawSupabaseUrl
  ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "")
  : undefined;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(normalizedSupabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(normalizedSupabaseUrl!, supabaseAnonKey!)
  : null;

export const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim() || "admin@shorinryu.local";
export const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "admin123";

export async function getSupabaseUserRole(): Promise<"admin" | "parent" | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    const metadataRole = session.user.user_metadata?.role;
    return metadataRole === "admin" || metadataRole === "parent" ? metadataRole : null;
  }

  return data.role === "admin" || data.role === "parent" ? data.role : null;
}

export type SupabaseBookingRow = {
  id: string;
  session_id: string;
  parent_name: string;
  parent_email: string;
  parent_phone?: string | null;
  child_name: string;
  status: "confirmed" | "cancelled";
  created_at?: string;
};

export function mapSupabaseBooking(row: SupabaseBookingRow): BookingRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    parentPhone: row.parent_phone ?? undefined,
    childName: row.child_name,
    status: row.status,
  };
}

export async function getSupabaseBookingsForParent(parentEmail: string): Promise<BookingRecord[]> {
  if (!supabase || !parentEmail) {
    return [];
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .ilike("parent_email", parentEmail)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as SupabaseBookingRow[]).map(mapSupabaseBooking);
}

export async function getSupabaseBookings(): Promise<BookingRecord[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as SupabaseBookingRow[]).map(mapSupabaseBooking);
}

export async function getSupabaseSessions(): Promise<SessionRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sessions")
    .select("id, class_id, session_date, start_time, end_time, capacity, classes(name)")
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    class_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    capacity: number;
    classes?: { name?: string } | { name?: string }[] | null;
  }>).map((row) => {
    const relatedClass = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const classInfo = karateClasses.find((klass) => klass.name === relatedClass?.name);

    return {
    id: row.id,
    classId: classInfo?.id ?? row.class_id,
    date: row.session_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    capacity: row.capacity,
    };
  });
}

export type SupabaseStudentRecord = {
  id: string;
  name: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  belt: string;
  baseClassDays: string[];
  baseClassName: string;
  baseClassTime: string;
};

export async function getSupabaseStudents(): Promise<SupabaseStudentRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.from("students").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    parentName: String(row.parent_name),
    parentEmail: String(row.parent_email),
    parentPhone: row.parent_phone ? String(row.parent_phone) : undefined,
    belt: String(row.belt ?? "White"),
    baseClassDays: Array.isArray(row.base_class_days) ? row.base_class_days.map(String) : [],
    baseClassName: String(row.base_class_name),
    baseClassTime: String(row.base_class_time),
  }));
}

export async function createSupabaseStudent(student: Omit<SupabaseStudentRecord, "id">): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: true };

  const { error } = await supabase.from("students").insert({
    name: student.name,
    parent_name: student.parentName,
    parent_email: student.parentEmail,
    parent_phone: student.parentPhone ?? null,
    belt: student.belt,
    base_class_days: student.baseClassDays,
    base_class_name: student.baseClassName,
    base_class_time: student.baseClassTime,
  });

  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function createSupabaseBookingAsAdmin(booking: Omit<BookingRecord, "id">): Promise<{ ok: boolean; bookingId?: string; message?: string }> {
  if (!supabase) return { ok: true };

  const { data, error } = await supabase.from("bookings").insert({
    session_id: booking.sessionId,
    parent_name: booking.parentName,
    parent_email: booking.parentEmail,
    parent_phone: booking.parentPhone ?? null,
    child_name: booking.childName,
    status: booking.status,
  }).select("id").single();

  return error ? { ok: false, message: error.message } : { ok: true, bookingId: data?.id };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSupabaseBooking({
  sessionId,
  parentName,
  parentPhone,
  childName,
}: {
  sessionId: string;
  parentName: string;
  parentPhone?: string;
  childName: string;
}): Promise<{ ok: boolean; bookingId?: string; message?: string }> {
  if (!supabase) {
    return { ok: true, message: "Supabase not configured; using demo mode." };
  }

  if (!UUID_REGEX.test(sessionId)) {
    return { ok: true, message: "Local session ID used." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authenticatedEmail = session?.user.email;

  if (!authenticatedEmail) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }

  const { data, error } = await supabase.rpc("book_slot", {
    p_session_id: sessionId,
    p_parent_name: parentName,
    p_parent_email: authenticatedEmail,
    p_parent_phone: parentPhone ?? null,
    p_child_name: childName,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Unable to create booking.",
    };
  }

  return {
    ok: true,
    bookingId: typeof data === "string" ? data : data ?? undefined,
  };
}

export async function cancelSupabaseBooking(bookingId: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: true, message: "Supabase not configured; using demo mode." };
  }

  if (!UUID_REGEX.test(bookingId)) {
    return { ok: true, message: "Local booking ID used." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);

  if (error) {
    return {
      ok: false,
      message: error.message || "Unable to cancel booking.",
    };
  }

  return { ok: true };
}

export async function updateSupabaseBooking({
  bookingId,
  sessionId,
  childName,
  status,
}: {
  bookingId: string;
  sessionId: string;
  childName: string;
  status?: BookingRecord["status"];
}): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: true, message: "Supabase not configured; using demo mode." };
  }

  if (!UUID_REGEX.test(bookingId) || !UUID_REGEX.test(sessionId)) {
    return { ok: true, message: "Local ID used." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ session_id: sessionId, child_name: childName, ...(status ? { status } : {}) })
    .eq("id", bookingId);

  if (error) {
    return { ok: false, message: error.message || "Unable to update booking." };
  }

  return { ok: true };
}
