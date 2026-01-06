import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import { OpenAPIBackend } from 'openapi-backend';

type OpenApiSpec = {
	openapi: string;
	info: unknown;
	paths?: Record<string, Record<string, unknown>>;
};

function normalizeFastifyRoute(url: string) {
	// /projects/:projectId/runs/:runId -> /projects/{projectId}/runs/{runId}
	return url.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
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

function toPlainQuery(searchParams: URLSearchParams) {
	// Keep it simple for v1: last-value-wins for duplicate keys.
	const out: Record<string, string> = {};
	for (const [k, v] of searchParams.entries()) out[k] = v;
	return out;
}

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

	// Build OpenAPI validator/router
	const oas = new OpenAPIBackend({
		definition: spec as any,
		strict: false,
		validate: true,
	});
	await oas.init();

	// Collect actual registered routes reliably
	const registered = new Set<string>();

	app.addHook('onRoute', (route) => {
		const url = normalizeFastifyRoute(route.url);

		const methods = Array.isArray(route.method) ? route.method : [route.method];
		for (const m of methods) {
			const method = String(m).toUpperCase();
			if (!METHODS.has(method)) continue;
			if (method === 'HEAD') continue; // we don't list HEAD in OpenAPI
			registered.add(`${method} ${url}`);
		}
	});

	// Request validation against OpenAPI (params/query/body)
	// Note: we skip /docs + swagger assets.
	app.addHook('preValidation', async (req) => {
		// Skip swagger-ui + spec routes
		if (req.url.startsWith('/docs')) return;

		const method = req.method.toUpperCase();
		if (!METHODS.has(method) || method === 'HEAD') return;

		// Build a RequestObject for openapi-backend
		const fullUrl = new URL(req.url, 'http://localhost'); // base is irrelevant
		const requestObject = {
			method,
			path: fullUrl.pathname,
			query: toPlainQuery(fullUrl.searchParams),
			headers: req.headers as Record<string, any>,
			body: req.body as any,
		};

		// If this request doesn’t match an OpenAPI operation, don’t validate it here.
		// (Keeps this plugin from blocking any “internal” routes you add later.)
		try {
			oas.matchOperation(requestObject as any);
		} catch {
			return;
		}

		const validate = oas.validateRequest(requestObject as any);
		if (validate.errors && validate.errors.length) {
			throw app.httpErrors.badRequest('OpenAPI request validation failed', {
				errors: validate.errors,
			});
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
