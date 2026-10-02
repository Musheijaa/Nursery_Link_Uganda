import { describe, expect, it } from 'vitest';
import { parseSmsReply } from './smsReply.js';

describe('parseSmsReply', () => {
  it.each([
    ['K7Q2MX 1', { kind: 'dispatched', shortCode: 'K7Q2MX' }],
    ['k7q2mx 1', { kind: 'dispatched', shortCode: 'K7Q2MX' }],
    ['  K7Q2MX   2 ', { kind: 'out_of_stock', shortCode: 'K7Q2MX' }],
    ['K7Q2MX,1', { kind: 'dispatched', shortCode: 'K7Q2MX' }],
    ['K7Q2MX-2.', { kind: 'out_of_stock', shortCode: 'K7Q2MX' }],
    ['K7Q2MX: 1', { kind: 'dispatched', shortCode: 'K7Q2MX' }],
  ])('understands %j', (text, expected) => {
    expect(parseSmsReply(text)).toEqual(expected);
  });

  it.each([
    'K7Q2MX 3',
    'K7Q2MX',
    '1',
    'K7Q2M 1',
    'K7Q2MXX 1',
    'K7Q2MX 12',
    'Yes I will send it tomorrow',
    'K7Q2MX 1 thanks',
    '',
  ])('does not guess at %j', text => {
    expect(parseSmsReply(text)).toEqual({ kind: 'unrecognised' });
  });
});
