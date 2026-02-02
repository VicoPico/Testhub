import type { FastifyInstance } from 'fastify';

export type RequiredProject = {
	id: string;
	slug: string;
	name: string;
	orgId: string;
};

/**
 * Heuristic to distinguish database IDs from human-readable slugs.
 *
 * Prisma `cuid()` values are:
 * - relatively long (≥ ~12 characters)
 * - alphanumeric
 *
 * This is NOT a guarantee of correctness — it only helps decide
 * which lookup to try first (id vs slug). Both paths are still
 * validated against the database.
 */
function looksLikeId(value: string) {
	return value.length >= 12 && /^[a-z0-9]+$/i.test(value);
}

/**
 * Resolve a project by (slug OR id) scoped to orgId.
 *
 * Returns 404 if not found in this org (including "exists in another org").
 */
export async function requireProjectForOrg(
	app: FastifyInstance,
	projectIdOrSlug: string,
	orgId: string,
): Promise<RequiredProject> {
	let project: RequiredProject | null = null;

	if (looksLikeId(projectIdOrSlug)) {
		project = await app.prisma.project.findFirst({
			where: { id: projectIdOrSlug, orgId },
			select: { id: true, slug: true, name: true, orgId: true },
		});
	}

	if (!project) {
		project = await app.prisma.project.findFirst({
			where: { slug: projectIdOrSlug, orgId },
			select: { id: true, slug: true, name: true, orgId: true },
		});
	}

	if (!project) {
		const alias = await app.prisma.projectSlugAlias.findFirst({
			where: {
				slug: projectIdOrSlug,
				project: { orgId },
			},
			select: {
				project: { select: { id: true, slug: true, name: true, orgId: true } },
			},
		});
		project = alias?.project ?? null;
	}

	if (!project) {
		throw app.httpErrors.notFound('Project not found');
	}

	return project;
}
