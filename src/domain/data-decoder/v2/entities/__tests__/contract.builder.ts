import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { fakeJson } from '@/__tests__/faker';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { Contract } from '@/domain/data-decoder/v2/entities/contract.entity';

export function projectBuilder(): IBuilder<NonNullable<Contract['project']>> {
  return new Builder<NonNullable<Contract['project']>>()
    .with('description', faker.lorem.sentence())
    .with('logo_file', faker.internet.url());
}

export function abiBuilder(): IBuilder<Contract['abi']> {
  return new Builder<Contract['abi']>()
    .with('abi_json', [JSON.parse(fakeJson()) as Record<string, unknown>])
    .with('abi_hash', faker.string.hexadecimal() as `0x${string}`)
    .with('modified', faker.date.past());
}

export function contractBuilder(): IBuilder<Contract> {
  return new Builder<Contract>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', faker.word.noun())
    .with('display_name', faker.word.noun())
    .with('chain_id', faker.number.int() as unknown as `${number}`)
    .with('project', projectBuilder().build())
    .with('abi', abiBuilder().build())
    .with('modified', faker.date.past());
}
