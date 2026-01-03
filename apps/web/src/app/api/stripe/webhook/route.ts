import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, CREDITS_BY_PACK, CREDITS_BY_SUBSCRIPTION, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(supabase, session);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(supabase, subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleCheckoutComplete(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error("No user_id in session metadata");
    return;
  }

  // One-time payment (credit pack)
  if (session.mode === "payment") {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const priceId = lineItems.data[0]?.price?.id;

    if (!priceId) return;

    // Find which pack this is
    const packKey = Object.entries(STRIPE_PRICE_IDS).find(
      ([, id]) => id === priceId
    )?.[0] as keyof typeof CREDITS_BY_PACK | undefined;

    if (packKey && packKey in CREDITS_BY_PACK) {
      const credits = CREDITS_BY_PACK[packKey as keyof typeof CREDITS_BY_PACK];

      // Add credits to user
      await supabase.from("credit_ledger").insert({
        user_id: userId,
        type: "purchase",
        amount: credits,
        note: `Purchased ${credits} credits (${packKey})`,
      });

      console.log(`Added ${credits} credits to user ${userId}`);
    }
  }

  // Subscription - credits are added on invoice.paid
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  // Get subscription ID from the first line item
  const firstLine = invoice.lines?.data?.[0];
  const subscription = firstLine?.subscription as string | undefined;
  if (!subscription) return;

  // Get subscription details
  const sub = await stripe.subscriptions.retrieve(subscription);
  const userId = sub.metadata?.user_id;
  if (!userId) return;

  const priceId = sub.items.data[0]?.price?.id;
  if (!priceId) return;

  // Find which tier this is
  const tierKey = Object.entries(STRIPE_PRICE_IDS).find(
    ([, id]) => id === priceId
  )?.[0] as keyof typeof CREDITS_BY_SUBSCRIPTION | undefined;

  if (tierKey && tierKey in CREDITS_BY_SUBSCRIPTION) {
    const credits = CREDITS_BY_SUBSCRIPTION[tierKey];

    // Add monthly credits
    await supabase.from("credit_ledger").insert({
      user_id: userId,
      type: "purchase",
      amount: credits,
      note: `Monthly ${tierKey} subscription credits`,
    });

    // Update user's subscription status
    await supabase.from("profiles").upsert({
      id: userId,
      subscription_tier: tierKey,
      subscription_status: "active",
      updated_at: new Date().toISOString(),
    });

    console.log(`Added ${credits} monthly credits to user ${userId} (${tierKey})`);
  }
}

async function handleSubscriptionCanceled(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  // Update user's subscription status
  await supabase.from("profiles").upsert({
    id: userId,
    subscription_tier: null,
    subscription_status: "canceled",
    updated_at: new Date().toISOString(),
  });

  console.log(`Subscription canceled for user ${userId}`);
}
