import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { GetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';

export function getEstimationDtoBuilder(): IBuilder<GetEstimationDto> {
  return new Builder<GetEstimationDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('data', faker.string.hexadecimal() as Hex)
    .with('operation', faker.helpers.arrayElement([0, 1]));
}
