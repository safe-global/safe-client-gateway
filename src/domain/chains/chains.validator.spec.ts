import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { ChainsValidator } from './chains.validator';
import chainFactory from './entities/__tests__/chain.factory';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Chains validator', () => {
  const validator = new ChainsValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('should return the data when validation succeed', () => {
    const chain = chainFactory();
    validationFunction.mockImplementation(() => true);

    const result = validator.validate(chain);

    expect(result).toEqual(chain);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should return the data when validation succeed for an array of items', () => {
    const chains = [chainFactory(), chainFactory()];
    validationFunction.mockImplementation(() => true);

    const result = chains.map((chain) => validator.validate(chain));

    expect(result).toEqual(chains);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const chain = chainFactory();
    const expectedErrMessage = 'testErrMessage';
    validationFunction.mockImplementation(() => false);
    mockValidationErrorFactory.from.mockReturnValue(
      new HttpException(expectedErrMessage, 500),
    );

    expect(() => validator.validate(chain)).toThrow(expectedErrMessage);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });

  it('should throw a validation error when validation fails for an array of items', async () => {
    const chains = [chainFactory(), chainFactory()];
    const expectedErrMessage = 'testErrMessage';
    validationFunction.mockImplementation(() => false);
    mockValidationErrorFactory.from.mockReturnValue(
      new HttpException(expectedErrMessage, 500),
    );

    expect(() => chains.map((chain) => validator.validate(chain))).toThrow(
      expectedErrMessage,
    );
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
