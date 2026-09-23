import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  const setupToken = process.env.ADMIN_SETUP_TOKEN?.trim();
  const adminClient = getAdminClient();

  if (!setupToken || !adminClient) {
    return NextResponse.json({ error: "Admin setup is not enabled." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { setupToken?: string; email?: string; password?: string; fullName?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = body.fullName?.trim() || email?.split("@")[0] || "Admin";

    if (body.setupToken !== setupToken) {
      return NextResponse.json({ error: "Invalid setup token." }, { status: 401 });
    }

    if (!email || password.length < 8) {
      return NextResponse.json({ error: "Enter a valid email and a password of at least 8 characters." }, { status: 400 });
    }

    const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: "Unable to look up the admin account." }, { status: 500 });
    }

    const existingUser = users.users.find((user) => user.email?.toLowerCase() === email);
    let userId = existingUser?.id;

    if (existingUser) {
      const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: { ...existingUser.user_metadata, full_name: fullName, role: "admin" },
      });
      if (updateError) {
        return NextResponse.json({ error: "Unable to update the admin account." }, { status: 500 });
      }
    } else {
      const { data, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "admin" },
      });
      if (createError || !data.user) {
        return NextResponse.json({ error: "Unable to create the admin account." }, { status: 500 });
      }
      userId = data.user.id;
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({ id: userId, full_name: fullName, role: "admin" }, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json({ error: "The account was created, but its admin role could not be saved." }, { status: 500 });
    }

    return NextResponse.json({ message: "Admin account is ready. You can now sign in." });
  } catch {
    return NextResponse.json({ error: "Invalid setup request." }, { status: 400 });
  }
}