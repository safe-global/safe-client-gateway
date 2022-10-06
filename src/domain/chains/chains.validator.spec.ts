import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { ChainsValidator } from './chains.validator';
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

  beforeEach(() => jest.clearAllMocks());

  it('should return the data when validation succeed', () => {
    const chain = chainFactory();
    validationFunction.mockImplementation(() => true);

    const result = validator.validate(chain);

    expect(result).toEqual(chain);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });

  it('should return the data when validation succeed for an array of items', () => {
    const chains = [chainFactory(), chainFactory()];
    validationFunction.mockImplementation(() => true);

    const result = chains.map((chain) => validator.validate(chain));

    expect(result).toEqual(chains);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(chains.length);
  });
});
