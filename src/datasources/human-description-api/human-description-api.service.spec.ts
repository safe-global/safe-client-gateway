import { HumanDescriptionApi } from './human-description-api.service';

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
});
