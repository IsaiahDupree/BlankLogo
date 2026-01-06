import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  console.log("[STRIPE PORTAL] 🚀 Portal request received");
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[STRIPE PORTAL] 👤 User:", user?.id || "NOT AUTHENTICATED");

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's Stripe customer ID (try bl_profiles first, then profiles)
  let profile = null;
  const { data: blProfile } = await supabase
    .from("bl_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  
  console.log("[STRIPE PORTAL] 📦 bl_profiles result:", blProfile);
  
  if (blProfile) {
    profile = blProfile;
  } else {
    const { data: regularProfile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    console.log("[STRIPE PORTAL] 📦 profiles result:", regularProfile);
    profile = regularProfile;
  }

  if (!profile?.stripe_customer_id) {
    console.log("[STRIPE PORTAL] ❌ No stripe_customer_id found");
    return NextResponse.json(
      { error: "No billing account found. Please make a purchase first." },
      { status: 404 }
    );
  }
  
  console.log("[STRIPE PORTAL] ✅ Found customer ID:", profile.stripe_customer_id);

  try {
    const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.blanklogo.app";
    console.log("[STRIPE PORTAL] 🔧 Creating portal session with baseUrl:", baseUrl);
    
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/app/credits`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
