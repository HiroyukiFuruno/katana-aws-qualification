import { expect } from '@playwright/test';
import { sql } from './commands';
import { issuerOrigin } from './settings';

export type VerifiedSession = { accessToken: string; userId: string };
type Claims = { sub: string; session_id: string; amr: { method: string; timestamp: number }[] };
type SessionEvidence = {
  userId: string;
  sessionId: string;
  method: string;
  authenticatedAt: string;
  issuer: string;
  provider: string;
};

export function verifySession(session: VerifiedSession, realm: string, provider: string) {
  const claims: Claims = JSON.parse(
    Buffer.from(session.accessToken.split('.')[1], 'base64url').toString(),
  );
  expect(claims.sub).toBe(session.userId);
  for (const id of [session.userId, claims.session_id]) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid session identifier');
  }
  expect(claims.amr.some((claim) => claim.method === 'oauth' && claim.timestamp > 0)).toBe(true);
  const evidence: SessionEvidence = JSON.parse(
    sql(`
    select json_build_object(
      'userId', session.user_id, 'sessionId', session.id,
      'method', amr.authentication_method, 'authenticatedAt', amr.updated_at,
      'issuer', identity.identity_data->>'iss', 'provider', identity.provider
    )
    from auth.sessions session
    join auth.users owner on owner.id = session.user_id
    join auth.mfa_amr_claims amr on amr.session_id = session.id
    join auth.identities identity on identity.user_id = owner.id
    where session.id = '${claims.session_id}' and owner.id = '${session.userId}'
      and amr.authentication_method = 'oauth'
      and (session.not_after is null or session.not_after > now());
  `),
  );
  expect(evidence.userId).toBe(session.userId);
  expect(evidence.sessionId).toBe(claims.session_id);
  expect(evidence.method).toBe('oauth');
  expect(evidence.issuer).toBe(`${issuerOrigin}/realms/merge-${realm}`);
  expect(evidence.provider).toBe(provider);
  return evidence;
}
