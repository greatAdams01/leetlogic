import { Router, raw, type RequestHandler } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getConfig } from "../config.js";
import { AppError } from "../lib/errors.js";
import { redis } from "../lib/redis.js";
export const listingSpeechRouter = Router();
listingSpeechRouter.use(requireAuth("customer"));
const unavailable = () =>
  new AppError(
    503,
    "VOICE_UNAVAILABLE",
    "Voice listing is unavailable right now. You can continue by typing.",
  );
listingSpeechRouter.get("/capabilities", async (_req, res) => {
  const c = getConfig();
  if (!c.LISTING_ASR_ENABLED || !c.LISTING_ASR_TOKEN) {
    res.json({ enabled: false, languages: [] });
    return;
  }
  try {
    const response = await fetch(`${c.LISTING_ASR_URL.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const body = await response.json();
    res.json({
      enabled: response.ok && body.status === "ready",
      languages: response.ok ? ["en"] : [],
      provider: "meta",
    });
  } catch {
    res.json({ enabled: false, languages: [] });
  }
});
const parseAudio: RequestHandler = (req, res, next) =>
  raw({ type: ["audio/mp4", "audio/m4a", "audio/wav", "audio/ogg", "audio/webm"], limit: "2mb" })(
    req,
    res,
    (error) => {
      if (error?.type === "entity.too.large")
        return next(
          new AppError(
            413,
            "AUDIO_SIZE_LIMIT",
            "Please record an answer shorter than thirty seconds.",
          ),
        );
      next(error);
    },
  );
listingSpeechRouter.post("/transcribe", parseAudio, async (req, res) => {
  const c = getConfig();
  if (!c.LISTING_ASR_ENABLED || !c.LISTING_ASR_TOKEN) throw unavailable();
  if (req.query.language !== "en")
    throw new AppError(
      422,
      "VOICE_LANGUAGE_UNSUPPORTED",
      "English voice listing is available for testing.",
    );
  if (!Buffer.isBuffer(req.body) || req.body.length < 16)
    throw new AppError(422, "INVALID_AUDIO", "Record an answer before continuing.");
  const key = `rate:listing-asr:${req.auth!.sub}:${Math.floor(Date.now() / 60000)}`;
  const count = await redis().eval(
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end; return n",
    1,
    key,
  );
  if (Number(count) > 30)
    throw new AppError(
      429,
      "VOICE_RATE_LIMITED",
      "Too many voice attempts. Please wait a minute.",
      undefined,
      60,
    );
  let response: Response;
  try {
    response = await fetch(`${c.LISTING_ASR_URL.replace(/\/$/, "")}/transcribe?language=en`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.LISTING_ASR_TOKEN}`,
        "Content-Type": req.get("content-type")!,
      },
      body: new Uint8Array(req.body),
      signal: AbortSignal.timeout(40000),
    });
  } catch {
    throw unavailable();
  }
  if (response.status === 422)
    throw new AppError(422, "INVALID_AUDIO", "No clear answer was heard. Please record it again.");
  if (!response.ok) throw unavailable();
  const result = await response.json();
  if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 5000)
    throw unavailable();
  res.set("Cache-Control", "no-store");
  res.json({ text: result.text.trim(), language: "en" });
});
