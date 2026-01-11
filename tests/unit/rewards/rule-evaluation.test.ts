import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Unit Tests: Reward Rule Evaluation
 * 
 * Tests pure logic for evaluating reward rules against events.
 * No database required - these run fast on every PR.
 */

// Types matching our database schema
interface RewardRule {
  id: string;
  name: string;
  trigger_event: string;
  credits_delta: number;
  conditions: Record<string, unknown>;
  max_awards_per_user: number;
  cooldown_seconds: number;
  enabled: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
}

interface AppEvent {
  id: string;
  user_id: string;
  event_name: string;
  event_time: Date;
  source: 'vercel_api' | 'worker' | 'stripe_webhook' | 'supabase_trigger';
  properties: Record<string, unknown>;
}

interface UserContext {
  user_id: string;
  created_at: Date;
  previous_awards: { rule_id: string; awarded_at: Date }[];
}

// Pure functions to test
function ruleMatchesEventName(rule: RewardRule, event: AppEvent): boolean {
  return rule.trigger_event === event.event_name;
}

function ruleIsWithinTimeWindow(rule: RewardRule, now: Date = new Date()): boolean {
  if (rule.starts_at && rule.starts_at > now) return false;
  if (rule.ends_at && rule.ends_at < now) return false;
  return true;
}

function ruleConditionsPass(
  rule: RewardRule, 
  event: AppEvent, 
  userContext: UserContext
): { passes: boolean; reason?: string } {
  const conditions = rule.conditions;
  
  // Check is_new_user condition
  if (conditions.is_new_user === true) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (userContext.created_at < sevenDaysAgo) {
      return { passes: false, reason: 'not_new_user' };
    }
  }
  
  // Check is_first_job condition
  if (conditions.is_first_job === true) {
    const previousJobs = event.properties.previous_job_count as number || 0;
    if (previousJobs > 0) {
      return { passes: false, reason: 'not_first_job' };
    }
  }
  
  return { passes: true };
}

function checkCooldown(
  rule: RewardRule, 
  userContext: UserContext, 
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (rule.cooldown_seconds <= 0) return { allowed: true };
  
  const previousAward = userContext.previous_awards.find(a => a.rule_id === rule.id);
  if (!previousAward) return { allowed: true };
  
  const cooldownEnds = new Date(previousAward.awarded_at.getTime() + rule.cooldown_seconds * 1000);
  if (now < cooldownEnds) {
    return { allowed: false, reason: 'cooldown' };
  }
  
  return { allowed: true };
}

function checkMaxAwards(
  rule: RewardRule, 
  userContext: UserContext
): { allowed: boolean; reason?: string } {
  if (rule.max_awards_per_user <= 0) return { allowed: true }; // 0 = unlimited
  
  const awardCount = userContext.previous_awards.filter(a => a.rule_id === rule.id).length;
  if (awardCount >= rule.max_awards_per_user) {
    return { allowed: false, reason: 'max_awards_reached' };
  }
  
  return { allowed: true };
}

function isTrustedSource(event: AppEvent): boolean {
  const trustedSources = ['vercel_api', 'worker', 'stripe_webhook', 'supabase_trigger'];
  return trustedSources.includes(event.source);
}

// Test data factories
function createRule(overrides: Partial<RewardRule> = {}): RewardRule {
  return {
    id: 'rule_test_123',
    name: 'Test Rule',
    trigger_event: 'job_completed',
    credits_delta: 10,
    conditions: {},
    max_awards_per_user: 1,
    cooldown_seconds: 0,
    enabled: true,
    starts_at: null,
    ends_at: null,
    ...overrides,
  };
}

function createEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: 'event_test_456',
    user_id: 'user_789',
    event_name: 'job_completed',
    event_time: new Date(),
    source: 'worker',
    properties: {},
    ...overrides,
  };
}

function createUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    user_id: 'user_789',
    created_at: new Date(), // New user by default
    previous_awards: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════

