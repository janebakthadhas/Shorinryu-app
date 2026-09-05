import { createClient } from "@supabase/supabase-js";
import type { BookingRecord } from "@/lib/mock-data";

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

  const metadataRole = session.user.user_metadata?.role;
  if (metadataRole === "admin" || metadataRole === "parent") {
    return metadataRole;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
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
    .eq("parent_email", parentEmail)
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSupabaseBooking({
  sessionId,
  parentName,
  parentEmail,
  parentPhone,
  childName,
}: {
  sessionId: string;
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  childName: string;
}): Promise<{ ok: boolean; bookingId?: string; message?: string }> {
  if (!supabase) {
    return { ok: true, message: "Supabase not configured; using demo mode." };
  }

  if (!UUID_REGEX.test(sessionId)) {
    return { ok: true, message: "Local session ID used." };
  }

  const { data, error } = await supabase.rpc("book_slot", {
    p_session_id: sessionId,
    p_parent_name: parentName,
    p_parent_email: parentEmail,
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
}: {
  bookingId: string;
  sessionId: string;
  childName: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: true, message: "Supabase not configured; using demo mode." };
  }

  if (!UUID_REGEX.test(bookingId) || !UUID_REGEX.test(sessionId)) {
    return { ok: true, message: "Local ID used." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ session_id: sessionId, child_name: childName })
    .eq("id", bookingId);

  if (error) {
    return { ok: false, message: error.message || "Unable to update booking." };
  }

  return { ok: true };
}
