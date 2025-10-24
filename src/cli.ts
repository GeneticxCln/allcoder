#!/usr/bin/env node
import { Command, Option } from "commander";
import { detectFormatFromPath, parseByFormat, stringifyByFormat, type Format, readFileUtf8, writeFileUtf8, sortKeysDeep } from "./formats";
import { mergeDeep } from "./merge";
import { redact } from "./redact";
import pkg from "../package.json";

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

const program = new Command();
program.name("allcoder").description("Config toolkit CLI").version(pkg.version ?? "0.0.0");

const formatOption = new Option("-f, --format <format>", "input/output format").choices([
  "json",
  "yaml",
  "toml",
]);

program
  .command("validate")
  .description("Validate a config file")
  .addOption(formatOption)
  .argument("[file]", "file to validate; omit to read from stdin")
  .option("-q, --quiet", "quiet mode; exit code only")
  .action(async (file: string | undefined, opts: { format?: Format; quiet?: boolean }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fmt = resolveFormat(opts.format, file);
      parseInput(text, fmt);
      if (!opts.quiet) console.log(`${file ?? "stdin"}: valid ${fmt.toUpperCase()}`);
      process.exitCode = 0;
    } catch (err) {
      if (!opts.quiet) console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program
  .command("format")
  .description("Format a config file")
  .addOption(formatOption)
  .argument("[file]", "file to format; omit to read from stdin")
  .option("-w, --write", "write result back to file")
  .option("--sort-keys", "sort keys recursively")
  .option("--indent <n>", "indent size (JSON/YAML)", (v) => parseInt(v, 10), 2)
  .action(async (file: string | undefined, opts: { format?: Format; write?: boolean; sortKeys?: boolean; indent?: number }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fmt = resolveFormat(opts.format, file);
      const parsed = parseInput(text, fmt);
      const output = stringifyByFormat(fmt, parsed, { indent: opts.indent ?? 2, sortKeys: !!opts.sortKeys });
      if (opts.write) {
        if (!file) throw new Error("--write requires a file path");
        await writeFileUtf8(file, output);
      } else {
        process.stdout.write(output);
      }
    } catch (err) {
      console.error(String((err as Error).message || err));
      process.exitCode = 2;
    }
  });

program
  .command("convert")
  .description("Convert between JSON/YAML/TOML")
  .addOption(new Option("--from <format>", "source format").choices(["json", "yaml", "toml"]))
  .addOption(new Option("--to <format>", "target format").choices(["json", "yaml", "toml"]).makeOptionMandatory(true))
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
  .description("Redact sensitive fields by key name")
  .addOption(formatOption)
  .argument("[file]", "file to redact; omit to read from stdin")
  .option("--keys <list>", "comma-separated keys to redact (case-insensitive)")
  .option("--replacement <value>", "replacement value; defaults to [REDACTED]")
  .option("--indent <n>", "indent size for JSON/YAML", (v) => parseInt(v, 10), 2)
  .option("--sort-keys", "sort keys in output")
  .action(async (file: string | undefined, opts: { format?: Format; keys?: string; replacement?: string; indent?: number; sortKeys?: boolean }) => {
    try {
      const text = file ? await readFileUtf8(file) : await readStdin();
      const fmt = resolveFormat(opts.format, file);
      const data = parseInput(text, fmt);
      const keys = opts.keys ? opts.keys.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
      const redacted = redact(data, { keys, replacement: opts.replacement });
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
