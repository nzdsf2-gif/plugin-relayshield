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
import type { DomainResult } from "../types.js";

export const checkDomainAction: Action = {
  name: "CHECK_DOMAIN_LOOKALIKES",
  similes: [
    "SCAN_DOMAIN",
    "DOMAIN_LOOKALIKE_SCAN",
    "TYPOSQUAT_CHECK",
    "PHISHING_DOMAIN_CHECK",
    "CHECK_DOMAIN_IMPERSONATORS",
  ],
  description:
    "Scan for typosquat and lookalike domains impersonating a brand. " +
    "Generates permutations and resolves via DNS with Certificate Transparency enrichment. " +
    "Use before a user clicks a link resembling a known brand domain.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Check for lookalike domains impersonating acme.com" },
      },
      {
        name: "agent",
        content: {
          text: "Scanning for typosquat domains targeting acme.com.",
          action: "CHECK_DOMAIN_LOOKALIKES",
        },
      },
    ],
    [
      {
        name: "user",
        content: { text: "Is this link safe? acme-login.com looks suspicious." },
      },
      {
        name: "agent",
        content: {
          text: "I'll scan for lookalike domains around acme.com to check.",
          action: "CHECK_DOMAIN_LOOKALIKES",
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

    // Extract domain — strip scheme and path
    const domainMatch = text.match(
      /(?:https?:\/\/)?([a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]\.[a-zA-Z]{2,})/
    );
    if (!domainMatch) {
      await callback?.({
        text: "Please provide a domain to scan for lookalikes (e.g. acme.com).",
      });
      return;
    }
    const domain = domainMatch[1].toLowerCase();

    const config = getConfig(runtime);
    logger.info(`[RelayShield] CHECK_DOMAIN_LOOKALIKES domain=${domain}`);

    const result = await apiPost<DomainResult>(config, "/domain", { domain });

    if (!result.ok || !result.data) {
      await callback?.({
        text: `Domain scan failed: ${result.error ?? "upstream error"}`,
      });
      return;
    }

    const { lookalikes_found, lookalikes, candidates_checked } = result.data;

    let reply: string;
    if (lookalikes_found === 0) {
      reply =
        `✅ No active lookalike domains found for **${domain}**.\n` +
        `(Checked ${candidates_checked} permutations)`;
    } else {
      const list = lookalikes
        .slice(0, 10)
        .map((l) => `• ${l.domain}`)
        .join("\n");
      reply =
        `⚠️ **${lookalikes_found}** active lookalike domain${lookalikes_found === 1 ? "" : "s"} found for **${domain}**:\n\n` +
        list +
        (lookalikes_found > 10 ? `\n…and ${lookalikes_found - 10} more.` : "") +
        `\n\n(Checked ${candidates_checked} permutations)\n\n` +
        "These domains are registered and resolving — potential phishing infrastructure.";
    }

    await callback?.({ text: reply });
    return;
  },
};
