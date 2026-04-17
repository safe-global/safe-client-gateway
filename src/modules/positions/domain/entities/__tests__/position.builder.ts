import { faker } from '@faker-js/faker';
import type { Builder, IBuilder } from '@/__tests__/builder';
import { zerionApplicationMetadataBuilder } from '@/modules/balances/datasources/entities/__tests__/zerion-balance.entity.builder';
import { balanceBuilder } from '@/modules/balances/domain/entities/__tests__/balance.builder';
import type { Position } from '@/modules/positions/domain/entities/position.entity';
import { PositionTypes } from '@/modules/positions/domain/entities/position-type.entity';

export function positionBuilder(): IBuilder<Position> {
  return (balanceBuilder() as unknown as Builder<Position>)
    .with('protocol', faker.string.sample())
    .with('name', faker.string.sample())
    .with('position_type', faker.helpers.arrayElement(PositionTypes))
    .with('application_metadata', zerionApplicationMetadataBuilder().build());
}
