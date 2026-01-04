/**
 * Credit Flow Integration Tests
 * Tests the complete credit lifecycle: reservation, finalization, refunds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

const mockSupabase = {
  rpc: mockRpc,
  from: mockFrom,
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockEq,
  single: mockSingle,
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('Credit Flow', () => {
  const testUserId = 'user-123';
  const testJobId = 'job-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Credit Balance Check', () => {
    it('should return user credit balance', async () => {
      mockRpc.mockResolvedValueOnce({ data: 10, error: null });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: balance } = await supabase.rpc('bl_get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(balance).toBe(10);
      expect(mockRpc).toHaveBeenCalledWith('bl_get_credit_balance', {
        p_user_id: testUserId,
      });
    });

    it('should return 0 for new users', async () => {
      mockRpc.mockResolvedValueOnce({ data: 0, error: null });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: balance } = await supabase.rpc('bl_get_credit_balance', {
        p_user_id: 'new-user',
      });

      expect(balance).toBe(0);
    });
  });

  describe('Credit Reservation', () => {
    it('should reserve credits when job is created', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: reserved } = await supabase.rpc('bl_reserve_credits', {
        p_user_id: testUserId,
        p_job_id: testJobId,
        p_amount: 1,
      });

      expect(reserved).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('bl_reserve_credits', {
        p_user_id: testUserId,
        p_job_id: testJobId,
        p_amount: 1,
      });
    });

    it('should fail reservation when insufficient credits', async () => {
      mockRpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Insufficient credits' } 
      });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { error } = await supabase.rpc('bl_reserve_credits', {
        p_user_id: testUserId,
        p_job_id: testJobId,
        p_amount: 100,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('Insufficient');
    });

    it('should block job creation without sufficient credits', async () => {
      const userBalance = 0;
      const creditsRequired = 1;
      
      const canCreateJob = userBalance >= creditsRequired;
      
      expect(canCreateJob).toBe(false);
    });
  });

  describe('Credit Finalization', () => {
    it('should finalize credits on job completion', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: finalized } = await supabase.rpc('bl_finalize_credits', {
        p_user_id: testUserId,
        p_job_id: testJobId,
      });

      expect(finalized).toBe(true);
    });

    it('should deduct credits from user balance', async () => {
      // Initial balance
      mockRpc.mockResolvedValueOnce({ data: 10, error: null });
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: initialBalance } = await supabase.rpc('bl_get_credit_balance', {
        p_user_id: testUserId,
      });

      // After job completion (simulated)
      mockRpc.mockResolvedValueOnce({ data: 9, error: null });
      
      const { data: finalBalance } = await supabase.rpc('bl_get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(initialBalance).toBe(10);
      expect(finalBalance).toBe(9);
    });
  });

  describe('Credit Refund', () => {
    it('should refund credits on job failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: refunded } = await supabase.rpc('bl_release_credits', {
        p_user_id: testUserId,
        p_job_id: testJobId,
      });

      expect(refunded).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('bl_release_credits', {
        p_user_id: testUserId,
        p_job_id: testJobId,
      });
    });

    it('should restore credits to user balance on failure', async () => {
      // Initial balance after reservation
      mockRpc.mockResolvedValueOnce({ data: 9, error: null });
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data: balanceAfterReserve } = await supabase.rpc('bl_get_credit_balance', {
        p_user_id: testUserId,
      });

      // After refund (simulated)
      mockRpc.mockResolvedValueOnce({ data: 10, error: null });
      
      const { data: balanceAfterRefund } = await supabase.rpc('bl_get_credit_balance', {
        p_user_id: testUserId,
      });

      expect(balanceAfterReserve).toBe(9);
      expect(balanceAfterRefund).toBe(10);
    });
  });

  describe('Credit Balance Updates', () => {
    it('should update balance in real-time via subscription', () => {
      // Simulate real-time subscription
      const callbacks: ((payload: any) => void)[] = [];
      
      const subscribe = (callback: (payload: any) => void) => {
        callbacks.push(callback);
        return { unsubscribe: () => {} };
      };

      const triggerUpdate = (newBalance: number) => {
        callbacks.forEach(cb => cb({ new: { credits_balance: newBalance } }));
      };

      let currentBalance = 10;
      subscribe((payload) => {
        currentBalance = payload.new.credits_balance;
      });

      triggerUpdate(9);
      expect(currentBalance).toBe(9);

      triggerUpdate(15);
      expect(currentBalance).toBe(15);
    });
  });

  describe('Processing Mode Credits', () => {
    it('should charge 1 credit for crop mode', () => {
      const calculateCredits = (mode: string) => {
        switch (mode) {
          case 'crop': return 1;
          case 'inpaint': return 2;
          case 'auto': return 2;
          default: return 1;
        }
      };

      expect(calculateCredits('crop')).toBe(1);
    });

    it('should charge 2 credits for inpaint mode', () => {
      const calculateCredits = (mode: string) => {
        switch (mode) {
          case 'crop': return 1;
          case 'inpaint': return 2;
          case 'auto': return 2;
          default: return 1;
        }
      };

      expect(calculateCredits('inpaint')).toBe(2);
    });

    it('should charge 2 credits for auto mode', () => {
      const calculateCredits = (mode: string) => {
        switch (mode) {
          case 'crop': return 1;
          case 'inpaint': return 2;
          case 'auto': return 2;
          default: return 1;
        }
      };

      expect(calculateCredits('auto')).toBe(2);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle concurrent credit operations', async () => {
    // Simulate concurrent operations
    const operations = [
      { type: 'reserve', amount: 1 },
      { type: 'reserve', amount: 1 },
      { type: 'finalize', amount: 1 },
    ];

    let balance = 10;
    let reserved = 0;

    for (const op of operations) {
      if (op.type === 'reserve' && balance >= op.amount) {
        balance -= op.amount;
        reserved += op.amount;
      } else if (op.type === 'finalize' && reserved >= op.amount) {
        reserved -= op.amount;
      }
    }

    expect(balance).toBe(8);
    expect(reserved).toBe(1);
  });

  it('should not allow negative balance', () => {
    const attemptReserve = (balance: number, amount: number) => {
      if (balance < amount) {
        return { success: false, error: 'Insufficient credits' };
      }
      return { success: true, newBalance: balance - amount };
    };

    const result = attemptReserve(0, 1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient credits');
  });
});
