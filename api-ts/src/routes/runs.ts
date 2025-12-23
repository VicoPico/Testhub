// src/routes/runs.ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

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
	env: z.record(z.any()).optional(),
	meta: z.record(z.any()).optional(),
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
			meta: z.record(z.any()).optional(),
		})
	),
});

// Heuristic: Prisma cuid() looks like "cm..." and is fairly long.
// We don't need this to be perfect; it’s just to decide which query to try first.
function looksLikeId(value: string) {
	return value.length >= 12 && /^[a-z0-9]+$/i.test(value);
}

/**
 * Resolve a project from either:
 * - slug (e.g. "demo")
 * - db id (e.g. "cmjieokwu0003sb5ie7xi3xn2")
 *
 * Throws a 404 via httpErrors if not found.
 */
async function requireProject(app: any, projectIdOrSlug: string) {
	let project: { id: string; name: string; slug: string } | null = null;

	if (looksLikeId(projectIdOrSlug)) {
		project = await app.prisma.project.findUnique({
			where: { id: projectIdOrSlug },
			select: { id: true, name: true, slug: true },
		});
	}

	if (!project) {
		project = await app.prisma.project.findFirst({
			where: { slug: projectIdOrSlug },
			select: { id: true, name: true, slug: true },
		});
	}

	if (!project) {
		throw app.httpErrors.notFound('Project not found');
	}

	return project;
}

export const runRoutes: FastifyPluginAsync = async (app) => {
	// List runs
	app.get('/projects/:projectId/runs', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = ListRunsQuery.parse(req.query);

		const project = await requireProject(app, projectId);

		const where: any = { projectId: project.id };
		if (query.status) where.status = query.status;

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

		const project = await requireProject(app, projectId);

		const run = await app.prisma.testRun.findFirst({
			where: { id: runId, projectId: project.id },
			include: {
				project: { select: { id: true, name: true, slug: true } },
			},
		});

		if (!run) throw app.httpErrors.notFound('Run not found');
		return run;
	});

	// List results for a run
	app.get('/projects/:projectId/runs/:runId/results', async (req) => {
		const { projectId, runId } = RunIdParams.parse(req.params);

		const project = await requireProject(app, projectId);

		// ensure run belongs to project
		const run = await app.prisma.testRun.findFirst({
			where: { id: runId, projectId: project.id },
			select: { id: true },
		});
		if (!run) throw app.httpErrors.notFound('Run not found');

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
	app.post('/projects/:projectId/runs', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const body = CreateRunBody.parse(req.body);

		const project = await requireProject(app, projectId);

		const created = await app.prisma.testRun.create({
			data: {
				projectId: project.id,
				source: body.source ?? 'manual',
				commitSha: body.commitSha,
				branch: body.branch,
				env: body.env ?? undefined,
				meta: body.meta ?? undefined,
				status: 'QUEUED',
			},
			select: { id: true, createdAt: true, status: true, projectId: true },
		});

		return created;
	});

	// Batch results (upserts TestCase + inserts TestResult)
	app.post('/projects/:projectId/runs/:runId/results:batch', async (req) => {
		const { projectId, runId } = RunIdParams.parse(req.params);
		const body = BatchResultsBody.parse(req.body);

		const project = await requireProject(app, projectId);

		const run = await app.prisma.testRun.findFirst({
			where: { id: runId, projectId: project.id },
			select: { id: true },
		});
		if (!run) throw app.httpErrors.notFound('Run not found');

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
						meta: r.meta ?? undefined,
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
