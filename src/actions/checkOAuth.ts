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
import type { OAuthWatchlistResult } from "../types.js";

export const checkOAuthAction: Action = {
  name: "CHECK_OAUTH_WATCHLIST",
  similes: [
    "OAUTH_WATCHLIST_CHECK",
    "CHECK_OAUTH_APPS",
    "OAUTH_BREACH_CHECK",
    "CHECK_CONNECTED_APPS",
    "OAUTH_EXPOSURE_CHECK",
  ],
  description:
    "Check whether high-risk OAuth-connected SaaS apps (Slack, GitHub, Notion, Zapier, Vercel, HubSpot, AI tools) " +
    "linked to an email have appeared in recent breaches. A breached OAuth app may expose Google/Microsoft " +
    "account access without touching the primary password.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Check OAuth app exposure for user@example.com" },
      },
      {
        name: "agent",
        content: {
          text: "Checking OAuth-connected apps for breaches linked to user@example.com.",
          action: "CHECK_OAUTH_WATCHLIST",
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
        text: "Please provide an email address to check for OAuth app exposure.",
      });
      return;
    }
    const email = emailMatch[0].toLowerCase();

    const config = getConfig(runtime);
    logger.info(`[RelayShield] CHECK_OAUTH_WATCHLIST email=${email}`);

    const result = await apiPost<OAuthWatchlistResult>(config, "/oauth-watchlist", { email });

    if (!result.ok || !result.data) {
      await callback?.({
        text: `OAuth watchlist check failed: ${result.error ?? "upstream error"}`,
      });
      return;
    }

    const { matched_count, matched_apps, recommendation } = result.data;

    let reply: string;
    if (matched_count === 0) {
      reply = `✅ No breached OAuth-connected apps found for **${email}**.`;
    } else {
      const list = matched_apps
        .map(
          (a) =>
            `• **${a.app}** — breached ${a.breach_date} — [Revoke access](${a.revoke_url})`
        )
        .join("\n");
      reply =
        `⚠️ **${matched_count}** breached OAuth app${matched_count === 1 ? "" : "s"} linked to **${email}**:\n\n` +
        list +
        `\n\n${recommendation}`;
    }

    await callback?.({ text: reply });
    return;
  },
};
