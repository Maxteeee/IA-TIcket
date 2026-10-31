import { API_URL } from '../config/api.js';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'HTTP_ERROR' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const cancellation = () => Object.assign(new Error('Solicitud cancelada'), { name: 'AbortError' });

export function createApiClient({ baseUrl = API_URL, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  return {
    async get(path, { signal } = {}) {
      if (!baseUrl) throw new ApiError('Configurá la dirección del servidor para cargar los eventos.', { code: 'CONFIGURATION' });
      if (signal?.aborted) throw cancellation();
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}${path}`, {
          headers: { Accept: 'application/json' }, signal: controller.signal,
        });
        let data;
        try {
          data = await response.json();
        } catch (error) {
          if (controller.signal.aborted) throw error;
          throw new ApiError('El servidor devolvió una respuesta inválida.', { status: response.status, code: 'INVALID_RESPONSE' });
        }
        if (signal?.aborted) throw cancellation();
        if (!response.ok) throw new ApiError(data?.message || 'No se pudo completar la consulta.', { status: response.status });
        return data;
      } catch (error) {
        if (signal?.aborted) throw cancellation();
        if (timedOut) throw new ApiError('El servidor tardó demasiado en responder. Volvé a intentar.', { code: 'TIMEOUT' });
        if (error instanceof TypeError) {
          throw new ApiError('No se pudo conectar al servidor. Revisá la conexión y volvé a intentar.', { code: 'NETWORK' });
        }
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    },
  };
}

export const apiClient = createApiClient();
