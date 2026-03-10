import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { SiweAuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function authPayloadDtoBuilder(): IBuilder<SiweAuthPayloadDto> {
  return new Builder<SiweAuthPayloadDto>()
    .with('chain_id', faker.string.numeric({ exclude: ['0'] }))
    .with('signer_address', getAddress(faker.finance.ethereumAddress()));
}
