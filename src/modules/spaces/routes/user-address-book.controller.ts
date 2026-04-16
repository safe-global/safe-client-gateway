import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { UserAddressBookService } from '@/modules/spaces/routes/user-address-book.service';
import { SpaceAddressBookDto } from '@/modules/spaces/routes/entities/space-address-book.dto.entity';
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
} from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { Address } from 'viem';

@ApiTags('spaces')
@Controller({ path: 'spaces', version: '1' })
export class UserAddressBookController {
  constructor(
    @Inject(UserAddressBookService)
    private readonly service: UserAddressBookService,
  ) {}

  @ApiOperation({
    summary: 'Get private address book',
    description:
      "Retrieves the authenticated user's private address book entries for a specific space.",
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Private address book items retrieved successfully',
    type: SpaceAddressBookDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'User is not a member of this space',
  })
  @Get('/:spaceId/address-book/private')
  @UseGuards(AuthGuard)
  public async getPrivateItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
  ): Promise<SpaceAddressBookDto> {
    return this.service.findAll(authPayload, spaceId);
  }

  @ApiOperation({
    summary: 'Upsert private address book entries',
    description:
      "Creates or updates the authenticated user's private address book entries for a space.",
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID',
    example: 1,
  })
  @ApiBody({
    type: UpsertAddressBookItemsDto,
    description: 'Address book items to create or update',
  })
  @ApiOkResponse({
    description: 'Private address book updated successfully',
    type: SpaceAddressBookDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'User is not a member of this space or wallet authentication required',
  })
  @Put('/:spaceId/address-book/private')
  @UseGuards(AuthGuard)
  public async upsertPrivateItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Body(new ValidationPipe(UpsertAddressBookItemsSchema))
    dto: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    return this.service.upsertMany(authPayload, spaceId, dto);
  }

  @ApiOperation({
    summary: 'Delete a private address book entry',
    description:
      "Removes a specific address from the user's private address book.",
  })
  @ApiParam({
    name: 'spaceId',
    type: 'number',
    description: 'Space ID',
    example: 1,
  })
  @ApiParam({
    name: 'address',
    type: 'string',
    description: 'Address to remove (0x prefixed)',
  })
  @ApiNoContentResponse({
    description: 'Private address book entry deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Entry not found' })
  @ApiForbiddenResponse({
    description: 'User is not a member or wallet authentication required',
  })
  @Delete('/:spaceId/address-book/private/:address')
  @UseGuards(AuthGuard)
  public async deletePrivateItem(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseIntPipe, new ValidationPipe(RowSchema.shape.id))
    spaceId: number,
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
  ): Promise<void> {
    return this.service.deleteByAddress({
      authPayload,
      spaceId,
      address,
    });
  }
}
