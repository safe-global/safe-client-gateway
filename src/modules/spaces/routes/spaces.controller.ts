// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { getEnumKey } from '@/domain/common/utils/enum';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { SpaceStatus } from '@/modules/spaces/domain/entities/space.entity';
import {
  CreateSpaceDto,
  CreateSpaceResponse,
  CreateSpaceSchema,
} from '@/modules/spaces/routes/entities/create-space.dto.entity';
import { GetSpaceResponse } from '@/modules/spaces/routes/entities/get-space.dto.entity';
import {
  UpdateSpaceDto,
  UpdateSpaceResponse,
  UpdateSpaceSchema,
} from '@/modules/spaces/routes/entities/update-space.dto.entity';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('spaces')
@UseGuards(AuthGuard)
@Controller({ path: 'spaces', version: '1' })
export class SpacesController {
  public constructor(private readonly spacesService: SpacesService) {}

  @ApiOperation({
    summary: 'Create space',
    description:
      'Creates a new space for the authenticated user. A space is a collaborative workspace where users can manage multiple Safes together.',
  })
  @ApiBody({
    type: CreateSpaceDto,
    description: 'Space creation data including the name of the space',
  })
  @ApiOkResponse({
    description: 'Space created successfully',
    type: CreateSpaceResponse,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user lacks permission to create spaces',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Post()
  @UseGuards(SpacesCreationRateLimitGuard)
  public async create(
    @Body(new ValidationPipe(CreateSpaceSchema))
    body: CreateSpaceDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<CreateSpaceResponse> {
    return await this.spacesService.create({
      authPayload,
      name: body.name,
      status: getEnumKey(SpaceStatus, SpaceStatus.ACTIVE),
    });
  }

  @ApiOperation({
    summary: 'Get user spaces',
    description:
      'Retrieves all spaces that the authenticated user is a member of or has been invited to, including the count of Safes in each space.',
  })
  @ApiOkResponse({
    description: 'User spaces retrieved successfully',
    type: GetSpaceResponse,
    isArray: true,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user lacks permission to view spaces',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Get()
  public async get(
    @Auth() authPayload: AuthPayload,
  ): Promise<Array<GetSpaceResponse>> {
    return await this.spacesService.getActiveOrInvitedSpaces(authPayload);
  }

  @ApiOperation({
    summary: 'Get space by UUID',
    description:
      'Retrieves detailed information about a specific space. The user must be a member of or invited to the space.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'Space information retrieved successfully',
    type: GetSpaceResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid space identifier',
  })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user is not a member of this space',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @Get('/:id')
  public async getOne(
    @Param('id', SpaceIdPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<GetSpaceResponse> {
    return await this.spacesService.getActiveOrInvitedSpace(id, authPayload);
  }

  @ApiOperation({
    summary: 'Update space',
    description:
      'Updates space information such as name. Only space admins can update space details.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Space UUID to update',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpdateSpaceDto,
    description: 'Space update data including new name or other properties',
  })
  @ApiOkResponse({
    description: 'Space updated successfully',
    type: UpdateSpaceResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid space identifier',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user is not an admin of this space',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to update this space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @Patch('/:id')
  @UseGuards(SpacesCreationRateLimitGuard)
  public async update(
    @Body(new ValidationPipe(UpdateSpaceSchema))
    payload: UpdateSpaceDto,
    @Param('id', SpaceIdPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<UpdateSpaceResponse> {
    return await this.spacesService.update({
      id,
      authPayload,
      updatePayload: payload,
    });
  }

  @ApiOperation({
    summary: 'Delete space',
    description:
      'Deletes a space and all its associated data. Only space admins can delete spaces.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Space UUID to delete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    description: 'Space deleted successfully',
    status: HttpStatus.NO_CONTENT,
  })
  @ApiBadRequestResponse({
    description: 'Invalid space identifier',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden resource - user is not an admin of this space',
  })
  @ApiUnauthorizedResponse({
    description:
      'Authentication required or user unauthorized to delete this space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @Param('id', SpaceIdPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spacesService.delete({ id, authPayload });
  }
}
