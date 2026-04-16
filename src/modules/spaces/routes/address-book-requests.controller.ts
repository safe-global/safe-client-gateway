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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

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
    type: 'number',
    description: 'Space ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Pending requests retrieved successfully',
    type: AddressBookRequestsDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'User is not a member of this space',
  })
  @Get('/:spaceId/address-book/requests')
  @UseGuards(AuthGuard)
  public async getPendingRequests(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<AddressBookRequestsDto> {
    return this.service.findPending(authPayload, spaceId);
  }

  @ApiOperation({
    summary: 'Request to add a private contact to the space address book',
    description:
      'Creates a request to add a private contact to the shared space address book. Requires the contact to exist in the private address book first.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID',
    example: 1,
  })
  @ApiBody({
    type: CreateAddressBookRequestDto,
    description: 'Address of the private contact to request adding',
  })
  @ApiCreatedResponse({
    description: 'Request created successfully',
    type: AddressBookRequestItemDto,
  })
  @ApiNotFoundResponse({
    description: 'Private contact not found',
  })
  @ApiForbiddenResponse({
    description: 'User is not a member or wallet authentication required',
  })
  @Post('/:spaceId/address-book/requests')
  @UseGuards(AuthGuard)
  public async createRequest(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Body(new ValidationPipe(CreateAddressBookRequestSchema))
    dto: CreateAddressBookRequestDto,
  ): Promise<AddressBookRequestItemDto> {
    return this.service.createRequest(authPayload, spaceId, dto.address);
  }

  @ApiOperation({
    summary: 'Approve a pending address book request',
    description:
      'Admin approves a pending request. The contact is added to the shared space address book.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID',
    example: 1,
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
    description: 'User is not an admin or wallet authentication required',
  })
  @Put('/:spaceId/address-book/requests/:requestId/approve')
  @UseGuards(AuthGuard)
  public async approveRequest(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param(
      'requestId',
      ParseIntPipe,
      new ValidationPipe(RowSchema.shape.id),
    )
    requestId: number,
  ): Promise<void> {
    return this.service.approve(authPayload, spaceId, requestId);
  }

  @ApiOperation({
    summary: 'Reject a pending address book request',
    description:
      'Admin rejects a pending request. The contact stays in the private address book.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID',
    example: 1,
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
    description: 'User is not an admin or wallet authentication required',
  })
  @Put('/:spaceId/address-book/requests/:requestId/reject')
  @UseGuards(AuthGuard)
  public async rejectRequest(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param(
      'requestId',
      ParseIntPipe,
      new ValidationPipe(RowSchema.shape.id),
    )
    requestId: number,
  ): Promise<void> {
    return this.service.reject(authPayload, spaceId, requestId);
  }
}
