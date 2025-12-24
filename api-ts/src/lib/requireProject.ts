// src/lib/requireProject.ts
import type { FastifyInstance } from 'fastify';

export type ProjectRef = {
	id: string;
	orgId: string;
	name: string;
	slug: string;
	createdAt: Date;
};

function looksLikeId(value: string) {
	return value.length >= 12 && /^[a-z0-9]+$/i.test(value);
}

export async function requireProject(
	app: FastifyInstance,
	projectIdOrSlug: string
): Promise<ProjectRef> {
	let project: ProjectRef | null = null;

	if (looksLikeId(projectIdOrSlug)) {
		project = await app.prisma.project.findUnique({
			where: { id: projectIdOrSlug },
			select: {
				id: true,
				orgId: true,
				name: true,
				slug: true,
				createdAt: true,
			},
		});
	}

	if (!project) {
		project = await app.prisma.project.findFirst({
			where: { slug: projectIdOrSlug },
			select: {
				id: true,
				orgId: true,
				name: true,
				slug: true,
				createdAt: true,
			},
		});
	}

	if (!project) throw app.httpErrors.notFound('Project not found');
	return project;
}
