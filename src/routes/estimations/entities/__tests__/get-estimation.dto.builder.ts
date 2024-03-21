import { Builder, IBuilder } from '@/__tests__/builder';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function getEstimationDtoBuilder(): IBuilder<GetEstimationDto> {
  return new Builder<GetEstimationDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('operation', faker.helpers.arrayElement([0, 1]));
}
