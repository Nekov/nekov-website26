// Storage adapters. Production uses Supabase through its REST API with the service role key (server only).
// Without SUPABASE_URL the app falls back to local JSON files for development and tests.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const envName = (env) => (env.SITE_ENV === 'production' && (!env.VERCEL_ENV || env.VERCEL_ENV === 'production') ? 'production' : 'staging');

function supabase(env) {
  const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const call = async (path, init = {}) => {
    const res = await fetch(base + path, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok) throw new Error(`supabase ${res.status}`); // never include the body: it may hold personal data
    return res.status === 204 ? null : res.json();
  };
  return {
    kind: 'supabase',
    async get(hash) { const r = await call(`/applications?session_hash=eq.${encodeURIComponent(hash)}&select=*`); return r[0] || null; },
    async getById(id) { const r = await call(`/applications?id=eq.${encodeURIComponent(id)}&select=*`); return r[0] || null; },
    async create(row) { const r = await call('/applications', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...row, environment: envName(env) }) }); return r[0]; },
    async update(hash, patch) { const r = await call(`/applications?session_hash=eq.${encodeURIComponent(hash)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }); return r[0]; },
    async event(row) { await call('/events', { method: 'POST', body: JSON.stringify({ ...row, environment: envName(env) }) }); },
  };
}

function local(env) {
  const dir = env.LEADS_DIR ? join(env.LEADS_DIR, 'apply') : env.VERCEL ? join(tmpdir(), 'apply') : join('data', 'apply');
  const file = join(dir, `${envName(env)}-applications.json`);
  const read = async () => { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return {}; } };
  const write = async (db) => { await mkdir(dir, { recursive: true }); await writeFile(file, JSON.stringify(db)); };
  return {
    kind: 'local',
    async get(hash) { return (await read())[hash] || null; },
    async getById(id) { return Object.values(await read()).find((r) => r.id === id) || null; },
    async create(row) { const db = await read(); const r = { id: crypto.randomUUID(), started_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'new', environment: envName(env), ...row }; db[row.session_hash] = r; await write(db); return r; },
    async update(hash, patch) { const db = await read(); if (!db[hash]) return null; db[hash] = { ...db[hash], ...patch, updated_at: new Date().toISOString() }; await write(db); return db[hash]; },
    async event(row) { await mkdir(dir, { recursive: true }); await appendFile(join(dir, `${envName(env)}-events.jsonl`), JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n'); },
  };
}

export const getStore = (env = process.env) => (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? supabase(env) : local(env));
export { envName };
