import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { openapiContractPlugin } from './plugins/openapiContract';

import { envPlugin } from './plugins/env';
import { corsPlugin } from './plugins/cors';
import { prismaPlugin } from './plugins/prisma';
import { requestContextPlugin } from './plugins/requestContext';
import { authPlugin } from './plugins/auth';

import { healthRoutes } from './routes/health';
import { runRoutes } from './routes/runs';

export function buildApp() {
	const app = Fastify({ logger: true });

	// --------------------------------------------------
	// Core / cross-cutting
	// --------------------------------------------------
	app.register(envPlugin);
	app.register(sensible);

	// --------------------------------------------------
	// OpenAPI contract + /docs + request validation
	// (must be registered before routes)
	// --------------------------------------------------
	app.register(openapiContractPlugin);

	// --------------------------------------------------
	// Needs envPlugin (CORS_ORIGIN)
	// --------------------------------------------------
	app.register(corsPlugin);

	// --------------------------------------------------
	// DB + request context + auth
	// --------------------------------------------------
	app.register(prismaPlugin);
	app.register(requestContextPlugin);
	app.register(authPlugin);

	// --------------------------------------------------
	// Routes
	// --------------------------------------------------
	app.register(healthRoutes);
	app.register(runRoutes);

	// --------------------------------------------------
	// Global error handler
	// - surfaces OpenAPI validation errors in dev
	// - keeps Fastify + sensible semantics
	// --------------------------------------------------
	app.setErrorHandler((err, req, reply) => {
		req.log.error(err);

		const statusCode =
			typeof (err as any).statusCode === 'number'
				? (err as any).statusCode
				: 500;

		// OpenAPI / Ajv validation details may live in different places
		const details =
			(err as any).cause ??
			(err as any).errors ??
			(err as any).validation ??
			undefined;

		reply.status(statusCode).send({
			statusCode,
			error:
				(err as any).name ??
				(statusCode >= 500 ? 'Internal Server Error' : 'Bad Request'),
			message: err.message,
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
