// SPDX-License-Identifier: FSL-1.1-MIT

import { Inject, Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { McpSession } from '@/modules/auth/mcp/domain/entities/mcp-session.entity';
import { IMcpElevationRepository } from '@/modules/auth/mcp/domain/mcp-elevation.repository.interface';
import {
  DescribeEndpointArgumentsSchema,
  type GatewayQuery,
  type HttpMethod,
  ReadEndpointArgumentsSchema,
  SearchEndpointsArgumentsSchema,
  WriteEndpointArgumentsSchema,
} from '@/modules/auth/mcp/routes/entities/mcp-tool-arguments.entity';
import { OpenApiCatalogService } from '@/modules/auth/mcp/routes/openapi-catalog.service';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/modules/auth/utils/auth-cookie.utils';
import { ELEVATION_REQUIRED_ERROR } from '@/routes/common/auth/elevation.guard';

export type McpRequestContext = {
  session: McpSession;
  clientIp: string;
};

// https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result
export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type McpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint?: boolean;
    openWorldHint: boolean;
  };
};

type McpTool<T extends z.ZodType> = Omit<McpToolDefinition, 'inputSchema'> & {
  schema: T;
  handler: (
    args: z.infer<T>,
    context: McpRequestContext,
  ) => Promise<McpToolResult>;
};

// Keeps a single tool result within what a model can usefully read.
const MAX_RESPONSE_LENGTH = 100_000;

export const ELEVATION_REQUIRED_HINT =
  "This action needs a recent second-factor check. Ask the user to disconnect and reconnect the Safe connector in Claude's settings; signing in again asks for their authenticator code. Then retry.";

export function getStepUpInstruction(stepUpUrl: string): string {
  return `This action needs a recent second-factor check. Show the user this link as a clickable link and ask them to open it: ${stepUpUrl} — it asks for their authenticator code and expires in a few minutes. Once they say they are done, retry the same call unchanged.`;
}

/**
 * The MCP tools: discover endpoints in the gateway's OpenAPI document and call
 * them as the signed-in user.
 *
 * A call is replayed in-process through the HTTP server with a short-lived
 * session cookie minted for the caller, so it passes the same guards, pipes,
 * rate limits and step-up checks as a request from the web app.
 */
@Injectable()
export class McpToolsService {
  private static readonly INTERNAL_TOKEN_LIFETIME_MS = 60_000;

