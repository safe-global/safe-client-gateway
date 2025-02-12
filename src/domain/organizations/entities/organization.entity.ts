import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';

export enum OrganizationStatus {
  ACTIVE = 1,
}
export const OrganizationStatusKeys = Object.keys(OrganizationStatus) as [
  keyof typeof OrganizationStatus,
];

export type Organization = z.infer<typeof OrganizationSchema>;

export const OrganizationSchema = RowSchema.extend({
  status: z.enum(OrganizationStatusKeys),
});
