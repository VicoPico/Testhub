import type { FastifyRequest } from 'fastify';

export type AuthApiKey = {
	kind: 'apiKey';
	apiKeyId: string;
	apiKeyPrefix: string;
	orgId: string;
	userId: string | null;
};

export type AuthAnonymous = { kind: 'anonymous' };

export type Auth = AuthAnonymous | AuthApiKey;

export function requireAuth(req: FastifyRequest): AuthApiKey {
	const auth = req.ctx.auth as Auth | undefined;
	if (!auth || auth.kind === 'anonymous') {
		throw req.server.httpErrors.unauthorized('Missing or invalid API key');
	}
	return auth;
}
