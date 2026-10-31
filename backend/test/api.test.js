import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createRepositories } from '../src/repositories/index.js';
import { seedReferenceData } from '../src/data/reference.js';

async function start(t) {
  let instant = new Date('2026-11-01T12:00:00Z');
  const repositories = seedReferenceData(createRepositories());
  const server = createApp({ repositories, now: () => new Date(instant) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { method = 'GET', body, usuario, status = 200, raw } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(usuario ? { 'X-Usuario-Id': usuario } : {}) },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const result = response.status === 204 ? null : await response.json();
    const expected = Array.isArray(status) ? status : [status];
    assert.ok(expected.includes(response.status), `${method} ${path}: HTTP ${response.status}, esperado ${expected}: ${JSON.stringify(result)}`);
    return result;
  };
  return { request, advance: (value) => { instant = new Date(value); } };
}

async function setup(t, cupo = 5) {
  const s = await start(t);
  const organizador = await s.request('/usuarios/organizador-1');
  const comprador = await s.request('/usuarios', { method: 'POST', body: { nombre: 'Luis', apellido: 'Gómez' }, status: 201 });
  const tercero = await s.request('/usuarios', { method: 'POST', body: { nombre: 'Otra', apellido: 'Persona' }, status: 201 });
  const categoria = await s.request('/categorias', { method: 'POST', body: { nombre: 'Música' }, status: 201 });
  const draft = {
    nombre: 'Concierto', descripcion: 'Música en vivo', categoriaId: categoria.id,
    fecha: '2026-11-03T20:00:00Z', fechaFin: '2026-11-03T23:00:00Z',
    tiposEntrada: [{ nombre: 'General', precio: 2500, cupo }],
  };
  const evento = await s.request('/eventos', { method: 'POST', body: draft, usuario: organizador.id, status: 201 });
  const input = { eventoId: evento.id, tipoEntradaId: evento.tiposEntrada[0].id, cantidad: 1 };
  const buy = () => s.request('/compras', { method: 'POST', body: input, usuario: comprador.id, status: 201 });
  return { ...s, organizador, comprador, tercero, categoria, draft, evento, input, buy };
}

test('HTTP: comprar, consultar ventas, confirmar y utilizar conserva cupo e historial serializable', async (t) => {
  const s = await setup(t);
  const compra = await s.buy();
  assert.equal(compra.estado, 'PENDIENTE');
  assert.equal(compra.total, 2500);
  assert.equal(compra.compradorId, s.comprador.id);
  assert.deepEqual(await s.request('/compras', { usuario: s.comprador.id }), [compra]);
  assert.deepEqual(await s.request(`/eventos/${s.evento.id}/compras`, { usuario: s.organizador.id }), [compra]);
  await s.request(`/compras/${compra.id}`, { usuario: s.tercero.id, status: 403 });
  await s.request(`/compras/${compra.id}/estado`, { method: 'PATCH', body: { estado: 'CONFIRMADA' }, usuario: s.comprador.id, status: 403 });
  const confirmed = await s.request(`/compras/${compra.id}/estado`, { method: 'PATCH', body: { estado: 'CONFIRMADA' }, usuario: s.organizador.id });
  assert.equal(confirmed.diasRestantes, 3);
  await s.request(`/compras/${compra.id}/estado`, { method: 'PATCH', body: { estado: 'UTILIZADA' }, usuario: s.organizador.id });
  const history = await s.request(`/compras/${compra.id}/historial`, { usuario: s.comprador.id });
  assert.deepEqual(history.map((cambio) => cambio.estado), ['PENDIENTE', 'CONFIRMADA', 'UTILIZADA']);
  assert.equal(history[0].compraId, compra.id);
  assert.equal(history[0].quienId, s.comprador.id);
  assert.equal(history[0].fechaHora, '2026-11-01T12:00:00.000Z');
  const evento = await s.request(`/eventos/${s.evento.id}`);
  assert.equal(evento.tiposEntrada[0].cupo, 4);
});

