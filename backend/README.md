# Backend de entradas

API Express en JavaScript, con almacenamiento en memoria. Desde la raíz: `npm install`, `npm run backend`. El arranque local prepara cinco categorías y los perfiles de prueba Comprador 1/Organizador 1, sin eventos. Los datos se pierden al reiniciar el proceso. El frontend ya consulta esta API para C3/C11, C4, C12, C1, C2, C5 y C6 (catálogo, publicación, compra, mis compras, ventas/disponibilidad por evento y chat entre comprador y organizador); los demás recorridos conservan la maqueta local.

## Catálogo de prueba para C3/C11

`npm run backend:demo` desde la raíz inicia el servidor con categorías y eventos de prueba del propio backend. También puede activarse con `SEED_DEMO=true` en backend/.env. El arranque normal prepara solo referencias (categorías y perfiles); createApp no incorpora datos implícitos y las pruebas conservan instancias aisladas.

`src/data/demo.js` carga cinco categorías y siete eventos (cinco futuros y dos pasados), con fechas relativas y tipos de entrada. Usa IDs estables, conserva referencias canónicas y no sobrescribe registros existentes. Todos los datos siguen siendo temporales en memoria. Incluye tres organizadores: Equipo Encuentro con promedio 4,5 de dos reseñas; Compañía Umbral con una reseña de 0; Red Abierta sin reseñas. Las tres reseñas históricas se vinculan con compras utilizadas de los eventos pasados; permiten probar C11 sin integrar todavía C9. No usa fixtures del frontend ni incorpora autenticación o pagos. C4 permite ahora crear eventos desde la app.

El listado y el detalle de eventos agregan resúmenes `categoria: {id, nombre, descripcion}` y `organizador: {id, nombre, apellido, roles, puntaje, cantidadResenias}` a sus DTOs, conservando `categoriaId` y `organizadorId`. Así la pantalla muestra nombres reales sin consultar todos los usuarios ni inventar asociaciones por nombre. `puntaje` es el promedio de todas las reseñas recibidas por ese organizador, o null si no tiene; `cantidadResenias` es el conteo real. El servicio utiliza la misma regla para ordenar y para construir estos datos, sin almacenar un promedio que pueda quedar desactualizado.

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

## Publicación C4 e identidad local

`server.js` invoca `seedReferenceData` antes de iniciar Express. Prepara `comprador-1` (COMPRADOR), `organizador-1` (COMPRADOR + ORGANIZADOR) y las cinco categorías. La carga es idempotente y no sobrescribe registros; no agrega eventos. El modo demo agrega los ejemplos de C3/C11 y marca como organizadores a sus autores históricos.

`Usuario.roles` se valida contra RolUsuario y se copia al construir/devolver DTOs. Los usuarios creados mediante la API reciben COMPRADOR por defecto; los cuerpos públicos de creación/edición no admiten roles. Los roles de prueba se asignan en datos de arranque, sin inventar un administrador ni un login.

`POST /api/eventos` exige un usuario existente con rol ORGANIZADOR. El evento completo y todos sus tipos se validan antes de guardar: fecha futura, categoría existente, al menos un tipo, nombres, precios no negativos de hasta dos decimales y cupos enteros no negativos. Los IDs de evento/tipos se generan en el servidor. No se recibe organizadorId en el cuerpo ni se crean compras, cobros o movimientos de cupo al publicar.

El encabezado opcional `Idempotency-Key` (1–100 letras ASCII, números o guiones) permite reintentar un POST sin duplicar el evento. La clave se limita a ese organizador y al mismo contenido: una repetición devuelve el evento existente con 201; otro contenido o un evento anterior eliminado produce 409. Una validación fallida no consume la clave. La memoria de claves vive junto al servicio del proceso, sin persistencia externa. La app conserva su clave al reintentar el mismo formulario y bloquea pulsaciones simultáneas.

`GET /api/eventos?organizadorId=organizador-1&incluirPasados=true` permite reconstruir el listado propio al recargar la app. Sigue siendo consulta pública de eventos; C2 consulta sus ventas mediante el resumen privado descrito abajo.

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
| GET | `/eventos/:id/ventas` | C2: evento, disponibilidad por tipo y sus compras en una consulta privada del propietario |
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

