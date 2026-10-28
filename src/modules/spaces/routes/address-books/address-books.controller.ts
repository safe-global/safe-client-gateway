// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { MAX_TAGS_PER_WORKSPACE } from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { AddressBooksService } from '#/modules/spaces/routes/address-books/address-books.service';
import {
  CreateTagDto,
  CreateTagSchema,
  RenameTagDto,
  RenameTagSchema,
  SetContactTagsDto,
  SetContactTagsSchema,
  TagIdSchema,
} from '#/modules/spaces/routes/address-books/entities/address-book-tags.dto.entity';
import { SpaceAddressBookDto } from '#/modules/spaces/routes/address-books/entities/space-address-book.dto.entity';
import {
  UpsertAddressBookItemsDto,
  UpsertAddressBookItemsSchema,
} from '#/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import { SpacesAddressBookRateLimitGuard } from '#/modules/spaces/routes/address-books/guards/spaces-address-book-rate-limit.guard';
import { Auth } from '#/routes/common/auth/auth.decorator';
import { ElevationGuard } from '#/routes/common/auth/elevation.guard';
import { SpaceIdPipe } from '#/routes/common/pipes/space-id.pipe';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { ValidationPipe } from '#/validation/pipes/validation.pipe';

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
      'Retrieves all address book entries for a specific space, with the tags of each entry and every tag of the space. Address books help organize and label frequently used addresses.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID to get address book for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'Address book items retrieved successfully',
    type: SpaceAddressBookDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not an active member of this space',
  })
  @Get('/:spaceId/address-book')
  @UseGuards(AuthGuard)
  public async getAddressBookItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
  ): Promise<SpaceAddressBookDto> {
    return await this.service.findAllBySpaceId(authPayload, spaceId);
  }

  @ApiOperation({
    summary: 'Update space address book',
    description:
      'Creates or updates address book entries for a space. This allows adding labels and organizing frequently used addresses. An entry that carries tags gets exactly those tags; an entry without tags keeps its current tags.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID to update address book for',
    example: '123e4567-e89b-12d3-a456-426614174000',
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
    description: 'Space not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not an active admin of this space',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid space identifier, address book items limit exceeded, or space tag limit reached',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid body - an invalid address, name or chain ID, an invalid tag name, or more tags on an entry than allowed',
  })
  @Put('/:spaceId/address-book')
  @UseGuards(AuthGuard, ElevationGuard, SpacesAddressBookRateLimitGuard)
  public async upsertAddressBookItems(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Body(new ValidationPipe(UpsertAddressBookItemsSchema))
    addressBookItems: UpsertAddressBookItemsDto,
  ): Promise<SpaceAddressBookDto> {
    return await this.service.upsertMany(
      authPayload,
      spaceId,
      addressBookItems,
    );
  }

  @ApiOperation({
    summary: 'Set address book entry tags',
    description:
      'Replaces the tags of one or more address book entries. Any active member of the space may set tags. A tag name the space does not have yet creates the tag. The request is all or nothing: if one entry cannot be tagged, no entry changes.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID containing the address book',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: SetContactTagsDto,
    description: 'The entries to tag, each with its full set of tag names',
  })
  @ApiOkResponse({
    description: 'Tags set successfully',
    type: SpaceAddressBookDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid space identifier, the space tag limit is reached, or more entries than the address book can hold',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not an active member of this space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found, or an address is not in the address book',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid body - no entries, an address listed twice, an invalid address or tag name, or more tags on an entry than allowed',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Put('/:spaceId/address-book/tags')
  @UseGuards(AuthGuard, ElevationGuard, SpacesAddressBookRateLimitGuard)
  public async setContactTags(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Body(new ValidationPipe(SetContactTagsSchema))
    dto: SetContactTagsDto,
  ): Promise<SpaceAddressBookDto> {
    return await this.service.setContactTags(authPayload, spaceId, dto);
  }

  @ApiOperation({
    summary: 'Create address book tag',
    description:
      'Creates a tag of the space with no contacts, in a random unused colour. Any active member of the space may create tags.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID containing the address book',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: CreateTagDto, description: 'The tag name' })
  @ApiCreatedResponse({
    description: 'Tag created successfully',
    type: SpaceAddressBookDto,
  })
  @ApiBadRequestResponse({
    description: `Invalid space identifier, or the space already has ${MAX_TAGS_PER_WORKSPACE} tags`,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not an active member of this space',
  })
  @ApiNotFoundResponse({ description: 'Space not found' })
  @ApiConflictResponse({
    description: 'The space has a tag with this name, ignoring case',
  })
  @ApiUnprocessableEntityResponse({ description: 'Invalid tag name' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Post('/:spaceId/address-book/tags')
  @UseGuards(AuthGuard, ElevationGuard, SpacesAddressBookRateLimitGuard)
  public async createTag(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Body(new ValidationPipe(CreateTagSchema))
    dto: CreateTagDto,
  ): Promise<SpaceAddressBookDto> {
    return await this.service.createTag({ authPayload, spaceId, dto });
  }

  @ApiOperation({
    summary: 'Rename address book tag',
    description:
      'Renames a tag of the space; the tag keeps its colour. Renaming to the name of another tag of the space merges the two: the entries of the renamed tag move to the existing tag, which keeps its name and colour. Any active member of the space may rename tags.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID containing the address book',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'tagId',
    type: 'number',
    description: 'ID of the tag to rename',
  })
  @ApiBody({ type: RenameTagDto, description: 'The new tag name' })
  @ApiOkResponse({
    description: 'Tag renamed successfully',
    type: SpaceAddressBookDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid space or tag identifier',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not an active member of this space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found, or the tag is not a tag of this space',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Invalid tag name, or a tag identifier beyond the safe integer range',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  @Patch('/:spaceId/address-book/tags/:tagId')
  @UseGuards(AuthGuard, ElevationGuard, SpacesAddressBookRateLimitGuard)
  public async renameTag(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('tagId', ParseIntPipe, new ValidationPipe(TagIdSchema))
    tagId: number,
    @Body(new ValidationPipe(RenameTagSchema))
    dto: RenameTagDto,
  ): Promise<SpaceAddressBookDto> {
    return await this.service.renameTag({ authPayload, spaceId, tagId, dto });
  }

  @ApiOperation({
    summary: 'Delete address book tag',
    description:
      'Deletes a tag of the space and removes it from every address book entry. Any active member of the space may delete tags.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID containing the address book',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'tagId',
    type: 'number',
    description: 'ID of the tag to delete',
  })
  @ApiNoContentResponse({ description: 'Tag deleted successfully' })
  @ApiBadRequestResponse({
    description: 'Invalid space or tag identifier',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required - valid JWT token must be provided',
  })
  @ApiForbiddenResponse({
    description:
      'Access forbidden - user is not an active member of this space',
  })
  @ApiNotFoundResponse({
    description: 'Space not found, or the tag is not a tag of this space',
  })
  @ApiUnprocessableEntityResponse({
    description: 'A tag identifier beyond the safe integer range',
  })
  @Delete('/:spaceId/address-book/tags/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, ElevationGuard)
  public async deleteTag(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('tagId', ParseIntPipe, new ValidationPipe(TagIdSchema))
    tagId: number,
  ): Promise<void> {
    return await this.service.deleteTag({ authPayload, spaceId, tagId });
  }

  @ApiOperation({
    summary: 'Delete address book entry',
    description:
      'Removes a specific address from the space address book by its address.',
  })
  @ApiParam({
    name: 'spaceId',
    type: 'string',
    description: 'Space UUID containing the address book',
    example: '123e4567-e89b-12d3-a456-426614174000',
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
  @ApiBadRequestResponse({ description: 'Invalid space identifier' })
  @ApiNotFoundResponse({
    description: 'Space not found',
  })
  @ApiForbiddenResponse({
    description: 'Access forbidden - user is not an active admin of this space',
  })
  @Delete('/:spaceId/address-book/:address')
  @UseGuards(AuthGuard, ElevationGuard)
  public async deleteByAddress(
    @Auth() authPayload: AuthPayload,
    @Param('spaceId', SpaceIdPipe) spaceId: number,
    @Param('address', new ValidationPipe(AddressSchema))
    address: Address,
  ): Promise<void> {
    return await this.service.deleteByAddress({
      authPayload,
      spaceId,
      address,
    });
  }
}
