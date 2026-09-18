import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

export const CONFIG_USERNAME = "admin";
export const CONFIG_PASSWORD = "Fecoimp2026";

const COOKIE_NAME = "msa_config";
const SESSION_TTL_SECONDS = 12 * 60 * 60;

async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionValue() {
  const expires = String(Date.now() + SESSION_TTL_SECONDS * 1000);
  const signature = await hmacHex(CONFIG_PASSWORD, expires);
  return `${expires}.${signature}`;
}

export async function verifySessionValue(value: string | undefined) {
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) <= Date.now()) return false;
  const expected = await hmacHex(CONFIG_PASSWORD, expires);
  return signature === expected;
}

export function isHttps(c: Context) {
  return new URL(c.req.url).protocol === "https:";
}

export async function isAuthenticated(c: Context) {
  return verifySessionValue(getCookie(c, COOKIE_NAME));
}

export async function setSession(c: Context) {
  setCookie(c, COOKIE_NAME, await createSessionValue(), {
    httpOnly: true,
    path: "/config",
    sameSite: "Lax",
    secure: isHttps(c),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSession(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: "/config" });
}

export function sessionCookieHeader(setCookieHeader: string | null) {
  if (!setCookieHeader) return null;
  return setCookieHeader.split(",").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`)) ?? null;
}