Compra, con `X-Usuario-Id` del comprador (rol COMPRADOR almacenado en el servidor):

```json
{ "eventoId": "ID_EVENTO", "tipoEntradaId": "ID_TIPO", "cantidad": 2, "precioUnitarioEsperado": 1200.5 }
```

`precioUnitarioEsperado` es opcional por compatibilidad; la app siempre lo envía para detectar cambios de precio y pedir otra confirmación (409). El servidor calcula el total con el precio vigente; no acepta comprador, total ni estado en el cuerpo. La respuesta 201 incluye ID, asociaciones, cantidad, estado PENDIENTE, total y las copias históricas `precioUnitario`/`tipoEntradaNombre`. `GET /compras/:id` permite recuperar la compra a sus participantes; el comprobante del frontend además exige que pertenezca al comprador activo.

La app envía `Idempotency-Key` para cada intento de compra. Es opcional, de 1 a 100 letras, números o guiones y se limita al comprador. Repetir la misma clave y cuerpo devuelve la compra existente sin descontar otra vez, incluso si ya se agotó el tipo o comenzó el evento. Cambiar el cuerpo con la misma clave da 409. Los intentos rechazados por validación no reservan ni consumen la clave. Compra y registro de claves viven en el mismo proceso en memoria.

Cambio de estado, con `X-Usuario-Id` del organizador: `{"estado":"CONFIRMADA"}` o `{"estado":"UTILIZADA"}`. Mensaje, como participante: `{"mensaje":"¿A qué hora abren?"}`. Reseña, como comprador: `{"compraId":"ID_COMPRA","detalle":"Muy buena experiencia","puntuacion":4.5}`.

### Consultas

- `/eventos?q=musica&categoriaId=ID&organizadorId=ID&orden=precio`: búsqueda por nombre, descripción y categoría, sin distinguir mayúsculas ni acentos. Los filtros son opcionales.
- `orden=fecha` (predeterminado): fecha ascendente. `orden=precio`: mínimo ascendente. `orden=puntaje`: promedio del organizador descendente, sin reseñas al final. Desempates por fecha y luego ID.
- El catálogo muestra eventos que todavía no comenzaron; `incluirPasados=true` permite recuperar todos, útil para el panel del organizador.
- `/compras?estado=CONFIRMADA`: mis compras filtradas. `/compras?eventoId=ID&estado=PENDIENTE`: ventas de un evento propio.
- `/resenias?eventoId=ID&organizadorId=ID`: filtros opcionales y combinables.

### C1: mis compras

`GET /compras`, con `X-Usuario-Id`, exige COMPRADOR almacenado y devuelve únicamente compras de esa identidad, incluidos eventos pasados. No admite un comprador arbitrario en la consulta. El perfil Organizador 1 tiene ambos roles: sin `eventoId` consulta sus compras personales; el filtro de ventas conserva su autorización por propiedad.

Cada DTO de compra (lista, detalle y creación) agrega `evento: {id, nombre, fecha, organizadorId}` para mostrar nombre/fecha sin descargar el catálogo ni hacer una consulta por tarjeta; `organizadorId` permite verificar la propiedad al abrir el chat de C6. Conserva los IDs, el tipo/precio históricos y el total de C12. No serializa el grafo de entidades ni calcula días en el presenter: invoca `Compra.diasRestantes(ahora)`. La lista comparte un instante del reloj del servidor entre todos sus registros.

Solo CONFIRMADA devuelve `diasRestantes`: diferencia hasta el inicio en períodos de 24 horas, redondeada hacia arriba y con mínimo 0; otros estados devuelven null. El frontend muestra ese valor, incluido 0, sin depender del reloj del teléfono. Lista y detalle consultan nuevamente al entrar, actualizar o volver del segundo plano. Los estados CANCELADA/REEMBOLSADA pueden presentarse si existen como datos históricos; su transición sigue pendiente y no se incorporó en C1.

## Reglas implementadas y decisiones técnicas

### C2: compras y disponibilidad por evento

