// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { UpdateMessageSignatureDto } from '@/modules/messages/routes/entities/update-message-signature.entity';

export function updateMessageSignatureDtoBuilder(): IBuilder<UpdateMessageSignatureDto> {
  return new Builder<UpdateMessageSignatureDto>().with(
    'signature',
    faker.string.hexadecimal({ length: 130 }) as Hex,
  );
}
