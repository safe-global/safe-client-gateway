// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
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
      new NotFoundException('Space not found.'),
    );

    await expect(pipe.transform(uuid)).rejects.toThrow(
      new NotFoundException('Space not found.'),
    );
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

  it('should resolve an uppercase UUID (case-insensitive)', async () => {
    const uuid = faker.string.uuid().toUpperCase();
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

  it('should resolve a numeric id equal to DB_MAX_SAFE_INTEGER (inclusive boundary)', async () => {
    const id = DB_MAX_SAFE_INTEGER;
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

  it('should reject an empty string with the shared message', async () => {
    await expect(pipe.transform('')).rejects.toThrow(
      new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE),
    );
    expect(spacesRepositoryMock.findIdByIdOrUuid).not.toHaveBeenCalled();
  });

  it('should reject a numeric id beyond the DB max with the shared message', async () => {
    await expect(
      pipe.transform(String(DB_MAX_SAFE_INTEGER + 1)),
    ).rejects.toThrow(
      new BadRequestException(INVALID_SPACE_IDENTIFIER_MESSAGE),
    );
    expect(spacesRepositoryMock.findIdByIdOrUuid).not.toHaveBeenCalled();
  });

  it('should propagate NotFoundException for a valid UUID with no row', async () => {
    const uuid = faker.string.uuid();
    spacesRepositoryMock.findIdByIdOrUuid.mockRejectedValue(
      new NotFoundException('Space not found.'),
    );

    await expect(pipe.transform(uuid)).rejects.toThrow(
      new NotFoundException('Space not found.'),
    );
  });

  it('should propagate NotFoundException for a valid numeric id with no row', async () => {
    spacesRepositoryMock.findIdByIdOrUuid.mockRejectedValue(
      new NotFoundException('Space not found.'),
    );

    await expect(
      pipe.transform(String(faker.number.int({ min: 1, max: 2 ** 31 - 2 }))),
    ).rejects.toThrow(new NotFoundException('Space not found.'));
  });

  it('should use the same rejection message as SpaceIdPipe', () => {
    expect(INVALID_SPACE_IDENTIFIER_MESSAGE).toBe('Invalid space identifier');
  });
});
