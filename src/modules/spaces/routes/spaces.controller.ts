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
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { getEnumKey } from '#/domain/common/utils/enum';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { SpaceStatus } from '#/modules/spaces/domain/entities/space.entity';
import { SpaceSetupExceptionFilter } from '#/modules/spaces/domain/setup/exception-filters/space-setup.exception-filter';
import {
  CreateSpaceDto,
  CreateSpaceResponse,
  CreateSpaceSchema,
} from '#/modules/spaces/routes/entities/create-space.dto.entity';
import { GetSpaceResponse } from '#/modules/spaces/routes/entities/get-space.dto.entity';
import {
  CreateSpaceSetupDto,
  CreateSpaceSetupSchema,
  SpaceSetupCheckoutDto,
  SpaceSetupDto,
} from '#/modules/spaces/routes/entities/space-setup.dto.entity';
import {
  UpdateSpaceDto,
  UpdateSpaceResponse,
  UpdateSpaceSchema,
} from '#/modules/spaces/routes/entities/update-space.dto.entity';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { SpaceSetupService } from '#/modules/spaces/routes/setup/space-setup.service';
import { SpacesService } from '#/modules/spaces/routes/spaces.service';
import { InvalidSurveySelectionsExceptionFilter } from '#/modules/surveys/domain/exception-filters/invalid-survey-selections.exception-filter';
import { TooManyInvitesExceptionFilter } from '#/modules/users/domain/members/exception-filters/too-many-invites.exception-filter';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { ElevationGuard } from '#/routes/common/auth/elevation.guard';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

// Each setup rejection answers with the status the HTTP contract names.
const SPACE_SETUP_EXCEPTION_FILTERS = [
  SpaceSetupExceptionFilter,
  TooManyInvitesExceptionFilter,
  InvalidSurveySelectionsExceptionFilter,
];

@ApiTags('spaces')
@UseGuards(AuthGuard)
@Controller({ path: 'spaces', version: '1' })
export class SpacesController {
  public constructor(
    private readonly spacesService: SpacesService,
    private readonly spaceSetupService: SpaceSetupService,
  ) {}

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
    summary: 'Create a space from the onboarding form',
    description:
      'Creates the space and its creator, stores the rest of the form as a pending setup, and starts the trial checkout. The setup (Safes, contacts, invites, survey) is applied when the trial starts. Without a plan (paymentLinkId null), the setup is applied at once and checkoutUrl is null.',
  })
  @ApiBody({ type: CreateSpaceSetupDto })
  @ApiCreatedResponse({ type: SpaceSetupCheckoutDto })
  @ApiBadRequestResponse({
    description: 'Invalid return URL or survey selections',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description: 'A plan that is not offered, or the space limit is reached',
  })
  @ApiNotFoundResponse({ description: 'No active survey for this slug' })
  @ApiConflictResponse({
    description:
      'The plan has fewer Safe seats than selected, or too many invites',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid body, a plan while billing is not available, or no plan while billing is enforced',
  })
  @ApiBadGatewayResponse({
    description:
      'The space was created, but the checkout could not start. The body carries spaceId; retry with PUT.',
  })
  @Post('setup')
  @UseGuards(SpacesCreationRateLimitGuard)
  @UseFilters(...SPACE_SETUP_EXCEPTION_FILTERS)
  public async createSetup(
    @Body(new ValidationPipe(CreateSpaceSetupSchema))
    body: CreateSpaceSetupDto,
    @Auth() authPayload: AuthPayload,
  ): Promise<SpaceSetupCheckoutDto> {
    return await this.spaceSetupService.create({ authPayload, body });
  }

  @ApiOperation({
    summary: 'Get the setup of a space',
    description:
      'Returns the onboarding form stored for the space. While it is pending, the subscription is read from the billing service, and a started trial applies the setup before this answers. Admins only.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({ type: SpaceSetupDto })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({ description: 'User is not an admin of this space' })
  @ApiNotFoundResponse({ description: 'Space not found, or it has no setup' })
  @Get('/:id/setup')
  public async getSetup(
    @Param('id', SpaceIdPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<SpaceSetupDto> {
    return await this.spaceSetupService.get({ spaceId: id, authPayload });
  }

  @ApiOperation({
    summary: 'Replace the setup of a space',
    description:
      'Replaces the name and the onboarding form of a space whose trial has not started, and starts a new checkout. Admins only.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: CreateSpaceSetupDto })
  @ApiOkResponse({ type: SpaceSetupCheckoutDto })
  @ApiBadRequestResponse({
    description: 'Invalid space identifier, return URL or survey selections',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Elevation required, not an admin, or a plan that is not offered',
  })
  @ApiNotFoundResponse({
    description: 'Space not found, it has no setup, or no active survey',
  })
  @ApiConflictResponse({
    description:
      'The setup is applied or the trial has started, the plan has fewer Safe seats than selected, or too many invites',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid body, a plan while billing is not available, or no plan while billing is enforced',
  })
  @Put('/:id/setup')
  @UseGuards(ElevationGuard)
  @UseFilters(...SPACE_SETUP_EXCEPTION_FILTERS)
  public async updateSetup(
    @Body(new ValidationPipe(CreateSpaceSetupSchema))
    body: CreateSpaceSetupDto,
    @Param('id', SpaceIdPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<SpaceSetupCheckoutDto> {
    return await this.spaceSetupService.update({
      spaceId: id,
      authPayload,
      body,
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
  @UseGuards(ElevationGuard, SpacesCreationRateLimitGuard)
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
  @UseGuards(ElevationGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @Param('id', SpaceIdPipe) id: number,
    @Auth() authPayload: AuthPayload,
  ): Promise<void> {
    return await this.spacesService.delete({ id, authPayload });
  }
}
