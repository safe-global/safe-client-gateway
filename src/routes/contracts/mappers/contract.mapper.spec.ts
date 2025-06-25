import {
  abiBuilder,
  contractBuilder as dataDecodedContractBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { ContractMapper } from '@/routes/contracts/mappers/contract.mapper';

describe('Contract Mapper', () => {
  let mapper: ContractMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    mapper = new ContractMapper();
  });

  it('should return mapped contract', () => {
    const address = '0xC0cf7C5DbcCBFDb0FAb8509C610dAc8B0Fa006aD';
    const contract = dataDecodedContractBuilder()
      .with('address', address)
      .build();

    const actual = mapper.map(contract);
    expect(actual).toEqual({
      address: address,
      contractAbi: {
        abi: [expect.any(Object)],
      },
      displayName: expect.any(String),
      logoUri: expect.any(String),
      name: expect.any(String),
      trustedForDelegateCall: expect.any(Boolean),
    });
  });

  it('should return displayName = "" if its null', () => {
    const contract = dataDecodedContractBuilder()
      .with('displayName', null)
      .build();

    const actual = mapper.map(contract);
    expect(actual.displayName).toEqual('');
  });

  it('should return logoUri = null if logoUrl is null', () => {
    const contract = dataDecodedContractBuilder().with('logoUrl', null).build();

    const actual = mapper.map(contract);
    expect(actual.logoUri).toEqual(null);
  });

  it('should return contractAbi = null if abiJson is null', () => {
    const contract = dataDecodedContractBuilder()
      .with('abi', abiBuilder().with('abiJson', null).build())
      .build();

    const actual = mapper.map(contract);
    expect(actual.contractAbi).toEqual(null);
  });

  it('should return contractAbi = null if abi is null', () => {
    const contract = dataDecodedContractBuilder().with('abi', null).build();

    const actual = mapper.map(contract);
    expect(actual.contractAbi).toEqual(null);
  });
});
