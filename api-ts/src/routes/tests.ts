import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { requireAuth, getAuth } from '../lib/requireAuth';
import { requireProjectForOrg } from '../lib/requireProjectForOrg';

const ProjectParams = z.object({
	projectId: z.string().min(1), // slug or db id
});

const TestCaseParams = z.object({
	projectId: z.string().min(1),
	testCaseId: z.string().min(1),
});

const ListTestsQuery = z.object({
	q: z.string().trim().min(1).optional(),
	suite: z.string().trim().min(1).optional(),
	status: z.enum(['PASSED', 'FAILED', 'SKIPPED', 'ERROR']).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(100),
});

const HistoryQuery = z.object({
	limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const testRoutes: FastifyPluginAsync = async (app) => {
	// Auth guard for *all* routes in this plugin
	app.addHook('preHandler', async (req) => {
		requireAuth(req);
	});

	// List test cases (with last-seen status)
	app.get('/projects/:projectId/tests', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = ListTestsQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const qLike = query.q ? `%${query.q}%` : undefined;
		const suiteLike = query.suite ? `%${query.suite}%` : undefined;

		const items = await app.prisma.$queryRaw<
			Array<{
				id: string;
				externalId: string;
				name: string;
				suiteName: string | null;
				filePath: string | null;
				tags: string[];
				createdAt: Date;
				lastStatus: string | null;
				lastSeenAt: Date | null;
			}>
		>(Prisma.sql`
			WITH latest AS (
				SELECT DISTINCT ON (tr."testCaseId")
					tr."testCaseId",
					tr.status,
					tr."createdAt" AS "lastSeenAt"
				FROM "TestResult" tr
				JOIN "TestRun" r ON r.id = tr."runId"
				WHERE r."projectId" = ${project.id}
				ORDER BY tr."testCaseId", tr."createdAt" DESC
			)
			SELECT
				tc.id,
				tc."externalId",
				tc.name,
				tc."suiteName",
				tc."filePath",
				tc.tags,
				tc."createdAt",
				latest.status AS "lastStatus",
				latest."lastSeenAt" AS "lastSeenAt"
			FROM "TestCase" tc
			LEFT JOIN latest ON latest."testCaseId" = tc.id
			WHERE tc."projectId" = ${project.id}
				AND (${qLike}::text IS NULL OR tc.name ILIKE ${qLike} OR tc."externalId" ILIKE ${qLike})
				AND (${suiteLike}::text IS NULL OR COALESCE(tc."suiteName", '') ILIKE ${suiteLike})
				AND (${query.status ?? null}::text IS NULL OR latest.status = ${query.status ?? null})
			ORDER BY COALESCE(latest."lastSeenAt", tc."createdAt") DESC
			LIMIT ${query.limit}
		`);

		return {
			items: items.map((r) => ({
				id: r.id,
				externalId: r.externalId,
				name: r.name,
				suiteName: r.suiteName,
				filePath: r.filePath,
				tags: r.tags,
				createdAt: r.createdAt.toISOString(),
				lastStatus: r.lastStatus,
				lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
			})),
		};
	});

	// Execution history for a single test case
	app.get('/projects/:projectId/tests/:testCaseId/history', async (req) => {
		const { projectId, testCaseId } = TestCaseParams.parse(req.params);
		const query = HistoryQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		// Ensure testCase belongs to the project
		const testCase = await app.prisma.testCase.findFirst({
			where: { id: testCaseId, projectId: project.id },
			select: { id: true },
		});
		if (!testCase) throw app.httpErrors.notFound('Test case not found');

		const results = await app.prisma.testResult.findMany({
			where: {
				testCaseId,
				run: { projectId: project.id },
			},
			orderBy: { createdAt: 'desc' },
			take: query.limit,
			select: {
				id: true,
				status: true,
				durationMs: true,
				createdAt: true,
				run: {
					select: {
						id: true,
						createdAt: true,
						status: true,
						branch: true,
						commitSha: true,
					},
				},
			},
		});

		return {
			items: results.map((r) => ({
				id: r.id,
				status: r.status,
				durationMs: r.durationMs ?? null,
				createdAt: r.createdAt.toISOString(),
				run: {
					id: r.run.id,
					createdAt: r.run.createdAt.toISOString(),
					status: r.run.status,
					branch: r.run.branch ?? null,
					commitSha: r.run.commitSha ?? null,
				},
			})),
		};
	});
};
