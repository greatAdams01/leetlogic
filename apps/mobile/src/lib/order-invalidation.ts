const listeners = new Set<() => void>();
export function notifyOrderChanges() { for (const listener of listeners) listener(); }
export function subscribeOrderChanges(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
