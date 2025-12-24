import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

type AnonymousAuth = { kind: 'anonymous' };

type ApiKeyAuth = {
	kind: 'apiKey';
	apiKeyId: string;
	apiKeyPrefix: string;
	orgId: string;
	userId: string | null;
};

export type Auth = AnonymousAuth | ApiKeyAuth;

/**
 * Parse an API key string into its prefix.
 *
 * Your schema stores ApiKey.prefix and ApiKey.hash. The client sends the full key.
 * We only use the prefix to find the DB record; hash verification can be added later.
 *
 * Example key: "test_12345678_deadbeef"
 * -> prefix: "test_12345678"
 */
function parseApiKeyPrefix(raw: string): string | null {
	const parts = raw.split('_').filter(Boolean);
	if (parts.length < 2) return null;
	return `${parts[0]}_${parts[1]}`;
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
	app.addHook('onRequest', async (req) => {
		// Make sure req.ctx exists (requestContext plugin should have created it,
		// but this makes the plugin resilient in case of ordering mistakes).
		if (!req.ctx) {
			req.ctx = { requestId: req.id, auth: { kind: 'anonymous' } };
		}

		const header = req.headers['x-api-key'];
		const raw = Array.isArray(header) ? header[0] : header;

		// No header -> anonymous
		if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
			req.ctx.auth = { kind: 'anonymous' };
			return;
		}

		const prefix = parseApiKeyPrefix(raw.trim());
		if (!prefix) {
			throw app.httpErrors.unauthorized('Invalid API key format');
		}

		// Look up key by prefix
		const key = await app.prisma.apiKey.findUnique({
			where: { prefix },
			select: {
				id: true,
				prefix: true,
				orgId: true,
				userId: true,
				revokedAt: true,
				expiresAt: true,
			},
		});

		if (!key) {
			throw app.httpErrors.unauthorized('Invalid API key');
		}

		if (key.revokedAt) {
			throw app.httpErrors.unauthorized('API key revoked');
		}

		if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
			throw app.httpErrors.unauthorized('API key expired');
		}

		// NOTE: hash verification (raw secret vs stored hash) can be added later.
		// For now, prefix must exist + not revoked/expired.
		req.ctx.auth = {
			kind: 'apiKey',
			apiKeyId: key.id,
			apiKeyPrefix: key.prefix,
			orgId: key.orgId,
			userId: key.userId,
		};
	});
});
