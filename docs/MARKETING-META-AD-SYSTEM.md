# BlankLogo Meta Ad System

> Complete creative system for Meta ads: placements, formats, 12-ad launch set, campaign structure, kill rules, and weekly creative machine.

---

## 1. Meta Creative Rules for BlankLogo

### The "3-Second Contract"

Your ad must communicate in ~3 seconds:
- **What it does:** removes watermarks from videos
- **Why trust it:** ad-free premium + quality preserved
- **What to do:** upload → done

### On-Screen Text Constraints (Reels/Stories)

- **6–10 words max** on the main overlay
- **1 badge max** (Ad-Free / HQ / No Install)
- CTA should be "Upload Video" or "Remove Watermark"

### Avoid These (Cause Drop-off)

- "AI magic" vibes with no proof
- Too much technical detail (crop sizes, px)
- Over-promising ("perfect," "100%," "any watermark anywhere")

---

## 2. Formats to Render (Meta-First)

Render every winning concept in 3 aspect ratios:

| Ratio | Placement | Notes |
|-------|-----------|-------|
| **9:16** | Reels/Stories | Highest volume / lowest CPM |
| **4:5** | Feed | Often best conversion efficiency |
| **1:1** | Feed | Still useful, but 4:5 usually beats it |

**If you only do two:** 9:16 + 4:5

---

## 3. The 12-Ad Launch Set (Built for Meta)

Balanced: 6 problem-aware + 6 solution-aware across best static templates.

### Template A — Before/After Split (4 ads)

#### A1 (Problem-Aware)
- **Overlay:** Watermark ruins it. / Fix it fast.
- **Badge:** Ad-Free
- **Primary text:** "That watermark is killing the clip. Upload → clean export → download."
- **Headline:** Remove Watermarks Fast

#### A2 (Problem-Aware)
- **Overlay:** Posting today? / Lose the watermark.
- **Badge:** HQ Output
- **Primary text:** "Turn 'can't post this' into 'ready to publish'."
- **Headline:** Ready to Post

#### A3 (Solution-Aware)
- **Overlay:** Tried other sites? / Stop getting blurry.
- **Badge:** Quality-First
- **Primary text:** "If the usual tools ruin your export, try a premium workflow built for clean results."
- **Headline:** Built to Avoid the Usual

#### A4 (Solution-Aware)
- **Overlay:** No 'HD' bait-and-switch.
- **Badge:** No Re-Encode
- **Primary text:** "Quality preserved. Audio intact. Clean export."
- **Headline:** Quality Preserved

---

### Template B — Comparison Card (4 ads)

#### B1 (Solution-Aware)
- **Overlay header:** Typical sites vs BlankLogo
- **Left bullets:** Ads • Blur • Fake progress
- **Right bullets:** Ad-Free • Clean • Fast
- **Primary text:** "Built to avoid the usual: ad walls, blurry exports, random failures."
- **Headline:** Premium Utility

#### B2 (Solution-Aware)
- **Left:** "Wait timers + popups"
- **Right:** "Ad-free premium flow"
- **Primary text:** "No popups. No nonsense. Just upload and go."
- **Headline:** Ad-Free Removal

#### B3 (Problem-Aware)
- **Left:** "Redo the whole edit"
- **Right:** "Remove watermark fast"
- **Primary text:** "Don't re-edit everything. Clean export in minutes."
- **Headline:** Fast Fix

#### B4 (Retargeting)
- **Left:** "Sketchy sites"
- **Right:** "Built like a real tool"
- **Primary text:** "Clear status → done → download. Not a sketchy site."
- **Headline:** Reliable Workflow

---

### Template C — UI Proof / 3-Step Flow (4 ads)

#### C1 (Problem-Aware)
- **Overlay:** Upload → Remove → Download
- **Badge:** Simple
- **Primary text:** "No installs. Just upload your video and get a clean version back."
- **Headline:** Works in Browser

#### C2 (Problem-Aware)
- **Overlay:** Processing… Done.
- **Badge:** Fast
- **Primary text:** "When you need a clean clip today."
- **Headline:** Remove Now

#### C3 (Solution-Aware)
- **Overlay:** Skip the ad spam.
- **Badge:** Ad-Free
- **Primary text:** "Premium experience. No popups. No wait games."
- **Headline:** Ad-Free Premium

