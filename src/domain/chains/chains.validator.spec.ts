import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { ChainsValidator } from './chains.validator';
import chainFactory from './entities/__tests__/chain.factory';

const expectedErrMessage = 'testErrMessage';

const validationErrorFactory = {
  from: jest.fn().mockReturnValue(new HttpException(expectedErrMessage, 500)),
} as unknown as ValidationErrorFactory;

const validationFunction = jest.fn();
validationFunction.mockImplementation(() => true);

const jsonSchemaService = {
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService;

const mockValidationErrorFactory = jest.mocked(validationErrorFactory);
const mockJsonSchemaService = jest.mocked(jsonSchemaService);

describe('Chains validator', () => {
  const validator = new ChainsValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  const chain = chainFactory();
  const chains = [chainFactory(), chainFactory()];

  beforeEach(() => jest.clearAllMocks());

  it('should return the data when validation succeed', () => {
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(chain);

    expect(result).toEqual(chain);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should return the data when validation succeed for an array of items', () => {
    validationFunction.mockImplementationOnce(() => true);

    const result = chains.map((chain) => validator.validate(chain));

    expect(result).toEqual(chains);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(chain)).toThrow(expectedErrMessage);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });

  it('should throw a validation error when validation fails for an array of items', async () => {
    validationFunction.mockImplementationOnce(() => false);

    expect(() => chains.map((chain) => validator.validate(chain))).toThrow(
      expectedErrMessage,
    );
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
