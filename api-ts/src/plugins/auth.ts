import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { parseApiKey, sha256Hex, safeEqualHex } from '../lib/apiKey';

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
	app.addHook('onRequest', async (req) => {
		const header = req.headers['x-api-key'];

		// No header -> remain anonymous (public routes still work)
		if (header == null) return;

		// Fastify headers can be string | string[] | undefined
		const raw = Array.isArray(header) ? header[0] : header;
		if (!raw) return;

		const parsed = parseApiKey(raw);
		if (!parsed) {
			throw app.httpErrors.unauthorized('Invalid API key format');
		}

		const { prefix, raw: rawKey } = parsed;
		const presentedHash = sha256Hex(rawKey);
		const now = new Date();

		const apiKey = await app.prisma.apiKey.findUnique({
			where: { prefix },
			select: {
				id: true,
				prefix: true,
				hash: true,
				orgId: true,
				userId: true,
				revokedAt: true,
				expiresAt: true,
				org: { select: { id: true, slug: true } },
				user: { select: { id: true, email: true } },
			},
		});

		if (!apiKey) throw app.httpErrors.unauthorized('Invalid API key');
		if (apiKey.revokedAt) throw app.httpErrors.unauthorized('API key revoked');
		if (apiKey.expiresAt && apiKey.expiresAt <= now) {
			throw app.httpErrors.unauthorized('API key expired');
		}

		if (!safeEqualHex(apiKey.hash, presentedHash)) {
			throw app.httpErrors.unauthorized('Invalid API key');
		}

		req.ctx.auth = {
			isAuthenticated: true,
			strategy: 'apiKey',
			apiKey: { id: apiKey.id, prefix: apiKey.prefix },
			orgId: apiKey.orgId,
			userId: apiKey.userId ?? null,
		};

		req.ctx.org = apiKey.org
			? { id: apiKey.org.id, slug: apiKey.org.slug }
			: { id: apiKey.orgId };

		req.ctx.user = apiKey.user
			? { id: apiKey.user.id, email: apiKey.user.email }
			: apiKey.userId
			? { id: apiKey.userId }
			: null;

		// best-effort lastUsedAt
		app.prisma.apiKey
			.update({ where: { id: apiKey.id }, data: { lastUsedAt: now } })
			.catch((err) => {
				req.log.warn(
					{ err, apiKeyId: apiKey.id },
					'Failed to update ApiKey.lastUsedAt'
				);
			});
	});
});
