// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import type { SpaceAuditEventType } from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import {
  SpaceAuditActorUserIdQuerySchema,
  SpaceAuditDateQuerySchema,
  SpaceAuditEventTypesQuerySchema,
  SpaceAuditLogActorDto,
  SpaceAuditLogPage,
  SpaceAuditSortDirectionQuerySchema,
} from '@/modules/spaces/routes/entities/space-audit-log.dto.entity';
import { SpaceAuditRouteGuard } from '@/modules/spaces/routes/guards/space-audit-route.guard';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { SpaceAuditService } from '@/modules/spaces/routes/space-audit.service';
import { PaginationDataDecorator } from '@/routes/common/decorators/pagination.data.decorator';
import { RouteUrlDecorator } from '@/routes/common/decorators/route.url.decorator';
import type { PaginationData } from '@/routes/common/pagination/pagination.data';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('spaces')
@UseGuards(AuthGuard, SpaceAuditRouteGuard)
@Controller({ path: 'spaces', version: '1' })
export class SpaceAuditController {
  public constructor(private readonly spaceAuditService: SpaceAuditService) {}

  @ApiOperation({
    summary: 'Get space audit log',
    description:
      'Retrieves the append-only audit log of a space — who did what, when. ' +
      'Requires ACTIVE membership. Events are ordered by creation time ' +
      '(newest first by default) with a stable id tie-break.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
  })
  @ApiQuery({
    name: 'event_type',
    required: false,
    type: String,
    description: 'Comma-separated list of event types to filter by',
  })
  @ApiQuery({
    name: 'actor_user_id',
    required: false,
    type: Number,
    description: 'Filter by acting user id',
  })
  @ApiQuery({
    name: 'created_at__gte',
    required: false,
    type: String,
    description: 'ISO 8601 lower bound (inclusive) on event creation time',
  })
  @ApiQuery({
    name: 'created_at__lte',
    required: false,
    type: String,
    description: 'ISO 8601 upper bound (inclusive) on event creation time',
  })
  @ApiQuery({
    name: 'sort_direction',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction over (created_at, id). Defaults to desc.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor for retrieving the next set of results',
  })
  @ApiOkResponse({
    type: SpaceAuditLogPage,
    description: 'Paginated audit log entries',
  })
  @ApiForbiddenResponse({
    description:
      'User is not an ACTIVE member of the space, or the feature is disabled',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @Get(':spaceId/audit-log')
  public async getAuditLog(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Auth() authPayload: AuthPayload,
    @RouteUrlDecorator() routeUrl: URL,
    @PaginationDataDecorator() paginationData: PaginationData,
    @Query('event_type', new ValidationPipe(SpaceAuditEventTypesQuerySchema))
    eventTypes?: Array<keyof typeof SpaceAuditEventType>,
    @Query(
      'actor_user_id',
      new ValidationPipe(SpaceAuditActorUserIdQuerySchema),
    )
    actorUserId?: number,
    @Query('created_at__gte', new ValidationPipe(SpaceAuditDateQuerySchema))
    createdAtGte?: Date,
    @Query('created_at__lte', new ValidationPipe(SpaceAuditDateQuerySchema))
    createdAtLte?: Date,
    @Query(
      'sort_direction',
      new ValidationPipe(SpaceAuditSortDirectionQuerySchema),
    )
    sortDirection?: 'asc' | 'desc',
  ): Promise<SpaceAuditLogPage> {
    return await this.spaceAuditService.getAuditLog({
      authPayload,
      spaceId,
      routeUrl,
      paginationData,
      filters: {
        eventTypes,
        actorUserId,
        createdAtGte,
        createdAtLte,
        sortDirection,
      },
    });
  }

  @ApiOperation({
    summary: 'Get space audit log actors',
    description:
      'Retrieves the distinct actors appearing in a space audit log — ' +
      'including former and deleted members — as a filter dropdown source. ' +
      'Requires ACTIVE membership.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
  })
  @ApiOkResponse({
    type: SpaceAuditLogActorDto,
    isArray: true,
    description: 'Distinct audit log actors',
  })
  @ApiForbiddenResponse({
    description:
      'User is not an ACTIVE member of the space, or the feature is disabled',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @Get(':spaceId/audit-log/actors')
  public async getAuditLogActors(
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<SpaceAuditLogActorDto>> {
    return await this.spaceAuditService.getAuditLogActors({
      authPayload,
      spaceId,
    });
  }
}
