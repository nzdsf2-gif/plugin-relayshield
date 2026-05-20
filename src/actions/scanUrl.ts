import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
} from "@elizaos/core";
import { apiPost, apiGet, getConfig } from "../client.js";
import type { ScanSubmitResult, ScanVerdictResult } from "../types.js";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS        = 12; // 60 seconds max

async function pollResult(
  config: ReturnType<typeof getConfig>,
  analysisId: string
): Promise<ScanVerdictResult | null> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await apiGet<ScanVerdictResult>(config, `/result/${analysisId}`);
    if (res.ok && res.data && res.data.verdict !== "pending" && res.data.status !== "pending") {
      return res.data;
    }
  }
  return null;
}

export const scanUrlAction: Action = {
  name: "SCAN_URL",
  similes: [
    "CHECK_URL",
    "URL_SAFETY_CHECK",
    "MALWARE_URL_SCAN",
    "PHISHING_URL_CHECK",
    "IS_URL_SAFE",
    "CHECK_LINK",
  ],
  description:
    "Scan a URL for malware and phishing across 70+ security engines. " +
    "Returns verdict: malicious, suspicious, or clean. " +
    "Use before navigating to an unfamiliar URL or when a user forwards a suspicious link.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Is https://suspicious-site.example.com safe?" },
      },
      {
        name: "agent",
        content: {
          text: "Scanning https://suspicious-site.example.com across 70+ security engines.",
          action: "SCAN_URL",
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

    const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/);
    if (!urlMatch) {
      await callback?.({
        text: "Please provide a URL starting with http:// or https:// to scan.",
      });
      return;
    }
    const url = urlMatch[0];

    const config = getConfig(runtime);
    logger.info(`[RelayShield] SCAN_URL url=${url}`);

    await callback?.({ text: `Submitting ${url} for analysis across 70+ engines…` });

    const submit = await apiPost<ScanSubmitResult>(config, "/scan-url", { url });

    if (!submit.ok || !submit.data?.analysis_id) {
      await callback?.({
        text: `URL scan submission failed: ${submit.error ?? "upstream error"}`,
      });
      return;
    }

    const { analysis_id } = submit.data;
    logger.info(`[RelayShield] SCAN_URL polling analysis_id=${analysis_id}`);

    const verdict = await pollResult(config, analysis_id);

    if (!verdict) {
      await callback?.({
        text:
          `⏱️ Scan for **${url}** timed out after 60 seconds. ` +
          `Poll manually: \`GET /v1/result/${analysis_id}\``,
      });
      return;
    }

    const emoji =
      verdict.verdict === "malicious"
        ? "🚨"
        : verdict.verdict === "suspicious"
        ? "⚠️"
        : "✅";

    const reply =
      `${emoji} **${url}**\n\n` +
      `• **Verdict:** ${verdict.verdict.toUpperCase()}\n` +
      `• **Malicious engines:** ${verdict.malicious ?? 0} / ${verdict.total_engines ?? "?"}\n` +
      `• **Suspicious:** ${verdict.suspicious ?? 0}\n` +
      `• **Clean:** ${verdict.harmless ?? 0}` +
      (verdict.verdict === "malicious"
        ? "\n\n**Do not visit this URL.**"
        : verdict.verdict === "suspicious"
        ? "\n\nProceed with caution."
        : "");

    await callback?.({ text: reply });
    return;
  },
};