test('HTTP: dos compradores simultáneos no obtienen la última entrada', async (t) => {
  const s = await setup(t, 1);
  const attempt = () => s.request('/compras', { method: 'POST', body: s.input,
    usuario: s.comprador.id, status: [201, 409] });
  const results = await Promise.all([attempt(), attempt()]);
  assert.equal(results.filter((result) => result.id).length, 1);
  assert.equal(results.filter((result) => /cupo/.test(result.message)).length, 1);
  const compras = await s.request('/compras', { usuario: s.comprador.id });
  assert.equal(compras.length, 1);
  assert.equal((await s.request(`/eventos/${s.evento.id}`)).tiposEntrada[0].cupo, 0);
  const error = await s.request('/compras', { method: 'POST', body: s.input, usuario: s.comprador.id, status: 409 });
  assert.match(error.message, /cupo/);
});

test('HTTP: chat e historial privados, contenido validado y sin restricciones por fecha', async (t) => {
  const s = await setup(t);
  const compra = await s.buy();
  const path = `/compras/${compra.id}/mensajes`;
  await s.request(path, { method: 'POST', body: { mensaje: 'Hola' }, usuario: s.comprador.id, status: 201 });
  s.advance('2026-11-10T00:00:00Z');
  const reply = await s.request(path, { method: 'POST', body: { mensaje: 'Respuesta' }, usuario: s.organizador.id, status: 201 });
  assert.equal(reply.usuarioId, s.organizador.id);
  const mensajes = await s.request(path, { usuario: s.comprador.id });
  assert.deepEqual(mensajes.map((mensaje) => mensaje.mensaje), ['Hola', 'Respuesta']);
  await s.request(path, { usuario: s.tercero.id, status: 403 });
  await s.request(path, { method: 'POST', body: { mensaje: 'Intruso' }, usuario: s.tercero.id, status: 403 });
  await s.request(path, { method: 'POST', body: { mensaje: ' ' }, usuario: s.comprador.id, status: 400 });
  await s.request(`/compras/${compra.id}/historial`, { usuario: s.tercero.id, status: 403 });
});

test('HTTP: CRUD de reseñas y reputación respetan asistencia, finalización y autoría', async (t) => {
  const s = await setup(t);
  const compra = await s.buy();
  const body = { compraId: compra.id, puntuacion: 0, detalle: 'Mi experiencia' };
  await s.request('/resenias', { method: 'POST', body, usuario: s.comprador.id, status: 409 });
  await s.request(`/compras/${compra.id}/estado`, { method: 'PATCH', body: { estado: 'CONFIRMADA' }, usuario: s.organizador.id });
  await s.request(`/compras/${compra.id}/estado`, { method: 'PATCH', body: { estado: 'UTILIZADA' }, usuario: s.organizador.id });
  await s.request('/resenias', { method: 'POST', body, usuario: s.comprador.id, status: 409 });
  s.advance('2026-11-04T00:00:00Z');
  const review = await s.request('/resenias', { method: 'POST', body, usuario: s.comprador.id, status: 201 });
  assert.deepEqual(await s.request(`/resenias/${review.id}`), review);
  assert.deepEqual(await s.request(`/eventos/${s.evento.id}/resenias`), [review]);
  assert.equal((await s.request(`/usuarios/${s.organizador.id}/reputacion`)).puntaje, 0);
  await s.request(`/resenias/${review.id}`, { method: 'PATCH', body: { puntuacion: 5 }, usuario: s.tercero.id, status: 403 });
  await s.request(`/resenias/${review.id}`, { method: 'PATCH', body: { puntuacion: 4 }, usuario: s.comprador.id });
  assert.equal((await s.request(`/usuarios/${s.organizador.id}/reputacion`)).puntaje, 4);
  await s.request(`/resenias/${review.id}`, { method: 'DELETE', usuario: s.comprador.id, status: 204 });
  assert.equal((await s.request(`/usuarios/${s.organizador.id}/reputacion`)).puntaje, null);
});