  private readonly tools: ReadonlyArray<McpTool<z.ZodType>>;
  private readonly stepUpAuthorizeUrl: string;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly openApiCatalog: OpenApiCatalogService,
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
    @Inject(IMcpElevationRepository)
    private readonly mcpElevationRepository: IMcpElevationRepository,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    // The browser starts the step-up on the host the OIDC callback returns
    // to, so the state cookie set there is sent back with the callback.
    this.stepUpAuthorizeUrl = new URL(
      '/v1/auth/oidc/authorize',
      configurationService.getOrThrow<string>('auth.auth0.redirectUri'),
    ).toString();
    this.tools = [
      defineTool({
        name: 'search_endpoints',
        title: 'Search Safe API endpoints',
        description:
          'Searches the Safe Client Gateway REST API. Returns the method, path template and summary of each matching endpoint. Start here, then use describe_endpoint for parameters and body.',
        schema: SearchEndpointsArgumentsSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        handler: async ({ query }) =>
          jsonResult(await this.openApiCatalog.search(query)),
      }),
      defineTool({
        name: 'describe_endpoint',
        title: 'Describe a Safe API endpoint',
        description:
          'Returns the parameters, request body schema and success response schema of one endpoint, identified by its method and path template from search_endpoints.',
        schema: DescribeEndpointArgumentsSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        handler: async ({ method, path }) => {
          const definition = await this.openApiCatalog.describe(method, path);
          return definition
            ? jsonResult(definition)
            : errorResult(
                `No ${method} ${path} endpoint. Use search_endpoints to find the path template.`,
              );
        },
      }),
      defineTool({
        name: 'read_endpoint',
        title: 'Read from the Safe API',
        description:
          'Calls a GET endpoint as the signed-in user and returns the HTTP status and response body.',
        schema: ReadEndpointArgumentsSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        handler: async ({ path, query }, context) =>
          await this.callEndpoint({ method: 'GET', path, query }, context),
      }),
      defineTool({
        name: 'write_endpoint',
        title: 'Change data through the Safe API',
        description:
          'Calls a POST, PUT, PATCH or DELETE endpoint as the signed-in user and returns the HTTP status and response body. This changes data, such as Workspaces, members or the address book.',
        schema: WriteEndpointArgumentsSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
        handler: async ({ method, path, query, body }, context) =>
          await this.callEndpoint({ method, path, query, body }, context),
      }),
    ];
  }

  getTools(): Array<McpToolDefinition> {
    return this.tools.map(({ schema, handler: _handler, ...definition }) => ({
      ...definition,
      inputSchema: z.toJSONSchema(schema, { io: 'input' }),
    }));
  }

  /**
   * @returns The tool result, or undefined if no tool has this name.
   */
  async callTool(
    name: string,
    args: unknown,
    context: McpRequestContext,
  ): Promise<McpToolResult | undefined> {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) {
      return undefined;
    }

    // Invalid arguments are a tool execution error rather than a protocol
    // error, so the model sees the message and can correct its call.
    const result = tool.schema.safeParse(args ?? {});
    if (!result.success) {
      return errorResult(z.prettifyError(result.error));
    }
    return await tool.handler(result.data, context);
  }

  private async callEndpoint(
    request: {
      method: HttpMethod;
      path: string;
      query?: GatewayQuery;
      body?: unknown;
    },
    context: McpRequestContext,
  ): Promise<McpToolResult> {
    const endpoint = await this.openApiCatalog.findEndpoint(
      request.method,
      request.path,
    );
    if (!endpoint) {
      return errorResult(
        `No ${request.method} endpoint serves ${request.path}. Use search_endpoints to find the path template.`,
      );
    }

    const hasBody = request.body !== undefined;
    const sessionToken = await this.signSessionToken(context.session);
    const response = await this.httpAdapterHost.httpAdapter
      .getInstance<FastifyInstance>()
      .inject({
        method: request.method,
        url: withQuery(request.path, request.query),
        remoteAddress: context.clientIp,
        headers: {
          accept: 'application/json',
          cookie: `${ACCESS_TOKEN_COOKIE_NAME}=${sessionToken}`,
          ...(hasBody && { 'content-type': 'application/json' }),
        },
        ...(hasBody && { payload: JSON.stringify(request.body) }),
      });

    this.loggingService.info({
      type: 'mcp_tool_call',
      userId: context.session.userId,
      method: request.method,
      route: endpoint.path,
      statusCode: response.statusCode,
    });

    const stepUpHint =
      response.statusCode === 403 && isElevationRequired(response.body)
        ? await this.getStepUpHint(context.session)
        : undefined;

    return toolResultFromResponse(
      response.statusCode,
      response.body,
      stepUpHint,
    );
  }

  /**
   * Opens a step-up for this connection and tells the model to hand the user
   * its link. A token naming no client cannot be tied to one connection, so
   * that user is sent to reconnect instead.
   */
  private async getStepUpHint(session: McpSession): Promise<string> {
    if (!session.clientId) {
      return ELEVATION_REQUIRED_HINT;
    }

    const requestId = await this.mcpElevationRepository.createRequest({
      userId: session.userId,
      clientId: session.clientId,
    });
    const stepUpUrl = new URL(this.stepUpAuthorizeUrl);
    stepUpUrl.searchParams.set('mcp_elevation', requestId);
    return getStepUpInstruction(stepUpUrl.toString());
  }

  /**
   * A session token equivalent to the one the OIDC callback sets as a cookie,
   * valid only long enough to serve one call. Its second factor is the later
   * of the one in the access token and a step-up completed for this connection.
   */
  private async signSessionToken(session: McpSession): Promise<string> {
    const now = Date.now();
    const expiresAt = Math.min(
      now + McpToolsService.INTERNAL_TOKEN_LIFETIME_MS,
      session.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
    );
    const elevatedAt = session.clientId
      ? await this.mcpElevationRepository.getElevatedAt({
          userId: session.userId,
          clientId: session.clientId,
        })
      : null;
    const mfaVerifiedAt = Math.max(session.mfaVerifiedAt ?? 0, elevatedAt ?? 0);

    return this.authRepository.signToken(
      {
        auth_method: AuthMethod.Oidc,
        sub: session.userId.toString(),
        mfa_verified_at: mfaVerifiedAt || undefined,
      },
      { iat: new Date(now), exp: new Date(expiresAt) },
    );
  }
}

function defineTool<T extends z.ZodType>(tool: McpTool<T>): McpTool<z.ZodType> {
  return tool as unknown as McpTool<z.ZodType>;
}

function withQuery(path: string, query: GatewayQuery): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      searchParams.append(key, String(item));
    }
  }
  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

function toolResultFromResponse(
  statusCode: number,
  body: string,
  hint: string | undefined,
): McpToolResult {
  const lines = [`HTTP ${statusCode}`];
  if (hint) {
    lines.push(hint);
  }
  lines.push(truncate(body));

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    isError: statusCode >= 400,
  };
}

function isElevationRequired(body: string): boolean {
  try {
    return JSON.parse(body)?.message === ELEVATION_REQUIRED_ERROR;
  } catch {
    return false;
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_RESPONSE_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_RESPONSE_LENGTH)}\n[Truncated: response exceeded ${MAX_RESPONSE_LENGTH} characters. Narrow the request, e.g. with paging parameters.]`;
}

function jsonResult(value: unknown): McpToolResult {
  return {
    content: [{ type: 'text', text: truncate(JSON.stringify(value, null, 2)) }],
  };
}

function errorResult(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
