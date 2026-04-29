import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isIotaNetwork,
  parseIotaNetwork,
  withNetworkParam,
} from '../lib/iota-network.ts';

describe('IOTA network helpers', () => {
  it('accepts only supported network names', () => {
    assert.equal(isIotaNetwork('mainnet'), true);
    assert.equal(isIotaNetwork('testnet'), true);
    assert.equal(isIotaNetwork('devnet'), false);
    assert.equal(isIotaNetwork(null), false);
  });

  it('falls back to mainnet for unknown query values', () => {
    assert.equal(parseIotaNetwork('testnet'), 'testnet');
    assert.equal(parseIotaNetwork('devnet'), 'mainnet');
    assert.equal(parseIotaNetwork(null), 'mainnet');
  });

  it('adds network query params without dropping existing params', () => {
    assert.equal(
      withNetworkParam('/api/validators', 'mainnet'),
      '/api/validators?network=mainnet'
    );
    assert.equal(
      withNetworkParam('/api/validators?page=2', 'testnet'),
      '/api/validators?page=2&network=testnet'
    );
  });
});
