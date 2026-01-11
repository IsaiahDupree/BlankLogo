import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  // Use request origin for proper redirect in production
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://www.blanklogo.app";
  return NextResponse.redirect(new URL("/", origin));
}

// Handle GET requests (browser prefetch, direct navigation)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://www.blanklogo.app";
  return NextResponse.redirect(new URL("/", origin));
}
