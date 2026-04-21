// SPDX-License-Identifier: FSL-1.1-MIT
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { SpaceCounterfactualSafesService } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.service';
import { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import type { UUID } from 'crypto';
import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/counterfactual-safes',
  version: '1',
})
@UseGuards(AuthGuard)
export class SpaceCounterfactualSafesController {
  public constructor(
    @Inject(SpaceCounterfactualSafesService)
    private readonly spaceCounterfactualSafesService: SpaceCounterfactualSafesService,
  ) {}

  @ApiOperation({
    summary: 'Get counterfactual Safes in a space',
    description:
      'Retrieves creation parameters for all counterfactual (undeployed) Safes that are associated with a space. Uses a join between space_safes and counterfactual_safes to provide full transparency on Safe ownership and deployment parameters to all space members.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    format: 'uuid',
    description: 'Space ID',
  })
  @ApiOkResponse({
    description: 'Counterfactual Safes retrieved successfully',
    type: GetCounterfactualSafesResponse,
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user is not a member of this space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @Get()
  public async get(
    @Param('spaceId', new ValidationPipe(UuidSchema))
    spaceId: UUID,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetCounterfactualSafesResponse> {
    return await this.spaceCounterfactualSafesService.get(spaceId, authPayload);
  }
}
