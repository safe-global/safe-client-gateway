// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { NestedSafesGraphResponse } from '@/modules/spaces/routes/entities/nested-safes-graph.entity';
import { NestedSafesGraphService } from '@/modules/spaces/routes/nested-safes-graph.service';
import { LegacySpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/nested-safes-graph',
  version: '1',
})
@UseGuards(AuthGuard)
export class NestedSafesGraphController {
  public constructor(
    @Inject(NestedSafesGraphService)
    private readonly service: NestedSafesGraphService,
  ) {}

  @ApiOperation({
    summary: 'Get nested Safes graph',
    description:
      'Returns the recursive nested-safe ownership graph (nodes + directed owner→owned edges) for a space on a single chain.',
    // operationId MUST start with "spaces" so the store codegen routes the hook into spaces.ts
    operationId: 'spacesGetNestedSafesGraphV1',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({ name: 'chainId', type: 'string', example: '1' })
  @ApiOkResponse({ type: NestedSafesGraphResponse })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'User is not a member of this space' })
  @Get()
  public async get(
    @Param('spaceId', LegacySpaceIdPipe) spaceId: number,
    @Query('chainId') chainId: string,
    @Auth() authPayload: AuthPayload,
  ): Promise<NestedSafesGraphResponse> {
    return await this.service.get({ spaceId, chainId, authPayload });
  }
}
