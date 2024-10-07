import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';
import { getAddress } from 'viem';

export function previewTransactionDtoBuilder(): IBuilder<PreviewTransactionDto> {
  return new Builder<PreviewTransactionDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('data', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
    .with('value', faker.string.numeric())
    .with('operation', faker.helpers.arrayElement([0, 1]));
}
