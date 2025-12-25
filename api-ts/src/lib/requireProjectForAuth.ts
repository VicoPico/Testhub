import type { FastifyInstance } from 'fastify';
import type { AuthenticatedAuth } from './requireAuth';

export type RequiredProject = {
	id: string;
	slug: string;
	name: string;
	orgId: string;
};

function looksLikeId(value: string) {
	return value.length >= 12 && /^[a-z0-9]+$/i.test(value);
}

export async function requireProjectForAuth(
	app: FastifyInstance,
	auth: AuthenticatedAuth,
	projectIdOrSlug: string
): Promise<RequiredProject> {
	let project: RequiredProject | null = null;

	if (looksLikeId(projectIdOrSlug)) {
		project = await app.prisma.project.findFirst({
			where: { id: projectIdOrSlug, orgId: auth.orgId },
			select: { id: true, slug: true, name: true, orgId: true },
		});
	}

	if (!project) {
		project = await app.prisma.project.findFirst({
			where: { slug: projectIdOrSlug, orgId: auth.orgId },
			select: { id: true, slug: true, name: true, orgId: true },
		});
	}

	if (!project) throw app.httpErrors.notFound('Project not found');
	return project;
}
