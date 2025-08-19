// utils/notify.js
import axios from "axios";

export async function notifyDiscord(message) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  try {
    await axios.post(url, { content: message });
  } catch (err) {
    console.warn("Failed to notify Discord:", err.message);
  }
}