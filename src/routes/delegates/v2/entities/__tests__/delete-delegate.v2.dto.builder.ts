import { Builder, IBuilder } from '@/__tests__/builder';
import { DeleteDelegateV2Dto } from '@/routes/delegates/v2/entities/delete-delegate.v2.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function deleteDelegateV2DtoBuilder(): IBuilder<DeleteDelegateV2Dto> {
  return new Builder<DeleteDelegateV2Dto>()
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with(
      'signature',
      faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
    );
}
