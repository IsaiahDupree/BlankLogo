import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: credits } = await supabase.rpc("get_credit_balance", { 
      p_user_id: user.id 
    });

    return NextResponse.json({ credits: credits ?? 0 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}
