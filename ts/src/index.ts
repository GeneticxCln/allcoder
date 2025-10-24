#!/usr/bin/env node
import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import Ajv, { type ValidateFunction } from 'ajv';
import { detectFormat, dumpStr, parseText, readData, type Format } from './lib/io.js';
import { deepMerge } from './lib/merge.js';
import { redactKeys } from './lib/redact.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('allcoder-ts')
    .description('Config toolkit CLI for JSON/YAML/TOML (TypeScript)')
    .version('0.1.0', '-v, --version', 'Show version');

  program
    .command('validate')
    .description('Validate files, optionally against a JSON Schema')
    .argument('<files...>', 'Files to validate')
    .option('-s, --schema <schemaFile>', 'Schema file (json/yaml/toml)')
    .action(async (files: string[], opts: { schema?: string }) => {
      let validateFn: ValidateFunction | null = null;
      if (opts.schema) {
        const fmt = detectFormat(opts.schema);
        const text = await fs.readFile(opts.schema, 'utf8');
        const schemaObj = parseText(text, fmt);
        const ajv = new Ajv({ allErrors: true, strict: false });
        validateFn = ajv.compile(schemaObj);
      }
      let okAll = true;
      for (const f of files) {
        try {
          const { data } = await readData(f);
          if (validateFn && !validateFn(data)) {
            okAll = false;
            console.error(`ERR ${f}: ${JSON.stringify(validateFn.errors)}`);
          } else {
            console.log(`OK  ${f}`);
          }
        } catch (e: any) {
          okAll = false;
          console.error(`ERR ${f}: ${e.message ?? String(e)}`);
        }
      }
      process.exitCode = okAll ? 0 : 1;
    });

  program
    .command('format')
    .description('Pretty-format JSON/YAML/TOML files')
    .argument('<files...>', 'Files to format')
    .option('-i, --in-place', 'Write back to files', false)
    .option('--check', 'Only check; exit non-zero if changes would be made', false)
    .action(async (files: string[], opts: { inPlace: boolean; check: boolean }) => {
      let wouldChange = false;
      for (const f of files) {
        const { data, format } = await readData(f);
        const out = dumpStr(data, format);
        const cur = await fs.readFile(f, 'utf8');
        if (out !== cur) {
          wouldChange = true;
          if (opts.inPlace) {
            await fs.writeFile(f, out, 'utf8');
            console.log(`UPDATED ${f}`);
          } else {
            console.log(`DIFFERS ${f}`);
          }
        }
      }
      if (opts.check && wouldChange) process.exitCode = 1;
    });

  program
    .command('convert')
    .description('Convert between JSON, YAML, TOML')
    .argument('<inputFile>', 'Input file')
    .requiredOption('--to <fmt>', 'Target format: json|yaml|toml')
    .option('-o, --output <file>', 'Output path')
    .action(async (inputFile: string, opts: { to: string; output?: string }) => {
      const { data } = await readData(inputFile);
      const toFmt = detectFormat(`dummy.${opts.to}`);
      const out = dumpStr(data, toFmt);
      if (opts.output) {
        await fs.writeFile(opts.output, out, 'utf8');
        console.log(`WROTE ${opts.output}`);
      } else {
        process.stdout.write(out);
      }
    });

  program
    .command('merge')
    .description('Merge multiple config files; later files override earlier ones')
    .argument('<inputs...>', 'Input files (2 or more)')
    .option('-o, --output <file>', 'Output file')
    .option('--deep', 'Deep merge nested mappings', true)
    .option('--to <fmt>', 'Force output format (json|yaml|toml)')
    .action(async (inputs: string[], opts: { output?: string; deep: boolean; to?: string }) => {
      if (inputs.length < 2) throw new Error('Provide at least two input files');
      let merged: any = null;
      let outFmt: Format | null = null;
      let i = 0;
      for (const p of inputs) {
        const { data, format } = await readData(p);
        if (i === 0) {
          merged = data;
          outFmt = format;
        } else {
          if (opts.deep) merged = deepMerge(merged, data);
          else if (isPlainObject(merged) && isPlainObject(data)) merged = { ...(merged as any), ...(data as any) };
          else merged = data;
          outFmt = format;
        }
        i++;
      }
      if (opts.to) outFmt = detectFormat(`dummy.${opts.to}`);
      if (!outFmt) throw new Error('Unknown output format');
      const out = dumpStr(merged, outFmt);
      if (opts.output) {
        await fs.writeFile(opts.output, out, 'utf8');
        console.log(`WROTE ${opts.output}`);
      } else {
        process.stdout.write(out);
      }
    });

  program
    .command('redact')
    .description('Redact sensitive keys recursively')
    .argument('<files...>', 'Files to redact')
    .requiredOption('-k, --keys <keys>', 'Comma-separated keys to redact')
    .option('-i, --in-place', 'Write changes back to files', false)
    .option('--mask <value>', 'Replacement value', '***REDACTED***')
    .action(async (files: string[], opts: { keys: string; inPlace: boolean; mask: string }) => {
      const keys = new Set(opts.keys.split(',').map((s) => s.trim()).filter(Boolean));
      for (const f of files) {
        const { data, format } = await readData(f);
        const red = redactKeys(data, keys, opts.mask);
        const out = dumpStr(red, format);
        if (opts.inPlace) {
          await fs.writeFile(f, out, 'utf8');
          console.log(`REDACTED ${f}`);
        } else {
          process.stdout.write(out);
        }
      }
    });

  program
    .command('serve')
    .description('Run the REST API service')
    .option('--host <host>', 'Host', '0.0.0.0')
    .option('--port <port>', 'Port', (v) => Number(v), 8000)
    .action(async (opts: { host: string; port: number }) => {
      const { buildServer } = await import('./api.js');
      const app = buildServer();
      await app.listen({ host: opts.host, port: opts.port });
      // Fastify keeps running
    });

  return program;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export async function main(argv = process.argv): Promise<void> {
  await buildProgram().parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // When executed directly
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
