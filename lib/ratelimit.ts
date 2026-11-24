// Simple fixed-window limiter. NOTE: state lives in the memory of one server instance,
// so on serverless hosting it is best-effort. For hard limits swap this for Upstash Redis
// (@upstash/ratelimit) - the call signature below can stay the same.
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return true;
  }
  entry.n += 1;
  return entry.n <= max;
}
