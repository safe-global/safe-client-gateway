import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { BalancesValidator } from './balances.validator';
import { balanceFactory } from './entities/__tests__/balance.factory';

const expectedErrMessage = 'testErrMessage';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn().mockReturnValue(new HttpException(expectedErrMessage, 500)),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Balances validator', () => {
  const validator = new BalancesValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const balances = [balanceFactory(), balanceFactory()];
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(balances[0]);

    expect(result).toEqual(balances[0]);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const balances = [balanceFactory(), balanceFactory()];
    validationFunction.mockImplementationOnce(() => false);

    expect(() =>
      balances.map((balance) => validator.validate(balance)),
    ).toThrow(expectedErrMessage);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
