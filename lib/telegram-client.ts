import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

let cachedClient: TelegramClient | null = null;

export async function getTelegramClient(): Promise<TelegramClient> {
  if (cachedClient?.connected) return cachedClient;
  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION ?? ""),
    parseInt(process.env.TELEGRAM_API_ID ?? "0"),
    process.env.TELEGRAM_API_HASH ?? "",
    { connectionRetries: 3 }
  );
  await client.connect();
  cachedClient = client;
  return client;
}
