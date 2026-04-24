// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { AddressBookRequestStatus } from '@/modules/spaces/domain/address-books/entities/address-book-request.entity';
import { getStringEnumKeys } from '@/domain/common/utils/enum';

export class AddressBookRequestItemDto {
  @ApiProperty()
  public id!: number;

  @ApiProperty({ type: String })
  public name!: string;

  @ApiProperty({ type: String })
  public address!: string;

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: Array<string>;

  @ApiProperty({ type: String })
  public requestedBy!: string;

  @ApiProperty({ enum: getStringEnumKeys(AddressBookRequestStatus) })
  public status!: keyof typeof AddressBookRequestStatus;

  @ApiProperty()
  public createdAt!: Date;

  @ApiProperty()
  public updatedAt!: Date;
}

export class AddressBookRequestsDto {
  @ApiProperty({ type: String })
  public spaceId!: string;

  @ApiProperty({ type: AddressBookRequestItemDto, isArray: true })
  public data!: Array<AddressBookRequestItemDto>;
}

export const CreateAddressBookRequestSchema = z.object({
  address: AddressSchema,
});

export class CreateAddressBookRequestDto implements z.infer<
  typeof CreateAddressBookRequestSchema
> {
  @ApiProperty({
    type: String,
    description: 'Address of the private contact to request adding to space',
  })
  public readonly address!: Address;
}
