# Backend de entradas

API Express en JavaScript, con almacenamiento en memoria. Desde la raíz: `npm install`, `npm run backend`. Las colecciones comienzan vacías y se pierden al reiniciar el proceso. El frontend ya consulta esta API para C3/C11 (catálogo, búsqueda, categorías, ordenamiento y detalle); los demás recorridos conservan la maqueta local.

## Catálogo de prueba para C3/C11

`npm run backend:demo` desde la raíz inicia el servidor con categorías y eventos de prueba del propio backend. También puede activarse con `SEED_DEMO=true` en backend/.env. El arranque normal sigue vacío por defecto; createApp no incorpora datos implícitos y las pruebas conservan instancias aisladas.

`src/data/demo.js` carga cinco categorías y siete eventos (cinco futuros y dos pasados), con fechas relativas y tipos de entrada. Usa IDs estables, conserva referencias canónicas y no sobrescribe registros existentes. Todos los datos siguen siendo temporales en memoria. Incluye tres organizadores: Equipo Encuentro con promedio 4,5 de dos reseñas; Compañía Umbral con una reseña de 0; Red Abierta sin reseñas. Las tres reseñas históricas se vinculan con compras utilizadas de los eventos pasados; permiten probar C11 sin integrar todavía C9. No usa fixtures del frontend ni incorpora autenticación, pagos o creación de eventos desde la app (C4 sigue pendiente de integración).

El listado y el detalle de eventos agregan resúmenes `categoria: {id, nombre, descripcion}` y `organizador: {id, nombre, apellido, puntaje, cantidadResenias}` a sus DTOs, conservando `categoriaId` y `organizadorId`. Así la pantalla muestra nombres reales sin consultar todos los usuarios ni inventar asociaciones por nombre. `puntaje` es el promedio de todas las reseñas recibidas por ese organizador, o null si no tiene; `cantidadResenias` es el conteo real. El servicio utiliza la misma regla para ordenar y para construir estos datos, sin almacenar un promedio que pueda quedar desactualizado.

## Organización y análisis del dominio

```text
src/
├── routes/          Método y URL → controlador
├── controllers/     Entrada HTTP, invocación del servicio y respuesta DTO
├── services/        Casos de uso, validación de contratos, permisos y coordinación
├── domain/          Entidades, relaciones y reglas; independiente de Express
├── repositories/    Identidad, guardado y consultas en memoria
├── http/            DTOs explícitos de respuesta, sin referencias circulares
├── app.js           Ensambla repositorios, servicios, controladores y rutas
└── server.js        Abre el puerto
```

Cada recurso principal tiene archivos `*.routes.js`, `*.controller.js`, `*.service.js` y `*.repository.js`. Las clases que estaban en `models/` ahora están en `domain/`. Los servicios no importan Express; los controladores no acceden directamente a repositorios.

| Elemento | Organización | Motivo |
| --- | --- | --- |
| Usuario | Entidad y repositorio propios | La misma persona puede comprar y organizar; no se necesitan clases ni roles exclusivos |
| Categoría | Entidad y repositorio propios | Es compartida por varios eventos |
| Evento | Entidad raíz y repositorio propio | Gestiona sus tipos de entrada y multimedia |
| TipoEntrada | Entidad embebida en Evento, con ID | No existe fuera del evento. Se administra mediante rutas anidadas y el servicio de eventos |
| Compra | Entidad raíz y repositorio propio | Vincula comprador, evento y uno de sus tipos; contiene cantidad, total, estado, chat e historial |
| Mensaje | Entidad embebida en Compra, con ID | Se agrega y consulta por compra. No tiene CRUD ni repositorio global |
| CambioEstadoCompra | Entidad embebida en Compra, con ID | Registro automático e inmutable desde la API. Solo se consulta |
| EstadoCompra | Enum | No necesita repositorio ni CRUD; no es una entidad |
| Reseña | Entidad y repositorio propios | Se consulta por evento y por organizador entre varios eventos. Vinculada con la compra que acredita asistencia |
| Favoritos | Relación Usuario → Evento | Se modifica desde el usuario; no requiere otra entidad |
| Multimedia | Colección de referencias dentro del evento | No hay carga de archivos ni ciclo de vida independiente |

Los repositorios conservan referencias canónicas para mantener la comparación por identidad del dominio existente. Sus métodos devuelven objetos de dominio para uso interno de los servicios. Los DTOs HTTP exponen IDs en las asociaciones, copian las colecciones y evitan ciclos como `Compra.historial → CambioEstadoCompra.compra`.

No se crean entradas individuales: el estado de la compra se aplica a toda su cantidad, según la decisión existente. Tampoco se agregan entidades para búsquedas, filtros, roles o pagos.

## Identidad de prueba

Las operaciones personales usan `X-Usuario-Id: <id devuelto al crear usuario>`. Los servicios resuelven ese ID al usuario almacenado y verifican que sea comprador, organizador o autor según corresponda. El autor de mensajes, comprador y organizador de eventos se derivan de esa identidad; no se aceptan como campos del cuerpo.

