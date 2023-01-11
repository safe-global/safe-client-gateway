import { JsonSchemaService } from '../schema/json-schema.service';
import { GenericValidator } from '../schema/generic.validator';
import { ChainsValidator } from './chains.validator';
import { chainSchema } from './entities/schemas/chain.schema';
import { chainBuilder } from './entities/__tests__/chain.builder';

const mockGenericValidator = jest.mocked({
  validate: jest.fn(),
} as unknown as GenericValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Chains validator', () => {
  const validator = new ChainsValidator(
    mockGenericValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(chainSchema);
  });

  it('should return the data when validation succeed', () => {
    const chain = chainBuilder().build();
    mockGenericValidator.validate.mockReturnValue(chain);

    const result = validator.validate(chain);

    expect(result).toEqual(chain);
    expect(mockGenericValidator.validate).toHaveBeenCalledTimes(1);
  });
});
