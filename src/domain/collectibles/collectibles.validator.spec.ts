import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { CollectiblesValidator } from './collectibles.validator';
import { collectibleSchema } from './entities/schemas/collectible.schema';
import collectibleFactory from './entities/__tests__/collectible.factory';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Collectibles validator', () => {
  const validator = new CollectiblesValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      collectibleSchema,
    );
  });

  it('should return the data when validation succeed', () => {
    const collectible = collectibleFactory();
    const result = validator.validate(collectible);

    expect(result).toBe(collectible);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
