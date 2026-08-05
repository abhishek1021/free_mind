import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

// Use global so the singleton survives Next.js HMR module reloads in dev.
// In production there is only one module instance anyway.
const g = global as typeof global & { _tgClient?: TelegramClient };

export async function getTelegramClient(): Promise<TelegramClient> {
  if (g._tgClient?.connected) return g._tgClient;

  // Disconnect any stale client before creating a new one — prevents
  // AUTH_KEY_DUPLICATED from two live connections using the same session.
  if (g._tgClient) {
    try { await g._tgClient.disconnect(); } catch { /* already dead */ }
    g._tgClient = undefined;
  }

  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION ?? ""),
    parseInt(process.env.TELEGRAM_API_ID ?? "0"),
    process.env.TELEGRAM_API_HASH ?? "",
    { connectionRetries: 3 }
  );

  await client.connect();
  g._tgClient = client;
  return client;
}
