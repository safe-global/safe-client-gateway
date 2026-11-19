// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  DEFAULT_TOKEN_LIST_FEATURE,
  getTxServiceTrusted,
} from '#/modules/balances/domain/trusted-token-list.helper';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';

describe('getTxServiceTrusted', () => {
  const withTokenList = chainBuilder()
    .with('features', [faker.word.sample(), DEFAULT_TOKEN_LIST_FEATURE])
    .build();
  const withoutTokenList = chainBuilder()
    .with('features', [faker.word.sample()])
    .build();

  it('keeps trusted on a chain with a default token list', () => {
    expect(getTxServiceTrusted({ chain: withTokenList, trusted: true })).toBe(
      true,
    );
  });

  it('asks for all tokens on a chain without a default token list', () => {
    expect(
      getTxServiceTrusted({ chain: withoutTokenList, trusted: true }),
    ).toBe(false);
  });

  it.each([true, false])(
    'keeps trusted=false when the token list feature is %s',
    (hasTokenList) => {
      const chain = hasTokenList ? withTokenList : withoutTokenList;
      expect(getTxServiceTrusted({ chain, trusted: false })).toBe(false);
    },
  );
});
