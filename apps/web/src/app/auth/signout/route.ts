import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Get the base URL for redirects
function getBaseUrl(request: NextRequest): string {
  // Try multiple sources for the URL
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const referer = request.headers.get("referer");
  
  if (origin) return origin;
  if (host) return host.includes("localhost") ? `http://${host}` : `https://${host}`;
  if (referer) {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {}
  }
  
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.blanklogo.app";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  const baseUrl = getBaseUrl(request);
  return NextResponse.redirect(new URL("/", baseUrl), { status: 303 });
}

// Handle GET requests (browser prefetch, direct navigation, form fallback)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  const baseUrl = getBaseUrl(request);
  return NextResponse.redirect(new URL("/", baseUrl), { status: 303 });
}
