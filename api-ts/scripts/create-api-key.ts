import { PrismaClient } from '@prisma/client';
import { createApiKey } from '../src/lib/apiKey';

async function main() {
	const prisma = new PrismaClient();

	const { plainText, prefix, hash } = createApiKey();

	const org = await prisma.organization.upsert({
		where: { slug: 'demo-org' },
		update: {},
		create: {
			name: 'Demo Org',
			slug: 'demo-org',
		},
	});

	const key = await prisma.apiKey.create({
		data: {
			name: 'Dev key',
			prefix,
			hash,
			orgId: org.id,
		},
	});

	console.log('x-api-key:', plainText);
	console.log('apiKeyId:', key.id);

	await prisma.$disconnect();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
