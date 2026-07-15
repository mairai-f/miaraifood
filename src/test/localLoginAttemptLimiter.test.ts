import {
  clearLocalLoginFailures,
  getLocalLoginBlockMessage,
  recordLocalLoginFailure,
} from "@/lib/localLoginAttemptLimiter";

const attemptOptions = {
  namespace: "offline-admin",
  ownerUserId: "owner-1",
  identifier: "Admin",
  windowMs: 60_000,
};

describe("localLoginAttemptLimiter", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks after the third failed local login", () => {
    expect(recordLocalLoginFailure(attemptOptions)).toBeNull();
    expect(recordLocalLoginFailure(attemptOptions)).toBeNull();
    expect(recordLocalLoginFailure(attemptOptions)).toContain("3 tentativas");
    expect(getLocalLoginBlockMessage(attemptOptions)).toContain("3 tentativas");
  });

  it("clears failed attempts after a successful login", () => {
    expect(recordLocalLoginFailure(attemptOptions)).toBeNull();
    expect(recordLocalLoginFailure(attemptOptions)).toBeNull();

    clearLocalLoginFailures(attemptOptions);

    expect(getLocalLoginBlockMessage(attemptOptions)).toBeNull();
    expect(recordLocalLoginFailure(attemptOptions)).toBeNull();
  });

  it("expires the local lock after the configured window", () => {
    recordLocalLoginFailure(attemptOptions);
    recordLocalLoginFailure(attemptOptions);
    recordLocalLoginFailure(attemptOptions);

    vi.advanceTimersByTime(60_001);

    expect(getLocalLoginBlockMessage(attemptOptions)).toBeNull();
    expect(recordLocalLoginFailure(attemptOptions)).toBeNull();
  });
});
