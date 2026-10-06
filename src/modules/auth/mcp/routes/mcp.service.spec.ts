// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JsonRpcErrorCode } from '@/modules/auth/mcp/routes/entities/json-rpc.entity';
import { McpService } from '@/modules/auth/mcp/routes/mcp.service';
import type {
  McpRequestContext,
  McpToolsService,
} from '@/modules/auth/mcp/routes/mcp-tools.service';

const mcpToolsServiceMock = {
  getTools: vi.fn(),
  callTool: vi.fn(),
} as unknown as MockedObject<McpToolsService>;

describe('McpService', () => {
  let target: McpService;
  let version: string;
  let context: McpRequestContext;

  beforeEach(() => {
    vi.resetAllMocks();
    version = faker.system.semver();
    const configurationService = new FakeConfigurationService();
    configurationService.set('about.version', version);
    context = {
      session: {
        userId: faker.number.int({ min: 1 }),
        clientId: faker.string.alphanumeric(24),
        mfaVerifiedAt: undefined,
        expiresAt: undefined,
      },
      clientIp: faker.internet.ipv4(),
    };

    target = new McpService(configurationService, mcpToolsServiceMock);
  });

  describe('initialize', () => {
    it('should accept a supported protocol version', async () => {
      const id = faker.number.int();

      const response = await target.handle(
        {
          jsonrpc: '2.0',
          id,
          method: 'initialize',
          params: { protocolVersion: '2025-06-18' },
        },
        context,
      );

      expect(response).toEqual({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'safe-client-gateway',
            title: 'Safe{Wallet}',
            version,
          },
          instructions: expect.any(String),
        },
      });
    });

    it('should answer an unsupported protocol version with the newest one', async () => {
      const response = await target.handle(
        {
          jsonrpc: '2.0',
          id: faker.string.uuid(),
          method: 'initialize',
          params: { protocolVersion: '1999-01-01' },
        },
        context,
      );

      expect(response).toMatchObject({
        result: { protocolVersion: McpService.SUPPORTED_PROTOCOL_VERSIONS[0] },
      });
    });
  });

  it('should not answer a notification', async () => {
    await expect(
      target.handle(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        context,
      ),
    ).resolves.toBeNull();
  });

  it('should answer a ping', async () => {
    const id = faker.number.int();

    await expect(
      target.handle({ jsonrpc: '2.0', id, method: 'ping' }, context),
    ).resolves.toEqual({ jsonrpc: '2.0', id, result: {} });
  });

  it('should list the tools', async () => {
    const tools = [{ name: faker.word.noun() }];
    mcpToolsServiceMock.getTools.mockReturnValue(
      tools as ReturnType<McpToolsService['getTools']>,
    );

    await expect(
      target.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, context),
    ).resolves.toEqual({ jsonrpc: '2.0', id: 1, result: { tools } });
  });

  describe('tools/call', () => {
    it('should call the tool with the request context', async () => {
      const toolResult = {
        content: [{ type: 'text' as const, text: faker.lorem.sentence() }],
      };
      const args = { query: faker.word.noun() };
      mcpToolsServiceMock.callTool.mockResolvedValue(toolResult);

      const response = await target.handle(
        {
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: { name: 'search_endpoints', arguments: args },
        },
        context,
      );

      expect(mcpToolsServiceMock.callTool).toHaveBeenCalledWith(
        'search_endpoints',
        args,
        context,
      );
      expect(response).toEqual({ jsonrpc: '2.0', id: 7, result: toolResult });
    });

    it('should reject an unknown tool with invalid params', async () => {
      mcpToolsServiceMock.callTool.mockResolvedValue(undefined);

      const response = await target.handle(
        {
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: { name: faker.word.noun() },
        },
        context,
      );

      expect(response).toMatchObject({
        error: { code: JsonRpcErrorCode.InvalidParams },
      });
    });

    it('should reject a call without a tool name', async () => {
      const response = await target.handle(
        { jsonrpc: '2.0', id: 7, method: 'tools/call', params: {} },
        context,
      );

      expect(response).toMatchObject({
        error: { code: JsonRpcErrorCode.InvalidParams },
      });
      expect(mcpToolsServiceMock.callTool).not.toHaveBeenCalled();
    });
  });

  it('should reject an unknown method', async () => {
    const response = await target.handle(
      { jsonrpc: '2.0', id: 3, method: 'resources/list' },
      context,
    );

    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 3,
      error: {
        code: JsonRpcErrorCode.MethodNotFound,
        message: 'Method not found: resources/list',
      },
    });
  });
});
