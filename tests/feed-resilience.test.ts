import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

/**
 * The feed is decorative, but `getFeedSnapshot` is called from the app layout
 * (`src/app/app/layout.tsx`), so anything that escapes it 500s EVERY `/app` page
 * rather than just the reel.
 *
 * The realistic trigger is a schema the running code does not match — a migration
 * not yet applied (missing `FeedEvent`), or applied while an older build is still
 * serving (P2022 on the reshaped `Notification`). That is precisely the window a
 * deploy opens, so this is a regression guard for an outage, not a style rule.
 *
 * `publish.ts` already documents "It NEVER throws" for the write path. These tests
 * hold the read path to the same contract.
 */

const dbFailure = () =>
  Object.assign(new Error('relation "FeedEvent" does not exist'), {
    code: "P2021",
  });

// Every model access rejects, standing in for a database whose schema predates
// this build. getTasks guards each provider itself, so those simply count zero.
const failingModel = {
  findMany: vi.fn().mockRejectedValue(dbFailure()),
  findFirst: vi.fn().mockRejectedValue(dbFailure()),
  count: vi.fn().mockRejectedValue(dbFailure()),
};

vi.mock("@/lib/db", () => ({
  prisma: new Proxy(
    {},
    {
      get: () => failingModel,
    },
  ),
}));

const user: SessionUser = {
  id: "u1",
  email: "analyst@becs.test",
  designation: "ANALYST",
  status: "ACTIVE",
  facilityId: "f1",
  sectionId: "s1",
  clientId: null,
  vendorId: null,
  outsourceLabId: null,
  roleKeys: [],
  canReadCrossSection: false,
};

describe("getFeedSnapshot never throws", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("degrades to an empty snapshot when the feed tables are missing", async () => {
    const { getFeedSnapshot, EMPTY_SNAPSHOT } = await import("@/lib/feed/query");

    // The assertion that matters: this resolves rather than rejecting. If it ever
    // rejects again, the app layout goes down with it.
    await expect(getFeedSnapshot(user)).resolves.toEqual(EMPTY_SNAPSHOT);
  });

  it("returns a well-formed snapshot, so the layout can render it unconditionally", async () => {
    const { getFeedSnapshot } = await import("@/lib/feed/query");
    const snap = await getFeedSnapshot(user);

    // FeedProvider/NewsReel read these directly — undefined would crash the client.
    expect(snap.unread).toBe(0);
    expect(Array.isArray(snap.inbox)).toBe(true);
    expect(Array.isArray(snap.tasks)).toBe(true);
    expect(Array.isArray(snap.reel)).toBe(true);
    expect(typeof snap.watermark).toBe("string");
  });

  it("logs the failure rather than swallowing it silently", async () => {
    const { getFeedSnapshot } = await import("@/lib/feed/query");
    await getFeedSnapshot(user);
    // A degraded feed must still be diagnosable from the server log.
    expect(console.error).toHaveBeenCalled();
  });
});

describe("capability matrix degrades without pinning the process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("falls back to built-in defaults when CapabilityGrant cannot be read", async () => {
    const { ensureCapabilitiesLoaded, hasCapability } = await import(
      "@/lib/auth/capability-store"
    );

    await expect(ensureCapabilitiesLoaded()).resolves.toBeUndefined();

    // Degrade to the built-in matrix, not to deny-all: the COO must still approve.
    expect(hasCapability("approvePR", "COO")).toBe(true);
    expect(hasCapability("approvePR", "ANALYST")).toBe(false);
    // ADMIN is never lockable out, whatever the store says.
    expect(hasCapability("approvePR", "ADMIN")).toBe(true);
  });

  it("retries on the next call instead of caching the failure forever", async () => {
    const store = await import("@/lib/auth/capability-store");

    await store.ensureCapabilitiesLoaded();
    const afterFirst = failingModel.findMany.mock.calls.length;
    await store.ensureCapabilitiesLoaded();

    // The bug this guards: assigning an empty Map on failure makes `if (cache)`
    // short-circuit forever, so the process stays on defaults even after the
    // database recovers — curable only by a restart.
    expect(failingModel.findMany.mock.calls.length).toBeGreaterThan(afterFirst);
  });
});
