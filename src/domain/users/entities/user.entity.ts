import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';

export enum UserStatus {
  ACTIVE = 1,
}
export const UserStatusKeys = Object.keys(UserStatus) as [
  keyof typeof UserStatus,
];

export type User = z.infer<typeof UserSchema>;

export const UserSchema = RowSchema.extend({
  status: z.enum(UserStatusKeys),
});
