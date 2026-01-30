import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { requireAuth, getAuth } from '../lib/requireAuth';
import { requireProjectForOrg } from '../lib/requireProjectForOrg';

const ProjectParams = z.object({
	projectId: z.string().min(1), // slug or db id
});

const SearchQuery = z.object({
	q: z.string().trim().min(1),
	limit: z.coerce.number().int().min(1).max(25).default(5),
});

export const searchRoutes: FastifyPluginAsync = async (app) => {
	// Auth guard for *all* routes in this plugin
	app.addHook('preHandler', async (req) => {
		requireAuth(req);
	});

	// Project-scoped search (tests + runs)
	app.get('/projects/:projectId/search', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = SearchQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const qLike = `%${query.q}%`;
		const qExact = query.q;
		const qUpper = query.q.toUpperCase();
		const statusMatch = [
			'QUEUED',
			'RUNNING',
			'COMPLETED',
			'FAILED',
			'CANCELED',
		].includes(qUpper)
			? qUpper
			: undefined;

		const tests = await app.prisma.$queryRaw<
			Array<{
				id: string;
				externalId: string;
				name: string;
				suiteName: string | null;
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
				latest.status AS "lastStatus",
				latest."lastSeenAt" AS "lastSeenAt"
			FROM "TestCase" tc
			LEFT JOIN latest ON latest."testCaseId" = tc.id
			WHERE tc."projectId" = ${project.id}
				AND (
					tc.name ILIKE ${qLike}
					OR tc."externalId" ILIKE ${qLike}
					OR tc.tags @> ARRAY[${qExact}]::text[]
					OR array_to_string(tc.tags, ',') ILIKE ${qLike}
					OR COALESCE(tc."suiteName", '') ILIKE ${qLike}
				)
			ORDER BY COALESCE(latest."lastSeenAt", tc."createdAt") DESC
			LIMIT ${query.limit}
		`);

		const runs = await app.prisma.testRun.findMany({
			where: {
				projectId: project.id,
				OR: [
					{ id: { contains: query.q, mode: 'insensitive' } },
					{ branch: { contains: query.q, mode: 'insensitive' } },
					{ commitSha: { contains: query.q, mode: 'insensitive' } },
					{ source: { contains: query.q, mode: 'insensitive' } },
					...(statusMatch ? [{ status: statusMatch as any }] : []),
				],
			},
			orderBy: { createdAt: 'desc' },
			take: query.limit,
			select: {
				id: true,
				createdAt: true,
				status: true,
				branch: true,
				commitSha: true,
			},
		});

		return {
			tests: tests.map((t) => ({
				id: t.id,
				externalId: t.externalId,
				name: t.name,
				suiteName: t.suiteName,
				lastStatus: t.lastStatus,
				lastSeenAt: t.lastSeenAt ? t.lastSeenAt.toISOString() : null,
			})),
			runs: runs.map((r) => ({
				id: r.id,
				createdAt: r.createdAt.toISOString(),
				status: r.status,
				branch: r.branch ?? null,
				commitSha: r.commitSha ?? null,
			})),
		};
	});
};
