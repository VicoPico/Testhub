import type { FastifyRequest } from 'fastify';

export type AuthedContext = {
	isAuthenticated: true;
	strategy: 'apiKey';
	orgId: string;
	apiKeyId: string;
	userId?: string | null;
};

export type UnauthedContext = {
	isAuthenticated: false;
	strategy: 'none';
};

export type AuthContext = AuthedContext | UnauthedContext;

// Narrowing helper if you ever need it
export function isAuthed(ctx: AuthContext): ctx is AuthedContext {
	return ctx.isAuthenticated === true && ctx.strategy === 'apiKey';
}

/**
 * Runtime auth guard.
 * - Logs what it sees in req.ctx.auth
 * - Throws 401 if not authenticated
 */
export function requireAuth(
	req: FastifyRequest
): asserts req is FastifyRequest & { ctx: { auth: AuthedContext } } {
	// Log what we see coming in
	req.log.info({ ctx: (req as any).ctx }, 'requireAuth called – current ctx');

	const ctx = (req as any).ctx?.auth as AuthContext | undefined;

	if (!ctx || !ctx.isAuthenticated || ctx.strategy !== 'apiKey') {
		req.log.warn(
			{ ctx },
			'requireAuth: unauthenticated or invalid strategy, throwing 401'
		);
		throw req.server.httpErrors.unauthorized('Authentication required');
	}

	// Success path
	req.log.info(
		{ orgId: ctx.orgId, apiKeyId: ctx.apiKeyId, userId: ctx.userId },
		'requireAuth: success'
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
