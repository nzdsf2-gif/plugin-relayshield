# @relayshield/plugin-relayshield

Identity threat intelligence for [ElizaOS](https://elizaos.ai) agents.

Gives your agent seven security tools: email breach lookup, SIM swap detection, domain lookalike scanning, OAuth watchlist checking, wallet risk screening, and URL/file malware analysis — all callable by natural language.

## Installation

```bash
elizaos plugins add @relayshield/plugin-relayshield
# or
npm install @relayshield/plugin-relayshield
```

## Authentication

Choose one:

| Method | How | Cost |
|---|---|---|
| **RapidAPI subscription** | Set `RELAYSHIELD_API_KEY` | Fixed monthly — [free tier available](https://rapidapi.com/relayshielduser/api/relayshield-security-intelligence) |
| **x402 PAYG** | Set `RELAYSHIELD_X_PAYMENT` | Per-call USDC on Base or Solana |

## Configuration

Add to your character file:

```json
{
  "name": "MyAgent",
  "plugins": ["@relayshield/plugin-relayshield"],
  "settings": {
    "RELAYSHIELD_API_KEY": "your-rapidapi-key"
  }
}
```

Or in your character TypeScript:

```typescript
import relayshieldPlugin from "@relayshield/plugin-relayshield";

const character = {
  name: "MyAgent",
  plugins: [relayshieldPlugin],
};
```

## Actions

| Action | Trigger phrase examples | Cost (PAYG) |
|---|---|---|
| `CHECK_BREACH` | "Has user@example.com been breached?" | $0.10 |
| `CHECK_SIM_SWAP` | "Check +14155551234 for SIM swap" | $0.25 |
| `CHECK_DOMAIN_LOOKALIKES` | "Any lookalike domains for acme.com?" | $0.50 |
| `CHECK_OAUTH_WATCHLIST` | "Check OAuth exposure for user@example.com" | $0.15 |
| `SCAN_WALLET` | "Is 0xABC...123 safe to send to?" | $0.15 |
| `SCAN_URL` | "Is https://suspicious.com safe?" | $0.05 |
| `SCAN_FILE` | "Scan https://cdn.example.com/invoice.pdf" | $0.10 |

## Links

- **API docs & free tier:** [relayshield.net](https://relayshield.net)
- **RapidAPI:** [rapidapi.com/relayshielduser/api/relayshield-security-intelligence](https://rapidapi.com/relayshielduser/api/relayshield-security-intelligence)
- **MCP server:** [relayshield-mcp on PyPI](https://pypi.org/project/relayshield-mcp/)
