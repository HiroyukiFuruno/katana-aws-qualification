import { expect, test } from 'bun:test';
import { callbackFailureKind } from '../src/auth/callbackFailure';

test('missing or mismatched PKCE storage offers a fresh flow in the current browser', () => {
  expect(callbackFailureKind({ code: 'pkce_code_verifier_not_found' }, '')).toBe('browser');
  expect(callbackFailureKind({ code: 'bad_code_verifier' }, '')).toBe('browser');
});

test('provider cancellation, expiration and unknown failures are distinct safe categories', () => {
  expect(callbackFailureKind(null, '?error=access_denied')).toBe('cancelled');
  expect(callbackFailureKind({ code: 'flow_state_expired' }, '')).toBe('expired');
  expect(callbackFailureKind({ code: 'flow_state_not_found' }, '')).toBe('expired');
  expect(callbackFailureKind(new Error('sensitive provider response'), '')).toBe('unknown');
});

test('Microsoft diagnostic descriptions never alter safe callback categories', () => {
  expect(
    callbackFailureKind(null, '?error=access_denied&error_description=AADSTS900941%3A+secret'),
  ).toBe('cancelled');
  expect(callbackFailureKind(null, '?error=access_denied&error_description=AADSTS65004%3A+secret')).toBe(
    'cancelled',
  );
  expect(callbackFailureKind(null, '?error=server_error&error_description=AADSTS900941')).toBe(
    'unknown',
  );
  expect(callbackFailureKind(null, '?error=server_error&error_description=AADSTS65004')).toBe('unknown');
});
