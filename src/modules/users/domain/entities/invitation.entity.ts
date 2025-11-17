import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { User } from '@/modules/users/domain/entities/user.entity';

export type Invitation = {
  userId: User['id'];
  spaceId: Space['id'];
  role: Member['role'];
  name: Member['name'];
  status: Member['status'];
  invitedBy: Member['invitedBy'];
};
