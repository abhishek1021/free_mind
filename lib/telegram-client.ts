import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

// ── Per-worker concurrency semaphore ──────────────────────────────────────────
// Limits simultaneous Telegram connections within a single Next.js worker.
// Without this, 20 video cards rendering at once each fire a media request →
// 20 concurrent MTProto connections from the same session → AUTH_KEY_DUPLICATED.
const MAX_CONCURRENT = 3;
const g = global as typeof global & {
  _tgSemCount?: number;
  _tgSemQueue?: Array<() => void>;
};
if (g._tgSemCount === undefined) g._tgSemCount = 0;
if (!g._tgSemQueue) g._tgSemQueue = [];

async function acquireSem(): Promise<void> {
  if (g._tgSemCount! < MAX_CONCURRENT) { g._tgSemCount!++; return; }
  return new Promise((resolve) => g._tgSemQueue!.push(resolve));
}
function releaseSem(): void {
  if (g._tgSemQueue!.length > 0) { g._tgSemQueue!.shift()!(); }
  else { g._tgSemCount!--; }
}

function makeClient(): TelegramClient {
  return new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION ?? ""),
    parseInt(process.env.TELEGRAM_API_ID ?? "0"),
    process.env.TELEGRAM_API_HASH ?? "",
    { connectionRetries: 2, retryDelay: 1000, autoReconnect: false }
  );
}

export async function withTelegramClient<T>(
  fn: (client: TelegramClient) => Promise<T>
): Promise<T> {
  await acquireSem();
  const client = makeClient();
  try {
    await client.connect();
    return await fn(client);
  } catch (err) {
    if (String(err).includes("AUTH_KEY_DUPLICATED")) {
      console.warn("[telegram] AUTH_KEY_DUPLICATED — waiting 3s then retrying");
      try { await client.disconnect(); } catch { /* ignore */ }
      // Jitter prevents thundering-herd on simultaneous retries
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      const retry = makeClient();
      try {
        await retry.connect();
        return await fn(retry);
      } finally {
        try { await retry.disconnect(); } catch { /* ignore */ }
      }
    }
    throw err;
  } finally {
    try { await client.disconnect(); } catch { /* ignore */ }
    releaseSem();
  }
}

export async function getTelegramClient(): Promise<TelegramClient> {
  throw new Error("Use withTelegramClient()");
}
export async function resetTelegramClient(): Promise<void> { /* no-op */ }
