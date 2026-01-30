import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import { OpenAPIBackend } from 'openapi-backend';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

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
	// last-value-wins for duplicate keys (fine for v1)
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

	// Build OpenAPI validator/router (OpenAPIBackend uses Ajv internally)
	const oas = new OpenAPIBackend({
		definition: spec as any,
		strict: false,
		validate: true,

		// Make Ajv understand format: date-time, etc.
		// (This is what stops the “unknown format "date-time" ignored” warnings.)
		// Also keep strict:false to avoid noisy schema warnings during early development.
		customizeAjv: (ajvInstance: Ajv) => {
			addFormats(ajvInstance);
			return ajvInstance;
		},

		// If you ever want stricter behavior later:
		// ajvOpts: { allErrors: true, coerceTypes: true, strict: false },
	} as any);

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
		if (req.url.startsWith('/docs')) return;
		if (req.url.startsWith('/auth')) return;

		const method = req.method.toUpperCase();
		if (!METHODS.has(method) || method === 'HEAD') return;

		const fullUrl = new URL(req.url, 'http://localhost'); // base irrelevant
		const requestObject = {
			method,
			path: fullUrl.pathname,
			query: toPlainQuery(fullUrl.searchParams),
			headers: req.headers as Record<string, any>,
			body: req.body as any,
		};

		// If no matching OpenAPI operation, don't block the request.
		const match = oas.matchOperation(requestObject as any);
		if (!match || !(match as any).operation) return;

		const result = oas.validateRequest(requestObject as any);
		if (result?.errors?.length) {
			throw app.httpErrors.badRequest('OpenAPI request validation failed', {
				errors: result.errors,
			});
		}
	});
});
