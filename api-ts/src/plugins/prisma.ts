import fp from 'fastify-plugin';
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;

declare module 'fastify' {
	interface FastifyInstance {
		prisma: PrismaClient;
	}
}

export const prismaPlugin = fp(async (app) => {
	// Create per Fastify instance
	const prisma = new PrismaClient();

	await prisma.$connect();

	const requiredTables = [
		'User',
		'Session',
		'EmailVerificationToken',
		'PasswordResetToken',
	];
	const requiredUserColumns = ['passwordHash', 'emailVerifiedAt'];

	const tables = (await prisma.$queryRawUnsafe(
		`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY ($1)`,
		requiredTables,
	)) as Array<{ table_name: string }>;

	const columns = (await prisma.$queryRawUnsafe(
		`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = ANY ($1)`,
		requiredUserColumns,
	)) as Array<{ column_name: string }>;

	const foundTables = new Set(tables.map((row) => row.table_name));
	const foundColumns = new Set(columns.map((row) => row.column_name));

	const missingTables = requiredTables.filter((t) => !foundTables.has(t));
	const missingColumns = requiredUserColumns.filter(
		(c) => !foundColumns.has(c),
	);

	if (missingTables.length || missingColumns.length) {
		app.log.error(
			{
				missingTables,
				missingColumns,
			},
			'Database schema is out of date. Run prisma migrate dev or prisma migrate reset (dev) to apply migrations.',
		);
		throw new Error(
			'Database schema is out of date. Run prisma migrate dev or prisma migrate reset (dev) to apply migrations.',
		);
	}

	app.decorate('prisma', prisma);

	app.addHook('onClose', (instance, done) => {
		instance.prisma
			.$disconnect()
			.then(() => done())
			.catch((err) => done(err));
	});
});
