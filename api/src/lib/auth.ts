import crypto from 'crypto';
import argon2 from 'argon2';
import { env } from '../env.js';

export async function hashPassword(password: string) {
  return argon2.hash(password);
}

export async function verifyPassword(password: string, hash: string) {
  return argon2.verify(hash, password);
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function createSignedToken(payload: Record<string, unknown>, secret: string) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifySignedToken(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(body)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function createAccessToken(payload: Record<string, unknown>) {
  return createSignedToken(payload, env.JWT_SECRET);
}

export function createRefreshToken(payload: Record<string, unknown>) {
  return createSignedToken(payload, env.JWT_REFRESH_SECRET);
}

export function verifyAccessToken(token: string) {
  return verifySignedToken(token, env.JWT_SECRET);
}

export function verifyRefreshToken(token: string) {
  return verifySignedToken(token, env.JWT_REFRESH_SECRET);
}

export function getTokenSecret() {
  return env.JWT_SECRET;
}