Este encabezado es un mecanismo de identidad para desarrollo local, **no autenticación**: cualquier cliente puede elegir otro ID. No se implementaron login, contraseñas ni sesiones. El catálogo, perfiles básicos, categorías y reseñas se consultan públicamente. La creación de usuarios y gestión de categorías son abiertas, sin un rol de administrador inventado.

## Endpoints

Todas las rutas siguientes llevan prefijo `/api`. `PATCH` modifica únicamente los campos enviados. Creación: `201`; consulta/edición: `200`; borrado: `204`. Errores: `{ "message": "..." }`, con `400` por datos inválidos, `401` por identidad ausente, `403` por falta de permiso, `404` por referencia/ruta inexistente, `409` por conflicto de negocio y `413` por cuerpo mayor a 100 KB. Los campos desconocidos en cuerpos de recursos se rechazan para evitar sobrescribir IDs, relaciones, total o estado.

| Método | Ruta | Operación |
| --- | --- | --- |
| GET, POST | `/usuarios` | Listar/crear perfiles |
| GET, PATCH, DELETE | `/usuarios/:id` | Consultar/editar/borrar; edición y borrado requieren ser ese usuario |
| GET | `/usuarios/:id/favoritos` | Favoritos propios |
| PUT, DELETE | `/usuarios/:id/favoritos/:eventoId` | Agregar/quitar un favorito propio de forma idempotente |
| GET | `/usuarios/:id/resenias` | Reseñas recibidas como organizador |
| GET | `/usuarios/:id/reputacion` | Promedio y cantidad de reseñas recibidas |
| GET, POST | `/categorias` | Listar/crear |
| GET, PATCH, DELETE | `/categorias/:id` | Consultar/editar/borrar |
| GET, POST | `/eventos` | Catálogo/crear evento como organizador |
| GET, PATCH, DELETE | `/eventos/:id` | Detalle/editar/borrar; escritura reservada al organizador |
| GET, POST | `/eventos/:id/tipos-entrada` | Listar/agregar tipos del evento |
| GET, PATCH, DELETE | `/eventos/:id/tipos-entrada/:tipoEntradaId` | Consultar/editar/borrar un tipo dentro de su evento |
| GET | `/eventos/:id/compras` | Ventas del evento, solo para su organizador; filtro `estado` opcional |
| GET | `/eventos/:id/resenias` | Reseñas del evento |
| GET | `/eventos/:id/experiencias-anteriores` | Reseñas de eventos anteriores y finalizados del mismo organizador |
| GET, POST | `/compras` | Mis compras/crear una compra propia |
| GET | `/compras/:id` | Detalle, solo para comprador u organizador |
| PATCH | `/compras/:id/estado` | Confirmación/utilización manual por el organizador |
| GET, POST | `/compras/:id/mensajes` | Consultar/agregar mensajes, solo participantes |
| GET | `/compras/:id/historial` | Cambios con estado, autor y fecha, solo participantes |
| GET, POST | `/resenias` | Listar/crear reseña con asistencia acreditada |
| GET, PATCH, DELETE | `/resenias/:id` | Consultar/editar/borrar; escritura reservada al autor |

Se conservan `/api/health` y `/api/items` como demostración técnica anterior. `items` no pertenece al dominio de entradas.

### Cuerpos de solicitud

Usuario: `{"nombre":"Ana","apellido":"Pérez"}`. Categoría: `{"nombre":"Música","descripcion":"Conciertos"}`; la descripción es opcional.

Evento, con `X-Usuario-Id` del organizador:

```json
{
  "nombre": "Concierto",
  "descripcion": "Música en vivo",
  "categoriaId": "ID_CATEGORIA",
  "fecha": "2027-12-01T20:00:00Z",
  "fechaFin": "2027-12-01T23:00:00Z",
  "multimedia": ["https://example.com/concierto.jpg"],
  "tiposEntrada": [
    { "nombre": "General", "descripcion": "Acceso general", "precio": 2500, "cupo": 50 }
  ]
}
```

`fecha` es el inicio y debe ser futuro al publicar. Las fechas requieren ISO con zona horaria. `fechaFin` es opcional y debe ser posterior al inicio. Sin fin explícito no se da por finalizado el evento. `multimedia` es opcional. Para editar tipos se utilizan sus rutas anidadas: `PATCH /eventos/:id` no reemplaza el arreglo completo ni permite cambiar al organizador.

Compra, con `X-Usuario-Id` del comprador:

```json
{ "eventoId": "ID_EVENTO", "tipoEntradaId": "ID_TIPO", "cantidad": 2 }
```

Cambio de estado, con `X-Usuario-Id` del organizador: `{"estado":"CONFIRMADA"}` o `{"estado":"UTILIZADA"}`. Mensaje, como participante: `{"mensaje":"¿A qué hora abren?"}`. Reseña, como comprador: `{"compraId":"ID_COMPRA","detalle":"Muy buena experiencia","puntuacion":4.5}`.

