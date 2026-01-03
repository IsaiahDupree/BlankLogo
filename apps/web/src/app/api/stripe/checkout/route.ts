import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { CREDIT_PACKS, PRICING_TIERS } from "@canvascast/shared";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId, mode } = await request.json();

  if (!priceId) {
    return NextResponse.json({ error: "Price ID required" }, { status: 400 });
  }

  // Validate the price ID
  const validPriceIds = Object.values(STRIPE_PRICE_IDS);
  if (!validPriceIds.includes(priceId)) {
    return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
  }

  // Determine mode based on whether it's a subscription or one-time
  const isSubscription = ["starter", "pro", "creator_plus"].some(
    (tier) => STRIPE_PRICE_IDS[tier as keyof typeof STRIPE_PRICE_IDS] === priceId
  );

  const checkoutMode = mode ?? (isSubscription ? "subscription" : "payment");

  try {
    // Check if user has a Stripe customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

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

      // Save customer ID to profile (upsert)
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        });
    }

    // Create checkout session
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
      success_url: `${process.env.APP_BASE_URL}/app/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_BASE_URL}/app/credits?canceled=true`,
      metadata: {
        user_id: user.id,
      },
      ...(checkoutMode === "subscription" && {
        subscription_data: {
          metadata: {
            user_id: user.id,
          },
        },
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
