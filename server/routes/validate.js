// Tiny input helpers (no validation library needed yet).

export function requireText(value, field, max = 500) {
  if (typeof value !== "string" || !value.trim()) throw badRequest(`${field} is required`);
  if (value.length > max) throw badRequest(`${field} is too long (max ${max})`);
  return value.trim();
}

export function optionalText(value, field, max = 20000) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest(`${field} must be text`);
  if (value.length > max) throw badRequest(`${field} is too long (max ${max})`);
  return value;
}

export function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(", ")}`);
  return value;
}

export function toId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export const now = () => new Date().toISOString();
