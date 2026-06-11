import { describe, expect, it } from 'vitest';

import { buildGuidedTourSeenKey, isGuidedTourEligiblePlan } from '@/lib/guidedTour';

describe('guidedTour', () => {
  it('enables onboarding for pro and complete plans', () => {
    expect(isGuidedTourEligiblePlan('pro')).toBe(true);
    expect(isGuidedTourEligiblePlan('completo')).toBe(true);
    expect(isGuidedTourEligiblePlan('complete')).toBe(true);
    expect(isGuidedTourEligiblePlan('demo')).toBe(false);
    expect(isGuidedTourEligiblePlan(null)).toBe(false);
  });

  it('scopes persistence by owner, user, plan, and version', () => {
    const ownerKey = buildGuidedTourSeenKey('operator-1', 'owner-1', 'pro');
    const userKey = buildGuidedTourSeenKey('operator-1', null, 'pro');

    expect(ownerKey).toContain('owner-1:operator-1:pro');
    expect(userKey).toContain('operator-1:operator-1:pro');
    expect(ownerKey).not.toEqual(userKey);
  });
});
