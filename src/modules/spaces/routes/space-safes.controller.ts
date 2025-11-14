import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import {
  CreateSpaceSafesDto,
  CreateSpaceSafesSchema,
} from '@/modules/spaces/routes/entities/create-space-safe.dto.entity';
import {
  DeleteSpaceSafesDto,
  DeleteSpaceSafesSchema,
} from '@/modules/spaces/routes/entities/delete-space-safe.dto.entity';
import { GetSpaceSafeResponse } from '@/modules/spaces/routes/entities/get-space-safe.dto.entity';
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiParam,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

@ApiTags('spaces')
@Controller({
  path: 'spaces/:spaceId/safes',
  version: '1',
})
@UseGuards(AuthGuard)
export class SpaceSafesController {
  public constructor(
    @Inject(SpaceSafesService)
    private readonly spaceSafesService: SpaceSafesService,
  ) {}

  @ApiOperation({
    summary: 'Add Safes to space',
    description:
      'Adds one or more Safe addresses to a space. This allows the space members to collectively manage these Safes.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to add Safes to',
    example: 1,
  })
  @ApiBody({
    type: CreateSpaceSafesDto,
    description:
      'List of Safe addresses and their chain information to add to the space',
  })
  @ApiCreatedResponse({
    description: 'Safes added to space successfully',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to modify this space',
  })
  @ApiNotFoundResponse({
    description: 'User or space not found',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user lacks permission to add Safes to this space',
  })
  @Post()
  public async create(
    @Body(new ValidationPipe(CreateSpaceSafesSchema))
    body: CreateSpaceSafesDto,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spaceSafesService.create({
      spaceId,
      authPayload,
      payload: body.safes,
    });
  }

  @ApiOperation({
    summary: 'Get space Safes',
    description:
      'Retrieves all Safes associated with a specific space, including their chain information and metadata.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to get Safes for',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Space Safes retrieved successfully',
    type: GetSpaceSafeResponse,
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to access this space',
  })
  @ApiNotFoundResponse({
    description: 'User or space not found',
  })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @Get()
  public async get(
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetSpaceSafeResponse> {
    return await this.spaceSafesService.get(spaceId, authPayload);
  }

  @ApiOperation({
    summary: 'Remove Safes from space',
    description:
      'Removes one or more Safe addresses from a space. This stops the space from managing these Safes.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to remove Safes from',
    example: 1,
  })
  @ApiBody({
    type: DeleteSpaceSafesDto,
    description:
      'List of Safe addresses and their chain information to remove from the space',
  })
  @ApiNoContentResponse({
    description: 'Safes removed from space successfully',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to modify this space',
  })
  @ApiNotFoundResponse({
    description:
      'Space has no Safes, user not found, or specified Safes not found in space',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user lacks permission to remove Safes from this space',
  })
  @Delete()
  @HttpCode(204)
  public async delete(
    @Body(new ValidationPipe(DeleteSpaceSafesSchema))
    body: DeleteSpaceSafesDto,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spaceSafesService.delete({
      authPayload,
      payload: body.safes,
      spaceId,
    });
  }
}
