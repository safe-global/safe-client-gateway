// SPDX-License-Identifier: FSL-1.1-MIT

import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { groupBy, mapValues } from 'lodash';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { LoggingService } from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import type { SpaceSafe } from '@/modules/spaces/datasources/safes/entities/space-safes.entity.db';
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import {
  assertAdmin,
  assertMember,
} from '@/modules/spaces/domain/space-assert.utils';
import type {
  CreateSpaceSafeDto,
  CreateSpaceSafesDto,
} from '@/modules/spaces/routes/safes/entities/create-space-safe.dto.entity';
import type { DeleteSpaceSafeDto } from '@/modules/spaces/routes/safes/entities/delete-space-safe.dto.entity';
import type { GetSpaceSafeResponse } from '@/modules/spaces/routes/safes/entities/get-space-safe.dto.entity';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

export const SAFES_ADDED_NAMES_UNSAVED_MESSAGE =
  'Your Safes were added, but their names were not saved. Please name them in the address book.';

@Injectable()
export class SpaceSafesService {
  public constructor(
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IEntitlementEnforcement)
    private readonly entitlementEnforcement: IEntitlementEnforcement,
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
    @Inject(IAddressBookItemsRepository)
    private readonly addressBookItemsRepository: IAddressBookItemsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async create(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<CreateSpaceSafeDto>;
    addressBookItems?: CreateSpaceSafesDto['addressBookItems'];
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    // The use case owns the transaction, so the seat check and the insert it
    // admits share one. What each step needs is resolved before it opens:
    // the plan (cache and database reads) and the ciphertext (a KMS round-trip
    // per Safe), leaving the locked section free of external I/O.
    const assertSeats = await this.entitlementEnforcement.prepareQuotaCheck({
      spaceId: args.spaceId,
      featureKey: 'safe_seats',
    });
    const rows = await this.spaceSafesRepository.encryptRows(
      args.spaceId,
      args.payload,
    );

    await this.postgresDatabaseService.transaction(async (entityManager) => {
      await this.spaceSafesRepository.lockSeats(args.spaceId, entityManager);
      // The delta is 0 for a chain of a Safe already held, so a Workspace at
      // its seat limit admits it. Sequential: both queries run on the one
      // connection the transaction holds.
      assertSeats({
        used: await this.spaceSafesRepository.countSeatsBySpaceId(
          args.spaceId,
          entityManager,
        ),
        delta: await this.spaceSafesRepository.countNewSeats(
          {
            spaceId: args.spaceId,
            addresses: args.payload.map(({ address }) => address),
          },
          entityManager,
        ),
      });
      await this.spaceSafesRepository.insertRows({
        spaceId: args.spaceId,
        actorUserId: userId,
        rows,
        entityManager,
      });
    });

    await this.upsertNames({ ...args, userId });
  }

  private async upsertNames(args: {
    spaceId: Space['id'];
    userId: number;
    addressBookItems?: CreateSpaceSafesDto['addressBookItems'];
  }): Promise<void> {
    if (!args.addressBookItems || args.addressBookItems.length === 0) {
      return;
    }
    try {
      await this.addressBookItemsRepository.upsertMany({
        userId: args.userId,
        spaceId: args.spaceId,
        addressBookItems: args.addressBookItems,
      });
    } catch (error) {
      this.loggingService.error(
        `Naming ${args.addressBookItems.length} Safe(s) failed after adding them to space ${args.spaceId}: ${asError(error).message}`,
      );
      throw new BadGatewayException(SAFES_ADDED_NAMES_UNSAVED_MESSAGE);
    }
  }

  public async get(
    spaceId: Space['id'],
    authPayload: AuthPayload,
  ): Promise<GetSpaceSafeResponse> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);
    await assertMember(this.membersRepository, spaceId, userId);

    const spaceSafes = await this.spaceSafesRepository.findBySpaceId(spaceId);

    return {
      safes: this.transformSpaceSafesResponse(spaceSafes),
    };
  }

  public async delete(args: {
    spaceId: Space['id'];
    authPayload: AuthPayload;
    payload: Array<DeleteSpaceSafeDto>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertAdmin(this.membersRepository, args.spaceId, userId);

    await this.spaceSafesRepository.delete({
      spaceId: args.spaceId,
      actorUserId: userId,
      payload: args.payload,
    });
  }

  /**
   * Transforms the space Safes response.
   *
   * Transform from:
   *       [
   *          { chainId: 1, address: '0x123' }, { chainId: 1, address: '0x456' }, { chainId: 2, address: '0x789' }
   *      ],
   * To:
   *      { 1: ['0x123', '0x456'], 2: ['0x789'] }
   *
   * @param {Array<Pick<SpaceSafe, 'chainId' | 'address'>>} spaceSafes
   *
   * @returns {GetSpaceSafeResponse}
   */
  private transformSpaceSafesResponse(
    spaceSafes: Array<Pick<SpaceSafe, 'chainId' | 'address'>>,
  ): GetSpaceSafeResponse['safes'] {
    const grouped = groupBy(spaceSafes, 'chainId');

    return mapValues(grouped, (items) => items.map((item) => item.address));
  }
}
