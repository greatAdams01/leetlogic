/** Share pending work (not its result) and retry normally after success or failure. */
export function singleFlight<Key, Value>(load: (key: Key) => Promise<Value>) {
  const pending = new Map<Key, Promise<Value>>();
  return (key: Key): Promise<Value> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve()
      .then(() => load(key))
      .finally(() => {
        if (pending.get(key) === request) pending.delete(key);
      });
    pending.set(key, request);
    return request;
  };
}

/** Cache successful immutable assets; a failed read is retryable. */
export function assetCache<Key, Value>(load: (key: Key) => Promise<Value>) {
  const values = new Map<Key, Value>();
  const read = singleFlight(async (key: Key) => {
    const value = await load(key);
    values.set(key, value);
    return value;
  });
  return {
    peek: (key: Key) => values.get(key),
    read: (key: Key) => (values.has(key) ? Promise.resolve(values.get(key)!) : read(key)),
  };
}
