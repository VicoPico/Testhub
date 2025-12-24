import type { FastifyInstance } from 'fastify';

export type RequiredProject = {
	id: string;
	slug: string;
	name: string;
	orgId: string;
};

/**
 * Heuristic: Prisma cuid() looks like "cm..." and is fairly long.
 * This doesn't need to be perfect; it just decides which lookup to try first.
 */
function looksLikeId(value: string) {
	return value.length >= 12 && /^[a-z0-9]+$/i.test(value);
}

/**
 * Resolve a project from either:
 * - slug (e.g. "demo")
 * - db id (e.g. "cmjieokwu0003sb5ie7xi3xn2")
 *
 * Throws a 404 if not found.
 */
export async function requireProject(
	app: FastifyInstance,
	projectIdOrSlug: string
): Promise<RequiredProject> {
	let project: RequiredProject | null = null;

	if (looksLikeId(projectIdOrSlug)) {
		project = await app.prisma.project.findUnique({
			where: { id: projectIdOrSlug },
			select: { id: true, slug: true, name: true, orgId: true },
		});
	}

	if (!project) {
		project = await app.prisma.project.findFirst({
			where: { slug: projectIdOrSlug },
			select: { id: true, slug: true, name: true, orgId: true },
		});
	}

	if (!project) {
		throw app.httpErrors.notFound('Project not found');
	}

	return project;
}
