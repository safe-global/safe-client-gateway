import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { OidcAuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';
import { faker } from '@faker-js/faker';

export function oidcAuthPayloadDtoBuilder(): IBuilder<OidcAuthPayloadDto> {
  return new Builder<OidcAuthPayloadDto>().with(
    'user_id',
    faker.string.numeric({ exclude: ['0'] }),
  );
}
