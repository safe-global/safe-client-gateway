import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { PipeTransform, Injectable } from '@nestjs/common';
import { z } from 'zod';

const Caip10AddressPipeSchema = z.object({
  chainId: NumericStringSchema,
  address: AddressSchema,
});

@Injectable()
export class Caip10AddressesPipe
  implements
    PipeTransform<string, Array<{ chainId: string; address: `0x${string}` }>>
{
  transform(data: string): Array<{
    chainId: string;
    address: `0x${string}`;
  }> {
    const addresses = data.split(',').map((caip10Address: string) => {
      const [chainId, address] = caip10Address.split(':');

      return Caip10AddressPipeSchema.parse({ chainId, address });
    });

    if (addresses.length === 0) {
      throw new Error('No addresses provided. At least one is required.');
    }

    return addresses;
  }
}
