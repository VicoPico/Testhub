import type { FastifyInstance } from 'fastify';

export type RequiredRun = {
	id: string;
	projectId: string;
	status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
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
};

/**
 * Fetch a run that belongs to a given project.
 * Throws a 404 if it does not exist (or does not belong to the project).
 */
export async function requireRun(
	app: FastifyInstance,
	projectId: string,
	runId: string
): Promise<RequiredRun> {
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
		},
	});

	if (!run) {
		throw app.httpErrors.notFound('Run not found');
	}

	return run;
}