test('HTTP: favoritos idempotentes, tipos embebidos y CRUD de eventos/categorías/usuarios', async (t) => {
  const s = await setup(t);
  const favorite = `/usuarios/${s.comprador.id}/favoritos/${s.evento.id}`;
  for (let i = 0; i < 2; i += 1) await s.request(favorite, { method: 'PUT', usuario: s.comprador.id });
  assert.equal((await s.request(`/usuarios/${s.comprador.id}/favoritos`, { usuario: s.comprador.id })).length, 1);
  await s.request(`/usuarios/${s.comprador.id}/favoritos`, { usuario: s.tercero.id, status: 403 });
  await s.request(`/eventos/${s.evento.id}`, { method: 'PATCH', body: { nombre: 'Cambio ajeno' }, usuario: s.tercero.id, status: 403 });
  const entry = await s.request(`/eventos/${s.evento.id}/tipos-entrada`, { method: 'POST',
    body: { nombre: 'VIP', precio: 5000, cupo: 3 }, usuario: s.organizador.id, status: 201 });
  const ticketPath = `/eventos/${s.evento.id}/tipos-entrada/${entry.id}`;
  assert.deepEqual(await s.request(ticketPath), entry);
  await s.request(ticketPath, { method: 'PATCH', body: { precio: 6000 }, usuario: s.organizador.id });
  assert.equal((await s.request(`/eventos/${s.evento.id}`)).rangoPrecios.max, 6000);
  await s.request(ticketPath, { method: 'DELETE', usuario: s.organizador.id, status: 204 });
  await s.request(`/categorias/${s.categoria.id}`, { method: 'DELETE', status: 409 });
  await s.request(`/categorias/${s.categoria.id}`, { method: 'PATCH', body: { nombre: 'Recitales' } });
  await s.request(`/eventos/${s.evento.id}`, { method: 'PATCH', body: { nombre: 'Otro nombre' }, usuario: s.organizador.id });
  await s.request(`/eventos/${s.evento.id}`, { method: 'DELETE', usuario: s.organizador.id, status: 204 });
  assert.deepEqual(await s.request(`/usuarios/${s.comprador.id}/favoritos`, { usuario: s.comprador.id }), []);
  await s.request(`/categorias/${s.categoria.id}`, { method: 'DELETE', status: 204 });
  await s.request(`/usuarios/${s.comprador.id}`, { method: 'PATCH', body: { nombre: 'Nuevo' }, usuario: s.comprador.id });
  await s.request(`/usuarios/${s.comprador.id}`, { method: 'DELETE', usuario: s.comprador.id, status: 204 });
  await s.request(`/usuarios/${s.comprador.id}`, { status: 404 });
});

test('HTTP: validación, JSON inválido, límites, identidad ausente y referencias inexistentes', async (t) => {
  const s = await setup(t);
  assert.equal((await s.request('/health')).status, 'ok');
  await s.request('/compras', { status: 401 });
  await s.request('/compras', { method: 'POST', body: { ...s.input, total: 0 }, usuario: s.comprador.id, status: 400 });
  await s.request('/eventos', { method: 'POST', body: { ...s.draft, categoriaId: 'no-existe' }, usuario: s.organizador.id, status: 404 });
  await s.request('/usuarios', { method: 'POST', raw: '{invalido', status: 400 });
  await s.request('/usuarios', { method: 'POST', raw: '[]', status: 400 });
  await s.request('/usuarios', { method: 'POST', body: { nombre: 'a'.repeat(110000), apellido: 'Prueba' }, status: 413 });
  await s.request('/eventos?q=a&q=b', { status: 400 });
  await s.request('/eventos?orden=desconocido', { status: 400 });
  await s.request('/no-existe', { status: 404 });
});
