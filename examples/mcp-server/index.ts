/**
 * Leash Model Context Protocol (MCP) Server
 *
 * Exposes Leash spending guard enforcement to LLM agents via standard MCP protocol.
 * Compatible with Claude Desktop, Cursor, Antigravity, and MCP-enabled agent harnesses.
 */

import {
  predictVerdict,
  GOLDEN_FINGERPRINT,
  MAX_PER_TX_WEI,
  MAX_PER_WINDOW_WEI,
  TOKEN_MAX_PER_TX,
} from '../../demo/lib/leash-cli';
import * as readline from 'readline';

interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

const TOOLS = [
  {
    name: 'leash_check_transaction',
    description:
      'Evaluates a proposed Safe transaction against the immutable Fe policy limits before execution. Returns ALLOW or DENY with exact denial code and remaining budget.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Destination Ethereum contract or recipient address (hex)' },
        value_eth: { type: 'string', description: 'ETH amount to spend (e.g. "0.05")' },
        value_wei: { type: 'string', description: 'Value in wei (optional, alternative to value_eth)' },
        data: { type: 'string', description: 'Calldata in hex format (e.g. "0xa9059cbb...")' },
        op: { type: 'string', enum: ['call', 'delegatecall'], description: 'Operation type (default: "call")' },
      },
      required: ['to'],
    },
  },
  {
    name: 'leash_get_budget',
    description: 'Returns the current remaining transaction and 24-hour rolling window budget under active policy.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'leash_get_policy_fingerprint',
    description: 'Returns the Keccak-256 policy fingerprint guaranteeing 0-drift between off-chain and on-chain rules.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

function handleMcpRequest(req: McpRequest): any {
  switch (req.method) {
    case 'tools/list':
      return { tools: TOOLS };

    case 'tools/call': {
      const toolName = req.params?.name;
      const args = req.params?.arguments || {};

      if (toolName === 'leash_check_transaction') {
        let valWei = 0n;
        if (args.value_wei) {
          valWei = BigInt(args.value_wei);
        } else if (args.value_eth) {
          valWei = BigInt(Math.floor(parseFloat(args.value_eth) * 1e18));
        }

        const verdict = predictVerdict({
          to: args.to,
          valueWei: valWei,
          data: args.data || '0x',
          op: args.op || 'call',
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(verdict, null, 2),
            },
          ],
        };
      }

      if (toolName === 'leash_get_budget') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  max_per_tx_wei: MAX_PER_TX_WEI.toString(),
                  max_per_tx_eth: '0.1',
                  max_per_window_wei: MAX_PER_WINDOW_WEI.toString(),
                  max_per_window_eth: '0.5',
                  max_token_per_tx: TOKEN_MAX_PER_TX.toString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (toolName === 'leash_get_policy_fingerprint') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ fingerprint: GOLDEN_FINGERPRINT }, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${toolName}`);
    }

    default:
      return {};
  }
}

export function startMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const req: McpRequest = JSON.parse(line.trim());
      const result = handleMcpRequest(req);
      const res = { jsonrpc: '2.0', id: req.id, result };
      process.stdout.write(JSON.stringify(res) + '\n');
    } catch (err: any) {
      const errRes = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err?.message || 'Internal error' },
      };
      process.stdout.write(JSON.stringify(errRes) + '\n');
    }
  });
}

if (require.main === module) {
  startMcpServer();
}