`GET /eventos/:id/ventas` exige `X-Usuario-Id`, rol ORGANIZADOR almacenado y propiedad del evento. Devuelve `{evento, compras}`. `evento` incluye id, nombre, fecha, organizadorId y todos los tipos con id/nombre/descripción/precio/cupo. Cada compra usa el DTO de C1/C12 y agrega solo `comprador: {id, nombre, apellido}` para identificar al comprador; no se serializa el grafo de usuarios ni su información de otros eventos.

La lectura de compras y disponibilidad, y su presentación, son síncronas en el mismo proceso: una compra concurrente se observa completa o en la consulta siguiente. El cupo es la disponibilidad restante actual, incluidos cero y tipos sin ventas; no se calcula restando nuevamente las compras. Pendientes reservan según la política existente y confirmar/utilizar no vuelven a descontar. La respuesta conserva los precios/nombres históricos de cada compra frente a los valores actuales del tipo.

El resumen no admite parámetros de consulta: los filtros por estado se aplican en la pantalla al conjunto recibido, conservando siempre todos los tipos y cupos. La ruta anterior `/eventos/:id/compras` y `/compras?eventoId=ID` conservan su respuesta de arreglo y filtro opcional, reforzadas con el mismo control de rol y propiedad. Un comprador participante o un organizador ajeno no pueden consultar las ventas. Los eventos pasados siguen consultables por su propietario. El catálogo público no expone compras ni nombres de compradores.

### C5/C6: mensajes y respuestas de una compra

Se reutilizan `GET /compras/:id/mensajes` y `POST /compras/:id/mensajes`, con `X-Usuario-Id`. El cuerpo de envío contiene únicamente `{"mensaje":"..."}`: texto de 1 a 2000 caracteres después de quitar espacios exteriores. Autor, ID y fecha se resuelven en el servidor. El DTO agrega `compraId` a `id`, `usuarioId`, `mensaje` y `enviado` ISO para comprobar la asociación al adaptar el chat.

El permiso es por relación y rol almacenado: comprador de esa compra con COMPRADOR u organizador de su evento con ORGANIZADOR. El control se aplica al detalle privado y a mensajes, incluso al recuperar reintentos. Otro comprador del mismo evento y un organizador ajeno no obtienen acceso. Una persona que sea comprador y organizador del mismo evento conserva acceso por cualquiera de sus relaciones con el rol correspondiente. No depende del estado, inicio ni finalización y no cambia cupo, estado o historial. Los mensajes siguen embebidos en Compra, sin CRUD ni repositorio global ni endpoint nuevo para C6.

El POST acepta `Idempotency-Key` opcional (1–100 letras, números o guiones), limitada a compra y autor. Misma clave y contenido normalizado devuelve el mismo mensaje/fecha con 201; otro contenido da 409. Se comprueban permisos antes de devolver un reintento. Validaciones fallidas no guardan mensajes ni consumen la clave. Doble solicitud o respuesta perdida no duplican mensajes cuando la app reusa esa clave. Sin clave se conserva el comportamiento previo: cada POST válido agrega un mensaje.

El servicio frontend usa la perspectiva comprador de C5 por defecto. C6 pasa `role: 'organizador'` y el ID del evento seleccionado: comprueba ORGANIZADOR y consulta el detalle privado antes de leer/enviar para verificar que la compra pertenezca a ese evento y que su organizador sea la sesión activa. No requiere tener rol comprador para responder ventas. Valida también que cada mensaje sea de uno de los dos participantes, sin cambiar la identidad del autor al alternar perspectivas. Los intentos se comparten por autor/compra; una clave usada por otro autor o compra no mezcla mensajes.

El chat compartido actualiza al abrir, volver del segundo plano o solicitar actualización; no agrega WebSocket, notificaciones ni polling. Historial y claves del servidor duran durante su proceso; reiniciar borra ambos. La clave pendiente del cliente sobrevive navegación/perfil en la misma ejecución, pero no una recarga completa.

### Reglas compartidas de dominio

