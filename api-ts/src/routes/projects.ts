import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
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
				},
			});

			// OpenAPI says 201 Created
			return reply.code(201).send(project);
		} catch (err) {
			if (
				err instanceof Prisma.PrismaClientKnownRequestError &&
				err.code === 'P2002'
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
			},
		});

		return project;
	});

	// --- UPDATE PROJECT ---
	app.patch('/projects/:projectId', async (req) => {
		const { orgId } = getAuth(req);
		const { projectId } = ProjectParams.parse(req.params);
		const body = UpdateProjectBody.parse(req.body);

		const project = await requireProjectForOrg(app, projectId, orgId);

		try {
			const updated = await app.prisma.project.update({
				where: { id: project.id },
				data: body,
				select: {
					id: true,
					name: true,
					slug: true,
					createdAt: true,
				},
			});

			return updated;
		} catch (err) {
			if (
				err instanceof Prisma.PrismaClientKnownRequestError &&
				err.code === 'P2002'
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
