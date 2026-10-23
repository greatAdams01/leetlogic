export type IdentityData = {
  available: boolean;
  unavailableCode?: string | null;
  consentVersion: string;
  passed: boolean;
  check: null | {
    id?: string;
    createdAt?: string;
    status: string;
    mode: string;
    summary?: {
      providerCompleted: boolean;
      documentPassed: boolean;
      missingRequiredSteps: string[];
    } | null;
  };
};
export type IdentityOperation = "idle" | "loading" | "launching" | "checking";
type Snapshot = { data: IdentityData | null; operation: IdentityOperation; error: unknown | null };
type Dependencies = {
  read: () => Promise<IdentityData>;
  reconcile: () => Promise<unknown>;
  start: (consentVersion: string) => Promise<{ url: string | null; check: IdentityData["check"] }>;
  open: (url: string) => Promise<unknown>;
  onStatus: (passed: boolean) => void;
};

/** One owner for foreground actions; background reads may never launch a browser. */
export function createIdentityFlow(deps: Dependencies) {
  let state: Snapshot = { data: null, operation: "idle", error: null };
  const listeners = new Set<() => void>();
  let active = false;
  let revision = 0;
  let polling: number | null = null;
  let pollSerial = 0;
  let browserPending = false;
  let queuedReturn = false;
  const update = (patch: Partial<Snapshot>) => {
    state = { ...state, ...patch };
    if (active) listeners.forEach((listener) => listener());
  };
  const accept = (data: IdentityData) => {
    const previous = state.data?.passed;
    update({ data, ...(data.passed ? { error: null } : {}) });
    if (previous !== data.passed) deps.onStatus(data.passed);
  };
  const current = (token: number) => active && token === revision;
  const run = async (
    operation: Exclude<IdentityOperation, "idle">,
    work: (token: number) => Promise<void>,
  ) => {
    // This lock is synchronous: rapid taps cannot beat React's next render.
    if (!active || state.operation !== "idle") return;
    const token = ++revision;
    update({ operation, error: null });
    try {
      await work(token);
    } catch (error) {
      if (current(token)) update({ error });
    } finally {
      if (current(token)) {
        update({ operation: "idle" });
        if (queuedReturn) {
          queuedReturn = false;
          void check();
        }
      }
    }
  };
  const read = async (token: number) => {
    const data = await deps.read();
    if (current(token)) accept(data);
  };
  const check = () =>
    run("checking", async (token) => {
      if (!state.data?.passed && state.data?.check) await deps.reconcile();
      if (current(token)) await read(token);
    });
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    activate() {
      active = true;
    },
    dispose() {
      active = false;
      ++revision;
      browserPending = false;
      queuedReturn = false;
      polling = null;
      state = { ...state, operation: "idle" };
    },
    load: () =>
      run("loading", async (token) => {
        await read(token);
        if (current(token) && !state.data?.passed && state.data?.check) {
          update({ operation: "checking" });
          await deps.reconcile();
          if (current(token)) await read(token);
        }
      }),
    check,
    launch(consent: boolean) {
      if (!consent || !state.data || state.data.passed) return Promise.resolve();
      const version = state.data.consentVersion;
      const previousAttempt = !!state.data.check;
      return run(previousAttempt ? "checking" : "launching", async (token) => {
        if (previousAttempt) {
          await deps.reconcile();
          if (!current(token)) return;
          await read(token);
          if (!current(token) || state.data?.passed) return;
          update({ operation: "launching" });
        }
        const result = await deps.start(version);
        if (!current(token)) return;
        update({ data: { ...state.data!, check: result.check } });
        if (result.url) {
          if (new URL(result.url).origin !== "https://identity.dojah.io")
            throw new Error(
              "We couldn’t confirm your identity check. Please try again or contact support.",
            );
          browserPending = true;
          try {
            await deps.open(result.url);
          } catch (error) {
            browserPending = false;
            throw error;
          }
          // Opening a browser is not completion. Reconcile only on return or an explicit check.
        } else await read(token);
      });
    },
    returned() {
      if (!active || (!browserPending && state.data?.check?.status !== "PENDING")) return;
      browserPending = false;
      if (state.operation === "launching" || state.operation === "loading") queuedReturn = true;
      else if (state.operation === "idle") void check();
      // If already checking, the existing check satisfies this foreground event.
    },
    async poll() {
      if (
        !active ||
        polling ||
        state.operation !== "idle" ||
        state.data?.check?.status !== "PENDING"
      )
        return;
      const token = revision;
      const pollId = ++pollSerial;
      polling = pollId;
      try {
        await read(token);
      } catch {
        /* Keep the last state/error; background polling must not flash controls. */
      } finally {
        if (polling === pollId) polling = null;
      }
    },
  };
}
