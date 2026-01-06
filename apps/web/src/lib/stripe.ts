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

// Credit pack Stripe Price IDs (from Stripe Dashboard)
// These are the LIVE price IDs for BlankLogo
export const STRIPE_PRICE_IDS = {
  // One-time credit packs (BlankLogo)
  pack_10: process.env.STRIPE_PRICE_PACK_10 ?? "price_1Sm34mD7MP3Gp2rw8A8eImNp",   // $9 - 10 credits
  pack_25: process.env.STRIPE_PRICE_PACK_25 ?? "price_1Sm37mD7MP3Gp2rwdNEBy48s",   // $19 - 25 credits
  pack_50: process.env.STRIPE_PRICE_PACK_50 ?? "price_1Sm39BD7MP3Gp2rwpb5yacXu",   // $35 - 50 credits
  pack_100: process.env.STRIPE_PRICE_PACK_100 ?? "price_1Sm3BSD7MP3Gp2rwpAUsvejC", // $59 - 100 credits
  // Monthly subscription tiers (BlankLogo)
  starter: process.env.STRIPE_PRICE_STARTER ?? "price_1Sm35mD7MP3Gp2rwGHDyW88r",   // $9/mo - 10 credits
  pro: process.env.STRIPE_PRICE_PRO ?? "price_1Sm39fD7MP3Gp2rwyght0raR",           // $29/mo - 50 credits
  business: process.env.STRIPE_PRICE_BUSINESS ?? "price_1Sm3ArD7MP3Gp2rwltwUFlfz", // $79/mo - 200 credits
} as const;

// Map credits to pack IDs (one-time purchases)
export const CREDITS_BY_PACK = {
  pack_10: 10,
  pack_25: 25,
  pack_50: 50,
  pack_100: 100,
} as const;

// Map credits to subscription tiers (monthly)
export const CREDITS_BY_SUBSCRIPTION = {
  starter: 10,
  pro: 50,
  business: 200,
} as const;
