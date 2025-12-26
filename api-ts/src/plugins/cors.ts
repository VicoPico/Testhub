// api-ts/src/plugins/cors.ts
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

export const corsPlugin: FastifyPluginAsync = fp(async (app) => {
	await app.register(cors, {
		origin: app.config.CORS_ORIGIN, // e.g. "http://localhost:5173"
		credentials: false, // you're using x-api-key (no cookies needed)
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['content-type', 'x-api-key'],
	});
});
