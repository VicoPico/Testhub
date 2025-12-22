import Fastify from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import prismaPlugin from './plugins/prisma';

const app = Fastify({
	logger: true,
});

await app.register(env, {
	schema: {
		type: 'object',
		required: ['DATABASE_URL'],
		properties: {
			DATABASE_URL: { type: 'string' },
			PORT: { type: 'string', default: '8080' },
			CORS_ORIGIN: { type: 'string', default: 'http://localhost:5173' },
		},
	},
	dotenv: true,
});

await app.register(cors, {
	origin: app.config.CORS_ORIGIN,
	credentials: true,
});

await app.register(prismaPlugin);

app.get('/health', async () => ({ ok: true }));

const port = Number(app.config.PORT ?? '8080');
await app.listen({ port, host: '0.0.0.0' });
