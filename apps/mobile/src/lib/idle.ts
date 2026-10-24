/** Background refresh must not compete with mounting a screen or handling a tap. */
export function whenIdle(work: () => void): () => void {
  const idle = globalThis as typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  let cancelled = false;
  const run = () => {
    if (!cancelled) work();
  };
  if (idle.requestIdleCallback && idle.cancelIdleCallback) {
    const id = idle.requestIdleCallback(run, { timeout: 1000 });
    return () => {
      cancelled = true;
      idle.cancelIdleCallback!(id);
    };
  }
  const timer = setTimeout(run, 0);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
