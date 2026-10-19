// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { policyConfigurationBuilder } from '#/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import type { PolicyConfiguration } from '#/modules/policies/domain/entities/policy-configuration.entity';
import type { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import { PolicyConfigurationRequestsService } from '#/modules/policies/routes/policy-configuration-requests.service';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

describe('PolicyConfigurationRequestsService', () => {
  const configurationRequestsRepository: MockedObject<ISafePolicyGuardConfigurationRequestsRepository> =
    { create: vi.fn() };
  const membersRepository: MockedObject<Pick<IMembersRepository, 'findOne'>> = {
    findOne: vi.fn(),
  };
  const spaceSafesRepository: MockedObject<
    Pick<ISpaceSafesRepository, 'existsInSpace'>
  > = { existsInSpace: vi.fn() };

  const target = new PolicyConfigurationRequestsService(
    configurationRequestsRepository,
    membersRepository as MockedObject<IMembersRepository>,
    spaceSafesRepository as MockedObject<ISpaceSafesRepository>,
  );

  const spaceId = faker.number.int({ min: 1, max: 100 });
  const userId = faker.number.int({ min: 1, max: 100 });
  const safe = {
    chainId: faker.string.numeric(),
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const request = {
    spaceId,
    safe,
    authPayload: new AuthPayload(
      siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
    ),
  };

  /** A payload whose root is the hash of its configurations. */
  function validPayload(): {
    root: Hex;
    configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>];
  } {
    const configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>] =
      [policyConfigurationBuilder().build()];
    return { root: configurationRoot(configurations), configurations };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    membersRepository.findOne.mockResolvedValue(memberBuilder().build());
    spaceSafesRepository.existsInSpace.mockResolvedValue(true);
    configurationRequestsRepository.create.mockResolvedValue();
  });

  it('should store the configurations of a root', async () => {
    const payload = validPayload();

    await expect(target.create({ ...request, payload })).resolves.toStrictEqual(
      { root: payload.root },
    );
    expect(spaceSafesRepository.existsInSpace).toHaveBeenCalledWith({
      spaceId,
      chainId: safe.chainId,
      address: safe.address,
    });
    expect(configurationRequestsRepository.create).toHaveBeenCalledWith({
      spaceId,
      chainId: safe.chainId,
      safeAddress: safe.address,
      root: payload.root,
      configurations: payload.configurations,
      createdBy: userId,
    });
  });

  it('should reject configurations that do not hash to the root without logging', async () => {
    const payload = validPayload();

    await expect(
      target.create({
        ...request,
        payload: { ...payload, root: `0x${'11'.repeat(32)}` },
      }),
    ).rejects.toThrow(
      new HttpExceptionNoLog(
        'The configurations do not hash to the given root',
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
    );
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should store an upper-cased root under its canonical casing', async () => {
    const payload = validPayload();
    const upperCased: Hex = `0x${payload.root.slice(2).toUpperCase()}`;

    await expect(
      target.create({ ...request, payload: { ...payload, root: upperCased } }),
    ).resolves.toStrictEqual({ root: payload.root });
    expect(configurationRequestsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ root: payload.root }),
    );
  });

  it('should reject a caller who is not a member of the space', async () => {
    membersRepository.findOne.mockResolvedValue(null);

    await expect(
      target.create({ ...request, payload: validPayload() }),
    ).rejects.toThrow('User is not a member of this workspace');
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });

  it('should reject a Safe that is not in the space', async () => {
    spaceSafesRepository.existsInSpace.mockResolvedValue(false);

    await expect(
      target.create({ ...request, payload: validPayload() }),
    ).rejects.toThrow(new ForbiddenException());
    expect(configurationRequestsRepository.create).not.toHaveBeenCalled();
  });
});
