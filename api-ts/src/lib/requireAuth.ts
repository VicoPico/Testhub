import type { FastifyRequest } from 'fastify';
import type { AuthContext } from '../plugins/requestContext';

export type AuthenticatedAuth = Extract<AuthContext, { isAuthenticated: true }>;

export function requireAuth(req: FastifyRequest): AuthenticatedAuth {
	if (!req.ctx) {
		throw req.server.httpErrors.internalServerError(
			'Request context not initialized (did you register requestContextPlugin early enough?)'
		);
	}

	const auth = req.ctx.auth;

	if (!auth || auth.isAuthenticated !== true) {
		throw req.server.httpErrors.unauthorized('Authentication required');
	}

	return auth;
}
