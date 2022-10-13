import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { CollectiblesValidator } from './collectibles.validator';
import { collectibleSchema } from './entities/schemas/collectible.schema';
import collectibleFactory from './entities/__tests__/collectible.factory';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Collectibles validator', () => {
  const validator = new CollectiblesValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(
      collectibleSchema,
    );
  });

  it('should return the data when validation succeed', () => {
    const collectible = collectibleFactory();
    mockGenericValidator.validate.mockReturnValue(collectible);

    const result = validator.validate(collectible);

    expect(result).toBe(collectible);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
