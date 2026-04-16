import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export class AddressBookRequestItemDto {
  @ApiProperty()
  public id!: number;

  @ApiProperty({ type: String })
  public name!: string;

  @ApiProperty({ type: String })
  public address!: string;

  @ApiProperty({ type: String, isArray: true })
  public chainIds!: string[];

  @ApiProperty({ type: String })
  public requestedBy!: string;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  public status!: 'PENDING' | 'APPROVED' | 'REJECTED';

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

export class CreateAddressBookRequestDto
  implements z.infer<typeof CreateAddressBookRequestSchema>
{
  @ApiProperty({
    type: String,
    description: 'Address of the private contact to request adding to space',
  })
  public readonly address!: `0x${string}`;
}