describe('Reward Rule Evaluation', () => {
  
  describe('rule_matches_event_name', () => {
    it('returns true when event name matches trigger', () => {
      const rule = createRule({ trigger_event: 'job_completed' });
      const event = createEvent({ event_name: 'job_completed' });
      
      expect(ruleMatchesEventName(rule, event)).toBe(true);
    });

    it('returns false when event name does not match', () => {
      const rule = createRule({ trigger_event: 'job_completed' });
      const event = createEvent({ event_name: 'auth_signed_in' });
      
      expect(ruleMatchesEventName(rule, event)).toBe(false);
    });

    it('is case-sensitive', () => {
      const rule = createRule({ trigger_event: 'job_completed' });
      const event = createEvent({ event_name: 'JOB_COMPLETED' });
      
      expect(ruleMatchesEventName(rule, event)).toBe(false);
    });
  });

  describe('rule_rejects_out_of_window', () => {
    it('allows rule with no time restrictions', () => {
      const rule = createRule({ starts_at: null, ends_at: null });
      
      expect(ruleIsWithinTimeWindow(rule)).toBe(true);
    });

    it('rejects rule that starts in the future', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const rule = createRule({ starts_at: futureDate });
      
      expect(ruleIsWithinTimeWindow(rule)).toBe(false);
    });

    it('rejects rule that ended in the past', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rule = createRule({ ends_at: pastDate });
      
      expect(ruleIsWithinTimeWindow(rule)).toBe(false);
    });

    it('allows rule within valid window', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const rule = createRule({ starts_at: pastDate, ends_at: futureDate });
      
      expect(ruleIsWithinTimeWindow(rule)).toBe(true);
    });
  });

  describe('rule_conditions_pass', () => {
    it('passes when no conditions specified', () => {
      const rule = createRule({ conditions: {} });
      const event = createEvent();
      const userContext = createUserContext();
      
      const result = ruleConditionsPass(rule, event, userContext);
      expect(result.passes).toBe(true);
    });

    it('passes is_new_user when user is new', () => {
      const rule = createRule({ conditions: { is_new_user: true } });
      const event = createEvent();
      const userContext = createUserContext({ created_at: new Date() });
      
      const result = ruleConditionsPass(rule, event, userContext);
      expect(result.passes).toBe(true);
    });

    it('fails is_new_user when user is old', () => {
      const rule = createRule({ conditions: { is_new_user: true } });
      const event = createEvent();
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const userContext = createUserContext({ created_at: oldDate });
      
      const result = ruleConditionsPass(rule, event, userContext);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('not_new_user');
    });

    it('passes is_first_job when no previous jobs', () => {
      const rule = createRule({ conditions: { is_first_job: true } });
      const event = createEvent({ properties: { previous_job_count: 0 } });
      const userContext = createUserContext();
      
      const result = ruleConditionsPass(rule, event, userContext);
      expect(result.passes).toBe(true);
    });

    it('fails is_first_job when has previous jobs', () => {
      const rule = createRule({ conditions: { is_first_job: true } });
      const event = createEvent({ properties: { previous_job_count: 5 } });
      const userContext = createUserContext();
      
      const result = ruleConditionsPass(rule, event, userContext);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe('not_first_job');
    });
  });
});

describe('Anti-Abuse Logic', () => {
  
  describe('cooldown_blocks_award', () => {
    it('allows award when no cooldown', () => {
      const rule = createRule({ cooldown_seconds: 0 });
      const userContext = createUserContext();
      
      const result = checkCooldown(rule, userContext);
      expect(result.allowed).toBe(true);
    });

    it('allows award when no previous award', () => {
      const rule = createRule({ cooldown_seconds: 86400 }); // 24h
      const userContext = createUserContext({ previous_awards: [] });
      
      const result = checkCooldown(rule, userContext);
      expect(result.allowed).toBe(true);
    });

    it('blocks award within cooldown period', () => {
      const rule = createRule({ cooldown_seconds: 86400 }); // 24h
      const recentAward = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const userContext = createUserContext({
        previous_awards: [{ rule_id: rule.id, awarded_at: recentAward }]
      });
      
      const result = checkCooldown(rule, userContext);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown');
    });

    it('allows award after cooldown expires', () => {
      const rule = createRule({ cooldown_seconds: 86400 }); // 24h
      const oldAward = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const userContext = createUserContext({
        previous_awards: [{ rule_id: rule.id, awarded_at: oldAward }]
      });
      
      const result = checkCooldown(rule, userContext);
      expect(result.allowed).toBe(true);
    });
  });

  describe('max_awards_per_user_blocks', () => {
    it('allows first award', () => {
      const rule = createRule({ max_awards_per_user: 1 });
      const userContext = createUserContext({ previous_awards: [] });
      
      const result = checkMaxAwards(rule, userContext);
      expect(result.allowed).toBe(true);
    });

    it('blocks when max reached', () => {
      const rule = createRule({ max_awards_per_user: 1 });
      const userContext = createUserContext({
        previous_awards: [{ rule_id: rule.id, awarded_at: new Date() }]
      });
      
      const result = checkMaxAwards(rule, userContext);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('max_awards_reached');
    });

    it('allows unlimited when max is 0', () => {
      const rule = createRule({ max_awards_per_user: 0 });
      const userContext = createUserContext({
        previous_awards: Array(10).fill({ rule_id: rule.id, awarded_at: new Date() })
      });
      
      const result = checkMaxAwards(rule, userContext);
      expect(result.allowed).toBe(true);
    });

    it('counts only awards for this rule', () => {
      const rule = createRule({ id: 'rule_a', max_awards_per_user: 1 });
      const userContext = createUserContext({
        previous_awards: [{ rule_id: 'rule_b', awarded_at: new Date() }]
      });
      
      const result = checkMaxAwards(rule, userContext);
      expect(result.allowed).toBe(true);
    });
  });

  describe('trusted_source_validation', () => {
    it('accepts vercel_api source', () => {
      const event = createEvent({ source: 'vercel_api' });
      expect(isTrustedSource(event)).toBe(true);
    });

    it('accepts worker source', () => {
      const event = createEvent({ source: 'worker' });
      expect(isTrustedSource(event)).toBe(true);
    });

    it('accepts stripe_webhook source', () => {
      const event = createEvent({ source: 'stripe_webhook' });
      expect(isTrustedSource(event)).toBe(true);
    });

    it('accepts supabase_trigger source', () => {
      const event = createEvent({ source: 'supabase_trigger' });
      expect(isTrustedSource(event)).toBe(true);
    });

    it('rejects client source', () => {
      // @ts-expect-error - testing invalid source
      const event = createEvent({ source: 'client' });
      expect(isTrustedSource(event)).toBe(false);
    });

    it('rejects unknown source', () => {
      // @ts-expect-error - testing invalid source
      const event = createEvent({ source: 'unknown' });
      expect(isTrustedSource(event)).toBe(false);
    });
  });
});

