import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatAddress,
  formatApy,
  formatCommission,
  formatIota,
  formatVotingPower,
} from '../lib/formatters.ts';

describe('formatters', () => {
  it('formats IOTA nanos into readable units', () => {
    assert.equal(formatIota('1230000000'), '1.23');
    assert.equal(formatIota('1230000000000'), '1.23K');
    assert.equal(formatIota('1230000000000000'), '1.23M');
  });

  it('formats validator percentages', () => {
    assert.equal(formatApy(0.1034), '10.34%');
    assert.equal(formatApy(null), '—');
    assert.equal(formatCommission(1000), '10.0%');
    assert.equal(formatVotingPower(25, 100), '25.00%');
    assert.equal(formatVotingPower(25, 0), '0%');
  });

  it('shortens long addresses but keeps short values intact', () => {
    assert.equal(formatAddress('0x1234567890abcdef', 4), '0x12...cdef');
    assert.equal(formatAddress('0x1234', 4), '0x1234');
    assert.equal(formatAddress(''), '—');
  });
});
