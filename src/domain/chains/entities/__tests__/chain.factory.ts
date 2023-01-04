import { faker } from '@faker-js/faker';
import { Chain } from '../chain.entity';
import { NativeCurrency } from '../native.currency.entity';
import nativeCurrencyFactory from './native.currency.factory';
import { BlockExplorerUriTemplate } from '../block-explorer-uri-template.entity';
import blockExplorerUriTemplateFactory from './block-explorer-uri-template.factory';
import { RpcUri } from '../rpc-uri.entity';
import { Theme } from '../theme.entity';
import { GasPriceOracle } from '../gas-price-oracle.entity';
import themeFactory from './theme.factory';
import { GasPriceFixed } from '../gas-price-fixed.entity';
import gasPriceFixedFactory from './gas-price-fixed.factory';
import gasPriceOracleFactory from './gas-price-oracle.factory';
import rpcUriFactory from './rpc-uri.factory';
import { Builder } from '../../../common/__tests__/builder';

export class ChainBuilder implements Builder<Chain> {
  private chainId: string = faker.datatype.number().toString();

  private chainName: string = faker.company.name();

  private description: string = faker.random.words();

  private l2: boolean = faker.datatype.boolean();

  private shortName: string = faker.company.companySuffix();

  private rpcUri: RpcUri = rpcUriFactory();

  private safeAppsRpcUri: RpcUri = rpcUriFactory();

  private publicRpcUri: RpcUri = rpcUriFactory();

  private blockExplorerUriTemplate: BlockExplorerUriTemplate =
    blockExplorerUriTemplateFactory();

  private nativeCurrency: NativeCurrency = nativeCurrencyFactory();

  private transactionService: string = faker.internet.url();

  private vpcTransactionService: string = faker.internet.url();

  private theme: Theme = themeFactory();

  private gasPrice: Array<GasPriceOracle | GasPriceFixed> = [
    gasPriceFixedFactory(),
    gasPriceOracleFactory(),
  ];

  private ensRegistryAddress: string | null = faker.finance.ethereumAddress();

  private disabledWallets: string[] = [
    faker.random.word(),
    faker.random.word(),
  ];

  private features: string[] = [faker.random.word(), faker.random.word()];

  withChainId(chainId: string) {
    this.chainId = chainId;
    return this;
  }

  withChainName(chainName: string) {
    this.chainName = chainName;
    return this;
  }

  withDescription(description: string) {
    this.description = description;
    return this;
  }

  withL2(l2: boolean) {
    this.l2 = l2;
    return this;
  }

  withShortName(shortName: string) {
    this.shortName = shortName;
    return this;
  }

  withRpcUri(rpcUri: RpcUri) {
    this.rpcUri = rpcUri;
    return this;
  }

  withSafeAppsRpcUri(safeAppsRpcUri: RpcUri) {
    this.safeAppsRpcUri = safeAppsRpcUri;
    return this;
  }

  withPublicRpcUri(publicRpcUri: RpcUri) {
    this.publicRpcUri = publicRpcUri;
    return this;
  }

  withBlockExplorerUriTemplate(
    blockExplorerUriTemplate: BlockExplorerUriTemplate,
  ) {
    this.blockExplorerUriTemplate = blockExplorerUriTemplate;
    return this;
  }

  withNativeCurrency(nativeCurrency: NativeCurrency) {
    this.nativeCurrency = nativeCurrency;
    return this;
  }

  withTransactionService(transactionService: string) {
    this.transactionService = transactionService;
    return this;
  }

  withVpcTransactionService(vpcTransactionService: string) {
    this.vpcTransactionService = vpcTransactionService;
    return this;
  }

  withTheme(theme: Theme) {
    this.theme = theme;
    return this;
  }

  withGasPrice(gasPrice: Array<GasPriceOracle | GasPriceFixed>) {
    this.gasPrice = gasPrice;
    return this;
  }

  withEnsRegistryAddress(ensRegistryAddress: string | null) {
    this.ensRegistryAddress = ensRegistryAddress;
    return this;
  }

  withDisabledWallets(disabledWallets: string[]) {
    this.disabledWallets = disabledWallets;
    return this;
  }

  withFeatures(features: string[]) {
    this.features = features;
    return this;
  }

  build(): Chain {
    return <Chain>{
      chainId: this.chainId,
      chainName: this.chainName,
      description: this.description,
      l2: this.l2,
      shortName: this.shortName,
      rpcUri: this.rpcUri,
      safeAppsRpcUri: this.safeAppsRpcUri,
      publicRpcUri: this.publicRpcUri,
      blockExplorerUriTemplate: this.blockExplorerUriTemplate,
      nativeCurrency: this.nativeCurrency,
      transactionService: this.transactionService,
      vpcTransactionService: this.vpcTransactionService,
      theme: this.theme,
      gasPrice: this.gasPrice,
      ensRegistryAddress: this.ensRegistryAddress,
      disabledWallets: this.disabledWallets,
      features: this.features,
    };
  }

  toJson(): unknown {
    return this.build();
  }
}
