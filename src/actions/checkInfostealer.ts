import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type HandlerOptions,
  logger,
} from "@elizaos/core";
import { apiPost, getConfig } from "../client.js";
import type { InfostealerResult } from "../types.js";

export const checkInfostealerAction: Action = {
  name: "CHECK_INFOSTEALER",
  similes: [
    "INFOSTEALER_CHECK",
    "MALWARE_CREDENTIAL_CHECK",
    "STEALER_LOG_CHECK",
    "DEVICE_COMPROMISE_CHECK",
    "CAVALIER_CHECK",
    "HAS_EMAIL_BEEN_STOLEN_BY_MALWARE",
  ],
  description:
    "Check whether an email address was harvested by infostealer malware " +
    "(RedLine, Raccoon, Vidar, etc.) using Hudson Rock Cavalier. " +
    "Returns found (bool), stealer count, and per-infection details: " +
    "date compromised, OS, malware path, corporate and personal credential counts. " +
    "Unlike HIBP breach checks, an infostealer hit means the device itself was " +
    "compromised — all stored passwords, session cookies, and crypto keys are at risk. " +
    "Use when a user suspects malware infection or reports unexpected account takeovers.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Has user@example.com been stolen by malware?" },
      },
      {
        name: "agent",
        content: {
          text: "Checking user@example.com against infostealer logs now.",
          action: "CHECK_INFOSTEALER",
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Check if alice@company.com appears in any infostealer databases" },
      },
      {
        name: "agent",
        content: {
          text: "Scanning Alice's email against Hudson Rock Cavalier infostealer logs.",
          action: "CHECK_INFOSTEALER",
        },
      },
    ],
  ],
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback,
    _responses?: Memory[]
  ) => {
    const text = message.content.text ?? "";

    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (!emailMatch) {
      await callback?.({
        text: "Please provide an email address to check for infostealer compromise.",
      });
      return;
    }
    const email = emailMatch[0].toLowerCase();

    const config = getConfig(runtime);
    logger.info(`[RelayShield] CHECK_INFOSTEALER email=${email}`);

    const result = await apiPost<InfostealerResult>(config, "/infostealer", { email });

    if (!result.ok || !result.data) {
      await callback?.({
        text: `Infostealer check failed: ${result.error ?? "upstream error"}`,
      });
      return;
    }

    const { found, stealer_count, stealers } = result.data;

    let reply: string;
    if (!found || stealer_count === 0) {
      reply =
        `✅ **${email}** was not found in any infostealer logs.\n\n` +
        `_This checks Hudson Rock's Cavalier database. A clean result does not guarantee ` +
        `the device has never been infected — run an antivirus scan to be sure._`;
    } else {
      const topStealers = stealers
        .slice(0, 3)
        .map((s) =>
          `• **${s.date_compromised ?? "unknown date"}** — ${s.operating_system ?? "unknown OS"}\n` +
          `  ${s.total_corporate_services ?? 0} corporate + ${s.total_user_services ?? 0} personal credentials stolen`
        )
        .join("\n");

      reply =
        `🦠 **${email}** found in **${stealer_count}** infostealer log${stealer_count === 1 ? "" : "s"}:\n\n` +
        topStealers +
        (stealer_count > 3 ? `\n\n…and ${stealer_count - 3} more infection${stealer_count - 3 === 1 ? "" : "s"}.` : "") +
        "\n\n**What this means:** An infostealer malware infection harvested credentials from this device. " +
        "All stored passwords, session cookies, and crypto keys are compromised.\n\n" +
        "**Recommended actions:**\n" +
        "• Change all passwords immediately from a clean device\n" +
        "• Enable 2FA on every account\n" +
        "• Revoke all active sessions (Google, Microsoft, social media)\n" +
        "• Run an antivirus scan (Malwarebytes Free) before changing passwords on the infected device";
    }

    await callback?.({ text: reply });
    return;
  },
};
