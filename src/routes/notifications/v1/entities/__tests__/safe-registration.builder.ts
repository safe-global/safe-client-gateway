import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { SafeRegistration } from '@/routes/notifications/v1/entities/safe-registration.entity';
import type { UUID } from 'crypto';
import { safeRegistrationSignatureBuilder } from '@/routes/notifications/v1/entities/__tests__/create-signature.builder';

export async function safeRegistrationBuilder(args: {
  signaturePrefix: string;
  uuid: UUID;
  cloudMessagingToken: UUID;
  timestamp: number;
}): Promise<IBuilder<SafeRegistration>> {
  const safeAddresses = faker.helpers.multiple(
    () => faker.finance.ethereumAddress(),
    {
      count: { min: 0, max: 5 },
    },
  ) as Array<`0x${string}`>;
  return new Builder<SafeRegistration>()
    .with('chainId', faker.string.numeric())
    .with('safes', safeAddresses)
    .with('signatures', [
      await safeRegistrationSignatureBuilder({
        ...args,
        safeAddresses: safeAddresses,
      }),
    ]);
}
