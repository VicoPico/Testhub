// src/lib/requireRun.ts
import type { FastifyInstance } from 'fastify';
import type { RunStatus } from '@prisma/client';

export type RunRef = {
	id: string;
	projectId: string;
	status: RunStatus;
	createdAt: Date;
	source: string | null;
	branch: string | null;
	commitSha: string | null;
	startedAt: Date | null;
	finishedAt: Date | null;
	durationMs: number | null;
	totalCount: number;
	passedCount: number;
	failedCount: number;
	skippedCount: number;
	errorCount: number;
	createdByUserId: string | null;
};

export async function requireRun(
	app: FastifyInstance,
	projectId: string,
	runId: string
): Promise<RunRef> {
	const run = await app.prisma.testRun.findFirst({
		where: { id: runId, projectId },
		select: {
			id: true,
			projectId: true,
			status: true,
			createdAt: true,
			source: true,
			branch: true,
			commitSha: true,
			startedAt: true,
			finishedAt: true,
			durationMs: true,
			totalCount: true,
			passedCount: true,
			failedCount: true,
			skippedCount: true,
			errorCount: true,
			createdByUserId: true,
		},
	});

	if (!run) throw app.httpErrors.notFound('Run not found');
	return run;
}
