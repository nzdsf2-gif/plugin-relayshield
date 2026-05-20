import type { Plugin } from "@elizaos/core";
import { checkBreachAction }       from "./actions/checkBreach.js";
import { checkSimSwapAction }      from "./actions/checkSimSwap.js";
import { checkDomainAction }       from "./actions/checkDomain.js";
import { checkOAuthAction }        from "./actions/checkOAuth.js";
import { checkInfostealerAction }  from "./actions/checkInfostealer.js";
import { scanWalletAction }        from "./actions/scanWallet.js";
import { scanUrlAction }           from "./actions/scanUrl.js";
import { scanFileAction }          from "./actions/scanFile.js";

export const relayshieldPlugin: Plugin = {
  name: "relayshield",
  description:
    "RelayShield identity threat intelligence — breach detection, SIM swap, domain lookalikes, " +
    "OAuth watchlist, infostealer malware detection, wallet risk, URL and file malware scanning. " +
    "Pay-as-you-go via USDC on Base or Solana (x402), or subscription via RapidAPI.",
  actions: [
    checkBreachAction,
    checkSimSwapAction,
    checkDomainAction,
    checkOAuthAction,
    checkInfostealerAction,
    scanWalletAction,
    scanUrlAction,
    scanFileAction,
  ],
};

export default relayshieldPlugin;

export {
  checkBreachAction,
  checkSimSwapAction,
  checkDomainAction,
  checkOAuthAction,
  checkInfostealerAction,
  scanWalletAction,
  scanUrlAction,
  scanFileAction,
};

export type {
  RelayShieldConfig,
  BreachResult,
  SimSwapResult,
  DomainResult,
  OAuthWatchlistResult,
  InfostealerResult,
  InfostealerStealer,
  WalletRiskResult,
  ScanSubmitResult,
  ScanVerdictResult,
} from "./types.js";
