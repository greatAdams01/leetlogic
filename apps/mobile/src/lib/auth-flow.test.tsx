import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  signed: false,
  generation: 0,
  record: null as object | null,
  read: vi.fn(),
  hydrated: false,
  account: null as any,
  failRequest: false,
  requests: [] as { path: string; options: any }[],
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert() {} },
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => h.store.get(k) || null,
    setItem: async (k: string, v: string) => {
      h.store.set(k, v);
    },
  },
}));
vi.mock("../components/feedback", () => ({ Feedback: () => null }));
vi.mock("../localization", () => ({ LocaleProvider: ({ children }: any) => children }));
vi.mock("./farmer-security", () => ({ readSecurity: h.read }));
vi.mock("./api", () => ({
  api: async (path: string, options: any) => {
    h.requests.push({ path, options });
    if (path === "/auth/otp/request" && h.failRequest) throw new Error("SMS unavailable");
    if (path === "/me") return { user: h.account };
    return path === "/auth/logout" ? new Promise(() => {}) : { messages: {} };
  },
  deviceId: async () => "device",
  hydrateSession: async () => h.hydrated,
  clearSession: async () => {
    h.signed = false;
    h.generation++;
  },
  authHeaders: () => (h.signed ? { Authorization: "Bearer account" } : {}),
  sessionVersion: () => h.generation,
}));
import { AppProvider, useApp } from "../state";
let current: ReturnType<typeof useApp>;
let tree: ReactTestRenderer;
function Probe() {
  current = useApp();
  return null;
}
beforeEach(() => {
  h.record = null;
  h.hydrated = false;
  h.account = null;
  h.read.mockReset();
  h.read.mockImplementation(async () => h.record);
  h.failRequest = false;
  h.requests = [];
  h.signed = false;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  h.store.clear();
});
it("logs out immediately to the app start and never carries seller intent to another account", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  await act(async () => {
    await current.selectRole("SELLER");
  });
  expect(current.route.name).toBe("phone");
  expect(current.role).toBe("SELLER");
  await act(async () => {
    await current.signOut();
  });
  expect(current.route.name).toBe("language");
  expect(current.role).toBe("BUYER");
  expect(current.user).toBeNull();
  await act(async () => {
    await current.finishSignIn({ id: "different", farmerProfile: null, capabilities: [{ capability: "BUYER" }] } as any);
  });
  expect(current.route.name).toBe("home");
  expect(h.store.get("account-role:different")).toBe("BUYER");
});
it("requires buyer registration to verify a phone number", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  await act(async () => {
    await current.selectRole("BUYER");
  });
  expect(current.route.name).toBe("phone");
  expect(current.authIntent).toBe("REGISTER");
  expect(current.user).toBeNull();
  expect(current.security).toBeNull();
});
it("returns a guest from the Orders sign-in prompt to browsing", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  await act(async () => {
    await current.selectRole("BUYER");
  });
  await act(async () => current.go("search"));
  await act(async () => current.go("orders"));
  expect(current.canGoBack).toBe(true);
  await act(async () => current.back());
  expect(current.route.name).toBe("search");
  // Recover existing navigation state from before the fix too.
  await act(async () => current.reset("orders"));
  expect(current.canGoBack).toBe(true);
  await act(async () => current.back());
  expect(current.route.name).toBe("home");
});

