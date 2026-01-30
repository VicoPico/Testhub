import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';

import { openapiContractPlugin } from './plugins/openapiContract';
import { envPlugin } from './plugins/env';
import { corsPlugin } from './plugins/cors';
import { prismaPlugin } from './plugins/prisma';
import { requestContextPlugin } from './plugins/requestContext';
import { authPlugin } from './plugins/auth';

import { healthRoutes } from './routes/health';
import { runRoutes } from './routes/runs';
import { projectRoutes } from './routes/projects';
import { testRoutes } from './routes/tests';
import { analyticsRoutes } from './routes/analytics';
import { searchRoutes } from './routes/search';
import { authRoutes } from './routes/auth';

/**
 * Cookie plugin must run AFTER envPlugin
 * because it needs app.config.AUTH_COOKIE_SECRET
 */
const authCookiePlugin = fp(async (app) => {
	await app.register(cookie, {
		secret: app.config.AUTH_COOKIE_SECRET,
		parseOptions: {
			httpOnly: true,
		},
	});
});

export function buildApp() {
	const app = Fastify({ logger: true });

	// Core / cross-cutting
	app.register(envPlugin);
	app.register(sensible);

	// OpenAPI contract + /docs + request validation
	app.register(openapiContractPlugin);

	// Needs envPlugin (WEB_APP_URL)
	app.register(corsPlugin);

	// Cookie parsing/signing for session auth
	app.register(authCookiePlugin);

	// DB + request context + auth
	app.register(prismaPlugin);
	app.register(requestContextPlugin);
	app.register(authPlugin);

	// Routes
	app.register(healthRoutes);
	app.register(runRoutes);
	app.register(projectRoutes);
	app.register(testRoutes);
	app.register(analyticsRoutes);
	app.register(searchRoutes);
	app.register(authRoutes);

	// Central error handler
	app.setErrorHandler((err, _req, reply) => {
		const anyErr = err as any;

		const statusCode =
			typeof anyErr.statusCode === 'number' && anyErr.statusCode >= 400
				? anyErr.statusCode
				: 500;

		const details =
			anyErr.cause ?? anyErr.errors ?? anyErr.validation ?? undefined;

		const message =
			typeof anyErr.message === 'string'
				? anyErr.message
				: statusCode >= 500
					? 'Internal Server Error'
					: 'Bad Request';

		const errorName =
			typeof anyErr.name === 'string'
				? anyErr.name
				: statusCode >= 500
					? 'Internal Server Error'
					: 'Bad Request';

		reply.status(statusCode).send({
			statusCode,
			error: errorName,
			message,
			...(details ? { details } : {}),
		});
	});

	return app;
}

async function main() {
	const app = buildApp();

	await app.ready();

	const port = app.config.PORT;
	await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
