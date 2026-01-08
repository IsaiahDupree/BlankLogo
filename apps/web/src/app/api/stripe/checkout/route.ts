import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

export async function POST(request: Request) {
  console.log("[STRIPE CHECKOUT] 🚀 Checkout request received");
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[STRIPE CHECKOUT] 👤 User:", user?.id || "NOT AUTHENTICATED");

  if (!user) {
    console.log("[STRIPE CHECKOUT] ❌ Unauthorized - no user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId, mode, event_id } = await request.json();
  console.log("[STRIPE CHECKOUT] 📦 Request:", { priceId, mode, event_id });

  if (!priceId) {
    console.log("[STRIPE CHECKOUT] ❌ Missing priceId");
    return NextResponse.json({ error: "Price ID required" }, { status: 400 });
  }

  // Validate the price ID
  const validPriceIds = Object.values(STRIPE_PRICE_IDS);
  console.log("[STRIPE CHECKOUT] ✅ Valid price IDs:", validPriceIds);
  
  if (!validPriceIds.includes(priceId)) {
    console.log("[STRIPE CHECKOUT] ❌ Invalid priceId:", priceId);
    return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
  }

  // Determine mode based on whether it's a subscription or one-time purchase
  const isSubscription = ["starter", "pro", "business"].some(
    (tier) => STRIPE_PRICE_IDS[tier as keyof typeof STRIPE_PRICE_IDS] === priceId
  );
  const checkoutMode = isSubscription ? "subscription" : "payment";

  try {
    // Check if user has a Stripe customer ID (try bl_profiles first, then profiles)
    let profile = null;
    const { data: blProfile } = await supabase
      .from("bl_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    
    if (blProfile) {
      profile = blProfile;
    } else {
      const { data: regularProfile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle();
      profile = regularProfile;
    }

    let customerId = profile?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to bl_profiles (upsert)
      await supabase
        .from("bl_profiles")
        .upsert({
          id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        });
    }

    // Create checkout session
    // Use APP_BASE_URL or fallback to NEXT_PUBLIC_APP_URL or default
    const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.blanklogo.app";
    
    console.log("[STRIPE CHECKOUT] 🔧 Creating session with:", {
      customerId,
      checkoutMode,
      priceId,
      baseUrl,
      successUrl: `${baseUrl}/app/credits?success=true`,
      cancelUrl: `${baseUrl}/app/credits?canceled=true`,
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: checkoutMode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/app/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/app/credits?canceled=true`,
      metadata: {
        user_id: user.id,
        event_id: event_id || '', // For Meta CAPI deduplication
      },
      ...(checkoutMode === "subscription" && {
        subscription_data: {
          metadata: {
            user_id: user.id,
            event_id: event_id || '',
          },
        },
      }),
    });

    console.log("[STRIPE CHECKOUT] ✅ Session created:", session.id, "URL:", session.url);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[STRIPE CHECKOUT] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: String(error) },
      { status: 500 }
    );
  }
}
