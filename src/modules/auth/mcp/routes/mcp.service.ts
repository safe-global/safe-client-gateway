// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  JsonRpcErrorCode,
  type JsonRpcMessage,
  type JsonRpcResponse,
} from '@/modules/auth/mcp/routes/entities/json-rpc.entity';
import {
  type McpRequestContext,
  McpToolsService,
} from '@/modules/auth/mcp/routes/mcp-tools.service';

const InitializeParamsSchema = z.object({
  protocolVersion: z.string().optional(),
});

const ToolCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

const INSTRUCTIONS =
  'Acts as the signed-in Safe{Wallet} user against the Safe Client Gateway REST API. Workspaces are called "spaces" in the API. Find endpoints with search_endpoints, read their parameters with describe_endpoint, then call them with read_endpoint or write_endpoint. When a result contains a step-up link, show it to the user as a clickable link and retry after they confirm.';

/**
 * The Model Context Protocol over stateless Streamable HTTP: each POST carries
 * one JSON-RPC message and is answered with one JSON response. The server
 * offers tools only and never initiates requests, so no session is kept.
 *
 * @see https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http
 */
@Injectable()
export class McpService {
  /** Newest first; the tools-only feature set is the same in each. */
  static readonly SUPPORTED_PROTOCOL_VERSIONS = [
    '2025-11-25',
    '2025-06-18',
    '2025-03-26',
    '2024-11-05',
  ];

  private readonly serverVersion: string;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    private readonly mcpToolsService: McpToolsService,
  ) {
    this.serverVersion =
      configurationService.get<string>('about.version') ?? 'unknown';
  }

  /**
   * @returns The response to send, or null for a notification.
   */
  async handle(
    message: JsonRpcMessage,
    context: McpRequestContext,
  ): Promise<JsonRpcResponse | null> {
    const { id } = message;
    if (id === undefined) {
      return null;
    }

    switch (message.method) {
      case 'initialize':
        return result(id, this.initialize(message.params));
      case 'ping':
        return result(id, {});
      case 'tools/list':
        return result(id, { tools: this.mcpToolsService.getTools() });
      case 'tools/call':
        return await this.callTool(id, message.params, context);
      default:
        return error(
          id,
          JsonRpcErrorCode.MethodNotFound,
          `Method not found: ${message.method}`,
        );
    }
  }

  private initialize(params: unknown): Record<string, unknown> {
    const requested = InitializeParamsSchema.safeParse(params ?? {}).data
      ?.protocolVersion;
    const protocolVersion =
      requested && McpService.SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : McpService.SUPPORTED_PROTOCOL_VERSIONS[0];

    return {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: 'safe-client-gateway',
        title: 'Safe{Wallet}',
        version: this.serverVersion,
      },
      instructions: INSTRUCTIONS,
    };
  }

  private async callTool(
    id: string | number,
    params: unknown,
    context: McpRequestContext,
  ): Promise<JsonRpcResponse> {
    const parsed = ToolCallParamsSchema.safeParse(params ?? {});
    if (!parsed.success) {
      return error(
        id,
        JsonRpcErrorCode.InvalidParams,
        z.prettifyError(parsed.error),
      );
    }

    const toolResult = await this.mcpToolsService.callTool(
      parsed.data.name,
      parsed.data.arguments,
      context,
    );
    if (!toolResult) {
      return error(
        id,
        JsonRpcErrorCode.InvalidParams,
        `Unknown tool: ${parsed.data.name}`,
      );
    }
    return result(id, toolResult);
  }
}

function result(id: string | number, value: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result: value };
}

function error(
  id: string | number,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
