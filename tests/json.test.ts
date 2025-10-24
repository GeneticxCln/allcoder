import { describe, it, expect } from "vitest";
import { validateJson, formatJson } from "../src";

describe("JSON utilities", () => {
  it("validates valid JSON", () => {
    const input = '{"a":1,"b":[2,3],"c":{"d":4}}';
    const result = validateJson(input);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value).toStrictEqual({ a: 1, b: [2, 3], c: { d: 4 } });
    }
  });

  it("invalidates malformed JSON", () => {
    const input = '{"a":1,,}';
    const result = validateJson(input);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  it("formats JSON with default indent and preserves key order", () => {
    const input = '{"b":1,"a":{"d":2,"c":1}}';
    const output = formatJson(input);
    expect(output).toBe(`{
  "b": 1,
  "a": {
    "d": 2,
    "c": 1
  }
}\n`);
  });

  it("formats JSON with sorted keys deeply", () => {
    const input = '{"b":1,"a":{"d":2,"c":1}}';
    const output = formatJson(input, { sortKeys: true });
    expect(output).toBe(`{
  "a": {
    "c": 1,
    "d": 2
  },
  "b": 1
}\n`);
  });
});
