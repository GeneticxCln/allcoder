export type MergeOptions = {
  arrayStrategy?: "replace" | "concat";
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export function mergeDeep<T>(
  target: T,
  source: unknown,
  options: MergeOptions = {}
): T {
  const { arrayStrategy = "replace" } = options;
  if (Array.isArray(target) && Array.isArray(source)) {
    return (arrayStrategy === "concat"
      ? ([...target, ...source] as unknown)
      : (source as unknown)) as T;
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const out: Record<string, unknown> = { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (k in out) {
        out[k] = mergeDeep(out[k] as unknown, v, options);
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }
  return (source as unknown) as T;
}
