// A tiny storage layer for push subscriptions. Runs on the local filesystem
// with zero setup for development, and on Upstash Redis in production (set the
// two UPSTASH_* env vars). The interface is deliberately small.

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PushRecord } from "./types";

export function idForEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("base64url").slice(0, 24);
}

export interface SubscriptionStore {
  upsert(rec: PushRecord): Promise<void>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<PushRecord | null>;
  all(): Promise<PushRecord[]>;
  markNotified(id: string, eventId: string, at: number): Promise<void>;
}

// ── File store (dev) ───────────────────────────────────────────────────────
class FileStore implements SubscriptionStore {
  private file = path.join(process.cwd(), ".data", "subscriptions.json");

  private async read(): Promise<Record<string, PushRecord>> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  private async write(map: Record<string, PushRecord>): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(map, null, 2));
  }

  async upsert(rec: PushRecord) {
    const map = await this.read();
    map[rec.id] = { ...map[rec.id], ...rec };
    await this.write(map);
  }
  async remove(id: string) {
    const map = await this.read();
    delete map[id];
    await this.write(map);
  }
  async get(id: string) {
    return (await this.read())[id] ?? null;
  }
  async all() {
    return Object.values(await this.read());
  }
  async markNotified(id: string, eventId: string, at: number) {
    const map = await this.read();
    const rec = map[id];
    if (!rec) return;
    rec.notified = pruneNotified({ ...rec.notified, [eventId]: at });
    await this.write(map);
  }
}

// ── Upstash Redis store (prod) ─────────────────────────────────────────────
class UpstashStore implements SubscriptionStore {
  private redis: import("@upstash/redis").Redis;
  private setKey = "lookup:subs";
  constructor(url: string, token: string, Redis: typeof import("@upstash/redis").Redis) {
    this.redis = new Redis({ url, token });
  }
  private key(id: string) {
    return `lookup:sub:${id}`;
  }
  async upsert(rec: PushRecord) {
    await this.redis.set(this.key(rec.id), rec);
    await this.redis.sadd(this.setKey, rec.id);
  }
  async remove(id: string) {
    await this.redis.del(this.key(id));
    await this.redis.srem(this.setKey, id);
  }
  async get(id: string) {
    return (await this.redis.get<PushRecord>(this.key(id))) ?? null;
  }
  async all() {
    const ids = await this.redis.smembers(this.setKey);
    if (!ids.length) return [];
    const recs = await Promise.all(ids.map((id) => this.get(id)));
    return recs.filter((r): r is PushRecord => r !== null);
  }
  async markNotified(id: string, eventId: string, at: number) {
    const rec = await this.get(id);
    if (!rec) return;
    rec.notified = pruneNotified({ ...rec.notified, [eventId]: at });
    await this.redis.set(this.key(id), rec);
  }
}

// keep the dedupe map from growing forever: drop entries older than 3 days
function pruneNotified(n: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(n)) if (v >= cutoff) out[k] = v;
  return out;
}

let cached: SubscriptionStore | null = null;

export async function getStore(): Promise<SubscriptionStore> {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const { Redis } = await import("@upstash/redis");
    cached = new UpstashStore(url, token, Redis);
  } else {
    cached = new FileStore();
  }
  return cached;
}
