import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { BalancesValidator } from './balances.validator';
import { balanceFactory } from './entities/__tests__/balance.factory';

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

describe('Balances validator', () => {
  const validator = new BalancesValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  const balances = [balanceFactory(), balanceFactory()];

  it('should return the data when validation succeed', () => {
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(balances[0]);

    expect(result).toEqual(balances[0]);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    validationFunction.mockImplementationOnce(() => false);

    expect(() =>
      balances.map((balance) => validator.validate(balance)),
    ).toThrow(expectedErrMessage);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
