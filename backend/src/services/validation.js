import { DomainError } from '../domain/DomainError.js';

export function fields(data, allowed, required = []) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new DomainError('El cuerpo debe ser un objeto JSON');
  }
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new DomainError(`Campos permitidos: ${allowed.join(', ')}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(data, key)) throw new DomainError(`Falta el campo ${key}`);
  }
  return data;
}

export function text(value, field, max = 100, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.trim().length > max) {
    throw new DomainError(`${field} debe ser un texto de ${allowEmpty ? 0 : 1} a ${max} caracteres`);
  }
  return value.trim();
}

export function number(value, field, { integer = false, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max
    || (integer && !Number.isSafeInteger(value))) {
    throw new DomainError(`${field} debe ser un número ${integer ? 'entero ' : ''}entre ${min} y ${max}`);
  }
  return value;
}

export function date(value, field) {
  // Exigir zona evita que el mismo contrato se interprete distinto en cada servidor.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new DomainError(`${field} debe ser una fecha ISO con zona horaria`);
  }
  const result = new Date(value);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(result.getTime()) || !Number.isFinite(calendar.getTime())
    || calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    throw new DomainError(`${field} debe ser una fecha válida`);
  }
  return result;
}

export function required(repository, id, label) {
  const entity = typeof id === 'string' && repository.findById(id);
  if (!entity) throw new DomainError(`${label} no encontrado`, 404);
  return entity;
}

export function actor(repositories, id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new DomainError('Indicá el usuario de prueba en X-Usuario-Id', 401);
  }
  return required(repositories.usuarios, id, 'Usuario');
}

export function authorize(condition, message = 'No tenés permiso para esta operación') {
  if (!condition) throw new DomainError(message, 403);
}

export function conflict(condition, message) {
  if (condition) throw new DomainError(message, 409);
}

export function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