describe('Email Content Safety', () => {
  
  interface EmailPayload {
    credits_delta: number;
    reason: string;
    balance_after: number;
    cta_url: string;
    [key: string]: unknown;
  }

  function buildRewardEmailPayload(
    credits: number,
    reason: string,
    balance: number,
    baseUrl: string
  ): EmailPayload {
    return {
      credits_delta: credits,
      reason,
      balance_after: balance,
      cta_url: `${baseUrl}/app`,
    };
  }

  const ALLOWED_KEYS = ['credits_delta', 'reason', 'balance_after', 'cta_url'];
  const FORBIDDEN_PATTERNS = [
    /secret/i,
    /token/i,
    /password/i,
    /api_key/i,
    /ip_address/i,
    /ip_hash/i,
  ];

  function validatePayloadSafety(payload: EmailPayload): { safe: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check for extra keys
    const extraKeys = Object.keys(payload).filter(k => !ALLOWED_KEYS.includes(k));
    if (extraKeys.length > 0) {
      issues.push(`Extra keys found: ${extraKeys.join(', ')}`);
    }
    
    // Check for forbidden patterns in values
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(key) || pattern.test(value)) {
            issues.push(`Forbidden pattern in ${key}`);
          }
        }
      }
    }
    
    return { safe: issues.length === 0, issues };
  }

  it('reward_email_payload_is_safe', () => {
    const payload = buildRewardEmailPayload(10, 'promo_signup', 20, 'https://blanklogo.app');
    
    const result = validatePayloadSafety(payload);
    expect(result.safe).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects payload with extra keys', () => {
    const payload = buildRewardEmailPayload(10, 'promo_signup', 20, 'https://blanklogo.app');
    (payload as Record<string, unknown>).user_password = 'secret123';
    
    const result = validatePayloadSafety(payload);
    expect(result.safe).toBe(false);
    expect(result.issues.some(i => i.includes('Extra keys'))).toBe(true);
  });

  it('rejects payload with secret patterns', () => {
    const payload = buildRewardEmailPayload(10, 'promo_signup', 20, 'https://blanklogo.app');
    (payload as Record<string, unknown>).api_key = 'sk_test_123';
    
    const result = validatePayloadSafety(payload);
    expect(result.safe).toBe(false);
  });
});

describe('PostHog Event Formatting', () => {
  
  interface PostHogEvent {
    event: string;
    properties: Record<string, unknown>;
  }

  const REQUIRED_PROPERTIES = [
    'user_id',
    'rule_id', 
    'event_id',
    'credits_delta',
    'reason',
    'environment',
    'request_id',
  ];

  function buildCreditsAwardedEvent(
    userId: string,
    ruleId: string,
    eventId: string,
    delta: number,
    reason: string,
    requestId: string,
    env: string = 'production'
  ): PostHogEvent {
    return {
      event: 'credits_awarded',
      properties: {
        user_id: userId,
        rule_id: ruleId,
        event_id: eventId,
        credits_delta: delta,
        reason,
        environment: env,
        request_id: requestId,
      },
    };
  }

  function validatePostHogEvent(event: PostHogEvent): { valid: boolean; missing: string[] } {
    const missing = REQUIRED_PROPERTIES.filter(
      prop => !(prop in event.properties) || event.properties[prop] === undefined
    );
    return { valid: missing.length === 0, missing };
  }

  it('posthog_credits_awarded_shape', () => {
    const event = buildCreditsAwardedEvent(
      'user_123',
      'rule_456',
      'event_789',
      10,
      'promo_signup',
      'req_abc'
    );

    const result = validatePostHogEvent(event);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(event.event).toBe('credits_awarded');
  });

  it('detects missing required properties', () => {
    const event: PostHogEvent = {
      event: 'credits_awarded',
      properties: {
        user_id: 'user_123',
        credits_delta: 10,
      },
    };

    const result = validatePostHogEvent(event);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('rule_id');
    expect(result.missing).toContain('event_id');
    expect(result.missing).toContain('reason');
  });
});
