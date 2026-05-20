import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,

  logger,
} from "@elizaos/core";
import { apiPost, getConfig } from "../client.js";
import type { BreachResult } from "../types.js";

export const checkBreachAction: Action = {
  name: "CHECK_BREACH",
  similes: [
    "CHECK_EMAIL_BREACH",
    "EMAIL_BREACH_CHECK",
    "HIBP_CHECK",
    "BREACH_LOOKUP",
    "CHECK_IF_EMAIL_BREACHED",
    "HAS_EMAIL_BEEN_BREACHED",
  ],
  description:
    "Check whether an email address appears in known data breaches (13B+ compromised accounts). " +
    "Use before trusting credential integrity or granting access based on email identity.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Check if user@example.com has been in any data breaches" },
      },
      {
        name: "agent",
        content: {
          text: "I'll check user@example.com against breach databases now.",
          action: "CHECK_BREACH",
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Has alice@company.com been pwned?" },
      },
      {
        name: "agent",
        content: {
          text: "Checking alice@company.com for breach exposure.",
          action: "CHECK_BREACH",
        },
      },
    ],
  ],
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const text = message.content.text ?? "";

    // Extract email from message
    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (!emailMatch) {
      await callback?.({
        text: "Please provide an email address to check for breaches.",
      });
      return;
    }
    const email = emailMatch[0].toLowerCase();

    const config = getConfig(runtime);
    logger.info(`[RelayShield] CHECK_BREACH email=${email}`);

    const result = await apiPost<BreachResult>(config, "/breach", { email });

    if (!result.ok || !result.data) {
      await callback?.({
        text: `Breach check failed: ${result.error ?? "upstream error"}`,
      });
      return;
    }

    const { breach_count, breaches } = result.data;

    let reply: string;
    if (breach_count === 0) {
      reply = `✅ **${email}** has not appeared in any known data breaches.`;
    } else {
      const topBreaches = breaches
        .slice(0, 5)
        .map((b) => `• **${b.name}** (${b.breach_date}) — ${b.data_classes.join(", ")}`)
        .join("\n");
      reply =
        `⚠️ **${email}** found in **${breach_count}** breach${breach_count === 1 ? "" : "es"}:\n\n` +
        topBreaches +
        (breach_count > 5 ? `\n\n…and ${breach_count - 5} more.` : "") +
        "\n\n**Recommended action:** Change passwords at affected services and enable 2FA.";
    }

    await callback?.({ text: reply });
    return;
  },
};
