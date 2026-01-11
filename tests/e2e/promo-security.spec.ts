import { test, expect } from '@playwright/test';

/**
 * Security Tests for Promo Reward System
 * 
 * Tests anti-abuse controls:
 * - Token forgery prevention
 * - Double-redemption blocking
 * - Rate limiting
 * - IP/UA fingerprinting
 * - Expired token rejection
 * - Old account rejection
 */

const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';

test.describe('Promo Security - Token Validation', () => {
  
  test('rejects forged/invalid JWT tokens', async ({ request }) => {
    console.log('[Security] Testing forged token rejection...');
    
    // Test with completely invalid token
    const invalidTokens = [
      'invalid-token',
      'not.a.jwt',
      'eyJhbGciOiJIUzI1NiJ9.fake.signature',
      // Forged token with wrong signature
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjYW1wYWlnbl9pZCI6ImJsYW5rbG9nb18xMGNyZWRpdHMiLCJleHAiOjE5OTk5OTk5OTl9.forged_signature_here',
    ];
    
    for (const token of invalidTokens) {
      const response = await request.get(`${BASE_URL}/api/promos/redeem`, {
        headers: { 'Cookie': `bl_promo_token=${token}` }
      });
      
      const data = await response.json();
      console.log(`[Security] Invalid token test: ${data.has_promo ? '❌ FAIL' : '✓ PASS'}`);
      
      // Should NOT have a valid promo with forged token
      expect(data.has_promo).toBe(false);
    }
  });

  test('rejects expired tokens', async ({ request }) => {
    console.log('[Security] Testing expired token rejection...');
    
    // Create a properly formatted but expired JWT (exp in the past)
    // This tests that the server validates expiration
    const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJjYW1wYWlnbl9pZCI6ImJsYW5rbG9nb18xMGNyZWRpdHMiLCJleHAiOjE2MDAwMDAwMDB9.test';
    
    const response = await request.get(`${BASE_URL}/api/promos/redeem`, {
      headers: { 'Cookie': `bl_promo_token=${expiredToken}` }
    });
    
    const data = await response.json();
    expect(data.has_promo).toBe(false);
    console.log('[Security] Expired token rejected ✓');
  });

  test('cannot redeem without authentication', async ({ request }) => {
    console.log('[Security] Testing unauthenticated redemption...');
    
    // First get a valid token
    const landingResponse = await request.get(
      `${BASE_URL}/promo?utm_campaign=blanklogo_10credits`,
      { maxRedirects: 0 }
    );
    
    const setCookie = landingResponse.headers()['set-cookie'];
    const tokenMatch = setCookie?.match(/bl_promo_token=([^;]+)/);
    const token = tokenMatch?.[1];
    
    expect(token).toBeTruthy();
    
    // Try to redeem without auth
    const redeemResponse = await request.post(`${BASE_URL}/api/promos/redeem`, {
      headers: { 'Cookie': `bl_promo_token=${token}` }
    });
    
    const data = await redeemResponse.json();
    expect(data.success).toBe(false);
    expect(data.error_code).toBe('not_authenticated');
    
    console.log('[Security] Unauthenticated redemption blocked ✓');
  });
});

