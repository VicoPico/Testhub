import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

type OpenApiSpec = {
	openapi: string;
	info: unknown;
	paths?: Record<string, Record<string, unknown>>;
};

function normalizeFastifyRoute(url: string) {
	// Fastify treats "results:batch" as "results" + ":batch" (a param), but in our API it's a literal suffix.
	// Preserve it as a literal so it matches OpenAPI.
	const sentinel = '__LITERAL_COLON_BATCH__';
	let u = url.replace('results:batch', `results${sentinel}`);

	// /projects/:projectId/runs/:runId -> /projects/{projectId}/runs/{runId}
	u = u.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

	return u.replace(`results${sentinel}`, 'results:batch');
}

const METHODS = new Set([
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
]);

export const openapiContractPlugin: FastifyPluginAsync = fp(async (app) => {
	// Load contracts/openapi.yaml (repo root)
	const specPath = path.resolve(process.cwd(), '../contracts/openapi.yaml');
	const raw = await fs.readFile(specPath, 'utf8');
	const spec = YAML.parse(raw) as OpenApiSpec;

	// Serve docs from the contract (docs match what you lint/bundle)
	await app.register(swagger, { openapi: spec as any });
	await app.register(swaggerUi, {
		routePrefix: '/docs',
		uiConfig: {
			docExpansion: 'list',
			deepLinking: true,
			persistAuthorization: true,
		},
	});

	// Collect actual registered routes reliably
	const registered = new Set<string>();

	app.addHook('onRoute', (route) => {
		const url = normalizeFastifyRoute(route.url);

		const methods = Array.isArray(route.method) ? route.method : [route.method];
		for (const m of methods) {
			const method = String(m).toUpperCase();
			if (!METHODS.has(method)) continue;
			if (method === 'HEAD') continue; // OpenAPI usually doesn't list HEAD explicitly
			registered.add(`${method} ${url}`);
		}
	});

	// Contract check: ensure every spec operation exists in Fastify
	app.addHook('onReady', async () => {
		const missing: string[] = [];

		for (const [p, ops] of Object.entries(spec.paths ?? {})) {
			for (const [maybeMethod] of Object.entries(ops ?? {})) {
				const method = maybeMethod.toUpperCase();
				if (!METHODS.has(method)) continue;
				if (method === 'HEAD') continue;

				const key = `${method} ${p}`;
				if (!registered.has(key)) missing.push(key);
			}
		}

		if (missing.length) {
			app.log.error(
				{ missing, sample: Array.from(registered).slice(0, 25) },
				'OpenAPI contract drift: operations exist in contracts/openapi.yaml but are not implemented by the server'
			);
			throw new Error(
				`OpenAPI contract drift (missing routes):\n${missing.join('\n')}`
			);
		}

		app.log.info({ count: registered.size }, 'OpenAPI contract check passed');
	});
});
