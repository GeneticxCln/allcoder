import { describe, it, expect } from 'vitest';
import { deepMerge } from '../src/lib/merge.ts';
import { redactKeys } from '../src/lib/redact.ts';
import { detectFormat, parseText, dumpStr } from '../src/lib/io.ts';

describe('merge', () => {
  it('deep merges objects and concatenates arrays', () => {
    const a = { db: { ports: [5432], host: 'localhost' } };
    const b = { db: { ports: [5433], user: 'root' } };
    const out = deepMerge(a, b);
    expect(out.db.ports).toEqual([5432, 5433]);
    expect(out.db.user).toBe('root');
  });
});

describe('redact', () => {
  it('redacts keys recursively', () => {
    const obj = { password: 'x', nested: { token: 'y' } };
    const out = redactKeys(obj, new Set(['password', 'token']));
    expect(out).toEqual({ password: '***REDACTED***', nested: { token: '***REDACTED***' } });
  });
});

describe('io', () => {
  it('round-trips yaml and json', () => {
    const yamlFmt = detectFormat('a.yaml');
    const obj = parseText('name: Alice\n', yamlFmt);
    const s = dumpStr(obj, yamlFmt);
    expect(s).toContain('Alice');
    const jsonFmt = detectFormat('a.json');
    const s2 = dumpStr(obj, jsonFmt);
    expect(JSON.parse(s2).name).toBe('Alice');
  });
});
