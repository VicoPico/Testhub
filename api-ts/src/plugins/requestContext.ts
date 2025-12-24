import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Authentication context attached to every request.
 *
 * - Always present
 * - Narrowed by `isAuthenticated`
 */
export type AuthContext =
	| {
			isAuthenticated: false;
			strategy: 'none';
	  }
	| {
			isAuthenticated: true;
			strategy: 'apiKey' | 'session' | 'jwt';

			// Resolved identities
			orgId: string;
			userId: string | null;

			// Auth material
			apiKeyId?: string;
			apiKeyPrefix?: string;
	  };

export type RequestContext = {
	/** Fastify-generated request id (for logs, tracing) */
	requestId: string;

	/** Organization resolved from auth (null if anonymous) */
	org: null | {
		id: string;
		slug?: string;
	};

	/** User resolved from auth (null for api keys without user) */
	user: null | {
		id: string;
		email?: string;
	};

	/** Authentication info */
	auth: AuthContext;
};

declare module 'fastify' {
	interface FastifyRequest {
		ctx: RequestContext;
	}
}

export const requestContextPlugin: FastifyPluginAsync = fp(async (app) => {
	app.addHook('onRequest', async (req) => {
		req.ctx = {
			requestId: req.id,
			org: null,
			user: null,
			auth: {
				isAuthenticated: false,
				strategy: 'none',
			},
		};
	});
});
