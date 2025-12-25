import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export type AuthContext =
	| {
			isAuthenticated: false;
			strategy: 'none';
	  }
	| {
			isAuthenticated: true;
			strategy: 'apiKey';
			apiKey: {
				id: string;
				prefix: string;
			};
			orgId: string;
			userId: string | null;
	  };

export type RequestContext = {
	requestId: string;

	user: null | {
		id: string;
		email?: string;
	};

	org: null | {
		id: string;
		slug?: string;
	};

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
			user: null,
			org: null,
			auth: {
				isAuthenticated: false,
				strategy: 'none',
			},
		};
	});
});
