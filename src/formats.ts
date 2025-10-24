import fs from "fs/promises";
import path from "path";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";
import YAML from "yaml";

export type Format = "json" | "yaml" | "toml";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

export function detectFormatFromPath(filePath: string): Format | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "json";
  if (ext === ".yml" || ext === ".yaml") return "yaml";
  if (ext === ".toml") return "toml";
  return null;
}

export function parseByFormat(format: Format, input: string): unknown {
  switch (format) {
    case "json":
      return JSON.parse(input) as unknown;
    case "yaml":
      return YAML.parse(input) as unknown;
    case "toml":
      return parseToml(input) as unknown;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export interface StringifyOptions {
  indent?: number;
  sortKeys?: boolean;
}

export function stringifyByFormat(
  format: Format,
  value: unknown,
  options: StringifyOptions = {}
): string {
  const { indent = 2, sortKeys = false } = options;
  const val = sortKeys ? sortKeysDeep(value) : value;
  switch (format) {
    case "json":
      return JSON.stringify(val, null, indent) + "\n";
    case "yaml":
      return YAML.stringify(val, { indent });
    case "toml":
      // toml library controls formatting; indent option may be ignored
      return stringifyToml(val as unknown as Parameters<typeof stringifyToml>[0]);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

export async function readFileUtf8(file: string): Promise<string> {
  return fs.readFile(file, "utf8");
}

export async function writeFileUtf8(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
}
