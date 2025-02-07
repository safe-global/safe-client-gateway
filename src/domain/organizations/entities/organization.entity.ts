import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';

export enum OrganizationStatus {
  ACTIVE = 1,
}

export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizationSchema = RowSchema.extend({
  status: z.nativeEnum(OrganizationStatus),
});
