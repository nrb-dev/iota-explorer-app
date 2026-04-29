import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractHost } from '../lib/iota/net-address.ts';

describe('IOTA net address parsing', () => {
  it('extracts DNS and IPv4 hosts from multiaddr values', () => {
    assert.equal(
      extractHost('/dns/iota-mainnet-validator.example/tcp/8080/http'),
      'iota-mainnet-validator.example'
    );
    assert.equal(
      extractHost('/dns4/validator.example/udp/8084'),
      'validator.example'
    );
    assert.equal(extractHost('/ip4/127.0.0.1/tcp/8080/http'), '127.0.0.1');
  });

  it('returns null for missing or unsupported addresses', () => {
    assert.equal(extractHost(undefined), null);
    assert.equal(extractHost(''), null);
    assert.equal(extractHost('/ip6/::1/tcp/8080/http'), null);
  });
});
