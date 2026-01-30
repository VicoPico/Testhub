import type { FastifyRequest } from 'fastify';
import type { AuthContext } from '../plugins/requestContext';

export type AuthedContext = Extract<AuthContext, { isAuthenticated: true }>;

// Narrowing helper if you ever need it
export function isAuthed(ctx: AuthContext): ctx is AuthedContext {
	return ctx.isAuthenticated === true;
}

/**
 * Runtime auth guard.
 * - Logs what it sees in req.ctx.auth
 * - Throws 401 if not authenticated
 */
export function requireAuth(
	req: FastifyRequest,
): asserts req is FastifyRequest & { ctx: { auth: AuthedContext } } {
	// Log what we see coming in
	req.log.info({ ctx: (req as any).ctx }, 'requireAuth called – current ctx');

	const ctx = (req as any).ctx?.auth as AuthContext | undefined;

	if (!ctx || !ctx.isAuthenticated) {
		req.log.warn(
			{ ctx },
			'requireAuth: unauthenticated or invalid strategy, throwing 401',
		);
		throw req.server.httpErrors.unauthorized('Authentication required');
	}

	// Success path
	req.log.info(
		{
			orgId: ctx.orgId,
			userId: ctx.userId,
			strategy: ctx.strategy,
			apiKeyId: ctx.strategy === 'apiKey' ? ctx.apiKey.id : null,
			sessionId: ctx.strategy === 'session' ? ctx.session.id : null,
		},
		'requireAuth: success',
	);
}

/**
 * Convenience helper for handlers.
 * Assumes requireAuth has already run in a hook.
 */
export function getAuth(req: FastifyRequest): AuthedContext {
	requireAuth(req);
	// At this point the assert above holds
	return (req as any).ctx.auth as AuthedContext;
}
