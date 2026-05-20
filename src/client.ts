/**
 * RelayShield API client
 * All calls use HTTPS — API Gateway enforces TLS 1.2+ on every request.
 */

import type { IAgentRuntime } from "@elizaos/core";
import type { RelayShieldConfig } from "./types.js";

const DEFAULT_API_URL =
  "https://xhh3tfrhng.execute-api.us-east-1.amazonaws.com/prod";

export function buildHeaders(config: RelayShieldConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["x-api-key"] = config.apiKey;
  } else if (config.xPayment) {
    headers["X-PAYMENT"] = config.xPayment;
  }
  return headers;
}

export function buildBase(config: RelayShieldConfig): string {
  const base = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/$/, "");
  // Subscription key → /v1/  |  x402 PAYG → /v1/payg/
  return config.apiKey ? `${base}/v1` : `${base}/v1/payg`;
}

export async function apiPost<T>(
  config: RelayShieldConfig,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const url = `${buildBase(config)}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify(body),
  });

  if (resp.status === 402) {
    return {
      ok: false,
      error:
        "Payment required. Set RELAYSHIELD_API_KEY (RapidAPI) or RELAYSHIELD_X_PAYMENT (x402 USDC). " +
        "Free tier: rapidapi.com/relayshielduser/api/relayshield-security-intelligence",
    };
  }

  const json = (await resp.json()) as { ok: boolean; data?: T; error?: string };
  return json;
}

export async function apiGet<T>(
  config: RelayShieldConfig,
  path: string
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const url = `${buildBase(config)}${path}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: buildHeaders(config),
  });
  const json = (await resp.json()) as { ok: boolean; data?: T; error?: string };
  return json;
}

export function getConfig(runtime: IAgentRuntime): RelayShieldConfig {
  const get = (key: string): string | undefined => {
    const val = runtime.getSetting(key);
    return val || undefined;
  };
  return {
    apiKey:   get("RELAYSHIELD_API_KEY"),
    xPayment: get("RELAYSHIELD_X_PAYMENT"),
    apiUrl:   get("RELAYSHIELD_API_URL"),
  };
}
