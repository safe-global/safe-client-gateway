// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

type InvitationIdentifier = {
  address?: Address;
  email?: string;
};

export type AddressInvitationIdentifier = InvitationIdentifier &
  Required<Pick<InvitationIdentifier, 'address'>> & {
    email?: never;
  };

export type EmailInvitationIdentifier = InvitationIdentifier &
  Required<Pick<InvitationIdentifier, 'email'>> & {
    address?: never;
  };

export type Invitation = {
  userId?: User['id'];
  spaceId: Space['id'];
  role: Member['role'];
  name: Member['name'];
  status: Member['status'];
  invitedBy: Member['invitedBy'];
  inviteExpiresAt: Member['inviteExpiresAt'];
};
