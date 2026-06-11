// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { getStringEnumKeys } from '@/domain/common/utils/enum';
import {
  SpaceAuditEventType,
  SpaceAuditEventTypeSchema,
} from '@/modules/spaces/domain/audit/entities/space-audit-event.entity';
import { Page } from '@/routes/common/entities/page.entity';
import { DateStringSchema } from '@/validation/entities/schemas/date-string.schema';

/** `event_type` arrives as one comma-separated query param. */
export const SpaceAuditEventTypesQuerySchema = z
  .string()
  .transform((str, ctx) => {
    return str.split(',').map((item) => {
      const result = SpaceAuditEventTypeSchema.safeParse(item);
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid event type "${item}"`,
        });
        return z.NEVER;
      }
      return result.data;
    });
  })
  .optional();

export const SpaceAuditActorUserIdQuerySchema = z.coerce
  .number()
  .int()
  .positive()
  .optional();

export const SpaceAuditDateQuerySchema = DateStringSchema.transform(
  (value) => new Date(value),
).optional();

export const SpaceAuditSortDirectionQuerySchema = z
  .enum(['asc', 'desc'])
  .optional();

export class SpaceAuditLogEntryDto {
  @ApiProperty({
    type: String,
    description: 'Monotonic entry id (bigint serialized as string)',
  })
  id!: string;

  @ApiProperty({ enum: getStringEnumKeys(SpaceAuditEventType) })
  eventType!: keyof typeof SpaceAuditEventType;

  @ApiProperty({ type: Number })
  actorUserId!: number;

  @ApiProperty({
    type: String,
    description: 'Resolved (and masked) display string of the acting user.',
  })
  actor!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Resolved (and masked) display string of the affected user, when the event has one.',
  })
  targetUser!: string | null;

  @ApiProperty({
    type: Object,
    description:
      'Event-specific payload, allowlisted per event type. Clients must treat every field as optional.',
  })
  payload!: Record<string, unknown>;

  @ApiProperty({ type: Date })
  createdAt!: Date;
}

export class SpaceAuditLogPage extends Page<SpaceAuditLogEntryDto> {
  @ApiProperty({ type: SpaceAuditLogEntryDto, isArray: true })
  results!: Array<SpaceAuditLogEntryDto>;
}

export class SpaceAuditLogActorDto {
  @ApiProperty({ type: Number })
  actorUserId!: number;

  @ApiProperty({
    type: String,
    description: 'Resolved (and masked) display string of the actor.',
  })
  actor!: string;
}
