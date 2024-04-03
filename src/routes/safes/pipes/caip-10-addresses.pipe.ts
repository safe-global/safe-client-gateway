import { PipeTransform, Injectable } from '@nestjs/common';

@Injectable()
export class Caip10AddressesPipe
  implements PipeTransform<string, Array<{ chainId: string; address: string }>>
{
  transform(data: string): Array<{
    chainId: string;
    address: string;
  }> {
    const addresses = data.split(',').map((caip10Address: string) => {
      const [chainId, address] = caip10Address.split(':');

      return { chainId, address };
    });

    if (addresses.length === 0 || !addresses[0].address) {
      throw new Error(
        'Provided addresses do not conform to the CAIP-10 standard',
      );
    }

    return addresses;
  }
}
