import { fakeJson } from '@/__tests__/faker';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  abiBuilder,
  contractBuilder as dataDecodedContractBuilder,
  projectBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { ContractMapper } from '@/routes/contracts/mappers/contract.mapper';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

describe('Contract Mapper', () => {
  let mapper: ContractMapper;

  const address = getAddress(faker.finance.ethereumAddress());
  const name = faker.word.sample();
  const displayName = faker.word.words();
  const logoUri = faker.internet.url({ appendSlash: false });
  const contractAbi = JSON.parse(fakeJson()) as Record<string, unknown>;
  const trustedForDelegateCall = false; //faker.datatype.boolean();

  beforeEach(() => {
    jest.resetAllMocks();

    mapper = new ContractMapper();
  });

  it('should return mapped contract', () => {
    const expected = contractBuilder()
      .with('address', address)
      .with('name', name)
      .with('displayName', displayName)
      .with('logoUri', logoUri)
      .with('contractAbi', { abi: [contractAbi] })
      .with('trustedForDelegateCall', trustedForDelegateCall)
      .build();

    const contract = dataDecodedContractBuilder()
      .with('address', address)
      .with('name', name)
      .with('displayName', displayName)
      .with('chainId', faker.number.int() as unknown as string)
      .with('project', projectBuilder().with('logoFile', logoUri).build())
      .with('abi', abiBuilder().with('abiJson', [contractAbi]).build())
      .with('modified', faker.date.past())
      .build();

    const actual = mapper.mapContract(contract);
    expect(actual).toEqual(expected);
  });

  it('should return displayName = "" if its null', () => {
    const contract = dataDecodedContractBuilder()
      .with('displayName', null)
      .build();

    const actual = mapper.mapContract(contract);
    expect(actual.displayName).toEqual('');
  });

  it('should return logoUri = null if project is null', () => {
    const contract = dataDecodedContractBuilder().with('project', null).build();

    const actual = mapper.mapContract(contract);
    expect(actual.logoUri).toEqual(null);
  });

  it('should return contractAbi = null if abiJson is null', () => {
    const contract = dataDecodedContractBuilder()
      .with('abi', abiBuilder().with('abiJson', null).build())
      .build();

    const actual = mapper.mapContract(contract);
    expect(actual.contractAbi).toEqual(null);
  });
});
