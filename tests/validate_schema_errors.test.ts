import { describe, it, expect } from "vitest";
import Ajv, { ErrorObject } from "ajv";

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  return (
    errors?.map((e) => `${e.instancePath ?? '/'} ${e.message}`)?.join("; ") || "Invalid"
  );
}

describe("Schema validation error details", () => {
  it("uses instancePath (not dataPath) when formatting error details", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        items: { type: "array", items: { type: "number" } },
        settings: {
          type: "object",
          properties: { enabled: { type: "boolean" } },
          required: ["enabled"],
          additionalProperties: false,
        },
      },
      required: ["name", "items", "settings"],
      additionalProperties: false,
    } as const;

    const data = {
      name: 1, // should be string
      items: ["a"], // items should be numbers
      settings: {}, // missing required property 'enabled'
    };

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema as unknown as object);
    const ok = validate(data);
    expect(ok).toBe(false);

    const details = formatAjvErrors(validate.errors);

    // Must include instancePath-based locations
    expect(details).toContain("/name");
    expect(details).toContain("/items/0");
    expect(details).toContain("/settings");

    // Ensure we are not referencing deprecated dataPath anywhere
    expect(details).not.toContain("dataPath");

    // Sanity check: messages are joined with '; '
    expect(details.split("; ").length).toBeGreaterThanOrEqual(3);
  });
});
