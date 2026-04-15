// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { FeePreviewTransactionDto } from '@/modules/fees/routes/entities/fee-preview-transaction.dto.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

export function feePreviewTransactionDtoBuilder(): IBuilder<FeePreviewTransactionDto> {
  return new Builder<FeePreviewTransactionDto>()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', '0')
    .with('data', '0x')
    .with('operation', Operation.CALL)
    .with('gasToken', getAddress(zeroAddress))
    .with('numberSignatures', faker.number.int({ min: 1, max: 10 }));
}
