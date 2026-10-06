// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { MCP_SESSION_REQUEST_PROPERTY } from '@/modules/auth/mcp/domain/entities/mcp-session.entity';
import {
  type JsonRpcMessage,
  JsonRpcMessageSchema,
} from '@/modules/auth/mcp/routes/entities/json-rpc.entity';
import { McpAuthGuard } from '@/modules/auth/mcp/routes/guards/mcp-auth.guard';
import { McpService } from '@/modules/auth/mcp/routes/mcp.service';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

/**
 * MCP endpoint for Claude custom connectors.
 *
 * Excluded from the OpenAPI document, which also keeps it out of the endpoints
 * its own tools can call.
 *
 * Note: gated by the `FF_MCP` feature flag.
 */
@ApiExcludeController()
@UseGuards(McpAuthGuard)
@Controller({ path: 'mcp', version: '1' })
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  async handleMessage(
    @Body(new ValidationPipe(JsonRpcMessageSchema)) message: JsonRpcMessage,
    @Req() request: HttpRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const session = request[MCP_SESSION_REQUEST_PROPERTY];
    if (!session) {
      throw new UnauthorizedException();
    }

    const response = await this.mcpService.handle(message, {
      session,
      clientIp: request.ip,
    });

    if (!response) {
      await reply.status(HttpStatus.ACCEPTED).send();
      return;
    }
    await reply.status(HttpStatus.OK).send(response);
  }

  // Stateless: there is no server-initiated stream to open and no session to end.
  @Get()
  async openStream(@Res() reply: FastifyReply): Promise<void> {
    await rejectMethod(reply);
  }

  @Delete()
  async endSession(@Res() reply: FastifyReply): Promise<void> {
    await rejectMethod(reply);
  }
}

async function rejectMethod(reply: FastifyReply): Promise<void> {
  await reply
    .status(HttpStatus.METHOD_NOT_ALLOWED)
    .header('Allow', 'POST')
    .send();
}