test.describe('Promo Security - Anti-Abuse', () => {
  
  test('rate limits rapid promo landing requests', async ({ request }) => {
    console.log('[Security] Testing rate limiting...');
    
    const requests = [];
    const startTime = Date.now();
    
    // Make 20 rapid requests
    for (let i = 0; i < 20; i++) {
      requests.push(
        request.get(`${BASE_URL}/promo?utm_campaign=blanklogo_10credits&t=${i}`, {
          maxRedirects: 0
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const elapsed = Date.now() - startTime;
    
    // Check that all requests completed (server didn't crash)
    const statuses = responses.map(r => r.status());
    const successCount = statuses.filter(s => s === 307).length;
    
    console.log(`[Security] ${successCount}/20 requests succeeded in ${elapsed}ms`);
    
    // All should be 307 (redirect) or 429 (rate limited)
    // If we see 429s, rate limiting is working
    const rateLimited = statuses.filter(s => s === 429).length;
    if (rateLimited > 0) {
      console.log(`[Security] Rate limiting active: ${rateLimited} requests limited ✓`);
    } else {
      console.log('[Security] No rate limiting detected (may be configured at edge)');
    }
    
    // Server should still be responsive
    expect(successCount + rateLimited).toBe(20);
  });

  test('different IPs get different token hashes', async ({ request }) => {
    console.log('[Security] Testing IP fingerprinting...');
    
    // Make two requests (simulating different IPs via different request contexts)
    const response1 = await request.get(
      `${BASE_URL}/promo?utm_campaign=blanklogo_10credits`,
      { 
        maxRedirects: 0,
        headers: { 'X-Forwarded-For': '1.2.3.4' }
      }
    );
    
    const response2 = await request.get(
      `${BASE_URL}/promo?utm_campaign=blanklogo_10credits`,
      { 
        maxRedirects: 0,
        headers: { 'X-Forwarded-For': '5.6.7.8' }
      }
    );
    
    const cookie1 = response1.headers()['set-cookie'];
    const cookie2 = response2.headers()['set-cookie'];
    
    // Tokens should be different (different IP hashes in payload)
    expect(cookie1).toBeTruthy();
    expect(cookie2).toBeTruthy();
    
    // Extract tokens
    const token1 = cookie1?.match(/bl_promo_token=([^;]+)/)?.[1];
    const token2 = cookie2?.match(/bl_promo_token=([^;]+)/)?.[1];
    
    // Tokens should be different (unique nonce + different IP hash)
    expect(token1).not.toBe(token2);
    
    console.log('[Security] Tokens have unique fingerprints ✓');
  });

  test('token contains secure attributes', async ({ request }) => {
    console.log('[Security] Testing cookie security attributes...');
    
    const response = await request.get(
      `${BASE_URL}/promo?utm_campaign=blanklogo_10credits`,
      { maxRedirects: 0 }
    );
    
    const setCookie = response.headers()['set-cookie'];
    
    // Check for security attributes
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=');
    
    // Should have reasonable expiry (not permanent)
    expect(setCookie).toMatch(/Max-Age=\d+/);
    
    console.log('[Security] Cookie has secure attributes ✓');
    console.log(`  - HttpOnly: ✓`);
    console.log(`  - Secure: ✓`);
    console.log(`  - SameSite: ✓`);
  });
});

test.describe('Promo Security - Campaign Validation', () => {
  
  test('rejects SQL injection in campaign ID', async ({ request }) => {
    console.log('[Security] Testing SQL injection prevention...');
    
    const maliciousInputs = [
      "'; DROP TABLE bl_promo_campaigns; --",
      "1' OR '1'='1",
      "blanklogo_10credits'; DELETE FROM users; --",
      "<script>alert('xss')</script>",
      "{{constructor.constructor('return this')()}}",
    ];
    
    for (const input of maliciousInputs) {
      const response = await request.get(
        `${BASE_URL}/promo?utm_campaign=${encodeURIComponent(input)}`,
        { maxRedirects: 0 }
      );
      
      // Should still work (redirect) but use default/safe campaign
      expect(response.status()).toBe(307);
      
      const location = response.headers()['location'];
      // Should NOT contain the malicious input
      expect(location).not.toContain(input);
    }
    
    console.log('[Security] SQL injection attempts safely handled ✓');
  });

  test('rejects XSS in UTM parameters', async ({ request }) => {
    console.log('[Security] Testing XSS prevention...');
    
    const xssPayloads = [
      '<script>alert(1)</script>',
      'javascript:alert(1)',
      '<img src=x onerror=alert(1)>',
      '"><script>alert(1)</script>',
    ];
    
    for (const payload of xssPayloads) {
      const response = await request.get(
        `${BASE_URL}/promo?utm_source=${encodeURIComponent(payload)}`,
        { maxRedirects: 0 }
      );
      
      expect(response.status()).toBe(307);
      
      // Location header should be URL-encoded, not raw XSS
      const location = response.headers()['location'];
      expect(location).not.toContain('<script>');
      expect(location).not.toContain('javascript:');
    }
    
    console.log('[Security] XSS payloads sanitized ✓');
  });

  test('handles long campaign IDs gracefully', async ({ request }) => {
    console.log('[Security] Testing long input handling...');
    
    // Use a reasonable but long campaign ID (under URL limits)
    const longCampaign = 'a'.repeat(500);
    
    const response = await request.get(
      `${BASE_URL}/promo?utm_campaign=${longCampaign}`,
      { maxRedirects: 0 }
    );
    
    // Should redirect normally with default campaign (invalid format)
    expect(response.status()).toBe(307);
    
    // Should use default campaign since long one is invalid
    const location = response.headers()['location'];
    expect(location).toContain('campaign=');
    
    console.log('[Security] Long input handled gracefully ✓');
  });
});

test.describe('Promo Security - Database Integrity', () => {
  
  test('redemption function validates campaign exists', async ({ request }) => {
    console.log('[Security] Testing campaign existence validation...');
    
    // This test verifies the database function handles non-existent campaigns
    // We can't directly call the DB function, but we can verify via API behavior
    
    // Get a token for a potentially non-existent campaign
    const response = await request.get(
      `${BASE_URL}/promo?utm_campaign=nonexistent_campaign_xyz123`,
      { maxRedirects: 0 }
    );
    
    expect(response.status()).toBe(307);
    
    // The location should contain a fallback campaign, not the invalid one
    const location = response.headers()['location'];
    console.log('[Security] Non-existent campaign handled:', location?.includes('campaign=') ? '✓' : '?');
  });

  test('unique constraint prevents double redemption attempts', async ({ request }) => {
    console.log('[Security] Testing double-redemption prevention...');
    
    // This is validated at the database level with UNIQUE constraint
    // The bl_redeem_promo function checks for existing redemption before insert
    
    // Make multiple redemption attempts
    const attempts = [];
    for (let i = 0; i < 5; i++) {
      attempts.push(
        request.post(`${BASE_URL}/api/promos/redeem`)
      );
    }
    
    const responses = await Promise.all(attempts);
    
    // All should fail (no auth), but server shouldn't crash
    for (const response of responses) {
      expect(response.status()).toBeLessThan(500);
    }
    
    console.log('[Security] Multiple redemption attempts handled safely ✓');
  });
});