### Consultas

- `/eventos?q=musica&categoriaId=ID&organizadorId=ID&orden=precio`: búsqueda por nombre, descripción y categoría, sin distinguir mayúsculas ni acentos. Los filtros son opcionales.
- `orden=fecha` (predeterminado): fecha ascendente. `orden=precio`: mínimo ascendente. `orden=puntaje`: promedio del organizador descendente, sin reseñas al final. Desempates por fecha y luego ID.
- El catálogo muestra eventos que todavía no comenzaron; `incluirPasados=true` permite recuperar todos, útil para el panel del organizador.
- `/compras?estado=CONFIRMADA`: mis compras filtradas. `/compras?eventoId=ID&estado=PENDIENTE`: ventas de un evento propio.
- `/resenias?eventoId=ID&organizadorId=ID`: filtros opcionales y combinables.

## Reglas implementadas y decisiones técnicas

- **Compra:** tipo perteneciente al evento, evento aún no iniciado y cantidad entera positiva. Total calculado en centavos, sin confiar en valores del cliente; se conserva aunque cambie el precio. Los precios admiten hasta dos decimales y los importes están limitados por la precisión segura de JavaScript.
- **Cupo:** provisionalmente se reserva al crear `PENDIENTE`; confirmar y utilizar no vuelven a descontar. Comprobación, reserva y guardado son síncronos dentro del mismo proceso. Esto evita sobreventa en este servidor en memoria; no es una transacción distribuida.
- **Estados:** circuito manual básico `PENDIENTE → CONFIRMADA → UTILIZADA`, solo por el organizador. Cada paso registra fecha/autor; saltos y repeticiones fallan sin modificar datos. No se confirma después del inicio del evento. Este circuito no procesa un pago ni valida un ticket físico.
- **Historial y chat:** historial automático de creación y cambios. Chat disponible en cualquier estado y fecha, exclusivamente para comprador y organizador; mensajes sin edición ni borrado.
- **Reseñas:** exige comprador de la compra, estado `UTILIZADA` y `fechaFin` alcanzada. Escala 0–5, incluidas fracciones y cero. Promedio aritmético de todas las reseñas del organizador; sin reseñas devuelve `null`. La cantidad máxima por compra/comprador sigue sin definirse, por lo que no se impone unicidad en esta etapa.
- **Precios de catálogo:** rango mínimo–máximo y mínimo para ordenar, incluyendo tipos agotados como convención técnica explícita. No se guarda el rango como otro precio.
- **Días:** valor derivado únicamente para compras confirmadas; períodos de 24 horas redondeados hacia arriba y mínimo cero. Para otros estados se devuelve `null`.
- **Integridad:** no se borra categoría usada, usuario con eventos/compras/reseñas, evento con compras/reseñas ni tipo con compras. Siempre queda al menos un tipo por evento. Borrar un evento sin compras limpia favoritos. Reprogramar un evento con compras se rechaza hasta definir ese flujo.
- **Edición de cupo:** `cupo` representa disponibilidad restante, no capacidad inicial. Actualizarlo establece la disponibilidad restante deseada. Una edición de tipos mantiene su ID y las referencias de compras anteriores.

La reserva en pendientes, el circuito manual, `fechaFin`, los redondeos y desempates son elecciones de esta implementación, diferenciadas de las decisiones previas confirmadas por el usuario. La consulta sobre el momento de descontar cupo queda abierta a su respuesta.

**Pendientes expresamente conservados:** cancelación/reembolso y devolución/expiración de reservas. No se expone borrado de compras ni edición libre de cantidad, total o asociaciones, porque eluden esas reglas y destruyen trazabilidad. Los estados `CANCELADA` y `REEMBOLSADA` siguen en el enum para el dominio, pero la API no los genera todavía. Las reservas pendientes no caducan por ahora. Tampoco se implementaron pagos, autenticación, almacenamiento persistente ni integración de los demás flujos de la maqueta; C3/C11 sí consumen la API.

## Verificación

Desde la raíz: `npm test`. Se usan `node:test`, `node:assert/strict` y `fetch`, sin dependencias nuevas. Las pruebas HTTP levantan servidores efímeros en `127.0.0.1` con un puerto libre y los cierran al terminar; requieren permiso para abrir sockets locales.

La cobertura incluye dominio previo, aislamiento de repositorios, cupos/precios, transiciones e historial, permisos de chat/ventas, asistencia y reputación, catálogo, favoritos, integridad de borrados, DTOs y dos solicitudes concurrentes por la última entrada. `createApp`, `createRepositories` y `createServices` permiten instancias aisladas y reloj inyectado.

Verificación de C11: 38 pruebas de backend correctas; la suite de frontend añade integración HTTP del servicio de catálogo contra Express real (31 pruebas de frontend en total), incluidos órdenes por fecha/precio/puntaje, cero frente a null, promedios entre eventos, cambios en reseñas, mínimos de tipos agotados y empates estables. No se probó un celular en esta entrega.
