import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export const corsPlugin = fp(async (app) => {
	// envPlugin has already run, so app.config is available here
	await app.register(cors, {
		origin: app.config.CORS_ORIGIN,
		credentials: true,
	});
});
