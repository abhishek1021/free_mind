/**
 * Run this ONCE locally to get your Telegram session string.
 * Usage: node scripts/telegram-auth.mjs
 *
 * You need TELEGRAM_API_ID and TELEGRAM_API_HASH in your .env.local first.
 * Get them from: https://my.telegram.org → API development tools
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import readline from "readline";
import { config } from "dotenv";

config({ path: ".env.local" });

const apiId = parseInt(process.env.TELEGRAM_API_ID ?? "0");
const apiHash = process.env.TELEGRAM_API_HASH ?? "";

if (!apiId || !apiHash) {
  console.error("❌  Add TELEGRAM_API_ID and TELEGRAM_API_HASH to .env.local first.");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => {
    const n = await ask("📱 Your Telegram phone number (with country code, e.g. +919876543210): ");
    return n.trim();
  },
  phoneCode: async () => {
    const c = await ask("🔑 OTP code Telegram just sent you: ");
    return c.trim();
  },
  password: async () => {
    const p = await ask("🔐 Two-factor password (press Enter if none): ");
    return p.trim();
  },
  onError: (err) => console.error("Error:", err),
});

const sessionString = client.session.save();

console.log("\n✅ Authentication successful!\n");
console.log("Add this to your .env.local:\n");
console.log(`TELEGRAM_SESSION=${sessionString}`);
console.log("\nAlso add it to Amplify → Hosting → Environment variables.");

await client.disconnect();
rl.close();
