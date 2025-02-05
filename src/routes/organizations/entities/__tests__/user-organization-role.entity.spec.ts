import { UserOrganizationRole } from '@/domain/users/entities/user-organization.entity';
import { UserOrganizationRoleSchema } from '@/routes/organizations/entities/user-organization-role.entity';

const keys = Object.keys(UserOrganizationRole).filter((key) => {
  // Numeric enums have forward and reverse key mappings
  return isNaN(Number(key));
}) as Array<keyof typeof UserOrganizationRole>;

describe('UserOrganizationRoleSchema', () => {
  it.each(keys)('should validate %s, returning the numeric value', (key) => {
    const result = UserOrganizationRoleSchema.safeParse(key);

    expect(result.success && result.data).not.toBe(key);
    expect(result.success && result.data).toBe(UserOrganizationRole[key]);
  });
});
