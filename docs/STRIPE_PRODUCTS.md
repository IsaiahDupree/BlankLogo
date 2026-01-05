# Stripe Products & Prices Setup

## Product Details for Stripe Dashboard

### Monthly Subscription Plans

#### 1. Starter Plan
- **Product Name:** BlankLogo Starter
- **Description:** 10 video credits per month. Perfect for occasional watermark removal needs.
- **Type:** Recurring
- **Billing Period:** Monthly
- **Price:** $9.00 USD
- **Price ID to use:** `price_starter`
- **Metadata:**
  - `credits`: `10`
  - `tier`: `starter`

#### 2. Pro Plan (Most Popular)
- **Product Name:** BlankLogo Pro
- **Description:** 50 video credits per month. Ideal for content creators and small teams.
- **Type:** Recurring
- **Billing Period:** Monthly
- **Price:** $29.00 USD
- **Price ID to use:** `price_pro`
- **Metadata:**
  - `credits`: `50`
  - `tier`: `pro`

#### 3. Business Plan
- **Product Name:** BlankLogo Business
- **Description:** 200 video credits per month. Built for agencies and high-volume users with API access.
- **Type:** Recurring
- **Billing Period:** Monthly
- **Price:** $79.00 USD
- **Price ID to use:** `price_business`
- **Metadata:**
  - `credits`: `200`
  - `tier`: `business`

---

### One-Time Credit Packs

#### 4. 10 Credits Pack
- **Product Name:** 10 Video Credits
- **Description:** One-time purchase of 10 video credits. Credits never expire.
- **Type:** One-time
- **Price:** $9.00 USD
- **Price ID to use:** `price_pack_10`
- **Metadata:**
  - `credits`: `10`
  - `pack_id`: `pack_10`

#### 5. 25 Credits Pack
- **Product Name:** 25 Video Credits
- **Description:** One-time purchase of 25 video credits. Credits never expire. Best value per credit.
- **Type:** One-time
- **Price:** $19.00 USD
- **Price ID to use:** `price_pack_25`
- **Metadata:**
  - `credits`: `25`
  - `pack_id`: `pack_25`

#### 6. 50 Credits Pack
- **Product Name:** 50 Video Credits
- **Description:** One-time purchase of 50 video credits. Credits never expire. Great for bulk processing.
- **Type:** One-time
- **Price:** $35.00 USD
- **Price ID to use:** `price_pack_50`
- **Metadata:**
  - `credits`: `50`
  - `pack_id`: `pack_50`

#### 7. 100 Credits Pack
- **Product Name:** 100 Video Credits
- **Description:** One-time purchase of 100 video credits. Credits never expire. Maximum savings.
- **Type:** One-time
- **Price:** $59.00 USD
- **Price ID to use:** `price_pack_100`
- **Metadata:**
  - `credits`: `100`
  - `pack_id`: `pack_100`

---

## Product Image

Use this image URL for all products:
```
https://www.blanklogo.app/og-image.png
```

Or create a simple product image with:
- **Background:** Dark gradient (blue to purple)
- **Logo:** White "B" in a rounded square
- **Text:** "BlankLogo" in white
- **Dimensions:** 1200x630px (recommended for Stripe)

---

## Setup Instructions

### 1. Go to Stripe Dashboard
```
https://dashboard.stripe.com/products
```

### 2. Create Each Product
For each product above:

1. Click **"+ Add product"**
2. Fill in:
   - **Name:** (from list above)
   - **Description:** (from list above)
   - **Image:** Upload or use URL
3. Under **Pricing:**
   - **Price:** (from list above)
   - **Billing period:** One time OR Recurring (monthly)
   - **Currency:** USD
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_`)
6. **Important:** Rename the Price ID to match the expected ID:
   - Click on the price
   - Click "..." menu → "Update price ID"
   - Change to the ID listed above (e.g., `price_starter`)

### 3. Add to Vercel Environment Variables

After creating all products, add these to Vercel:

```
STRIPE_PRICE_PACK_10=price_pack_10
STRIPE_PRICE_PACK_25=price_pack_25
STRIPE_PRICE_PACK_50=price_pack_50
STRIPE_PRICE_PACK_100=price_pack_100
STRIPE_PRICE_STARTER=price_starter
STRIPE_PRICE_PRO=price_pro
STRIPE_PRICE_BUSINESS=price_business
```

---

## Quick Copy for Stripe

### Subscription Plans

**Starter:**
- Name: `BlankLogo Starter`
- Description: `10 video credits per month. Perfect for occasional watermark removal needs.`
- Price: `$9.00 USD/month`

**Pro:**
- Name: `BlankLogo Pro`
- Description: `50 video credits per month. Ideal for content creators and small teams.`
- Price: `$29.00 USD/month`

**Business:**
- Name: `BlankLogo Business`
- Description: `200 video credits per month. Built for agencies and high-volume users with API access.`
- Price: `$79.00 USD/month`

### Credit Packs

**10 Credits:**
- Name: `10 Video Credits`
- Description: `One-time purchase of 10 video credits. Credits never expire.`
- Price: `$9.00 USD`

**25 Credits:**
- Name: `25 Video Credits`
- Description: `One-time purchase of 25 video credits. Credits never expire. Best value per credit.`
- Price: `$19.00 USD`

**50 Credits:**
- Name: `50 Video Credits`
- Description: `One-time purchase of 50 video credits. Credits never expire. Great for bulk processing.`
- Price: `$35.00 USD`

**100 Credits:**
- Name: `100 Video Credits`
- Description: `One-time purchase of 100 video credits. Credits never expire. Maximum savings.`
- Price: `$59.00 USD`
