/**
 * RelayShield plugin types
 */

export interface RelayShieldConfig {
  apiKey?: string;       // RapidAPI subscription key
  xPayment?: string;     // x402 PAYG payment proof (Base or Solana USDC)
  apiUrl?: string;       // Override API base URL (for testing)
}

export interface BreachResult {
  email: string;
  breach_count: number;
  breaches: Array<{
    name: string;
    domain: string;
    breach_date: string;
    data_classes: string[];
    is_verified: boolean;
  }>;
}

export interface SimSwapResult {
  phone: string;
  swapped: boolean;
  swap_timestamp: string;
  carrier: string;
  checked_at: string;
}

export interface DomainResult {
  domain: string;
  lookalikes_found: number;
  lookalikes: Array<{ domain: string }>;
  candidates_checked: number;
  checked_at: string;
}

export interface OAuthWatchlistResult {
  email: string;
  matched_count: number;
  matched_apps: Array<{
    app: string;
    breach_date: string;
    data_classes: string[];
    revoke_url: string;
  }>;
  recommendation: string;
  checked_at: string;
}

export interface WalletRiskResult {
  address: string;
  chain: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_flags: string[];
  metadata: Record<string, unknown>;
}

export interface InfostealerStealer {
  date_compromised?: string;
  computer_name?: string;
  operating_system?: string;
  malware_path?: string;
  total_corporate_services?: number;
  total_user_services?: number;
}

export interface InfostealerResult {
  email: string;
  found: boolean;
  stealer_count: number;
  stealers: InfostealerStealer[];
}

export interface ScanSubmitResult {
  status: string;
  target: string;
  analysis_id: string;
  poll_endpoint: string;
  note: string;
}

export interface ScanVerdictResult {
  target: string;
  analysis_id: string;
  verdict: "malicious" | "suspicious" | "clean" | "timeout" | "pending";
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
  total_engines?: number;
}
