/** Separate balance-check retries from durable payment processing. */
export function startPaymentSchedule(tasks: {
  enabled: () => boolean;
  jobs: () => Promise<unknown>;
  reconcile: () => Promise<unknown>;
  report: (error: unknown, stage: "jobs" | "balances", retryInSeconds: number) => void;
}) {
  let running = false;
  let nextJobs = 0,
    nextBalance = 0;
  let jobFailures = 0,
    balanceFailures = 0;
  const backoff = (failures: number) => Math.min(3600000, 300000 * 2 ** Math.min(failures - 1, 4));
  const timer = setInterval(async () => {
    if (running || !tasks.enabled()) return;
    running = true;
    try {
      if (Date.now() >= nextJobs) {
        try {
          await tasks.jobs();
          jobFailures = 0;
          nextJobs = 0;
        } catch (error) {
          const delay = backoff(++jobFailures);
          nextJobs = Date.now() + delay;
          tasks.report(error, "jobs", delay / 1000);
        }
      }
      if (Date.now() >= nextBalance) {
        try {
          await tasks.reconcile();
          balanceFailures = 0;
          nextBalance = Date.now() + 86400000;
        } catch (error) {
          const delay = backoff(++balanceFailures);
          nextBalance = Date.now() + delay;
          tasks.report(error, "balances", delay / 1000);
        }
      }
    } finally {
      running = false;
    }
  }, 15000);
  timer.unref();
  return () => clearInterval(timer);
}
