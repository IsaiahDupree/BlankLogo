# Infrastructure & Integrations PRD

> **Purpose**: This document captures the technical scaffolding, infrastructure patterns, and third-party integrations built for this project. Business logic has been abstracted to make this reusable as a template for similar SaaS applications.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Database Schema (Supabase)](#database-schema-supabase)
4. [Authentication](#authentication)
5. [Stripe Integration](#stripe-integration)
6. [Resend Email Integration](#resend-email-integration)
7. [Background Worker Pattern](#background-worker-pattern)
8. [Storage Architecture](#storage-architecture)
9. [Deployment (Vercel + Railway)](#deployment-vercel--railway)
10. [Testing Infrastructure](#testing-infrastructure)
11. [Environment Variables](#environment-variables)
12. [Meta Ads Integration](#meta-ads-integration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL (Web App)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Next.js 14 (App Router)                                            ││
│  │  ├── /app           → Dashboard, authenticated pages                ││
│  │  ├── /api/stripe    → Checkout, webhooks, customer portal           ││
│  │  ├── /api/projects  → CRUD for user resources                       ││
│  │  └── /api/internal  → Worker callbacks (protected)                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │        SUPABASE               │
                    │  ┌─────────────────────────┐  │
                    │  │  PostgreSQL Database    │  │
                    │  │  ├── Auth (users)       │  │
                    │  │  ├── Projects           │  │
                    │  │  ├── Jobs (queue)       │  │
                    │  │  ├── Assets             │  │
                    │  │  ├── Credit Ledger      │  │
                    │  │  └── Profiles           │  │
                    │  └─────────────────────────┘  │
                    │  ┌─────────────────────────┐  │
                    │  │  Object Storage         │  │
                    │  │  ├── project-assets     │  │
                    │  │  └── project-outputs    │  │
                    │  └─────────────────────────┘  │
                    └───────────────┬───────────────┘
                                    │
┌───────────────────────────────────┴─────────────────────────────────────┐
│                          RAILWAY (Worker)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  Node.js Worker Process                                             ││
│  │  ├── Job Queue Polling                                              ││
│  │  ├── Pipeline Steps (pluggable)                                     ││
│  │  ├── External API Integrations                                      ││
│  │  └── Asset Upload/Management                                        ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
/
├── apps/
│   ├── web/                    # Next.js frontend + API routes
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   │   ├── app/       # Authenticated dashboard
│   │   │   │   ├── api/       # API routes
│   │   │   │   └── (public)/  # Marketing pages
│   │   │   ├── lib/           # Shared utilities
│   │   │   │   ├── supabase/  # Supabase client config
│   │   │   │   ├── stripe.ts  # Stripe client config
│   │   │   │   └── resend.ts  # Resend client config
│   │   │   └── components/    # React components
│   │   └── package.json
│   │
│   └── worker/                 # Background job processor
│       ├── src/
│       │   ├── index.ts       # Main entry, polling loop
│       │   ├── pipeline/      # Job processing steps
│       │   └── lib/           # Utilities
│       ├── Dockerfile         # For Railway deployment
│       └── package.json
│
├── packages/
│   └── shared/                # Shared types, constants, validators
│       ├── src/
│       │   ├── types.ts       # TypeScript interfaces
│       │   ├── constants.ts   # Pricing, tiers, limits
│       │   └── validators.ts  # Zod schemas
│       └── package.json
│
├── supabase/
│   ├── migrations/            # SQL migrations
│   ├── config.toml           # Local dev config
│   └── seed.sql              # Test data
│
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── e2e/                   # Playwright E2E tests
│   └── security/              # Security tests
│
├── package.json               # Root workspace config
├── pnpm-workspace.yaml        # Workspace definition
├── vitest.config.ts           # Test configuration
└── playwright.config.ts       # E2E test configuration
```

### Package Manager: pnpm workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Scripts (root package.json)

```json
{
  "scripts": {
    "dev": "pnpm --filter @app/web dev",
    "dev:worker": "pnpm --filter @app/worker dev",
    "build": "pnpm --filter @app/web build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push"
  }
}
```

---

## Database Schema (Supabase)

### Core Tables

#### `projects`
User-owned resources that trigger background jobs.

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status project_status not null default 'draft', -- enum: draft, processing, ready, failed
  -- Add your domain-specific columns here
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: Users can only access their own projects
alter table projects enable row level security;
create policy "projects_select_own" on projects for select using (auth.uid() = user_id);
create policy "projects_insert_own" on projects for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on projects for update using (auth.uid() = user_id);
create policy "projects_delete_own" on projects for delete using (auth.uid() = user_id);
```

#### `jobs`
Background job queue with status tracking.

```sql
create type job_status as enum ('QUEUED', 'PROCESSING', 'READY', 'FAILED');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  status job_status not null default 'QUEUED',
  progress int not null default 0 check (progress between 0 and 100),
  
  error_code text,
  error_message text,
  
  claimed_at timestamptz,
  claimed_by text,  -- worker identifier
  started_at timestamptz,
  finished_at timestamptz,
  
  cost_credits_reserved int not null default 0,
  cost_credits_final int not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for efficient queue polling
create index jobs_status_created_idx on jobs(status, created_at);
```

#### `assets`
References to files stored in Supabase Storage.

```sql
create type asset_type as enum ('input', 'output', 'intermediate');

create table assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  
  type asset_type not null,
  path text not null,  -- Storage path: bucket/path/to/file
  meta jsonb not null default '{}',
  
  created_at timestamptz not null default now()
);
```

#### `credit_ledger`
Append-only ledger for credit transactions.

```sql
create type ledger_type as enum ('purchase', 'reserve', 'release', 'spend', 'refund', 'admin_adjust');

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  type ledger_type not null,
  amount int not null,  -- positive = add, negative = deduct
  note text,
  created_at timestamptz not null default now()
);

-- View for current balance
create view credit_balance as
select user_id, coalesce(sum(amount), 0) as balance
from credit_ledger
group by user_id;
```

#### `profiles`
Extended user profile with Stripe integration.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  subscription_tier text,  -- 'starter', 'pro', 'enterprise'
  subscription_status text default 'none',  -- 'active', 'canceled', 'past_due'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Database Functions

#### Safe Job Claiming (prevents race conditions)

```sql
create function claim_next_job(worker_name text)
returns jobs
language plpgsql
security definer
as $$
declare
  v_job jobs;
begin
  with next as (
    select id from jobs
    where status = 'QUEUED'
    order by created_at asc
    for update skip locked
    limit 1
  ),
  upd as (
    update jobs j
    set status = 'PROCESSING',
        claimed_at = now(),
        claimed_by = worker_name,
        started_at = coalesce(started_at, now()),
        progress = greatest(progress, 1)
    from next
    where j.id = next.id
    returning j.*
  )
  select * into v_job from upd;
  return v_job;
end;
$$;
```

#### Credit Management

```sql
-- Reserve credits before job starts
create function reserve_credits(p_user_id uuid, p_job_id uuid, p_amount int)
returns void language plpgsql security definer as $$
begin
  -- Check balance
  if (select balance from credit_balance where user_id = p_user_id) < p_amount then
    raise exception 'Insufficient credits';
  end if;
  
  -- Deduct from balance
  insert into credit_ledger(user_id, job_id, type, amount, note)
  values (p_user_id, p_job_id, 'reserve', -p_amount, 'Reserve for job');
  
  update jobs set cost_credits_reserved = p_amount where id = p_job_id;
end;
$$;

-- Finalize credits after job completes
create function finalize_credits(p_user_id uuid, p_job_id uuid, p_final_cost int)
returns void language plpgsql security definer as $$
declare
  v_reserved int;
begin
  select cost_credits_reserved into v_reserved from jobs where id = p_job_id;
  
  -- Refund unused credits
  if v_reserved > p_final_cost then
    insert into credit_ledger(user_id, job_id, type, amount, note)
    values (p_user_id, p_job_id, 'release', v_reserved - p_final_cost, 'Refund unused');
  end if;
  
  update jobs set cost_credits_final = p_final_cost, cost_credits_reserved = 0
  where id = p_job_id;
end;
$$;
```

---

## Authentication

### Supabase Auth Configuration

```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

// Admin client for server-side operations (bypasses RLS)
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}
```

### Middleware for Protected Routes

```typescript
// apps/web/src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect /app routes
  if (request.nextUrl.pathname.startsWith("/app") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
```

---

## Stripe Integration

### Configuration

```typescript
// apps/web/src/lib/stripe.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Price IDs from Stripe Dashboard
export const STRIPE_PRICE_IDS = {
  // One-time credit packs
  pack_25: process.env.STRIPE_PRICE_PACK_25!,
  pack_80: process.env.STRIPE_PRICE_PACK_80!,
  pack_250: process.env.STRIPE_PRICE_PACK_250!,
  
  // Subscription tiers
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
} as const;

// Credit amounts per product
export const CREDITS_BY_PACK = {
  pack_25: 25,
  pack_80: 80,
  pack_250: 250,
} as const;

export const CREDITS_BY_SUBSCRIPTION = {
  starter: 60,    // per month
  pro: 200,
  enterprise: 500,
} as const;
```

### Checkout API Route

```typescript
// apps/web/src/app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId, mode } = await request.json();

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id;
  
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    
    await supabase.from("profiles").upsert({
      id: user.id,
      stripe_customer_id: customerId,
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: mode, // 'payment' or 'subscription'
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_BASE_URL}/app/credits?success=true`,
    cancel_url: `${process.env.APP_BASE_URL}/app/credits?canceled=true`,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
```

### Webhook Handler

```typescript
// apps/web/src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, CREDITS_BY_PACK, CREDITS_BY_SUBSCRIPTION } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      
      if (session.mode === "payment") {
        // One-time purchase - add credits
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        const credits = CREDITS_BY_PACK[priceId] ?? 0;
        
        await supabase.from("credit_ledger").insert({
          user_id: userId,
          type: "purchase",
          amount: credits,
          note: `Purchased ${credits} credits`,
        });
      }
      break;
    }

    case "invoice.paid": {
      // Subscription renewal - add monthly credits
      const invoice = event.data.object;
      const subscription = await stripe.subscriptions.retrieve(
        invoice.subscription as string
      );
      const userId = subscription.metadata?.user_id;
      const tier = subscription.metadata?.tier;
      const credits = CREDITS_BY_SUBSCRIPTION[tier] ?? 0;
      
      await supabase.from("credit_ledger").insert({
        user_id: userId,
        type: "purchase",
        amount: credits,
        note: `Monthly ${tier} subscription credits`,
      });
      
      await supabase.from("profiles").upsert({
        id: userId,
        subscription_tier: tier,
        subscription_status: "active",
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      
      await supabase.from("profiles").upsert({
        id: userId,
        subscription_tier: null,
        subscription_status: "canceled",
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

### Customer Portal

```typescript
// apps/web/src/app/api/stripe/portal/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user!.id)
    .single();

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.APP_BASE_URL}/app/settings`,
  });

  return NextResponse.json({ url: session.url });
}
```

---

## Resend Email Integration

### Configuration

```typescript
// apps/web/src/lib/resend.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
export const FROM = process.env.RESEND_FROM || "App <hello@example.com>";
export const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
```

### Email Templates (React)

```typescript
// apps/web/src/lib/emails/job-completed.tsx
import { Html, Head, Body, Container, Text, Button } from "@react-email/components";

interface JobCompletedEmailProps {
  userName: string;
  projectTitle: string;
  projectUrl: string;
}

export function JobCompletedEmail({ userName, projectTitle, projectUrl }: JobCompletedEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f4f4f4" }}>
        <Container style={{ backgroundColor: "#fff", padding: "40px", borderRadius: "8px" }}>
          <Text style={{ fontSize: "24px", fontWeight: "bold" }}>
            Your project is ready! 🎉
          </Text>
          <Text>Hi {userName},</Text>
          <Text>
            Good news! Your project "{projectTitle}" has finished processing and is ready for download.
          </Text>
          <Button
            href={projectUrl}
            style={{
              backgroundColor: "#0070f3",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
            }}
          >
            View Project
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

### Sending Emails

```typescript
// apps/web/src/lib/emails/send.ts
import { resend, FROM, BASE_URL } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/server";
import { JobCompletedEmail } from "./job-completed";
import { render } from "@react-email/render";

export async function sendJobCompletedEmail(userId: string, projectId: string, projectTitle: string) {
  const supabase = createAdminClient();
  
  // Get user email
  const { data: user } = await supabase.auth.admin.getUserById(userId);
  if (!user?.user?.email) return;
  
  // Check notification preferences
  const { data: prefs } = await supabase
    .from("user_notification_prefs")
    .select("email_job_completed")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (prefs?.email_job_completed === false) return;

  const projectUrl = `${BASE_URL}/app/projects/${projectId}`;
  
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: user.user.email,
    subject: `Your project "${projectTitle}" is ready!`,
    react: JobCompletedEmail({
      userName: user.user.email.split("@")[0],
      projectTitle,
      projectUrl,
    }),
  });

  // Log email
  await supabase.from("email_log").insert({
    user_id: userId,
    kind: "job_completed",
    to_email: user.user.email,
    subject: `Your project "${projectTitle}" is ready!`,
    resend_id: data?.id,
    status: error ? "failed" : "sent",
    error_message: error?.message,
  });
}
```

### Database Tables for Email

```sql
-- Notification preferences
create table user_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_job_completed boolean not null default true,
  email_job_failed boolean not null default true,
  email_credits_low boolean not null default true,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Email audit log
create table email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null,  -- 'job_completed', 'job_failed', 'welcome', etc.
  to_email text not null,
  subject text not null,
  resend_id text,
  status text not null default 'queued',  -- 'queued', 'sent', 'failed'
  error_message text,
  created_at timestamptz not null default now()
);
```

---

## Background Worker Pattern

### Worker Entry Point

```typescript
// apps/worker/src/index.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "1000");

async function main() {
  console.log(`[Worker ${WORKER_ID}] Starting...`);

  while (true) {
    try {
      // Claim next job using database function (prevents race conditions)
      const { data: job, error } = await supabase.rpc("claim_next_job", {
        worker_name: WORKER_ID,
      });

      if (error) {
        console.error("[Worker] Claim error:", error.message);
        await sleep(POLL_INTERVAL);
        continue;
      }

      if (!job) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      console.log(`[Worker] Processing job ${job.id}`);
      await processJob(job);
      
    } catch (err) {
      console.error("[Worker] Unexpected error:", err);
      await sleep(POLL_INTERVAL);
    }
  }
}

async function processJob(job: Job) {
  try {
    // Run your pipeline steps here
    await runPipeline(job);
    
    // Mark job as complete
    await supabase.from("jobs").update({
      status: "READY",
      progress: 100,
      finished_at: new Date().toISOString(),
    }).eq("id", job.id);
    
    // Update project status
    await supabase.from("projects").update({
      status: "ready",
    }).eq("id", job.project_id);
    
    // Send notification
    await notifyJobComplete(job);
    
  } catch (err) {
    // Mark job as failed
    await supabase.from("jobs").update({
      status: "FAILED",
      error_code: "ERR_PROCESSING",
      error_message: err instanceof Error ? err.message : "Unknown error",
      finished_at: new Date().toISOString(),
    }).eq("id", job.id);
    
    await supabase.from("projects").update({
      status: "failed",
    }).eq("id", job.project_id);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
```

### Pipeline Types

```typescript
// apps/worker/src/pipeline/types.ts
export interface PipelineContext {
  job: Job;
  project: Project;
  userId: string;
  projectId: string;
  jobId: string;
  basePath: string;      // Storage path for intermediate assets
  outputPath: string;    // Storage path for final outputs
  artifacts: Record<string, unknown>;  // Accumulated data between steps
}

export interface StepResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### Dockerfile for Railway

```dockerfile
# apps/worker/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/worker ./apps/worker
COPY packages/shared ./packages/shared

# Build
RUN pnpm --filter @app/worker build

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
```

---

## Storage Architecture

### Bucket Structure

```
project-assets/           # Private bucket for intermediate files
├── u_{userId}/
│   └── p_{projectId}/
│       └── j_{jobId}/
│           ├── inputs/
│           ├── intermediate/
│           └── ...

project-outputs/          # Private bucket for final outputs
├── u_{userId}/
│   └── p_{projectId}/
│       └── j_{jobId}/
│           ├── final.mp4
│           ├── captions.srt
│           └── assets.zip
```

### Storage Policies (RLS)

```sql
-- Users can read their own outputs
create policy "outputs_select_own"
on storage.objects for select
using (
  bucket_id = 'project-outputs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Only service role can write (workers use service role key)
```

### Generating Signed URLs

```typescript
// Server-side (API route)
const { data: signedUrl } = await supabase.storage
  .from("project-outputs")
  .createSignedUrl(path, 3600); // 1 hour expiry
```

---

## Deployment (Vercel + Railway)

### Vercel (Web App)

1. Connect GitHub repo
2. Set root directory: `apps/web`
3. Framework: Next.js
4. Environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   RESEND_API_KEY=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   APP_BASE_URL=https://your-app.vercel.app
   ```

### Railway (Worker)

1. Connect GitHub repo
2. Root directory: `/` (uses Dockerfile at `apps/worker/Dockerfile`)
3. Environment variables:
   ```
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   WORKER_ID=worker-prod-1
   POLL_INTERVAL_MS=1000
   # Add your domain-specific API keys
   ```

### Railway Scaling

```yaml
# railway.yaml (optional)
build:
  dockerfilePath: apps/worker/Dockerfile
deploy:
  replicas: 2
  resources:
    memory: 2048
```

---

## Testing Infrastructure

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
  },
});
```

### Playwright E2E Config

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3838",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm --filter @app/web dev -p 3838",
    port: 3838,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Test Helpers

```typescript
// tests/helpers/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const testSupabase = createClient(
  process.env.SUPABASE_URL || "http://127.0.0.1:54341",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "..."
);

export async function createTestUser() {
  const { data } = await testSupabase.auth.admin.createUser({
    email: `test-${Date.now()}@example.com`,
    password: "testpassword123",
    email_confirm: true,
  });
  return data.user;
}

export async function cleanupTestUser(userId: string) {
  await testSupabase.auth.admin.deleteUser(userId);
}
```

---

## Environment Variables

### apps/web/.env.local

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_PACK_25=price_...
STRIPE_PRICE_PACK_80=price_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM=App <hello@example.com>

# App
APP_BASE_URL=http://localhost:3000
INTERNAL_NOTIFY_SECRET=your-secret-here
```

### apps/worker/.env

```bash
# Supabase
SUPABASE_URL=http://127.0.0.1:54341
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Worker
WORKER_ID=worker-local-1
POLL_INTERVAL_MS=1000

# Add your domain-specific API keys
```

---

## Meta Ads Integration

> **Status**: Not yet implemented

### Planned Implementation

#### Facebook Pixel Setup

```typescript
// apps/web/src/lib/meta-pixel.ts
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export function trackEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", event, params);
  }
}

// Track purchase
trackEvent("Purchase", { value: 19.99, currency: "USD" });

// Track signup
trackEvent("CompleteRegistration");

// Track add to cart (credits)
trackEvent("AddToCart", { content_type: "product", content_ids: ["credits_80"] });
```

#### Script Injection

```tsx
// apps/web/src/app/layout.tsx
<Script id="fb-pixel" strategy="afterInteractive">
  {`
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${FB_PIXEL_ID}');
    fbq('track', 'PageView');
  `}
</Script>
```

#### Conversions API (Server-Side)

```typescript
// apps/web/src/lib/meta-conversions.ts
const PIXEL_ID = process.env.FB_PIXEL_ID;
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

export async function trackServerEvent(event: string, userData: UserData, customData?: Record<string, unknown>) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [{
          event_name: event,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          user_data: {
            em: hashSHA256(userData.email),
            client_ip_address: userData.ip,
            client_user_agent: userData.userAgent,
          },
          custom_data: customData,
        }],
      }),
    }
  );
  return response.json();
}
```

---

## Summary

This infrastructure provides:

- **Monorepo architecture** with pnpm workspaces
- **Type-safe database schema** with PostgreSQL/Supabase
- **Row-level security** for multi-tenant data isolation
- **Credit-based billing** with Stripe integration
- **Transactional emails** via Resend
- **Background job processing** with Railway workers
- **E2E testing** with Playwright
- **Production deployment** on Vercel + Railway

The business logic (what the jobs actually do) is abstracted and pluggable via the pipeline pattern in the worker.
