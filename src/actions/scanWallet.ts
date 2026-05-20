import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from "@elizaos/core";
import { apiPost, getConfig } from "../client.js";
import type { WalletRiskResult } from "../types.js";

export const scanWalletAction: Action = {
  name: "SCAN_WALLET",
  similes: [
    "CHECK_WALLET",
    "WALLET_RISK_CHECK",
    "WALLET_SAFETY_CHECK",
    "EVM_WALLET_SCAN",
    "CHECK_WALLET_RISK",
    "IS_WALLET_SAFE",
  ],
  description:
    "Check an EVM or Solana wallet address for on-chain risk signals — blacklists, phishing associations, " +
    "dark web activity, cybercrime flags. Returns risk level (LOW/MEDIUM/HIGH). " +
    "Use before sending funds to an unknown address.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Is wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 safe to send to?" },
      },
      {
        name: "agent",
        content: {
          text: "Scanning 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 for risk signals.",
          action: "SCAN_WALLET",
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

    // Match EVM (0x) or Solana (base58, 32-44 chars) addresses
    const evmMatch     = text.match(/0x[0-9a-fA-F]{40}/);
    const solanaMatch  = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    const address      = evmMatch?.[0] ?? solanaMatch?.[0];

    if (!address) {
      await callback?.({
        text: "Please provide a wallet address (EVM 0x... or Solana base58) to scan.",
      });
      return;
    }

    const config  = getConfig(runtime);
    const chain   = evmMatch ? "evm" : "solana";
    logger.info(`[RelayShield] SCAN_WALLET address=${address} chain=${chain}`);

    const endpoint = chain === "solana" ? "/wallet-risk" : "/wallet-risk";
    const result   = await apiPost<WalletRiskResult>(config, endpoint, { address });

    if (!result.ok || !result.data) {
      await callback?.({
        text: `Wallet scan failed: ${result.error ?? "upstream error"}`,
      });
      return;
    }

    const { risk_level, risk_flags, chain: detectedChain } = result.data;

    const emoji = risk_level === "HIGH" ? "🚨" : risk_level === "MEDIUM" ? "⚠️" : "✅";
    let reply =
      `${emoji} **${address}** — Risk level: **${risk_level}** (${detectedChain ?? chain})\n\n`;

    if (risk_flags.length > 0) {
      reply += "**Flags:**\n" + risk_flags.map((f) => `• ${f}`).join("\n");
      if (risk_level === "HIGH") {
        reply += "\n\n**Do not send funds to this address.**";
      }
    } else {
      reply += "No risk flags detected.";
    }

    await callback?.({ text: reply });
    return;
  },
};
