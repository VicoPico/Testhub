import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireAuth, getAuth } from '../lib/requireAuth';
import { requireProjectForOrg } from '../lib/requireProjectForOrg';

const ProjectParams = z.object({
	projectId: z.string().min(1), // slug or db id
});

const DaysQuery = z.object({
	days: z.coerce.number().int().min(1).max(90).default(7),
});

const DaysLimitQuery = DaysQuery.extend({
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

function cutoffDate(days: number) {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export const analyticsRoutes: FastifyPluginAsync = async (app) => {
	app.addHook('preHandler', async (req) => {
		requireAuth(req);
	});

	app.get('/projects/:projectId/analytics/timeseries', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = DaysQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const cutoff = cutoffDate(query.days);
		const startDaysAgo = query.days - 1;

		type Row = {
			day: string;
			passedcount: number;
			failedcount: number;
			skippedcount: number;
			errorcount: number;
			totalcount: number;
		};

		const rows = await app.prisma.$queryRaw<Row[]>`
			WITH days AS (
				SELECT generate_series(
					date_trunc('day', now()) - (${startDaysAgo} * interval '1 day'),
					date_trunc('day', now()),
					interval '1 day'
				) AS day
			), filtered AS (
				SELECT tr.status, tr."createdAt" AS created_at
				FROM "TestResult" tr
				JOIN "TestRun" r ON r.id = tr."runId"
				WHERE r."projectId" = ${project.id}
				  AND tr."createdAt" >= ${cutoff}
			)
			SELECT
				to_char(d.day::date, 'YYYY-MM-DD') AS day,
				COALESCE(SUM(CASE WHEN f.status = 'PASSED' THEN 1 ELSE 0 END), 0)::int AS passedCount,
				COALESCE(SUM(CASE WHEN f.status = 'FAILED' THEN 1 ELSE 0 END), 0)::int AS failedCount,
				COALESCE(SUM(CASE WHEN f.status = 'SKIPPED' THEN 1 ELSE 0 END), 0)::int AS skippedCount,
				COALESCE(SUM(CASE WHEN f.status = 'ERROR' THEN 1 ELSE 0 END), 0)::int AS errorCount,
				COALESCE(COUNT(f.status), 0)::int AS totalCount
			FROM days d
			LEFT JOIN filtered f ON date_trunc('day', f.created_at) = d.day
			GROUP BY d.day
			ORDER BY d.day ASC;
		`;

		return {
			days: query.days,
			items: rows.map((r) => ({
				day: r.day,
				passedCount: r.passedcount,
				failedCount: r.failedcount,
				skippedCount: r.skippedcount,
				errorCount: r.errorcount,
				totalCount: r.totalcount,
			})),
		};
	});

	app.get('/projects/:projectId/analytics/slowest-tests', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = DaysLimitQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const cutoff = cutoffDate(query.days);

		type Row = {
			testcaseid: string;
			name: string;
			externalid: string;
			suitename: string | null;
			avgdurationms: number;
			maxdurationms: number;
			samplescount: number;
		};

		const rows = await app.prisma.$queryRaw<Row[]>`
			WITH filtered AS (
				SELECT
					tr."testCaseId" AS testCaseId,
					tr."durationMs" AS durationMs,
					tc.name AS name,
					tc."externalId" AS externalId,
					tc."suiteName" AS suiteName
				FROM "TestResult" tr
				JOIN "TestRun" r ON r.id = tr."runId"
				JOIN "TestCase" tc ON tc.id = tr."testCaseId"
				WHERE r."projectId" = ${project.id}
				  AND tr."createdAt" >= ${cutoff}
				  AND tr."durationMs" IS NOT NULL
			)
			SELECT
				f.testCaseId AS testCaseId,
				MIN(f.name) AS name,
				MIN(f.externalId) AS externalId,
				MIN(f.suiteName) AS suiteName,
				AVG(f.durationMs)::int AS avgDurationMs,
				MAX(f.durationMs)::int AS maxDurationMs,
				COUNT(*)::int AS samplesCount
			FROM filtered f
			GROUP BY f.testCaseId
			ORDER BY AVG(f.durationMs) DESC NULLS LAST
			LIMIT ${query.limit};
		`;

		return {
			days: query.days,
			items: rows.map((r) => ({
				testCaseId: r.testcaseid,
				name: r.name,
				externalId: r.externalid,
				suiteName: r.suitename,
				avgDurationMs: r.avgdurationms,
				maxDurationMs: r.maxdurationms,
				samplesCount: r.samplescount,
			})),
		};
	});

	app.get('/projects/:projectId/analytics/most-failing-tests', async (req) => {
		const { projectId } = ProjectParams.parse(req.params);
		const query = DaysLimitQuery.parse(req.query);

		const { orgId } = getAuth(req);
		const project = await requireProjectForOrg(app, projectId, orgId);

		const cutoff = cutoffDate(query.days);

		type Row = {
			testcaseid: string;
			name: string;
			externalid: string;
			suitename: string | null;
			failedcount: number;
			errorcount: number;
			totalcount: number;
		};

		const rows = await app.prisma.$queryRaw<Row[]>`
			SELECT
				tc.id AS testCaseId,
				tc.name AS name,
				tc."externalId" AS externalId,
				tc."suiteName" AS suiteName,
				SUM(CASE WHEN tr.status = 'FAILED' THEN 1 ELSE 0 END)::int AS failedCount,
				SUM(CASE WHEN tr.status = 'ERROR' THEN 1 ELSE 0 END)::int AS errorCount,
				COUNT(*)::int AS totalCount
			FROM "TestResult" tr
			JOIN "TestRun" r ON r.id = tr."runId"
			JOIN "TestCase" tc ON tc.id = tr."testCaseId"
			WHERE r."projectId" = ${project.id}
			  AND tr."createdAt" >= ${cutoff}
			GROUP BY tc.id
			HAVING COUNT(*) > 0
			ORDER BY (SUM(CASE WHEN tr.status IN ('FAILED','ERROR') THEN 1 ELSE 0 END)) DESC
			LIMIT ${query.limit};
		`;

		return {
			days: query.days,
			items: rows.map((r) => ({
				testCaseId: r.testcaseid,
				name: r.name,
				externalId: r.externalid,
				suiteName: r.suitename,
				failedCount: r.failedcount,
				errorCount: r.errorcount,
				totalCount: r.totalcount,
			})),
		};
	});
};
