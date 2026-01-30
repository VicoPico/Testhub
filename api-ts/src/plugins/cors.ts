import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

export const corsPlugin: FastifyPluginAsync = fp(async (app) => {
	await app.register(cors, {
		origin: app.config.WEB_APP_URL, // e.g. "http://localhost:5173"
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['content-type', 'x-api-key'],
	});
});
