import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { sha256Hex } from './apiKey';

export async function hashPassword(password: string): Promise<string> {
	return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return argon2.verify(hash, password);
}

export function generateToken(): string {
	return randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
	return sha256Hex(raw);
}
