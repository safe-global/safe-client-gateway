import type { Organization } from '@/domain/organizations/entities/organization.entity';
import type { UserOrganization } from '@/domain/users/entities/user-organization.entity';
import type { User } from '@/domain/users/entities/user.entity';

export type Invitation = {
  userId: User['id'];
  orgId: Organization['id'];
  role: UserOrganization['role'];
  name: UserOrganization['name'];
  status: UserOrganization['status'];
};
