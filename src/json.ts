export type JsonValidation =
  | { valid: true; value: unknown }
  | { valid: false; error: Error };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v));
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

export function validateJson(input: string): JsonValidation {
  try {
    const value = JSON.parse(input) as unknown;
    return { valid: true, value };
  } catch (e) {
    const error = e instanceof Error ? e : new Error("Invalid JSON");
    return { valid: false, error };
  }
}

export interface FormatJsonOptions {
  indent?: number;
  sortKeys?: boolean;
}

export function formatJson(
  input: string,
  options: FormatJsonOptions = {}
): string {
  const { indent = 2, sortKeys = false } = options;
  const parsed = JSON.parse(input) as unknown;
  const processed = sortKeys ? sortKeysDeep(parsed) : parsed;
  return JSON.stringify(processed, null, indent) + "\n";
}
