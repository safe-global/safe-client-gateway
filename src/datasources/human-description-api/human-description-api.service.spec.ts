import { HumanDescriptionApi } from './human-description-api.service';

describe('HumanDescriptionAPI', () => {
  it('should return parsed messages from json', () => {
    const humanDescriptionApi = new HumanDescriptionApi();

    const descriptions = humanDescriptionApi.getDescriptions();

    expect(descriptions['function transfer(address, uint256)']).toEqual(
      'Send {{tokenValue $1}} to {{address $0}}',
    );
  });
});
