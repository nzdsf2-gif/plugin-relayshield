import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from "@elizaos/core";
import { apiPost, getConfig } from "../client.js";
import type { SimSwapResult } from "../types.js";

export const checkSimSwapAction: Action = {
  name: "CHECK_SIM_SWAP",
  similes: [
    "SIM_SWAP_CHECK",
    "DETECT_SIM_SWAP",
    "CHECK_PHONE_SIM_SWAP",
    "ESIM_CHECK",
    "CARRIER_CHECK",
  ],
  description:
    "Detect whether a SIM swap or eSIM provisioning event occurred on a phone number in the last 24 hours " +
    "using live carrier data. Use before completing SMS-based authentication or high-value transfers.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Check if +14155551234 has had a SIM swap recently" },
      },
      {
        name: "agent",
        content: {
          text: "Checking +14155551234 for recent SIM swap activity via live carrier data.",
          action: "CHECK_SIM_SWAP",
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

    // Extract E.164 phone number
    const phoneMatch = text.match(/\+?1?\s?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
    if (!phoneMatch) {
      await callback?.({
        text: "Please provide a phone number in E.164 format (e.g. +14155551234) to check for SIM swap.",
      });
      return false;
    }
    // Normalise to E.164
    const phone = "+" + phoneMatch[0].replace(/\D/g, "");

    const config = getConfig(runtime);
    logger.info(`[RelayShield] CHECK_SIM_SWAP phone=${phone}`);

    const result = await apiPost<SimSwapResult>(config, "/sim-swap", { phone });

    if (!result.ok || !result.data) {
      await callback?.({
        text: `SIM swap check failed: ${result.error ?? "upstream error"}`,
      });
      return false;
    }

    const { swapped, swap_timestamp, carrier } = result.data;

    let reply: string;
    if (swapped) {
      reply =
        `🚨 **SIM swap detected** on ${phone}!\n\n` +
        `• **When:** ${swap_timestamp || "within last 24 hours"}\n` +
        `• **Current carrier:** ${carrier || "unknown"}\n\n` +
        "**Do not proceed** with SMS-based authentication. The phone number may be under attacker control.";
    } else {
      reply =
        `✅ No SIM swap detected on **${phone}**.\n` +
        `• **Carrier:** ${carrier || "unknown"}\n` +
        "Safe to proceed with SMS-based verification.";
    }

    await callback?.({ text: reply });
    return true;
  },
};
