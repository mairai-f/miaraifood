export const START_GUIDED_TOUR_EVENT = 'happycash:start-system-tour';

export const GUIDED_TOUR_VERSION = 'system-tour-v2';

const guidedTourPlanIds = new Set(['pro', 'completo', 'complete']);

export const isGuidedTourEligiblePlan = (planId: string | null | undefined) =>
  guidedTourPlanIds.has(String(planId || '').trim().toLowerCase());

export const buildGuidedTourSeenKey = (userId: string, ownerUserId: string | null | undefined, planId: string) =>
  `happycash:guided-tour:${GUIDED_TOUR_VERSION}:${ownerUserId || userId}:${userId}:${planId}`;

export const hasSeenGuidedTour = (key: string) => {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return true;
  }
};

export const markGuidedTourSeen = (key: string) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Best-effort persistence. The tutorial should never block the app.
  }
};

export const requestGuidedTourStart = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(START_GUIDED_TOUR_EVENT));
};
