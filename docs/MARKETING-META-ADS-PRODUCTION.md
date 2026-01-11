# BlankLogo Meta Ads Production Guide

> Plug-and-play pack for Remotion templates + Meta testing structure

---

## 1. 20 Production-Ready Static Ad Overlays

### Overlay Readability Rules

- **Line 1 (hook):** 3–6 words
- **Line 2 (proof/benefit):** 3–7 words
- **Badge (optional):** "Ad-Free" / "HQ Output" / "No Install"
- **CTA button text:** "Upload Video" / "Try Now" / "Remove Watermark"

---

### A) Problem-Aware (10)

| # | Line 1 | Line 2 | Badge |
|---|--------|--------|-------|
| 1 | Watermark ruins it. | Fix it fast. | Ad-Free |
| 2 | Don't repost with this. | Remove the watermark. | HQ Output |
| 3 | Client needs it today. | Clean export, quick. | Premium |
| 4 | That logo has to go. | Get a clean clip. | No Install |
| 5 | Stop re-editing everything. | Just remove the mark. | Simple 3-step |
| 6 | Your video is fire… | The watermark isn't. | Ad-Free |
| 7 | Posting today? | Lose the watermark. | Fast |
| 8 | Don't let this tank views. | Clean it up. | HQ Output |
| 9 | Watermark = instant "skip." | Fix it in minutes. | Ad-Free |
| 10 | Make it look original. | Remove the watermark. | Premium |

---

### B) Solution-Aware (10)

| # | Line 1 | Line 2 | Badge |
|---|--------|--------|-------|
| 11 | Tried other sites? | Stop getting blurry. | HQ Output |
| 12 | Skip the ad spam. | Premium removal. | Ad-Free |
| 13 | No "fake progress" BS. | Real output. | Reliable |
| 14 | Most tools ruin quality. | We don't. | Quality-First |
| 15 | No new watermark. | Just clean video. | Premium |
| 16 | If it failed before… | Try the clean option. | Ad-Free |
| 17 | Stop settling for smears. | Cleaner removal. | HQ Output |
| 18 | No installs. No plugins. | Upload → Done. | Simple |
| 19 | Built like a real tool. | Not a sketchy site. | Premium |
| 20 | The one you bookmark. | Because it works. | Ad-Free |

---

### CTA Button Options (rotate)

- Upload Video
- Remove Watermark
- Try BlankLogo
- Get Clean Export
- Start Now

---

## 2. Primary Text + Headline + Description

### Problem-Aware Primary Text (pick 1 per ad)

- "That watermark is killing the clip. Upload → clean it → download."
- "Don't redo the edit. Remove the watermark and keep your quality."
- "Fast, simple, and ad-free. Built for creators who post daily."
- "Turn a 'can't post this' video into a clean export."
- "Clean clip, no nonsense. Just upload and go."

### Solution-Aware Primary Text

- "If the usual sites keep ruining your export, try a premium tool built for clean results."
- "No ad walls. No gimmicks. Just clean watermark removal."
- "Stop getting blurry patches. Quality-first output."
- "Built to avoid the usual: ads, low-quality exports, and fails."
- "Ad-free premium flow: Upload → Process → Download."

### Headlines (Meta headline field)

- Remove Watermarks From Videos
- Clean Export (Ad-Free)
- Premium Watermark Removal
- Keep Your Video Quality
- Upload → Remove → Download

### Descriptions (small text under headline)

- No installs • Ad-Free
- Quality-first output
- Built for creators

---

## 3. Remotion Template Kit

Build 5 templates and swap screenshot + text:

### 1) BeforeAfterSplit
- Wipe reveal divider
- Labels: BEFORE / AFTER

### 2) ThreeStepFlow
- Cards: Upload → Remove → Download
- Small timer icon ("minutes")

### 3) ComparisonCard
- Left: "Typical sites"
- Right: "BlankLogo"
- 3 bullets each (short)

### 4) UIProof
- Screenshot of your app
- Highlight box around "Download" / "Done"

### 5) ReceiptChecklist
- Removed ✅
- HQ ✅
- Ad-Free ✅
- Done ✅

### Production Trick

Make a JSON file with fields:
```json
{
  "hookLine1": "Watermark ruins it.",
  "hookLine2": "Fix it fast.",
  "badge": "Ad-Free",
  "cta": "Upload Video",
  "primaryText": "That watermark is killing the clip...",
  "headline": "Remove Watermarks From Videos",
  "description": "No installs • Ad-Free",
  "imagePath": "./assets/before-after-01.png"
}
```

Then render batches.

---

## 4. Meta Testing Structure (Creative-First, Low CAC)

### Campaign Setup (Phase A: Find Winners)

- **1 Campaign** (ABO)
- **1 Ad Set** (Broad)
- US (or your best geo), 18–44 (start tighter), Advantage+ placements
- Optimize for **Purchase** (or Initiate Checkout if purchase volume is too low)
- **Ads:** 12–20 creatives (your static variations)

> **Why:** Same audience + same optimization means the winner is the creative, not the targeting.

### Naming Convention

Keep your dashboard clean:

- **Campaign:** `BLANKLOGO_Purchase_ABO_CreativeTest_v1`
- **Ad set:** `Broad_US_18-44_A+Placements`
- **Ads:**
  - `PA_BeforeAfter_01_AdFree`
  - `SA_Compare_03_HQ`
  - `SA_UIProof_02_NoAds`

*(PA = problem-aware, SA = solution-aware)*

---

## 5. Kill / Keep Rules

### First 24–48 Hours: Kill Obvious Losers

**Kill if:**
- CTR (link) < 0.8% after meaningful spend
- CPC is wildly high vs others
- Lots of clicks but 0 "Initiate Checkout" signals compared to peers

**Keep / promote if:**
- Top 20–30% CTR
- Strong click → checkout rate (relative to others)
- Any early purchases (even 1) if CPA is in range

### After You Have Some Purchases

**Keep scaling winners that show:**
- Lowest CPA
- Strong Purchase conversion rate
- Low refund / low support issues (real world matters)

### Rotation Cadence

- **Weekly:** add 5–8 new creatives
- **Pause:** bottom 30–50%
- **Keep:** top 3–5 running as "controls"

---

## 6. Competitor Comparison Bullets (Safe + Effective)

Use on comparison cards: left side ("Typical sites") vs right ("BlankLogo")

| Typical Sites | BlankLogo |
|---------------|-----------|
| Ad walls + popups | Ad-Free premium flow |
| Blurry patches | Cleaner output |
| Adds a new watermark | No extra watermark |
| Slow / unreliable | Clear status + download |
| Confusing steps | Simple 3-step |

*(You're not naming anyone; you're describing common frustrations.)*

---

## 7. Launch Checklist

### Fastest Path to Launch

1. **Pick 10 screenshots** (before/after frames + UI "done" states)
2. **Render:**
   - 6 problem-aware ads (mix templates)
   - 6 solution-aware ads (mix templates)
3. **Launch Phase A** creative test (12 ads)
4. **Promote top 3–5** into Phase B (scaling) next week

---

## 8. Offer: 10 Free Credits

**New User Incentive:**
- Every new signup gets **10 free credits** (one-time)
- Enough to try 1-2 watermark removals
- Reduces friction to first conversion
- Creates "try before you buy" experience

**Ad copy that references this:**
- "Start with 10 free credits"
- "Try it free — no card required"
- "10 free removals to start"
