import {
  CreateAddressBookItemDto,
  CreateAddressBookItemDtoSchema,
} from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { AddressBooksService } from '@/routes/accounts/address-books/address-books.service';
import {
  AddressBook,
  AddressBookItem,
} from '@/routes/accounts/address-books/entities/address-book.entity';
import { Auth } from '@/routes/auth/decorators/auth.decorator';
import { AuthGuard } from '@/routes/auth/guards/auth.guard';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('accounts')
@Controller({ path: 'accounts', version: '1' })
export class AddressBooksController {
  constructor(private readonly service: AddressBooksService) {}

  @ApiOkResponse({ type: AddressBook })
  @Get(':address/address-books/:chainId')
  @UseGuards(AuthGuard)
  async getAddressBook(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
  ): Promise<AddressBook> {
    return this.service.getAddressBook({
      authPayload,
      address,
      chainId,
    });
  }

  @ApiOkResponse({ type: AddressBookItem })
  @Post(':address/address-books/:chainId')
  @UseGuards(AuthGuard)
  async createAddressBookItem(
    @Auth() authPayload: AuthPayload,
    @Param('address', new ValidationPipe(AddressSchema)) address: `0x${string}`,
    @Param('chainId', new ValidationPipe(NumericStringSchema)) chainId: string,
    @Body(new ValidationPipe(CreateAddressBookItemDtoSchema))
    createAddressBookItemDto: CreateAddressBookItemDto,
  ): Promise<AddressBookItem> {
    return this.service.createAddressBookItem({
      authPayload,
      address,
      chainId,
      createAddressBookItemDto,
    });
  }
}
