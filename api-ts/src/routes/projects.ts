import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, getAuth } from '../lib/requireAuth';
import { requireProjectForOrg } from '../lib/requireProjectForOrg';

const CreateProjectBody = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
});

const UpdateProjectBody = z.object({
	name: z.string().min(1).optional(),
	slug: z.string().min(1).optional(),
});

const ProjectParams = z.object({
	projectId: z.string().min(1), // slug or db id
});

const SlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSlug(value: string) {
	if (!SlugPattern.test(value)) {
		throw new Error('invalid_slug');
	}
}

export const projectRoutes: FastifyPluginAsync = async (app) => {
	// Auth guard for *all* routes in this plugin
	app.addHook('preHandler', (req, _reply, done) => {
		req.log.info(
			{ url: req.url, method: req.method },
			'projects preHandler requireAuth',
		);

		try {
			requireAuth(req);
			const { orgId, userId } = getAuth(req);
			req.log.info(
				{ orgId, userId: userId ?? null, reqId: (req as any).id },
				'projects requireAuth: success',
			);
			done();
		} catch (err) {
			req.log.error({ err }, 'projects requireAuth: failure');
			done(err as Error);
		}
	});

	// --- DEBUG PING ---
	app.get('/projects/ping', async (req, reply) => {
		req.log.info('projects ping handler reached');
		const { orgId, userId } = getAuth(req);

		return reply.send({
			ok: true,
			orgId,
			userId: userId ?? null,
		});
	});

	// --- LIST PROJECTS ---
	app.get('/projects', async (req) => {
		const { orgId } = getAuth(req);

		const projects = await app.prisma.project.findMany({
			where: { orgId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				name: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		// matches ProjectListResponse (items: Project[])
		return { items: projects };
	});

	// --- CREATE PROJECT ---
	app.post('/projects', async (req, reply) => {
		const { orgId } = getAuth(req);
		const body = CreateProjectBody.parse(req.body);

		try {
			const project = await app.prisma.project.create({
				data: {
					orgId,
					name: body.name,
					slug: body.slug,
				},
				select: {
					id: true,
					name: true,
					slug: true,
					createdAt: true,
					updatedAt: true,
				},
			});

			// OpenAPI says 201 Created
			return reply.code(201).send(project);
		} catch (err) {
			if (
				err &&
				typeof err === 'object' &&
				'code' in err &&
				(err as { code?: string }).code === 'P2002'
			) {
				// Unique constraint violation (likely orgId+slug)
				throw app.httpErrors.badRequest(
					'Project slug is already in use in this organization',
				);
			}
			throw err;
		}
	});

	// --- GET SINGLE PROJECT ---
	app.get('/projects/:projectId', async (req) => {
		const { orgId } = getAuth(req);
		const { projectId } = ProjectParams.parse(req.params);

		// Ensure the project exists + belongs to this org
		const base = await requireProjectForOrg(app, projectId, orgId);

		// Fetch with a typed select that matches the OpenAPI Project schema
		const project = await app.prisma.project.findUniqueOrThrow({
			where: { id: base.id },
			select: {
				id: true,
				name: true,
				slug: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return project;
	});

	// --- UPDATE PROJECT ---
	app.patch('/projects/:projectId', async (req) => {
		const { orgId } = getAuth(req);
		const { projectId } = ProjectParams.parse(req.params);
		const body = UpdateProjectBody.parse(req.body);

		if (!app.prisma) {
			throw app.httpErrors.internalServerError('Prisma not initialized');
		}

		const project = await requireProjectForOrg(app, projectId, orgId);

		const nextName = body.name?.trim();
		const nextSlugRaw = body.slug?.trim();
		const wantsSlugChange =
			nextSlugRaw != null &&
			nextSlugRaw.length > 0 &&
			nextSlugRaw !== project.slug;

		if (nextSlugRaw) {
			try {
				assertSlug(nextSlugRaw);
			} catch (err) {
				if (err instanceof Error && err.message === 'invalid_slug') {
					throw app.httpErrors.badRequest(
						'Slug must be lowercase letters, numbers, and dashes.',
					);
				}
				throw err;
			}
		}

		try {
			const updated = await app.prisma.$transaction(
				async (tx: Prisma.TransactionClient) => {
					const aliasDelegate = (tx as typeof app.prisma).projectSlugAlias as
						| typeof app.prisma.projectSlugAlias
						| undefined;

					if (wantsSlugChange && nextSlugRaw) {
						const existingProject = await tx.project.findFirst({
							where: { slug: nextSlugRaw, orgId },
							select: { id: true },
						});
						if (existingProject && existingProject.id !== project.id) {
							throw app.httpErrors.badRequest(
								'Project slug is already in use in this organization',
							);
						}

						if (aliasDelegate) {
							const existingAlias = await aliasDelegate.findUnique({
								where: { slug: nextSlugRaw },
								select: { projectId: true },
							});
							if (existingAlias && existingAlias.projectId !== project.id) {
								throw app.httpErrors.badRequest(
									'Project slug is already in use in this organization',
								);
							}

							if (existingAlias && existingAlias.projectId === project.id) {
								await aliasDelegate.delete({
									where: { slug: nextSlugRaw },
								});
							}

							await aliasDelegate.createMany({
								data: [{ projectId: project.id, slug: project.slug }],
								skipDuplicates: true,
							});
						}
					}

					return tx.project.update({
						where: { id: project.id },
						data: {
							...(nextName ? { name: nextName } : {}),
							...(wantsSlugChange && nextSlugRaw ? { slug: nextSlugRaw } : {}),
						},
						select: {
							id: true,
							name: true,
							slug: true,
							createdAt: true,
							updatedAt: true,
						},
					});
				},
			);

			return updated;
		} catch (err) {
			if (
				err &&
				typeof err === 'object' &&
				'code' in err &&
				(err as { code?: string }).code === 'P2002'
			) {
				throw app.httpErrors.badRequest(
					'Project slug is already in use in this organization',
				);
			}
			throw err;
		}
	});

	// --- DELETE PROJECT ---
	app.delete('/projects/:projectId', async (req, reply) => {
		const { orgId } = getAuth(req);
		const { projectId } = ProjectParams.parse(req.params);

		// Ensure the project exists + belongs to this org
		const project = await requireProjectForOrg(app, projectId, orgId);

		// Delete the project (cascade will remove runs, test cases, results)
		await app.prisma.project.delete({
			where: { id: project.id },
		});

		return reply.code(204).send();
	});
};
