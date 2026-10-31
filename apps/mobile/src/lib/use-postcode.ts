import { useEffect, useRef, useState } from "react";
import {
  normalizeDigitalPostcode, postcodeSuggestionQuery, postcodeLookupSchema, postcodeReverseSchema, postcodeSearchSchema,
  type PostcodeLookup, type PostcodeReverse, type PostcodeSearch,
} from "../../../../packages/contracts/src/addresses";

export type PostcodeControls = {
  value: string;
  revision?: string;
  coordinates?: { latitude: number; longitude: number };
  disabled?: boolean;
  request: (action: "lookup" | "search" | "reverse", body: unknown) => Promise<unknown>;
  onChange: (value: string) => void;
  onVerified: (lookup: PostcodeLookup) => void;
  onManual: () => void;
};
const contextKey = (value: PostcodeControls) => JSON.stringify([
  value.value, value.revision, value.coordinates, !!value.disabled,
]);

/** Shared mobile/web request lifecycle; late reads must not replace edited or abandoned addresses. */
export function usePostcode(controls: PostcodeControls) {
  const current = useRef(controls);
  current.current = controls;
  const sequence = useRef(0);
  const running = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState<PostcodeSearch | null>(null);
  const [candidate, setCandidate] = useState<PostcodeReverse["candidate"]>();
  const [pending, setPending] = useState<{ key: string; lookup: PostcodeLookup } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sequence.current++; };
  }, []);
  const reset = () => {
    sequence.current++;
    running.current = false;
    setBusy(false); setError(null); setMessage(""); setSearch(null); setCandidate(undefined); setPending(null);
  };
  const key = contextKey(controls);
  useEffect(() => { reset(); }, [key]);
  const edit = (value: string) => {
    reset();
    // Synchronous invalidation also covers input changes before the next render.
    current.current = { ...current.current, value };
    controls.onChange(value);
  };
  const run = async (action: "lookup" | "search" | "reverse") => {
    if (running.current || current.current.disabled) return;
    const snapshot = current.current;
    const key = contextKey(snapshot);
    const id = ++sequence.current;
    const active = () => mounted.current && sequence.current === id && contextKey(current.current) === key;
    running.current = true;
    setBusy(true); setError(null); setMessage(""); setSearch(null); setCandidate(undefined); setPending(null);
    try {
      if (action === "lookup") {
        snapshot.onChange(snapshot.value);
        if (!normalizeDigitalPostcode(snapshot.value)) throw { code: "POSTCODE_INVALID_FORMAT" };
        const parsed = postcodeLookupSchema.safeParse(await snapshot.request(action, { code: snapshot.value }));
        if (!active()) return;
        if (!parsed.success || parsed.data.postcode !== normalizeDigitalPostcode(snapshot.value)) throw { code: "POSTCODE_PROVIDER_RESPONSE_INVALID" };
        const result = parsed.data;
        if (!result.valid) {
          setError({ code: "POSTCODE_NOT_FOUND" });
        } else if (!result.verificationToken) {
          setError({ code: "POSTCODE_PROVIDER_RESPONSE_INVALID" });
        } else {
          setMessage(result.limitation || result.level === 1
            ? "Only postcode validity is available. Complete and confirm the address manually."
            : "Review the returned address fields. This lookup does not verify your map pin.");
          setPending({ key, lookup: result });
        }
      } else if (action === "search") {
        const parsed = postcodeSearchSchema.safeParse(await snapshot.request(action, { q: snapshot.value }));
        if (!active()) return;
        if (!parsed.success) throw { code: "POSTCODE_PROVIDER_RESPONSE_INVALID" };
        const result = parsed.data;
        setSearch(result);
        if (!result.suggestions.length) setMessage("No postcode suggestions found. Enter a full code or use manual address entry.");
      } else {
        if (!snapshot.coordinates) return;
        const parsed = postcodeReverseSchema.safeParse(await snapshot.request(action, snapshot.coordinates));
        if (!active()) return;
        if (!parsed.success) throw { code: "POSTCODE_PROVIDER_RESPONSE_INVALID" };
        const result = parsed.data;
        if (result.found && result.candidate) {
          setCandidate(result.candidate);
          setMessage("Nearby postcode candidate. Confirm it is your building, then check the postcode.");
        } else setMessage("No nearby postcode found. Enter the address and landmarks manually.");
      }
    } catch (e) {
      if (active()) setError(e);
    } finally {
      if (mounted.current && sequence.current === id) { running.current = false; setBusy(false); }
    }
  };
  return {
    busy, error, message, search, candidate, edit,
    pending: pending?.key === key ? pending.lookup : null,
    confirm: () => {
      if (!pending || pending.key !== contextKey(current.current) || current.current.disabled) return;
      setPending(null);
      current.current.onVerified(pending.lookup);
    },
    lookup: () => run("lookup"), find: () => run("search"), reverse: () => run("reverse"),
    choose: (code: string) => { if (search) edit(postcodeSuggestionQuery(controls.value, search.segment, code)); },
    manual: () => { reset(); controls.onManual(); },
  };
}
