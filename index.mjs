#!/usr/bin/env node
// TraydStar MCP server: exposes the v1 agent API as MCP tools so Claude and
// other MCP clients can browse, propose, and trade on TraydStar.
//
// Config (env):
//   TRAYDSTAR_API_KEY  - agent key (tsk_...), minted at POST /api/agent-keys
//   TRAYDSTAR_API_URL  - base URL, default https://traydstar.com
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.TRAYDSTAR_API_URL || "https://traydstar.com").replace(/\/$/, "");
const API_KEY = process.env.TRAYDSTAR_API_KEY;

async function api(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    return { content: [{ type: "text", text: `Error ${res.status}: ${data.error || text}` }], isError: true };
  }
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: "traydstar", version: "0.1.0" });

server.registerTool("search_listings", {
  description: "Search active barter listings on TraydStar. Public; returns goods and services people want to trade (no cash — barter only, matched by value).",
  inputSchema: {
    q: z.string().optional().describe("Text search over title and description"),
    category: z.string().optional(),
    type: z.enum(["GOOD", "SERVICE", "BOTH"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  },
}, async (args) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(args)) if (v !== undefined) params.set(k, String(v));
  return api("GET", `/api/v1/listings?${params}`);
});

server.registerTool("get_listing", {
  description: "Get one TraydStar listing by id, including the owner's rating and estimated USD value.",
  inputSchema: { listing_id: z.string().uuid() },
}, async ({ listing_id }) => api("GET", `/api/v1/listings/${listing_id}`));

server.registerTool("create_listing", {
  description: "Create a barter listing on behalf of the account (scope: propose). Describe a good or service to offer and optionally what's wanted in return. Note: image uploads are not supported via API; listings created here use a placeholder image.",
  inputSchema: {
    title: z.string().min(3).max(100),
    description: z.string().min(10).max(5000),
    type: z.enum(["GOOD", "SERVICE", "BOTH"]),
    category: z.string().min(1).max(50),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"]).optional(),
    want_tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    want_description: z.string().max(2000).optional(),
    stated_value_usd: z.number().positive().optional().describe("Your estimate of the item/service value in USD"),
  },
}, async (args) => api("POST", "/api/v1/listings", args));

server.registerTool("whoami", {
  description: "Show which TraydStar account this agent key acts for, and its scopes.",
  inputSchema: {},
}, async () => api("GET", "/api/v1/me"));

server.registerTool("list_proposals", {
  description: "List trade proposals sent or received by the account (scope: read).",
  inputSchema: {},
}, async () => api("GET", "/api/v1/proposals"));

server.registerTool("create_proposal", {
  description: "Propose a trade: offer one of the account's listings (optional) for another Trayder's listing (scope: propose).",
  inputSchema: {
    receiver_listing_id: z.string().uuid().describe("The listing you want"),
    proposer_listing_id: z.string().uuid().optional().describe("Your listing to offer in exchange"),
    message: z.string().max(2000).optional(),
  },
}, async (args) => api("POST", "/api/v1/proposals", args));

server.registerTool("accept_proposal", {
  description: "Accept a received proposal (scope: trade). Creates a Handshake and returns payment instructions for the Handshake fee (amount, chain, and treasury address are in the response — never assume the amount).",
  inputSchema: { proposal_id: z.string().uuid() },
}, async ({ proposal_id }) => api("POST", `/api/v1/proposals/${proposal_id}/accept`));

server.registerTool("withdraw_proposal", {
  description: "Withdraw a pending proposal the account sent (scope: propose).",
  inputSchema: { proposal_id: z.string().uuid() },
}, async ({ proposal_id }) => api("POST", `/api/v1/proposals/${proposal_id}/withdraw`));

server.registerTool("decline_proposal", {
  description: "Decline a received proposal (scope: trade).",
  inputSchema: { proposal_id: z.string().uuid() },
}, async ({ proposal_id }) => api("POST", `/api/v1/proposals/${proposal_id}/decline`));

server.registerTool("list_handshakes", {
  description: "List the account's handshakes with payment and completion status (scope: read).",
  inputSchema: {},
}, async () => api("GET", "/api/v1/handshakes"));

server.registerTool("get_handshake", {
  description: "Get a handshake. Its `payment.state` says what to do for your side: 'covered' (a free Handshake or the owner's membership covers it — call cover_handshake_fee), 'payable' (includes USDC payment instructions — link your wallet once with link_wallet, send the exact amount, then call verify_handshake_payment), or 'settled' (nothing to do).",
  inputSchema: { handshake_id: z.string().uuid() },
}, async ({ handshake_id }) => api("GET", `/api/v1/handshakes/${handshake_id}`));

server.registerTool("cover_handshake_fee", {
  description: "Settle your side of a Handshake when get_handshake reports payment.state = 'covered' (free Handshake or the owner's membership). No money moves (scope: pay).",
  inputSchema: { handshake_id: z.string().uuid() },
}, async ({ handshake_id }) => api("POST", `/api/v1/handshakes/${handshake_id}/cover`));

server.registerTool("get_wallet_link_message", {
  description: "Get the exact message to sign so a wallet can be linked to this account (scope: pay). USDC fee payments are only credited from the linked wallet. Sign it with EIP-191 personal_sign and pass the result to link_wallet. Also returns the currently linked address, if any.",
  inputSchema: {},
}, async () => api("GET", "/api/v1/wallet/link"));

server.registerTool("link_wallet", {
  description: "Link the wallet that will pay Handshake fees, proving control with a signature over the message from get_wallet_link_message (scope: pay). The message expires after a few minutes.",
  inputSchema: {
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    message: z.string().max(500),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  },
}, async (args) => api("POST", "/api/v1/wallet/link", args));

server.registerTool("verify_handshake_payment", {
  description: "Submit the tx hash of the USDC fee transfer for on-chain verification (scope: pay). The server checks the transfer on-chain before recording it. If the tx is not yet visible (422), wait a few seconds and retry.",
  inputSchema: {
    handshake_id: z.string().uuid(),
    tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  },
}, async ({ handshake_id, tx_hash }) =>
  api("POST", `/api/v1/handshakes/${handshake_id}/verify-payment`, { txHash: tx_hash }));

server.registerTool("complete_handshake", {
  description: "Mark the account's side of an active handshake complete after the real-world exchange (scope: trade). The trade finalizes when both parties complete. Reviews must be left by the human, not the agent.",
  inputSchema: { handshake_id: z.string().uuid() },
}, async ({ handshake_id }) => api("POST", `/api/v1/handshakes/${handshake_id}/complete`));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`TraydStar MCP server connected (${BASE_URL})${API_KEY ? "" : " — no TRAYDSTAR_API_KEY set; only public tools will work"}`);
