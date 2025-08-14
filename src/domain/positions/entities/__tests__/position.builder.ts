import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import type { Builder } from '@/__tests__/builder';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import type { Position } from '@/domain/positions/entities/position.entity';
import { POSITION_TYPE_VALUES } from '@/domain/positions/entities/position-type.entity';
import { zerionApplicationMetadataBuilder } from '@/datasources/balances-api/entities/__tests__/zerion-balance.entity.builder';

export function positionBuilder(): IBuilder<Position> {
  return (balanceBuilder() as unknown as Builder<Position>)
    .with('protocol', faker.string.sample())
    .with('name', faker.string.sample())
    .with('position_type', faker.helpers.arrayElement(POSITION_TYPE_VALUES))
    .with('application_metadata', zerionApplicationMetadataBuilder().build());
}
