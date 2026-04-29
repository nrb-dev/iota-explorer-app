import type { IotaNetwork } from '../iota-network';

const DEFAULT_RPC_URLS = {
  mainnet: 'https://api.mainnet.iota.cafe',
  testnet: 'https://api.testnet.iota.cafe',
} satisfies Record<IotaNetwork, string>;

export function getRpcUrl(network: IotaNetwork): string {
  if (network === 'testnet') {
    return process.env.IOTA_TESTNET_RPC_URL || DEFAULT_RPC_URLS.testnet;
  }

  return (
    process.env.IOTA_MAINNET_RPC_URL ||
    process.env.IOTA_RPC_URL ||
    DEFAULT_RPC_URLS.mainnet
  );
}

export function getRpcKey(network: IotaNetwork): string {
  if (network === 'testnet') {
    return process.env.IOTA_TESTNET_RPC_KEY || process.env.IOTA_RPC_KEY || '';
  }

  return process.env.IOTA_MAINNET_RPC_KEY || process.env.IOTA_RPC_KEY || '';
}
