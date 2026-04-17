// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AddConfirmationDto } from '@/modules/transactions/routes/entities/add-confirmation.dto';

export function addConfirmationDtoBuilder(): IBuilder<AddConfirmationDto> {
  return new Builder<AddConfirmationDto>().with(
    'signature',
    faker.string.hexadecimal({ length: 130 }) as Hex,
  );
}
