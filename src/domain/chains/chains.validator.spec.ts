import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { ChainsValidator } from './chains.validator';
import { chainSchema } from './entities/schemas/chain.schema';
import chainFactory from './entities/__tests__/chain.factory';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Chains validator', () => {
  const validator = new ChainsValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should mount the proper schema', () => {
    expect(mockJsonSchemaService.compile).toHaveBeenCalledWith(chainSchema);
  });

  it('should return the data when validation succeed', () => {
    const chain = chainFactory();
    const result = validator.validate(chain);

    expect(result).toEqual(chain);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
