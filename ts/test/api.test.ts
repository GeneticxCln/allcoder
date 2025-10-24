import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/api.ts';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

let cwd: string;

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), 'allcoder-ts-'));
});

afterAll(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('api', () => {
  it('version', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/version' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as any;
    expect(body.version).toBeDefined();
  });

  it('convert', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/convert',
      payload: { doc: { filename: 'a.yaml', content: 'name: Alice\n' }, to: 'json' },
    });
    expect(res.statusCode).toBe(200);
    expect(String(res.json().content)).toContain('Alice');
  });
});
