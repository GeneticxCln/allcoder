export type RedactOptions = {
  keys?: string[];
  replacement?: unknown;
};

const DEFAULT_KEYS = [
  "password",
  "pass",
  "secret",
  "token",
  "apiKey",
  "apikey",
  "auth",
  "authorization",
  "key",
  "privateKey",
  "private_key",
  "client_secret",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export function redact(value: unknown, opts: RedactOptions = {}): unknown {
  const keys = (opts.keys ?? DEFAULT_KEYS).map((k) => k.toLowerCase());
  const replacement = Object.prototype.hasOwnProperty.call(opts, "replacement")
    ? opts.replacement
    : "[REDACTED]";

  function walk(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(walk);
    if (isPlainObject(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (keys.includes(k.toLowerCase())) {
          out[k] = replacement;
        } else {
          out[k] = walk(val);
        }
      }
      return out;
    }
    return v;
  }

  return walk(value);
}
