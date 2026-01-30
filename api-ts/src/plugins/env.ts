import fp from 'fastify-plugin';
import env from '@fastify/env';
import { z } from 'zod';

const EnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
	PORT: z.coerce.number().default(8080),
	AUTH_COOKIE_SECRET: z.string().min(1),
	AUTH_COOKIE_NAME: z.string().default('testhub_session'),
	GITHUB_CLIENT_ID: z.string().min(1),
	GITHUB_CLIENT_SECRET: z.string().min(1),
	PUBLIC_BASE_URL: z.string().default('http://localhost:8080'),
	WEB_APP_URL: z.string().default('http://localhost:5173'),
	ALLOW_SIGNUP: z.coerce.boolean().default(false),
	EMAIL_FROM: z.string().optional(),
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
			required: [
				'DATABASE_URL',
				'AUTH_COOKIE_SECRET',
				'GITHUB_CLIENT_ID',
				'GITHUB_CLIENT_SECRET',
			],
			properties: {
				DATABASE_URL: { type: 'string' },
				PORT: { type: 'string', default: '8080' },
				AUTH_COOKIE_SECRET: { type: 'string' },
				AUTH_COOKIE_NAME: { type: 'string', default: 'testhub_session' },
				GITHUB_CLIENT_ID: { type: 'string' },
				GITHUB_CLIENT_SECRET: { type: 'string' },
				PUBLIC_BASE_URL: { type: 'string', default: 'http://localhost:8080' },
				WEB_APP_URL: { type: 'string', default: 'http://localhost:5173' },
				ALLOW_SIGNUP: { type: 'string', default: 'false' },
				EMAIL_FROM: { type: 'string' },
			},
		},
	});

	const parsed = EnvSchema.safeParse(app.config);
	if (!parsed.success) {
		app.log.error(parsed.error.flatten());
		throw new Error('Invalid environment variables');
	}

	app.config = parsed.data;
	app.log.info({ config: app.config }, 'loaded env config');
});
