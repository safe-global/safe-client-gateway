import { HumanDescriptionApi } from './human-description-api.service';
import { faker } from '@faker-js/faker';
import { ValueType } from './entities/human-description.entity';

describe('HumanDescriptionAPI', () => {
  const contractDescriptions = {
    'function transfer(address, uint256)':
      'Send {{tokenValue $1}} to {{address $0}}',
  };

  it('should return parsed messages from json', () => {
    const humanDescriptionApi = new HumanDescriptionApi(contractDescriptions);

    const parsedMessages = humanDescriptionApi.getParsedMessages();

    expect(parsedMessages['function transfer(address, uint256)']).toEqual({
      process: expect.any(Function),
    });
  });

  it('should parse token values', () => {
    const humanDescriptionApi = new HumanDescriptionApi(contractDescriptions);

    const mockTo = faker.finance.ethereumAddress();
    const mockRecipient = faker.finance.ethereumAddress();
    const mockAmount = faker.number.bigInt();

    const parsedParam = humanDescriptionApi.parseParam(
      ValueType.TokenValue,
      1,
      mockTo,
      [mockRecipient, mockAmount],
    );

    expect(parsedParam).toEqual({ amount: mockAmount, address: mockTo });
  });

  it('should parse addresses', () => {
    const humanDescriptionApi = new HumanDescriptionApi(contractDescriptions);

    const mockTo = faker.finance.ethereumAddress();
    const mockRecipient = faker.finance.ethereumAddress();
    const mockAmount = faker.number.bigInt();

    const parsedParam = humanDescriptionApi.parseExpression(
      ValueType.Address,
      0,
      mockTo,
      [mockRecipient, mockAmount],
    );

    expect(parsedParam).toEqual({
      type: ValueType.Address,
      value: mockRecipient,
    });
  });

  it('should parse identifiers', () => {
    const humanDescriptionApi = new HumanDescriptionApi(contractDescriptions);

    const mockTo = faker.finance.ethereumAddress();
    const mockIdentifier = faker.string.hexadecimal({ length: 32 });

    const parsedParam = humanDescriptionApi.parseExpression(
      ValueType.Identifier,
      0,
      mockTo,
      [mockIdentifier],
    );

    expect(parsedParam).toEqual({
      type: ValueType.Identifier,
      value: mockIdentifier,
    });
  });

  it('should return null for non ValueType values', () => {
    const humanDescriptionApi = new HumanDescriptionApi(contractDescriptions);

    const mockTo = faker.finance.ethereumAddress();
    const mockIdentifier = faker.string.hexadecimal({ length: 32 });

    const parsedParam = humanDescriptionApi.parseExpression(
      'Something' as ValueType,
      0,
      mockTo,
      [mockIdentifier],
    );

    expect(parsedParam).toBeNull();
  });
});
