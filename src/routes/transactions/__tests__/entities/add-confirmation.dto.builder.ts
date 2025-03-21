import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AddConfirmationDto } from '@/routes/transactions/entities/add-confirmation.dto';

export function addConfirmationDtoBuilder(): IBuilder<AddConfirmationDto> {
  return new Builder<AddConfirmationDto>().with(
    'signature',
    faker.string.hexadecimal({ length: 130 }) as `0x${string}`,
  );
}