- **Compra:** rol COMPRADOR, tipo perteneciente al evento, evento aún no iniciado y cantidad entera positiva. Total calculado en centavos, sin confiar en valores del cliente; precio unitario, nombre del tipo y total se conservan aunque se edite la entrada. Si se envía precio esperado y difiere del vigente, se rechaza sin reservar. Los precios admiten hasta dos decimales y los importes están limitados por la precisión segura de JavaScript.
- **Cupo:** provisionalmente se reserva al crear `PENDIENTE`; confirmar y utilizar no vuelven a descontar. Comprobación, reserva y guardado son síncronos dentro del mismo proceso. Esto evita sobreventa en este servidor en memoria; no es una transacción distribuida.
- **Estados:** circuito manual básico `PENDIENTE → CONFIRMADA → UTILIZADA`, solo por el organizador. Cada paso registra fecha/autor; saltos y repeticiones fallan sin modificar datos. No se confirma después del inicio del evento. Este circuito no procesa un pago ni valida un ticket físico.
- **Historial y chat:** historial automático de creación y cambios. Chat disponible en cualquier estado y fecha, exclusivamente para comprador y organizador; mensajes sin edición ni borrado.
- **Reseñas:** exige comprador de la compra, estado `UTILIZADA` y `fechaFin` alcanzada. Escala 0–5, incluidas fracciones y cero. Promedio aritmético de todas las reseñas del organizador; sin reseñas devuelve `null`. La cantidad máxima por compra/comprador sigue sin definirse, por lo que no se impone unicidad en esta etapa.
- **Precios de catálogo:** rango mínimo–máximo y mínimo para ordenar, incluyendo tipos agotados como convención técnica explícita. No se guarda el rango como otro precio.
- **Días:** valor derivado únicamente para compras confirmadas; períodos de 24 horas redondeados hacia arriba y mínimo cero. Para otros estados se devuelve `null`.
- **Integridad:** no se borra categoría usada, usuario con eventos/compras/reseñas, evento con compras/reseñas ni tipo con compras. Siempre queda al menos un tipo por evento. Borrar un evento sin compras limpia favoritos. Reprogramar un evento con compras se rechaza hasta definir ese flujo.
- **Edición de cupo:** `cupo` representa disponibilidad restante, no capacidad inicial. Actualizarlo establece la disponibilidad restante deseada. Una edición de tipos mantiene su ID y las referencias de compras anteriores.

La reserva en pendientes, el circuito manual, `fechaFin`, los redondeos y desempates son elecciones de esta implementación, diferenciadas de las decisiones previas confirmadas por el usuario. La consulta sobre el momento de descontar cupo queda abierta a su respuesta.

**Pendientes expresamente conservados:** cancelación/reembolso y devolución/expiración de reservas. No se expone borrado de compras ni edición libre de cantidad, total o asociaciones, porque eluden esas reglas y destruyen trazabilidad. Los estados `CANCELADA` y `REEMBOLSADA` siguen en el enum para el dominio, pero la API no los genera todavía. Las reservas pendientes no caducan por ahora. Tampoco se implementaron pagos, autenticación, almacenamiento persistente ni integración de los demás flujos de la maqueta; C3/C11/C4/C12/C1/C2/C5/C6 sí consumen la API.

## Verificación

Desde la raíz: `npm test`. Se usan `node:test`, `node:assert/strict` y `fetch`, sin dependencias nuevas. Las pruebas HTTP levantan servidores efímeros en `127.0.0.1` con un puerto libre y los cierran al terminar; requieren permiso para abrir sockets locales.

La cobertura incluye dominio previo, aislamiento de repositorios, cupos/precios, transiciones e historial, permisos de chat/ventas, asistencia y reputación, catálogo, favoritos, integridad de borrados, DTOs y dos solicitudes concurrentes por la última entrada. `createApp`, `createRepositories` y `createServices` permiten instancias aisladas y reloj inyectado.

Verificación de C6: 55 pruebas backend y 100 frontend correctas (155 en total). Se conserva la cobertura anterior y se agregan intercambio C5/C6 con historial compartido tras recarga, organizador sin rol comprador, respuestas en todos los estados/evento pasado, rol/propiedad/evento, autores válidos, respuesta perdida y claves independientes por autor/compra. Compilación Android/iOS verificada; sin prueba propia en celular.
