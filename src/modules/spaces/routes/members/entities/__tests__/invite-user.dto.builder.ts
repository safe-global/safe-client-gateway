// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import {
  InviteType,
  type InviteUserInput,
} from '@/modules/spaces/routes/members/entities/invite-users.dto.entity';
import { EmailAddressSchema } from '@/validation/entities/schemas/email-address.schema';

type WalletInviteUserInput = Extract<
  InviteUserInput,
  { type: typeof InviteType.Wallet }
>;

type EmailInviteUserInput = Extract<
  InviteUserInput,
  { type: typeof InviteType.Email }
>;

export function walletInviteUserDtoBuilder(): IBuilder<WalletInviteUserInput> {
  return new Builder<WalletInviteUserInput>()
    .with('type', InviteType.Wallet)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('role', 'MEMBER')
    .with('name', nameBuilder());
}

export function emailInviteUserDtoBuilder(): IBuilder<EmailInviteUserInput> {
  return new Builder<EmailInviteUserInput>()
    .with('type', InviteType.Email)
    .with('email', EmailAddressSchema.parse(faker.internet.email()))
    .with('role', 'MEMBER')
    .with('name', nameBuilder());
}
