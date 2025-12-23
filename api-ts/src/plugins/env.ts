import fp from 'fastify-plugin';
import env from '@fastify/env';
import { z } from 'zod';

const EnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
	PORT: z.coerce.number().default(8080),
	CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

declare module 'fastify' {
	interface FastifyInstance {
		config: z.infer<typeof EnvSchema>;
	}
}

export const envPlugin = fp(async (app) => {
	await app.register(env, {
		dotenv: true,
		schema: {
			type: 'object',
			required: ['DATABASE_URL'],
			properties: {
				DATABASE_URL: { type: 'string' },
				PORT: { type: 'string', default: '8080' },
				CORS_ORIGIN: { type: 'string', default: 'http://localhost:5173' },
			},
		},
	});

	const parsed = EnvSchema.safeParse(app.config);
	if (!parsed.success) {
		app.log.error(parsed.error.flatten());
		throw new Error('Invalid environment variables');
	}

	app.config = parsed.data;
});
