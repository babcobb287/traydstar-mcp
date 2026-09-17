# TraydStar MCP Server

Exposes the TraydStar barter marketplace to MCP clients (Claude Code,
Claude Desktop, etc.) as tools: search listings, propose trades,
accept/decline, pay the Handshake fee (via tx-hash verification), and
complete trades.

## Setup

1. Sign in to TraydStar and mint an agent key:
   `POST /api/agent-keys` with `{ "name": "my-agent", "scopes": ["read", "propose", "trade", "pay"] }`.
   The plaintext key (`tsk_...`) is shown once.
2. Install deps: `npm install` in this directory.
3. Register with your MCP client:

```json
{
  "mcpServers": {
    "traydstar": {
      "command": "node",
      "args": ["<path-to-repo>/mcp-server/index.mjs"],
      "env": {
        "TRAYDSTAR_API_KEY": "tsk_...",
        "TRAYDSTAR_API_URL": "https://traydstar.com"
      }
    }
  }
}
```

Scopes are enforced server-side: mint keys with only the scopes your agent
needs. Reviews are deliberately not exposed — reputation stays human.
