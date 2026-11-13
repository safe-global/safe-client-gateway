// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '#/datasources/db/v2/entities/row.entity';
import { getStringEnumKeys } from '#/domain/common/utils/enum';
import { ChainIdSchema } from '#/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressBookItemSchema } from '#/modules/spaces/domain/address-books/entities/address-book-item.entity';
import { SurveySlugSchema } from '#/modules/surveys/domain/entities/survey.entity';
import { SurveyResponseSelectionsSchema } from '#/modules/surveys/domain/entities/survey-response.entity';
import { InviteUserSchema } from '#/modules/users/domain/entities/invite-user.entity';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { UuidSchema } from '#/validation/entities/schemas/uuid.schema';

/**
 * PENDING until an apply claims it, APPLYING while one runs, APPLIED once
 * done. An APPLYING row older than the apply lease is claimed again.
 */
export enum SpaceSetupStatus {
  PENDING = 1,
  APPLIED = 2,
  APPLYING = 3,
}

/** The payload shape written today; a later shape gets the next number. */
export const SPACE_SETUP_PAYLOAD_VERSION = 1;

export const SpaceSetupSafeSchema = z.object({
  chainId: ChainIdSchema,
  address: AddressSchema,
});

export type SpaceSetupSafe = z.infer<typeof SpaceSetupSafeSchema>;

export const SpaceSetupSurveySchema = z.object({
  slug: SurveySlugSchema,
  selections: SurveyResponseSelectionsSchema,
});

export type SpaceSetupSurvey = z.infer<typeof SpaceSetupSurveySchema>;

/**
 * What the Workspace setup applies once its trial starts. Stored as one
 * encrypted blob; `version` lets a later shape be read next to this one.
 */
export const SpaceSetupPayloadSchema = z.object({
  version: z.literal(SPACE_SETUP_PAYLOAD_VERSION),
  safes: z.array(SpaceSetupSafeSchema),
  addressBookItems: z.array(AddressBookItemSchema),
  invites: z.array(InviteUserSchema),
  survey: SpaceSetupSurveySchema.nullable(),
});

export type SpaceSetupPayload = z.infer<typeof SpaceSetupPayloadSchema>;

export const SpaceSetupSchema = RowSchema.extend({
  spaceId: z.number().int().positive(),
  paymentLinkId: z.string().nullable(),
  payload: SpaceSetupPayloadSchema,
  status: z.enum(getStringEnumKeys(SpaceSetupStatus)),
  /** Set by each claim; only the apply holding it may mark the setup applied. */
  claimId: UuidSchema.nullable(),
  appliedAt: z.date().nullable(),
});

/** A setup row with its payload decrypted. */
export type SpaceSetup = z.infer<typeof SpaceSetupSchema>;

/** A setup an apply holds: always under a claim. */
export type ClaimedSpaceSetup = SpaceSetup & {
  claimId: NonNullable<SpaceSetup['claimId']>;
};

/** A setup row as stored: the payload is the encrypted JSON blob. */
export const SpaceSetupRowSchema = SpaceSetupSchema.extend({
  payload: z.string(),
});

export type SpaceSetupRow = z.infer<typeof SpaceSetupRowSchema>;
