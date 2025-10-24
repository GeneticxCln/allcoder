#!/usr/bin/env node
import { Command, Option } from "commander";
import fg from "fast-glob";
import { detectFormatFromPath, parseByFormat, stringifyByFormat, type Format, readFileUtf8, writeFileUtf8, sortKeysDeep } from "./formats";
import { mergeDeep } from "./merge";
import { redact } from "./redact";
import pkg from "../package.json";
import Ajv, { ErrorObject } from "ajv";

async function readStdin(): Promise<string> {
  return await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function resolveFormat(fromOpt: string | undefined, file: string | undefined): Format {
  if (fromOpt) return fromOpt as Format;
  if (file) {
    const f = detectFormatFromPath(file);
    if (f) return f;
  }
  throw new Error("Unable to detect format; please specify --format");
}

function parseInput(text: string, format: Format): unknown {
  return parseByFormat(format, text);
}

async function expandFiles(patterns: string[]): Promise<string[]> {
  if (!patterns.length) return [];
  const files = await fg(patterns, { onlyFiles: true, unique: true, dot: false });
  return files;
}

const program = new Command();
program.name("allcoder").description("Config toolkit CLI").version(pkg.version ?? "0.0.0");

const formatOption = new Option("-f, --format <format>", "input/output format").choices([
  "json",
  "jsonc",
  "json5",
  "yaml",
  "toml",
]);

program
  .command("validate")
  .description("Validate a config file")
  .addOption(formatOption)
  .argument("[file]", "file to validate; omit to read from stdin")
  .option("--schema <file>", "JSON Schema file (json/yaml/toml/jsonc/json5)")
  .option("-q, --quiet", "quiet mode; exit code only")
  .action(async (file: string | undefined, opts: { format?: Format; quiet?: boolean; schema?: string }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fmt = resolveFormat(opts.format, file);
      const data = parseInput(text, fmt);
      if (opts.schema) {
        const schemaText = await readFileUtf8(opts.schema);
        const sFmt = detectFormatFromPath(opts.schema) ?? "json";
        const schema = parseInput(schemaText, sFmt) as object;
        const ajv = new Ajv({ allErrors: true });
        const validate = ajv.compile(schema);
        const ok = validate(data);
        if (!ok) {
          const details = (validate.errors ?? [])
            .map((e: ErrorObject) => `${e.instancePath ?? e.dataPath ?? '/'} ${e.message}`)
            .join("; ") || "Invalid";
          throw new Error(`Schema validation failed: ${details}`);
        }
      }
      if (!opts.quiet) console.log(`${file ?? "stdin"}: valid ${fmt.toUpperCase()}`);
      process.exitCode = 0;
    } catch (err) {
      if (!opts.quiet) console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program
  .command("format")
  .description("Format config file(s)")
  .addOption(formatOption)
  .argument("[files...]", "file(s) or glob(s) to format; omit to read from stdin")
  .option("-w, --write", "write result back to file (required for multiple files)")
  .option("--check", "check if files are formatted; exit 1 if changes would be made")
  .option("--sort-keys", "sort keys recursively")
  .option("--indent <n>", "indent size (JSON/YAML)", (v) => parseInt(v, 10), 2)
  .action(async (files: string[] | undefined, opts: { format?: Format; write?: boolean; check?: boolean; sortKeys?: boolean; indent?: number }) => {
    try {
      const patterns = files ?? [];
      if (patterns.length === 0) {
        // stdin mode
        const text = await readStdin();
        const fmt = resolveFormat(opts.format, undefined);
        const parsed = parseInput(text, fmt);
        const output = stringifyByFormat(fmt, parsed, { indent: opts.indent ?? 2, sortKeys: !!opts.sortKeys });
        if (opts.check) {
          if (output !== text) process.exitCode = 1; // changed
          return;
        }
        if (opts.write) throw new Error("--write not allowed in stdin mode");
        process.stdout.write(output);
        return;
      }

      const filesToProcess = await expandFiles(patterns);
      if (filesToProcess.length > 1 && !opts.write) {
        throw new Error("Formatting multiple files requires --write");
      }
      let changed = false;
      for (const file of filesToProcess) {
        const fmt = resolveFormat(opts.format, file);
        const text = await readFileUtf8(file);
        const parsed = parseInput(text, fmt);
        const output = stringifyByFormat(fmt, parsed, { indent: opts.indent ?? 2, sortKeys: !!opts.sortKeys });
        if (opts.check) {
          if (output !== text) {
            console.error(`${file}: needs formatting`);
            changed = true;
          }
          continue;
        }
        if (opts.write) {
          if (output !== text) await writeFileUtf8(file, output);
        } else {
          process.stdout.write(output);
        }
      }
      if (opts.check && changed) process.exitCode = 1;
    } catch (err) {
      console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program
  .command("convert")
  .description("Convert between JSON/YAML/TOML/JSONC/JSON5")
  .addOption(new Option("--from <format>", "source format").choices(["json", "jsonc", "json5", "yaml", "toml"]))
  .addOption(new Option("--to <format>", "target format").choices(["json", "jsonc", "json5", "yaml", "toml"]).makeOptionMandatory(true))
  .argument("[file]", "file to convert; omit to read from stdin")
  .option("--sort-keys", "sort keys recursively (affects JSON/YAML/TOML object order)")
  .option("--indent <n>", "indent size for JSON/YAML", (v) => parseInt(v, 10), 2)
  .action(async (file: string | undefined, opts: { from?: Format; to: Format; sortKeys?: boolean; indent?: number }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fromFmt = resolveFormat(opts.from, file);
      const data = parseInput(text, fromFmt);
      const output = stringifyByFormat(opts.to, data, { indent: opts.indent ?? 2, sortKeys: !!opts.sortKeys });
      process.stdout.write(output);
    } catch (err) {
      console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program
  .command("merge")
  .description("Deep merge multiple config files")
  .addOption(formatOption)
  .argument("<files...>", "files to merge (same format)")
  .option("--array <strategy>", "array strategy: replace|concat", (v) => (v === "concat" ? "concat" : "replace"), "replace")
  .option("--sort-keys", "sort keys in output")
  .option("--indent <n>", "indent size for JSON/YAML", (v) => parseInt(v, 10), 2)
  .action(async (files: string[], opts: { format?: Format; array?: "replace" | "concat"; sortKeys?: boolean; indent?: number }) => {
    try {
      if (files.length < 2) throw new Error("Provide at least two files to merge");
      const fmt = resolveFormat(opts.format, files[0]);
      let acc = parseInput(await readFileUtf8(files[0]), fmt);
      for (const f of files.slice(1)) {
        const next = parseInput(await readFileUtf8(f), fmt);
        acc = mergeDeep(acc as unknown, next, { arrayStrategy: opts.array }) as unknown;
      }
      const out = stringifyByFormat(fmt, acc, { indent: opts.indent ?? 2, sortKeys: !!opts.sortKeys });
      process.stdout.write(out);
    } catch (err) {
      console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program
  .command("redact")
  .description("Redact sensitive fields by key name, regex, or paths")
  .addOption(formatOption)
  .argument("[file]", "file to redact; omit to read from stdin")
  .option("--keys <list>", "comma-separated keys to redact (case-insensitive)")
  .option("--key-regex <pattern>", "regex to match key names (e.g. 'token|secret')")
  .option("--paths <list>", "comma-separated dot-paths to redact (e.g. 'a.b.c,users.0.password')")
  .option("--replacement <value>", "replacement value; defaults to [REDACTED]")
  .option("--indent <n>", "indent size for JSON/YAML", (v) => parseInt(v, 10), 2)
  .option("--sort-keys", "sort keys in output")
  .action(async (file: string | undefined, opts: { format?: Format; keys?: string; keyRegex?: string; paths?: string; replacement?: string; indent?: number; sortKeys?: boolean }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fmt = resolveFormat(opts.format, file);
      const data = parseInput(text, fmt);
      const keys = opts.keys ? opts.keys.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const paths = opts.paths ? opts.paths.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const keyRegex = opts.keyRegex ? new RegExp(opts.keyRegex, "i") : undefined;
      const redacted = redact(data, { keys, replacement: opts.replacement, paths, keyRegex });
      const output = stringifyByFormat(fmt, redacted, { indent: opts.indent ?? 2, sortKeys: !!opts.sortKeys });
      process.stdout.write(output);
    } catch (err) {
      console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

// Hidden util to sort keys of a file in-place
program
  .command("sort-keys")
  .description("Sort keys deeply in a file (utility)")
  .addOption(formatOption)
  .argument("[file]", "file to process; omit to read from stdin")
  .option("-w, --write", "write back to file")
  .option("--indent <n>", "indent for JSON/YAML", (v) => parseInt(v, 10), 2)
  .action(async (file: string | undefined, opts: { format?: Format; write?: boolean; indent?: number }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fmt = resolveFormat(opts.format, file);
      const data = parseInput(text, fmt);
      const sorted = sortKeysDeep(data);
      const out = stringifyByFormat(fmt, sorted, { indent: opts.indent ?? 2, sortKeys: false });
      if (opts.write) {
        if (!file) throw new Error("--write requires a file path");
        await writeFileUtf8(file, out);
      } else {
        process.stdout.write(out);
      }
    } catch (err) {
      console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program.parseAsync().catch((err) => {
  console.error(String((err as Error).message || err));
  process.exit(2);
});
