import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import type { UUID } from 'crypto';
import { Column, Entity, Unique, PrimaryGeneratedColumn } from 'typeorm';
import { z } from 'zod';
import { UserStatus } from '@/domain/users/entities/user.entity';

export const UserSchema = RowSchema.extend({
  id: UuidSchema,
  status: z.nativeEnum(UserStatus),
});

@Entity('users')
@Unique('id', ['id'])
export class User implements z.infer<typeof UserSchema> {
  @PrimaryGeneratedColumn('uuid')
  id!: UUID;

  @Column({
    type: 'enum',
    enum: UserSchema,
  })
  status!: UserStatus;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at!: Date;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at!: Date;
}
