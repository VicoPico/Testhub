import type { FastifyRequest } from 'fastify';

/**
 * Authenticated request context (API key–based)
 */
export type AuthenticatedAuth = {
	isAuthenticated: true;
	strategy: 'apiKey';
	orgId: string;
	apiKeyId: string;
	userId?: string | null;
};

/**
 * Unauthenticated request context
 */
export type UnauthenticatedAuth = {
	isAuthenticated: false;
	strategy: 'none';
};

/**
 * Full auth context union
 */
export type AuthContext = AuthenticatedAuth | UnauthenticatedAuth;

/**
 * Runtime + type-level auth guard.
 *
 * After this call, `req.ctx.auth` is guaranteed to be authenticated.
 */
export function requireAuth(
	req: FastifyRequest
): asserts req is FastifyRequest & { ctx: { auth: AuthenticatedAuth } } {
	if (!req.ctx?.auth || req.ctx.auth.isAuthenticated !== true) {
		throw req.server.httpErrors.unauthorized('Authentication required');
	}
}

/**
 * Convenience helper for routes that need auth data.
 * Throws if unauthenticated.
 */
export function getAuth(req: FastifyRequest): AuthenticatedAuth {
	requireAuth(req);
	return req.ctx.auth;
}
