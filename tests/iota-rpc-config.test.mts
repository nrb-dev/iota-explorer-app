import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { getRpcKey, getRpcUrl } from '../lib/iota/rpc-config.ts';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.IOTA_MAINNET_RPC_URL = originalEnv.IOTA_MAINNET_RPC_URL;
  process.env.IOTA_TESTNET_RPC_URL = originalEnv.IOTA_TESTNET_RPC_URL;
  process.env.IOTA_RPC_URL = originalEnv.IOTA_RPC_URL;
  process.env.IOTA_MAINNET_RPC_KEY = originalEnv.IOTA_MAINNET_RPC_KEY;
  process.env.IOTA_TESTNET_RPC_KEY = originalEnv.IOTA_TESTNET_RPC_KEY;
  process.env.IOTA_RPC_KEY = originalEnv.IOTA_RPC_KEY;
  process.env.NEXT_PUBLIC_IOTA_MAINNET_RPC_URL =
    originalEnv.NEXT_PUBLIC_IOTA_MAINNET_RPC_URL;
  process.env.NEXT_PUBLIC_IOTA_TESTNET_RPC_URL =
    originalEnv.NEXT_PUBLIC_IOTA_TESTNET_RPC_URL;
});

describe('IOTA RPC config', () => {
  it('uses only server-side env names for RPC URLs', () => {
    delete process.env.IOTA_MAINNET_RPC_URL;
    delete process.env.IOTA_TESTNET_RPC_URL;
    delete process.env.IOTA_RPC_URL;
    process.env.NEXT_PUBLIC_IOTA_MAINNET_RPC_URL =
      'https://public-mainnet.invalid';
    process.env.NEXT_PUBLIC_IOTA_TESTNET_RPC_URL =
      'https://public-testnet.invalid';

    assert.equal(getRpcUrl('mainnet'), 'https://api.mainnet.iota.cafe');
    assert.equal(getRpcUrl('testnet'), 'https://api.testnet.iota.cafe');
  });

  it('prefers network-specific RPC URLs over the shared mainnet fallback', () => {
    process.env.IOTA_RPC_URL = 'https://shared.example';
    process.env.IOTA_MAINNET_RPC_URL = 'https://mainnet.example';
    process.env.IOTA_TESTNET_RPC_URL = 'https://testnet.example';

    assert.equal(getRpcUrl('mainnet'), 'https://mainnet.example');
    assert.equal(getRpcUrl('testnet'), 'https://testnet.example');
  });

  it('uses network-specific keys before the shared key', () => {
    process.env.IOTA_RPC_KEY = 'shared-key';
    process.env.IOTA_MAINNET_RPC_KEY = 'mainnet-key';
    process.env.IOTA_TESTNET_RPC_KEY = 'testnet-key';

    assert.equal(getRpcKey('mainnet'), 'mainnet-key');
    assert.equal(getRpcKey('testnet'), 'testnet-key');
  });
});
