import type { Space } from '@/domain/spaces/entities/space.entity';
import type { Member } from '@/domain/users/entities/member.entity';
import type { User } from '@/domain/users/entities/user.entity';

export type Invitation = {
  userId: User['id'];
  spaceId: Space['id'];
  role: Member['role'];
  name: Member['name'];
  status: Member['status'];
  invitedBy: Member['invitedBy'];
};
