import Stripe from "stripe";

// Lazy initialization to avoid build-time errors when API key is not set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(apiKey, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// Export for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return getStripe()[prop as keyof Stripe];
  }
});

// Credit pack Stripe Price IDs (create these in Stripe Dashboard)
export const STRIPE_PRICE_IDS = {
  pack_25: process.env.STRIPE_PRICE_PACK_25 ?? "price_pack_25",
  pack_80: process.env.STRIPE_PRICE_PACK_80 ?? "price_pack_80",
  pack_250: process.env.STRIPE_PRICE_PACK_250 ?? "price_pack_250",
  pack_500: process.env.STRIPE_PRICE_PACK_500 ?? "price_pack_500",
  // Subscription tiers
  starter: process.env.STRIPE_PRICE_STARTER ?? "price_starter",
  pro: process.env.STRIPE_PRICE_PRO ?? "price_pro",
  creator_plus: process.env.STRIPE_PRICE_CREATOR_PLUS ?? "price_creator_plus",
} as const;

// Map credits to pack IDs
export const CREDITS_BY_PACK = {
  pack_25: 25,
  pack_80: 80,
  pack_250: 250,
  pack_500: 500,
} as const;

export const CREDITS_BY_SUBSCRIPTION = {
  starter: 60,
  pro: 200,
  creator_plus: 500,
} as const;
