export type RedactOptions = {
  keys?: string[];
  keyRegex?: RegExp;
  paths?: string[]; // dot-separated paths
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
  const keyRegex = opts.keyRegex;
  const pathSet = new Set((opts.paths ?? []).map((p) => p.trim()).filter(Boolean));
  const replacement = Object.prototype.hasOwnProperty.call(opts, "replacement")
    ? opts.replacement
    : "[REDACTED]";

  function walk(v: unknown, pathAcc: (string | number)[] = []): unknown {
    if (Array.isArray(v)) return v.map((item, idx) => walk(item, [...pathAcc, idx]));
    if (isPlainObject(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        const fullPath = [...pathAcc, k].join(".");
        const byKey = keys.includes(k.toLowerCase());
        const byRegex = keyRegex ? keyRegex.test(k) : false;
        const byPath = pathSet.has(fullPath);
        if (byKey || byRegex || byPath) {
          out[k] = replacement;
        } else {
          out[k] = walk(val, [...pathAcc, k]);
        }
      }
      return out;
    }
    return v;
  }

  return walk(value);
}