#### C4 (Retargeting / Most-Aware)
- **Overlay:** 10 free credits (one-time)
- **Badge:** No card
- **Primary text:** "Try it without a credit card. See if it earns a bookmark."
- **Headline:** Start Free

---

## 4. Campaign Structure (Meta Testing)

### Phase A — Creative-First Testing (ABO)

| Setting | Value |
|---------|-------|
| **Campaign** | Purchases (or InitiateCheckout if volume too low) |
| **Ad Set** | 1 (Broad) |
| **Geo** | US, 18–44 (or 18–54 for more volume) |
| **Placements** | Advantage+ ON |
| **Ads** | 12 ads from launch set |
| **Targeting** | No interest targeting (creative does the work) |

**Why:** One audience, one optimization, only creative changes → fastest signal.

---

## 5. Kill Rules (Simple + Ruthless)

Use relative winners/losers inside the same ad set.

### Kill If:
- CTR(link) is clearly bottom-tier vs the rest
- High clicks but near-zero ViewContent → InitiateCheckout rate compared to peers
- Comments show trust fail: "scam?" or "doesn't work"

### Keep / Scale If:
- Top CTR(link) and strong downstream intent (IC / Purchase)
- Comments show recognition: "I need this", "finally", "bookmarking"

---

## 6. Retargeting (Prints Money Once You Have Traffic)

### Retargeting Ad Set (7–14 Day Window)

**Audience:**
- ViewContent
- InitiateCheckout
- SignUp
- *Exclude Purchasers*

**Run 3 Creatives:**
1. **10 free credits (one-time)** (C4)
2. **Risk reversal:** "Job fails? credit refunded."
3. **Mode clarity:** "Crop edges fast / Inpaint when needed"

---

## 7. Pixel Events to Fire

### Minimum Events:
- `PageView`
- `ViewContent` (landing/pricing)
- `SignUp` (account created)
- `InitiateCheckout` (start payment / confirm plan)
- `Purchase` (successful payment)

### Pass These Parameters:
- `value`, `currency`
- `plan_name` / `product_type` (subscription vs top-up)
- `credits_purchased`
- `mode_used` (crop/inpaint) as custom parameter

---

## 8. Creative Production Checklist

### Screenshots to Capture:
- 6–10 "before" frames (watermark obvious)
- 6–10 "after" frames (clean)
- UI: Upload screen, Processing screen, Done/Download screen
- Pricing/credits screen (for retargeting)
- 1 "supported platforms" visual (icons/logos list)

### Consistent Design System:
- Same font
- Same badge style (Ad-Free / HQ / No Install)
- Same CTA style (Upload Video)

**Consistency = trust.**

---

## 9. Weekly Creative Machine

### Ship Every Week:
- 2 new Before/After
- 2 new Comparison
- 2 new UI Proof / Flow
- 2 new Retargeting variants

### Rotate Hooks (Not Whole Design):
- "Skip ad spam"
- "Stop blurry exports"
- "Posting today?"
- "Client deliverable"
- "No re-encode / quality preserved"
- "10 free credits (one-time)"

---

## 10. 24 Full Ad Concepts

### Problem-Aware (12)

| ID | Template | Overlay | Badge | Primary Text | Headline |
|----|----------|---------|-------|--------------|----------|
| PA-01 | Before/After | Watermark ruins it. / Fix it fast. | Ad-Free | "That watermark is killing the clip. Upload → clean export → download." | Remove Watermarks Fast |
| PA-02 | 3-Step | Upload → Remove → Download | Simple | "No apps. No drama. Get a clean version back fast." | Clean Video in Minutes |
| PA-03 | UI Proof | Processing… Done. | Fast | "When you need a clean clip today." | Remove Watermark Now |
| PA-04 | Checklist | Removed ✅ / Audio ✅ / No Ads ✅ | Premium | "Built for creators who post daily. Simple and clean." | Ad-Free Watermark Removal |
| PA-05 | Zoom | Delete this watermark. | HQ | "Stop reposting with a watermark. Clean export in a few steps." | Clean Export |
| PA-06 | Urgency | Client wants it today. | Premium | "Don't redo the edit. Remove the watermark and ship it." | Fast Fix for Deliverables |
| PA-07 | Browser | No installs. No plugins. | Simple | "Just upload your video and get a clean version back." | Works in Browser |
| PA-08 | Quality | Keep it crisp. | HQ Output | "Quality preserved—no re-encode. Audio stays intact." | Original Quality Preserved |
| PA-09 | Bookmark | The tool you bookmark. | Ad-Free | "Because watermarks always show up at the worst time." | Remove Watermarks Anytime |
| PA-10 | Timer | Minutes, not hours. | Fast | "Fast processing designed for quick posting workflows." | Fast Processing |
| PA-11 | Posting | Posting today? / Lose the watermark. | Fast | "Turn 'can't post this' into 'ready to publish'." | Ready to Post |
| PA-12 | Premium | Premium. Ad-free. Clean. | Premium | "No popups. No fake progress. Just a clean export." | Premium Utility |

