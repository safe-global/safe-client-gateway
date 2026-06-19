// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { AddressBookRequestsService } from '@/modules/spaces/routes/address-book-requests.service';
import {
  AddressBookRequestItemDto,
  AddressBookRequestsDto,
  CreateAddressBookRequestDto,
  CreateAddressBookRequestSchema,
} from '@/modules/spaces/routes/entities/address-book-request.dto.entity';
import { SpacesAddressBookRequestsRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-address-book-requests-rate-limit.guard';
import { SpaceIdPipe } from '@/modules/spaces/routes/pipes/space-id.pipe';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

@ApiTags('spaces')
@Controller({ path: 'spaces', version: '1' })
export class AddressBookRequestsController {
  constructor(
    @Inject(AddressBookRequestsService)
    private readonly service: AddressBookRequestsService,
  ) {}

  @ApiOperation({
    summary: 'Get pending address book requests',
    description:
      'Retrieves pending requests to add contacts to the space address book. Admins see all pending requests, members see only their own.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'Pending requests retrieved successfully',
    type: AddressBookRequestsDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'User is not a member of this space',
  })
  @Get('/:spaceId/address-book/requests')
  @UseGuards(AuthGuard)
  public async getPendingRequests(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
  ): Promise<AddressBookRequestsDto> {
    return await this.service.findPending(authPayload, spaceId);
  }

  @ApiOperation({
    summary: 'Request to add a contact to the space address book',
    description:
      'Creates a request to add a contact to the shared space address book. The proposed contact (name, address, chain ids) is stored on the request and added to the address book once an admin approves it.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: CreateAddressBookRequestDto,
    description: 'The contact to propose for the space address book',
  })
  @ApiCreatedResponse({
    description: 'Request created successfully',
    type: AddressBookRequestItemDto,
  })
  @ApiConflictResponse({
    description: 'A pending request for this address already exists',
  })
  @ApiBadRequestResponse({
    description: 'Maximum number of pending requests reached',
  })
  @ApiForbiddenResponse({
    description: 'User is not an active member of this space',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Post('/:spaceId/address-book/requests')
  @UseGuards(AuthGuard, SpacesAddressBookRequestsRateLimitGuard)
  public async createRequest(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Body(new ValidationPipe(CreateAddressBookRequestSchema))
    dto: CreateAddressBookRequestDto,
  ): Promise<AddressBookRequestItemDto> {
    return await this.service.createRequest(authPayload, spaceId, dto);
  }

  @ApiOperation({
    summary: 'Approve a pending address book request',
    description:
      'Admin approves a pending request. The contact is added to the shared space address book.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'requestId',
    type: 'number',
    description: 'Request ID to approve',
  })
  @ApiOkResponse({ description: 'Request approved successfully' })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiBadRequestResponse({
    description: 'Only pending requests can be approved',
  })
  @ApiForbiddenResponse({
    description: 'User is not an admin of this space',
  })
  @Put('/:spaceId/address-book/requests/:requestId/approve')
  @UseGuards(AuthGuard)
  public async approveRequest(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('requestId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    requestId: number,
  ): Promise<void> {
    return await this.service.approve(authPayload, spaceId, requestId);
  }

  @ApiOperation({
    summary: 'Reject a pending address book request',
    description:
      'Admin rejects a pending request. The requester can submit a new request for the same address afterwards.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'requestId',
    type: 'number',
    description: 'Request ID to reject',
  })
  @ApiOkResponse({ description: 'Request rejected successfully' })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiBadRequestResponse({
    description: 'Only pending requests can be rejected',
  })
  @ApiForbiddenResponse({
    description: 'User is not an admin of this space',
  })
  @Put('/:spaceId/address-book/requests/:requestId/reject')
  @UseGuards(AuthGuard)
  public async rejectRequest(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('requestId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    requestId: number,
  ): Promise<void> {
    return await this.service.reject(authPayload, spaceId, requestId);
  }
}
