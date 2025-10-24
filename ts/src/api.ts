import Fastify from 'fastify';
import Ajv, { type ValidateFunction } from 'ajv';
import { detectFormat, dumpStr, parseText, type Format } from './lib/io.js';
import { deepMerge } from './lib/merge.js';
import { redactKeys } from './lib/redact.js';

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get('/version', async () => ({ version: '0.1.0' }));

  app.post('/validate', async (req, reply) => {
    const body = req.body as any;
    const docs = (body?.docs ?? []) as { filename: string; content: string }[];
    const schemaDoc = body?.schema as { filename: string; content: string } | undefined;

    let validateFn: ValidateFunction | null = null;
    if (schemaDoc) {
      try {
        const fmt = detectFormat(schemaDoc.filename);
        const schemaObj = parseText(schemaDoc.content, fmt);
        const ajv = new Ajv({ allErrors: true, strict: false });
        validateFn = ajv.compile(schemaObj);
      } catch (e: any) {
        return reply.status(400).send({ error: `Invalid schema: ${e?.message ?? String(e)}` });
      }
    }

    const results: any[] = [];
    const errors: any[] = [];
    for (const d of docs) {
      try {
        const fmt = detectFormat(d.filename);
        const data = parseText(d.content, fmt);
        if (validateFn && !validateFn(data)) {
          results.push({ filename: d.filename, ok: false });
          errors.push({ filename: d.filename, error: validateFn.errors });
        } else {
          results.push({ filename: d.filename, ok: true });
        }
      } catch (e: any) {
        results.push({ filename: d.filename, ok: false });
        errors.push({ filename: d.filename, error: e?.message ?? String(e) });
      }
    }
    const status = results.every((r) => r.ok) ? 200 : 422;
    return reply.status(status).send({ results, errors });
  });

  app.post('/format', async (req) => {
    const body = req.body as any;
    const docs = (body?.docs ?? []) as { filename: string; content: string }[];
    const out = docs.map((d) => {
      const fmt = detectFormat(d.filename);
      const data = parseText(d.content, fmt);
      return { filename: d.filename, content: dumpStr(data, fmt) };
    });
    return { docs: out };
  });

  app.post('/convert', async (req) => {
    const body = req.body as any;
    const d = body?.doc as { filename: string; content: string };
    const to = body?.to as string;
    const srcFmt = detectFormat(d.filename);
    const data = parseText(d.content, srcFmt);
    const dstFmt = detectFormat(`dummy.${to}`);
    return { content: dumpStr(data, dstFmt) };
  });

  app.post('/merge', async (req) => {
    const body = req.body as any;
    const docs = (body?.docs ?? []) as { filename: string; content: string }[];
    const to = body?.to as string | undefined;
    const deep = (body?.deep as boolean | undefined) ?? true;

    let merged: any = null;
    let outFmt: Format | null = null;
    let i = 0;
    for (const d of docs) {
      const fmt = detectFormat(d.filename);
      const data = parseText(d.content, fmt);
      if (i === 0) {
        merged = data;
        outFmt = fmt;
      } else {
        if (deep) merged = deepMerge(merged, data);
        else if (isPlainObject(merged) && isPlainObject(data)) merged = { ...(merged as any), ...(data as any) };
        else merged = data;
        outFmt = fmt;
      }
      i++;
    }
    if (to) outFmt = detectFormat(`dummy.${to}`);
    if (!outFmt) throw new Error('Unknown output format');
    return { content: dumpStr(merged, outFmt) };
  });

  app.post('/redact', async (req) => {
    const body = req.body as any;
    const docs = (body?.docs ?? []) as { filename: string; content: string }[];
    const keysArr = (body?.keys ?? []) as string[];
    const mask = (body?.mask as string | undefined) ?? '***REDACTED***';
    const keys = new Set(keysArr);
    const out = docs.map((d) => {
      const fmt = detectFormat(d.filename);
      const data = parseText(d.content, fmt);
      const red = redactKeys(data, keys, mask);
      return { filename: d.filename, content: dumpStr(red, fmt) };
    });
    return { docs: out };
  });

  return app;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
