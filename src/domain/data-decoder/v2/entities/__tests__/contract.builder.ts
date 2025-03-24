import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { fakeJson } from '@/__tests__/faker';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';

export function projectBuilder(): IBuilder<NonNullable<Contract['project']>> {
  return new Builder<NonNullable<Contract['project']>>()
    .with('description', faker.lorem.sentence())
    .with('logoFile', faker.internet.url());
}

export function abiBuilder(): IBuilder<Contract['abi']> {
  return new Builder<Contract['abi']>()
    .with('abiJson', [JSON.parse(fakeJson()) as Record<string, unknown>])
    .with('abiHash', faker.string.hexadecimal() as `0x${string}`)
    .with('modified', faker.date.past());
}

export function contractBuilder(): IBuilder<Contract> {
  return new Builder<Contract>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', faker.word.noun())
    .with('displayName', faker.word.noun())
    .with('chainId', faker.number.int() as unknown as string)
    .with('project', projectBuilder().build())
    .with('abi', abiBuilder().build())
    .with('modified', faker.date.past());
}