const farmer = {
  id: "farmer",
  capabilities: [{ capability: "SELLER" }],
  phoneE164: "+2348012345678",
  farmerProfile: { verificationStatus: "APPROVED" },
} as any;
async function lockedFarmer() {
  h.record = { biometric: false };
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  await act(async () => current.setUser(farmer));
  await act(async () => current.selectRole("SELLER"));
  h.signed = true;
  expect(current.security).toBe("unlock");
}
it("takes PIN recovery directly to SMS verification and creates a new PIN only after verification", async () => {
  await lockedFarmer();
  await act(async () => current.changeLocale("ha"));
  await act(async () => current.recoverSecurity());
  expect(h.requests).toContainEqual({
    path: "/auth/otp/request",
    options: { method: "POST", body: { phone: farmer.phoneE164, deviceId: "device" } },
  });
  expect(current.route).toEqual({ name: "otp", id: farmer.phoneE164 });
  expect(current.locale).toBe("ha");
  expect(current.user).toBeNull();
  expect(h.signed).toBe(false);
  expect(current.security).toBe("unlock");
  // Simulate loadUser after a successful OTP response; the PIN gate stays up.
  await act(async () => current.setUser(farmer));
  expect(current.security).toBe("unlock");
  await act(async () => current.finishSignIn(farmer));
  expect(current.role).toBe("SELLER");
  expect(current.security).toBe("create");
  expect(current.route.name).toBe("home");
});
it("preserves the locked session when the SMS code cannot be sent", async () => {
  await lockedFarmer();
  h.failRequest = true;
  await act(async () => {
    await expect(current.recoverSecurity()).rejects.toThrow("SMS unavailable");
  });
  expect(current.user).toEqual(farmer);
  expect(current.security).toBe("unlock");
  expect(current.role).toBe("SELLER");
  expect(h.signed).toBe(true);
  expect(h.requests.some((r) => r.path === "/auth/logout")).toBe(false);
});
it("returns from recovery verification to the saved phone number without onboarding", async () => {
  await lockedFarmer();
  await act(async () => current.recoverSecurity());
  await act(async () => current.back());
  expect(current.route).toEqual({ name: "phone", id: farmer.phoneE164 });
});
it("does not carry farmer recovery intent into a different verified account", async () => {
  await lockedFarmer();
  await act(async () => current.recoverSecurity());
  await act(async () => current.finishSignIn({ id: "other", farmerProfile: null, capabilities: [{ capability: "BUYER" }] } as any));
  expect(current.route.name).toBe("home");
  expect(current.role).toBe("BUYER");
});

it("does not publish a verified farmer until the saved PIN gate finishes loading", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  h.signed = true;
  h.account = farmer;
  await act(async () => {
    await current.loadUser(false);
  });
  expect(current.user).toBeNull();
  let resolve!: (value: object) => void;
  h.read.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = current.finishSignIn(farmer);
  });
  expect(current.user).toBeNull();
  await act(async () => {
    resolve({ biometric: true });
    await pending;
  });
  expect(current.user).toEqual(farmer);
  expect(current.security).toBe("unlock");
});
it("does not restore a late sign-in result after logout", async () => {
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  let resolve!: (value: object) => void;
  h.read.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = current.finishSignIn(farmer);
  });
  await act(async () => current.signOut());
  await act(async () => {
    resolve({ biometric: true });
    await pending;
  });
  expect(current.user).toBeNull();
  expect(current.security).toBeNull();
  expect(current.route.name).toBe("language");
});
it.each([true, false])(
  "restores the PIN gate after app restart independently of biometric opt-in: %s",
  async (biometric) => {
    h.record = { biometric };
    h.hydrated = true;
    h.signed = true;
    h.account = farmer;
    h.generation++;
    h.store.set("account-role:farmer", "SELLER");
    await act(async () => {
      tree = create(
        <AppProvider>
          <Probe />
        </AppProvider>,
      );
    });
    expect(current.ready).toBe(true);
    expect(current.security).toBe("unlock");
    expect(current.role).toBe("SELLER");
    expect(current.user).toEqual(farmer);
  },
);

it("keeps the account private if startup cannot read the saved security configuration", async () => {
  h.hydrated = true;
  h.signed = true;
  h.account = farmer;
  h.generation++;
  h.read.mockRejectedValue(new Error("Secure storage unavailable"));
  await act(async () => {
    tree = create(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  expect(current.ready).toBe(true);
  expect(current.user).toBeNull();
  expect(h.signed).toBe(false);
});

it.each([true, false])(
  "returns to the saved PIN gate after logout and a new sign-in: biometric opt-in %s",
  async (biometric) => {
    await lockedFarmer();
    h.record = { biometric };
    await act(async () => current.signOut());
    expect(current.security).toBeNull();
    expect(current.user).toBeNull();
    await act(async () => current.finishSignIn(farmer));
    expect(current.security).toBe("unlock");
    expect(current.role).toBe("SELLER");
    expect(current.user).toEqual(farmer);
  },
);

it("preserves the entered phone and language when switching directly from login to registration", async () => {
  await act(async () => { tree = create(<AppProvider><Probe /></AppProvider>); });
  await act(async () => current.changeLocale("ha"));
  await act(async () => current.startRegistration("+2348012345678"));
  expect(current.route).toEqual({ name: "role", id: "+2348012345678", query: "register" });
  await act(async () => current.selectRole("SELLER"));
  expect(current.route).toEqual({ name: "phone", id: "+2348012345678" });
  expect(current.authIntent).toBe("REGISTER"); expect(current.locale).toBe("ha");
});
