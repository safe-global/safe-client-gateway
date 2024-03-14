import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { GetDataDecodedDto } from '@/routes/data-decode/entities/get-data-decoded.dto.entity';
import { getAddress } from 'viem';

export function getDataDecodedDtoBuilder(): IBuilder<GetDataDecodedDto> {
  return new Builder<GetDataDecodedDto>()
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('to', getAddress(faker.finance.ethereumAddress()));
}
