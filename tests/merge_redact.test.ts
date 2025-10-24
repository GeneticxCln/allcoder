import { describe, it, expect } from "vitest";
import { mergeDeep, redact } from "../src";

describe("merge & redact", () => {
  it("deep merges objects with array replace by default", () => {
    const a = { a: 1, b: { c: 1, d: 2 }, arr: [1, 2] };
    const b = { b: { c: 2, e: 3 }, f: 5, arr: [3] };
    const merged = mergeDeep(a, b);
    expect(merged).toStrictEqual({ a: 1, b: { c: 2, d: 2, e: 3 }, f: 5, arr: [3] });
  });

  it("can concat arrays when asked", () => {
    const a = { arr: [1, 2] };
    const b = { arr: [3] };
    const merged = mergeDeep(a, b, { arrayStrategy: "concat" });
    expect(merged).toStrictEqual({ arr: [1, 2, 3] });
  });

  it("redacts default sensitive keys", () => {
    const obj = { password: "p", nested: { apiKey: "x", ok: 1 } };
    const r = redact(obj);
    expect(r).toStrictEqual({ password: "[REDACTED]", nested: { apiKey: "[REDACTED]", ok: 1 } });
  });

  it("redacts custom keys with custom replacement", () => {
    const obj = { token: "abc", app: { secret: "def" } };
    const r = redact(obj, { keys: ["token"], replacement: null });
    expect(r).toStrictEqual({ token: null, app: { secret: "def" } });
  });
});
