import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	// Keep it idempotent
	const org = await prisma.organization.upsert({
		where: { slug: 'demo-org' },
		update: {},
		create: { name: 'Demo Org', slug: 'demo-org' },
	});

	await prisma.project.upsert({
		where: { orgId_slug: { orgId: org.id, slug: 'demo' } },
		update: {},
		create: {
			orgId: org.id,
			name: 'Demo Project',
			slug: 'demo',
		},
	});

	console.log('✅ Seeded demo org + demo project');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => prisma.$disconnect());
