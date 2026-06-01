// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { Auth } from '@/modules/auth/routes/decorators/auth.decorator';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { UserAddressBookDto } from '@/modules/spaces/routes/entities/space-address-book.dto.entity';
import {
  UpsertAddressBookItemsDto,
  UpsertAddressBookItemsSchema,
} from '@/modules/spaces/routes/entities/upsert-address-book-items.dto.entity';
import { UserAddressBookService } from '@/modules/spaces/routes/user-address-book.service';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

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
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'Private address book items retrieved successfully',
    type: UserAddressBookDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'User is not a member of this space',
  })
  @Get('/:spaceId/address-book/private')
  @UseGuards(AuthGuard)
  public async getPrivateItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseUUIDPipe) spaceUuid: string,
  ): Promise<UserAddressBookDto> {
    const spaceId = await this.service.getNumericId(spaceUuid);
    return await this.service.findAll(authPayload, spaceId);
  }

  @ApiOperation({
    summary: 'Upsert private address book entries',
    description:
      "Creates or updates the authenticated user's private address book entries for a space.",
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: UpsertAddressBookItemsDto,
    description: 'Address book items to create or update',
  })
  @ApiOkResponse({
    description: 'Private address book updated successfully',
    type: UserAddressBookDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'User is not a member of this space',
  })
  @Put('/:spaceId/address-book/private')
  @UseGuards(AuthGuard)
  public async upsertPrivateItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseUUIDPipe) spaceUuid: string,
    @Body(new ValidationPipe(UpsertAddressBookItemsSchema))
    dto: UpsertAddressBookItemsDto,
  ): Promise<UserAddressBookDto> {
    const spaceId = await this.service.getNumericId(spaceUuid);
    return await this.service.upsertMany(authPayload, spaceId, dto);
  }

  @ApiOperation({
    summary: 'Delete a private address book entry',
    description:
      "Removes a specific address from the user's private address book.",
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
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
    description: 'User is not a member of this space',
  })
  @Delete('/:spaceId/address-book/private/:address')
  @UseGuards(AuthGuard)
  public async deletePrivateItem(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', ParseUUIDPipe) spaceUuid: string,
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
  ): Promise<void> {
    const spaceId = await this.service.getNumericId(spaceUuid);
    return await this.service.deleteByAddress({
      authPayload,
      spaceId,
      address,
    });
  }
}
