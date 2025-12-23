import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
	app.get('/health', async () => ({ ok: true }));
	app.get('/ready', async () => {
		await app.prisma.$queryRaw`SELECT 1`;
		return { ok: true };
	});
};
