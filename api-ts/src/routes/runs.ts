import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireRun } from '../lib/requireRun';
import { requireAuth, getAuth } from '../lib/requireAuth';
import { requireProjectForOrg } from '../lib/requireProjectForOrg';

const ProjectParams = z.object({
	projectId: z.string().min(1), // slug or db id
});

const RunIdParams = z.object({
	projectId: z.string().min(1), // slug or db id
	runId: z.string().min(1),
});

const ListRunsQuery = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	cursor: z.string().optional(),
	status: z
		.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED'])
		.optional(),
});

const CreateRunBody = z.object({
	source: z.string().optional(),
	commitSha: z.string().optional(),
	branch: z.string().optional(),
	env: z.record(z.string(), z.unknown()).optional(),
	meta: z.record(z.string(), z.unknown()).optional(),
});

const BatchResultsBody = z.object({
	results: z.array(
		z.object({
			externalId: z.string().min(1),
			name: z.string().min(1),
			status: z.enum(['PASSED', 'FAILED', 'SKIPPED', 'ERROR']),
			durationMs: z.number().int().min(0).optional(),
			message: z.string().optional(),
			stacktrace: z.string().optional(),
			stdout: z.string().optional(),
			stderr: z.string().optional(),
			filePath: z.string().optional(),
			suiteName: z.string().optional(),
			tags: z.array(z.string()).optional(),
			meta: z.record(z.string(), z.unknown()).optional(),
		})
	),
});

export const runRoutes: FastifyPluginAsync = async (app) => {
	// Auth guard for *all* routes in this plugin
	app.addHook('preHandler', async (req) => {
		requireAuth(req);
	});

	// List runs
	app.get('/projects/:projectId/runs', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = ListRunsQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const where: Prisma.TestRunWhereInput = {
			projectId: project.id,
			...(query.status ? { status: query.status } : {}),
		};

		const runs = await app.prisma.testRun.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			take: query.limit,
			...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
			select: {
				id: true,
				createdAt: true,
				status: true,
				source: true,
				commitSha: true,
				branch: true,
				startedAt: true,
				finishedAt: true,
				durationMs: true,
				totalCount: true,
				passedCount: true,
				failedCount: true,
				skippedCount: true,
				errorCount: true,
			},
		});

		const nextCursor =
			runs.length === query.limit ? runs[runs.length - 1]?.id : null;

		return { items: runs, nextCursor };
	});

	// Run details
	app.get('/projects/:projectId/runs/:runId', async (req) => {
		const { projectId, runId } = RunIdParams.parse(req.params);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		return requireRun(app, project.id, runId);
	});

	// List results for a run
	app.get('/projects/:projectId/runs/:runId/results', async (req) => {
		const { projectId, runId } = RunIdParams.parse(req.params);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		// Ensure run belongs to project (throws 404 if not)
		await requireRun(app, project.id, runId);

		const results = await app.prisma.testResult.findMany({
			where: { runId },
			orderBy: { createdAt: 'asc' },
			select: {
				id: true,
				status: true,
				durationMs: true,
				message: true,
				createdAt: true,
				testCase: {
					select: {
						id: true,
						externalId: true,
						name: true,
						suiteName: true,
						tags: true,
					},
				},
			},
		});

		return { items: results };
	});

	// Create run
	app.post('/projects/:projectId/runs', async (req, reply) => {
		const { projectId } = ProjectParams.parse(req.params);
		const body = CreateRunBody.parse(req.body);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const created = await app.prisma.testRun.create({
			data: {
				projectId: project.id,
				source: body.source ?? 'manual',
				commitSha: body.commitSha,
				branch: body.branch,
				env: body.env as Prisma.InputJsonValue | undefined,
				meta: body.meta as Prisma.InputJsonValue | undefined,
				status: 'QUEUED',
			},
			select: { id: true, createdAt: true, status: true, projectId: true },
		});

		return reply.code(201).send(created);
	});

	// Batch results (upserts TestCase + inserts TestResult)
	app.post('/projects/:projectId/runs/:runId/results/batch', async (req) => {
		const { projectId, runId } = RunIdParams.parse(req.params);
		const body = BatchResultsBody.parse(req.body);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		await requireRun(app, project.id, runId);

		const created = await app.prisma.$transaction(async (tx) => {
			let passed = 0,
				failed = 0,
				skipped = 0,
				error = 0;

			for (const r of body.results) {
				const tc = await tx.testCase.upsert({
					where: {
						projectId_externalId: {
							projectId: project.id,
							externalId: r.externalId,
						},
					},
					update: {
						name: r.name,
						filePath: r.filePath,
						suiteName: r.suiteName,
						...(r.tags ? { tags: r.tags } : {}),
					},
					create: {
						projectId: project.id,
						externalId: r.externalId,
						name: r.name,
						filePath: r.filePath,
						suiteName: r.suiteName,
						tags: r.tags ?? [],
					},
					select: { id: true },
				});

				await tx.testResult.create({
					data: {
						runId,
						testCaseId: tc.id,
						status: r.status,
						durationMs: r.durationMs,
						message: r.message,
						stacktrace: r.stacktrace,
						stdout: r.stdout,
						stderr: r.stderr,
						meta: (r.meta ?? undefined) as Prisma.InputJsonValue | undefined,
					},
				});

				if (r.status === 'PASSED') passed++;
				else if (r.status === 'FAILED') failed++;
				else if (r.status === 'SKIPPED') skipped++;
				else error++;
			}

			const total = passed + failed + skipped + error;

			await tx.testRun.update({
				where: { id: runId },
				data: {
					totalCount: total,
					passedCount: passed,
					failedCount: failed,
					skippedCount: skipped,
					errorCount: error,
				},
			});

			return { inserted: body.results.length };
		});

		return created;
	});
};
