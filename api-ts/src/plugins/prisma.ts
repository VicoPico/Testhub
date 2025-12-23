import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
	interface FastifyInstance {
		prisma: PrismaClient;
	}
}

export const prismaPlugin = fp(async (app) => {
	// Create per Fastify instance
	const prisma = new PrismaClient();

	await prisma.$connect();

	app.decorate('prisma', prisma);

	app.addHook('onClose', (instance, done) => {
		instance.prisma
			.$disconnect()
			.then(() => done())
			.catch((err) => done(err));
	});
});