### Solution-Aware (12)

| ID | Template | Overlay | Badge | Primary Text | Headline |
|----|----------|---------|-------|--------------|----------|
| SA-01 | Comparison | Typical sites: ads + blur / BlankLogo: clean + ad-free | Premium | "If the usual tools keep ruining your export, try a premium workflow." | Built to Avoid the Usual |
| SA-02 | Confession | Tried 3 sites. / Still blurry. | HQ Output | "Stop wasting time. Clean export, premium experience." | Finally Works |
| SA-03 | No Ads | Skip the ad spam. | Ad-Free | "No popups. No timers. Just upload and go." | Ad-Free Removal |
| SA-04 | Quality | No "HD" lies. | Quality-First | "Quality preserved. Audio intact. Clean output." | Quality-First |
| SA-05 | Reliability | No silent failures. | Reliable | "Clear status → done → download. Built like a real tool." | Reliable Workflow |
| SA-06 | Mode | Crop fast. / Inpaint when needed. | Premium | "Pick the mode that fits your clip. Premium results either way." | Crop + Inpaint |
| SA-07 | No WM | No new watermark. | Premium | "Clean export—ready to post." | Clean Export |
| SA-08 | Creator | Built for creators. | Premium | "Not a random tool pile. A focused watermark removal utility." | Creator-Built Tool |
| SA-09 | Detection | Detected: TikTok / Done. | HQ | "Auto-detect watermark type → apply best settings → export." | Auto-Detect & Remove |
| SA-10 | Privacy | Private by default. | Secure | "Auto-delete after 7 days. We don't share content." | Private & Secure |
| SA-11 | Speed | Fast when it matters. | Fast | "Most small files finish quickly. No waiting rooms." | Fast Processing |
| SA-12 | Retarget | You were this close. | Ad-Free | "Start with 10 free credits (one-time). See if it earns a bookmark." | Try It Free |

---

## 11. Landing Page Copy Recommendations

### Hero (Above the Fold)

**H1:** Remove Watermarks From AI Videos — Fast, Clean, Ad-Free

**Subhead:** Upload a video (or paste a link). BlankLogo automatically detects the platform watermark and applies the best edge-crop preset to deliver a clean export—no re-encoding, no quality loss.

**Trust bullets:**
- 5–15s processing for most small files
- Original quality preserved (no re-encode)
- Ad-free premium experience
- Private by default (auto-delete)

**Primary CTA:** Remove Watermark
**Secondary CTA:** See How It Works

**Microcopy under CTA:** Start with 10 free credits (one-time). No credit card required.

### "Works Best When" (Tiny Line for Trust)

> Works best when watermarks sit on the edges (like Sora/TikTok). If a watermark overlaps your subject, cropping may reduce framing.

---

## 12. Pricing Page Copy Recommendations

### Hero

**H2:** Simple, Credit-Based Pricing

Pay only for what you use. 1 credit = 1 video processed.
Choose a monthly plan for ongoing use—or buy credits as needed.

**Start with 10 free credits (one-time). No credit card required.**

### Plan Descriptions

**Starter — $9/mo**
> Best for: creators who only need watermark removal occasionally.

**Pro — $29/mo (Most Popular)**
> Best for: people posting weekly (or working with clients).
> "Most creators land here once they try Inpaint."

**Business — $79/mo**
> Best for: teams, agencies, and high-volume workflows.

### Top-Up Framing

> Need credits without a monthly plan?
> Grab a pack. Credits never expire. Keep them for the next time a watermark tries to ruin a post.

---

## 13. Consistent "Free Credits" Language

**Use everywhere:**

> "10 free credits (one-time). No credit card required."

Or shorter:

> "10 free credits (one-time). No card."
