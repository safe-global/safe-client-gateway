// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import {
  INVALID_SPACE_IDENTIFIER_MESSAGE,
  SpaceIdPipe,
} from '@/modules/spaces/routes/pipes/space-id.pipe';

const spacesRepositoryMock = {
  findIdByUuid: jest.fn(),
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

  it('should resolve an uppercase UUID (case-insensitive)', async () => {
    const uuid = faker.string.uuid().toUpperCase();
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

  it('should reject an empty string with the shared message', async () => {
    await expect(pipe.transform('')).rejects.toThrow(
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

  it('should propagate NotFoundException for a valid UUID with no row', async () => {
    const uuid = faker.string.uuid();
    spacesRepositoryMock.findIdByUuid.mockRejectedValue(
      new NotFoundException('Workspace not found.'),
    );

    await expect(pipe.transform(uuid)).rejects.toThrow(
      new NotFoundException('Workspace not found.'),
    );
  });
});
