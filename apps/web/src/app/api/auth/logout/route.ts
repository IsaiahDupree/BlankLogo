import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Logout current session
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { scope } = await request.json().catch(() => ({ scope: "local" }));

    if (scope === "global") {
      // Logout all devices/sessions
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ message: "Logged out of all devices" });
    }

    // Local logout (current session only)
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
