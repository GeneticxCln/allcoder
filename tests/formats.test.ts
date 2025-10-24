import { describe, it, expect } from "vitest";
import { parseByFormat, stringifyByFormat, sortKeysDeep } from "../src";

describe("YAML & TOML", () => {
  it("parses and stringifies YAML", () => {
    const yaml = "a: 1\nb:\n  - 2\n  - 3\n";
    const data = parseByFormat("yaml", yaml) as unknown;
    expect(data).toStrictEqual({ a: 1, b: [2, 3] });
    const out = stringifyByFormat("yaml", data, { indent: 2 });
    expect(out).toBe(yaml);
  });

  it("round-trips TOML", () => {
    const obj = { a: 1, arr: [1, 2], nested: { c: 2 } };
    const toml = stringifyByFormat("toml", obj);
    const back = parseByFormat("toml", toml);
    expect(back).toStrictEqual(obj);
  });

  it("sorts keys deeply before stringify", () => {
    const obj = { b: 1, a: { d: 2, c: 1 } };
    const sorted = sortKeysDeep(obj);
    const yaml = stringifyByFormat("yaml", sorted);
    expect(yaml).toBe("a:\n  c: 1\n  d: 2\nb: 1\n");
  });
});
