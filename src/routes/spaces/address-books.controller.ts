import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressBooksService } from '@/routes/spaces/address-books.service';
import { SpaceAddressBookDto } from '@/routes/spaces/entities/space-address-book.dto.entity';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import {
  UpsertAddressBookItemsDto,
  UpsertAddressBookItemsSchema,
} from '@/routes/spaces/entities/upsert-address-book-items.dto.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { SpacesAddressBookRateLimitGuard } from '@/routes/spaces/guards/spaces-address-book-rate-limit.guard';

@ApiTags('spaces')
@Controller({ path: 'spaces', version: '1' })
export class AddressBooksController {
  constructor(
    @Inject(AddressBooksService)
    private readonly service: AddressBooksService,
  ) {}

  @ApiOperation({
    summary: 'Get space address book',
    description:
      'Retrieves all address book entries for a specific space. Address books help organize and label frequently used addresses.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to get address book for',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Address book items retrieved successfully',
    type: SpaceAddressBookDto,
  })
  @ApiNotFoundResponse({
    description: 'User, member, or space not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not a member of this space',
  })
  @Get('/:spaceId/address-book')
  @UseGuards(AuthGuard)
  public async getAddressBookItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<SpaceAddressBookDto> {
    return this.service.findAllBySpaceId(authPayload, spaceId);
  }

  @ApiOperation({
    summary: 'Update space address book',
    description:
      'Creates or updates address book entries for a space. This allows adding labels and organizing frequently used addresses.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID to update address book for',
    example: 1,
  })
  @ApiBody({
    type: UpsertAddressBookItemsDto,
    description:
      'Address book items to create or update, including addresses and their labels',
  })
  @ApiOkResponse({
    description: 'Address book updated successfully',
    type: SpaceAddressBookDto,
  })
  @ApiNotFoundResponse({
    description: 'User, member, or space not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not authorized to modify this address book',
  })
  @ApiBadRequestResponse({
    description: 'Address book items limit exceeded or invalid data provided',
  })
  @Put('/:spaceId/address-book')
  @UseGuards(SpacesAddressBookRateLimitGuard)
  @UseGuards(AuthGuard)
  public async upsertAddressBookItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Body(new ValidationPipe(UpsertAddressBookItemsSchema))
    addressBookItems: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    return this.service.upsertMany(authPayload, spaceId, addressBookItems);
  }

  @ApiOperation({
    summary: 'Delete address book entry',
    description:
      'Removes a specific address from the space address book by its address.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID containing the address book',
    example: 1,
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description:
      'Address to remove from the address book (0x prefixed hex string)',
  })
  @ApiNoContentResponse({
    description: 'Address book entry deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'User, member, space, or address book entry not found',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not authorized to modify this address book',
  })
  @Delete('/:spaceId/address-book/:address')
  @UseGuards(AuthGuard)
  public async deleteByAddress(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param('address', new ValidationPipe(AddressSchema))
    address: `0x${string}`,
  ): Promise<void> {
    return this.service.deleteByAddress({ authPayload, spaceId, address });
  }
}
