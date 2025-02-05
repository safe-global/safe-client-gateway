import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';

export enum UserStatus {
  PENDING = 0,
  ACTIVE = 1,
}

export type User = z.infer<typeof UserSchema>;

export const UserSchema = RowSchema.extend({
  status: z.nativeEnum(UserStatus),
});
