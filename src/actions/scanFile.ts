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
const MAX_POLLS        = 18; // 90 seconds max — file scans take longer

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

export const scanFileAction: Action = {
  name: "SCAN_FILE",
  similes: [
    "CHECK_FILE",
    "FILE_MALWARE_SCAN",
    "ANTIVIRUS_SCAN",
    "SCAN_ATTACHMENT",
    "IS_FILE_SAFE",
    "CHECK_DOWNLOAD",
  ],
  description:
    "Scan a file URL for malware across 70+ antivirus engines. " +
    "Returns verdict: malicious, suspicious, or clean. " +
    "Use when a user receives an email attachment and shares the download link.",
  validate: async (runtime: IAgentRuntime) => {
    const apiKey   = runtime.getSetting("RELAYSHIELD_API_KEY");
    const xPayment = runtime.getSetting("RELAYSHIELD_X_PAYMENT");
    return !!(apiKey || xPayment);
  },
  examples: [
    [
      {
        name: "user",
        content: { text: "Scan this file for malware: https://cdn.example.com/invoice.pdf" },
      },
      {
        name: "agent",
        content: {
          text: "Submitting invoice.pdf for malware scanning across 70+ AV engines.",
          action: "SCAN_FILE",
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
        text: "Please provide a public download URL (http:// or https://) for the file to scan.",
      });
      return;
    }
    const fileUrl  = urlMatch[0];
    const filename = fileUrl.split("/").pop() ?? "file";

    const config = getConfig(runtime);
    logger.info(`[RelayShield] SCAN_FILE file_url=${fileUrl}`);

    await callback?.({ text: `Submitting **${filename}** for malware analysis across 70+ AV engines…` });

    const submit = await apiPost<ScanSubmitResult>(config, "/scan-file", {
      file_url: fileUrl,
      filename,
    });

    if (!submit.ok || !submit.data?.analysis_id) {
      await callback?.({
        text: `File scan submission failed: ${submit.error ?? "upstream error"}`,
      });
      return;
    }

    const { analysis_id } = submit.data;
    logger.info(`[RelayShield] SCAN_FILE polling analysis_id=${analysis_id}`);

    const verdict = await pollResult(config, analysis_id);

    if (!verdict) {
      await callback?.({
        text:
          `⏱️ Scan for **${filename}** timed out after 90 seconds. ` +
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
      `${emoji} **${filename}**\n\n` +
      `• **Verdict:** ${verdict.verdict.toUpperCase()}\n` +
      `• **Malicious engines:** ${verdict.malicious ?? 0} / ${verdict.total_engines ?? "?"}\n` +
      `• **Suspicious:** ${verdict.suspicious ?? 0}\n` +
      `• **Clean:** ${verdict.harmless ?? 0}` +
      (verdict.verdict === "malicious"
        ? "\n\n**Do not open this file.**"
        : verdict.verdict === "suspicious"
        ? "\n\nOpen with caution in a sandboxed environment."
        : "");

    await callback?.({ text: reply });
    return;
  },
};
