// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  INVALID_SPACE_IDENTIFIER_MESSAGE,
  LegacySpaceIdPipe,
  SpaceIdPipe,
} from '@/modules/spaces/routes/pipes/space-id.pipe';

const spacesRepositoryMock = {
  findIdByUuid: jest.fn(),
  findIdByIdOrUuid: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

describe('SpaceIdPipe', () => {
  let pipe: SpaceIdPipe;

  beforeEach(() => {
    jest.resetAllMocks();
    pipe = new SpaceIdPipe(spacesRepositoryMock);
  });

  it('should resolve a UUID to its numeric id', async () => {
    const uuid = faker.string.uuid();
    const id = faker.number.int({ min: 1 });
    spacesRepositoryMock.findIdByUuid.mockResolvedValue(id);

    await expect(pipe.transform(uuid)).resolves.toBe(id);
    expect(spacesRepositoryMock.findIdByUuid).toHaveBeenCalledWith(uuid);
  });

  it('should reject a non-UUID value with the shared message', async () => {
    await expect(pipe.transform(faker.string.alpha())).rejects.toThrow(
      new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE),
    );
    expect(spacesRepositoryMock.findIdByUuid).not.toHaveBeenCalled();
  });

  it('should reject a numeric value (UUID only)', async () => {
    await expect(pipe.transform('123')).rejects.toThrow(
      new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE),
    );
    expect(spacesRepositoryMock.findIdByUuid).not.toHaveBeenCalled();
  });
});

describe('LegacySpaceIdPipe', () => {
  let pipe: LegacySpaceIdPipe;

  beforeEach(() => {
    jest.resetAllMocks();
    pipe = new LegacySpaceIdPipe(spacesRepositoryMock);
  });

  it('should resolve a UUID to its numeric id', async () => {
    const uuid = faker.string.uuid();
    const id = faker.number.int({ min: 1 });
    spacesRepositoryMock.findIdByIdOrUuid.mockResolvedValue(id);

    await expect(pipe.transform(uuid)).resolves.toBe(id);
    expect(spacesRepositoryMock.findIdByIdOrUuid).toHaveBeenCalledWith(uuid);
  });

  it('should resolve a numeric id', async () => {
    const id = faker.number.int({ min: 1, max: 2 ** 31 - 2 });
    spacesRepositoryMock.findIdByIdOrUuid.mockResolvedValue(id);

    await expect(pipe.transform(String(id))).resolves.toBe(id);
    expect(spacesRepositoryMock.findIdByIdOrUuid).toHaveBeenCalledWith(
      String(id),
    );
  });

  it('should reject a non-numeric, non-UUID value with the shared message', async () => {
    await expect(pipe.transform(faker.string.alpha())).rejects.toThrow(
      new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE),
    );
    expect(spacesRepositoryMock.findIdByIdOrUuid).not.toHaveBeenCalled();
  });

  it('should reject a numeric id beyond the DB max with the shared message', async () => {
    await expect(pipe.transform(String(2 ** 31))).rejects.toThrow(
      new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE),
    );
    expect(spacesRepositoryMock.findIdByIdOrUuid).not.toHaveBeenCalled();
  });

  it('should use the same rejection message as SpaceIdPipe', () => {
    expect(INVALID_SPACE_IDENTIFIER_MESSAGE).toBe('Invalid space identifier');
  });
});
