import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
	app.get('/health', async (req) => {
		// TEMP: verify request context wiring (Step 8B)
		req.log.info({ auth: req.ctx.auth }, 'request auth context');

		return { ok: true };
	});

	app.get('/ready', async () => {
		await app.prisma.$queryRaw`SELECT 1`;
		return { ok: true };
	});
};
