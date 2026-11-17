// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { z } from 'zod';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import {
  SpaceSetupSafeSchema,
  type SpaceSetupStatus,
  SpaceSetupSurveySchema,
} from '#/modules/spaces/domain/setup/entities/space-setup.entity';
import {
  AddressBookItem,
  AddressBookItemSchema,
} from '#/modules/spaces/routes/address-books/entities/upsert-address-book-items.dto.entity';
import { CreateSpaceSchema } from '#/modules/spaces/routes/entities/create-space.dto.entity';
import {
  EmailInviteUserDto,
  WalletInviteUserDto,
} from '#/modules/spaces/routes/members/entities/invite-users.dto.entity';
import { SpaceSafeDto } from '#/modules/spaces/routes/safes/entities/space-safe.dto.entity';
import type { SurveyResponseSelections } from '#/modules/surveys/domain/entities/survey-response.entity';
import {
  type InviteUserInput,
  InviteUserSchema,
} from '#/modules/users/domain/entities/invite-user.entity';
import { OpaqueIdSchema } from '#/validation/entities/schemas/opaque-id.schema';

export const CreateSpaceSetupSchema = z.object({
  name: CreateSpaceSchema.shape.name,
  paymentLinkId: OpaqueIdSchema.nullable(),
  safes: z.array(SpaceSetupSafeSchema),
  addressBookItems: z.array(AddressBookItemSchema),
  invites: z.array(InviteUserSchema),
  survey: SpaceSetupSurveySchema.nullable(),
  returnUrl: z.url(),
});

export const SPACE_SETUP_STATUS_DTO_VALUES = ['pending', 'applied'] as const;

export type SpaceSetupStatusDto =
  (typeof SPACE_SETUP_STATUS_DTO_VALUES)[number];

/** Clients see an apply in progress as pending: it is not finished. */
export const SPACE_SETUP_STATUS_DTO = {
  PENDING: 'pending',
  APPLYING: 'pending',
  APPLIED: 'applied',
} as const satisfies Record<keyof typeof SpaceSetupStatus, SpaceSetupStatusDto>;

class SpaceSetupSurveyDto implements z.infer<typeof SpaceSetupSurveySchema> {
  @ApiProperty({ type: String, example: 'onboarding' })
  public readonly slug!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Map from page id to selected option keys',
  })
  public readonly selections!: SurveyResponseSelections;
}

const INVITE_ITEMS_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(WalletInviteUserDto) },
    { $ref: getSchemaPath(EmailInviteUserDto) },
  ],
};

@ApiExtraModels(WalletInviteUserDto, EmailInviteUserDto)
export class CreateSpaceSetupDto
  implements z.infer<typeof CreateSpaceSetupSchema>
{
  @ApiProperty({ type: String })
  public readonly name!: Space['name'];

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The picked trial plan; its checkout starts the trial. Null applies the setup at once, which is refused once billing is enforced.',
  })
  public readonly paymentLinkId!: string | null;

  @ApiProperty({
    type: SpaceSafeDto,
    isArray: true,
    description:
      'Safes to add when the trial starts. One seat per address, however many chains.',
  })
  public readonly safes!: Array<SpaceSafeDto>;

  @ApiProperty({ type: AddressBookItem, isArray: true })
  public readonly addressBookItems!: Array<AddressBookItem>;

  @ApiProperty({ type: 'array', items: INVITE_ITEMS_SCHEMA })
  public readonly invites!: Array<InviteUserInput>;

  @ApiProperty({ type: SpaceSetupSurveyDto, nullable: true })
  public readonly survey!: SpaceSetupSurveyDto | null;

  @ApiProperty({
    type: String,
    description:
      'Where the checkout returns to. Must be on an allowed redirect domain.',
  })
  public readonly returnUrl!: string;
}

export class SpaceSetupCheckoutDto {
  @ApiProperty({ type: String, description: 'Space UUID' })
  public readonly spaceId!: Space['uuid'];

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The checkout to redirect to. Null when no plan was given: the setup is applied already.',
  })
  public readonly checkoutUrl!: string | null;
}

@ApiExtraModels(WalletInviteUserDto, EmailInviteUserDto)
export class SpaceSetupDto {
  @ApiProperty({ type: String, enum: SPACE_SETUP_STATUS_DTO_VALUES })
  public readonly status!: SpaceSetupStatusDto;

  @ApiProperty({ type: String, nullable: true })
  public readonly paymentLinkId!: string | null;

  @ApiProperty({ type: SpaceSafeDto, isArray: true })
  public readonly safes!: Array<SpaceSafeDto>;

  @ApiProperty({ type: AddressBookItem, isArray: true })
  public readonly addressBookItems!: Array<AddressBookItem>;

  @ApiProperty({ type: 'array', items: INVITE_ITEMS_SCHEMA })
  public readonly invites!: Array<InviteUserInput>;

  @ApiProperty({ type: SpaceSetupSurveyDto, nullable: true })
  public readonly survey!: SpaceSetupSurveyDto | null;
}
