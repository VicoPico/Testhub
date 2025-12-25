import Fastify from 'fastify';
import sensible from '@fastify/sensible';

import { envPlugin } from './plugins/env';
import { corsPlugin } from './plugins/cors';
import { prismaPlugin } from './plugins/prisma';
import { requestContextPlugin } from './plugins/requestContext';
import { authPlugin } from './plugins/auth';

import { healthRoutes } from './routes/health';
import { runRoutes } from './routes/runs';

export function buildApp() {
	const app = Fastify({ logger: true });

	// Core / cross-cutting
	app.register(envPlugin);
	app.register(sensible);

	// Needs envPlugin (CORS_ORIGIN)
	app.register(corsPlugin);

	// DB + request context + auth
	app.register(prismaPlugin);
	app.register(requestContextPlugin);
	app.register(authPlugin);

	// Routes
	app.register(healthRoutes);
	app.register(runRoutes);

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
