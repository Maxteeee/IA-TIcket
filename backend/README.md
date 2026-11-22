# Backend de entradas

API Express en JavaScript, con almacenamiento en memoria. Desde la raíz: `npm install`, `npm run backend`. El arranque local prepara cinco categorías y los perfiles de prueba Comprador 1/Organizador 1, sin eventos. Los datos se pierden al reiniciar el proceso. El frontend ya consulta esta API para C3/C11, C4, C12, C1, C2, C5/C6 y C9/C10/C7/C8 (catálogo, publicación, compra, mis compras, ventas, chat, reseñas y cancelación/reembolso simulado); los favoritos manuales se conservan localmente por perfil en el frontend.

## Acceso desde el celular con WSL

El servidor escucha en `0.0.0.0:3000`. En WSL, que responda `localhost` en Windows no garantiza que responda desde otro dispositivo. El arranque distingue **API interna WSL** y la dirección pública configurada con `PUBLIC_API_URL` en backend/.env. Esta variable solo cambia el mensaje de arranque; el acceso depende de la configuración de red.

Para el modo NAT de WSL, obtener la IPv4 de la conexión de Windows (`ipconfig`) y la IP actual de WSL (`hostname -I`). Desde PowerShell **como administrador**, reemplazar las dos direcciones de ejemplo y configurar únicamente el puerto de la API:

```powershell
$ipWindows = '192.168.1.100'
$ipWsl = '172.18.61.7'
netsh interface portproxy add v4tov4 listenaddress=$ipWindows listenport=3000 connectaddress=$ipWsl connectport=3000 protocol=tcp
New-NetFirewallRule -Name IATicket-Api-WSL-3000 -DisplayName 'IA Ticket API WSL (TCP 3000, red local)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -LocalAddress $ipWindows -RemoteAddress LocalSubnet -Profile Any
```

El comando de firewall se usa al crear la regla por primera vez; si ya existe, comprobarla antes de agregar otra. Si cambia la IP de Windows o WSL, actualizar el reenvío y la regla correspondiente. No deshabilitar el firewall. El permiso de administrador lo solicita Windows.

En backend/.env, configurar `PUBLIC_API_URL=http://IP_WINDOWS:3000/api`; en frontend/.env, `EXPO_PUBLIC_API_URL=http://IP_WINDOWS:3000/api`, con dos barras después de `http:`. Iniciar el backend con `npm run backend` desde la raíz. Desde el teléfono en la misma red, abrir `http://IP_WINDOWS:3000/api/health` y luego `/api/categorias`: deben responder JSON. Recargar la app después de actualizar la dirección (reiniciar solo Expo si conserva la configuración anterior). El túnel de Expo transporta la app, no la API. Reiniciar el backend borra sus datos en memoria.

## Arranque sin datos de negocio precargados

**DD-08, confirmado por el usuario el 2026-11-02:** el servidor prepara solamente los dos perfiles locales y las cinco categorías base. Eventos, compras, mensajes, reseñas y favoritos comienzan vacíos; se crean mediante los recorridos de la app. No hay otros organizadores precargados, comandos demo ni carga por SEED_DEMO/--demo. No se eliminan datos del proceso en curso por una llamada de limpieza: el almacenamiento continúa siendo en memoria y se vacía al reiniciarlo.

Los escenarios completos para búsqueda/reputación/experiencias están en `test/fixtures/demo.js`, importados exclusivamente por las pruebas, con repositorios aislados. El frontend tiene sus propios escenarios de test separados de las colecciones vacías de la app. Esos fixtures no son datos del usuario ni se incorporan al arranque.

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

## Decisión de diseño DD-07: no comprar entradas de eventos propios

**Confirmada por el usuario el 2026-11-02.** Una persona puede tener COMPRADOR y ORGANIZADOR y comprar eventos de otros organizadores. No puede crear una compra cuyo comprador sea el organizador del mismo evento, aunque tenga ambos roles. Se evita que sus propias compras distorsionen disponibilidad, ventas y futuras reseñas. Esta regla corresponde a C12 y no elimina el rol de comprador del organizador.

El dominio Compra rechaza esa relación al construir una nueva compra. El servicio resuelve usuario/evento canónicos y verifica la restricción antes de recuperar un intento o reservar; POST /compras devuelve **409** con `No podés comprar entradas para un evento propio`. No crea compra, historial o reserva ni consume una clave de reintento fallida. El frontend permite consultar la publicación y sus entradas, muestra que el evento es propio y bloquea selección, cantidad, compra y reintento desde ese detalle, tanto conectado como de ejemplo.

La regla se aplica a nuevas operaciones; no borra ni cancela automáticamente registros anteriores. Consultar una compra histórica y su chat sigue sujeto a sus permisos previos. Las pruebas de sesiones/compras personales ahora utilizan eventos ajenos; la cobertura de registros históricos no habilita crear autocompras por la API actual.

## Identidad de prueba

Las operaciones personales usan `X-Usuario-Id: <id devuelto al crear usuario>`. Los servicios resuelven ese ID al usuario almacenado y verifican que sea comprador, organizador o autor según corresponda. El autor de mensajes, comprador y organizador de eventos se derivan de esa identidad; no se aceptan como campos del cuerpo.

Este encabezado es un mecanismo de identidad para desarrollo local, **no autenticación**: cualquier cliente puede elegir otro ID. No se implementaron login, contraseñas ni sesiones. El catálogo, perfiles básicos, categorías y reseñas se consultan públicamente. La creación de usuarios y gestión de categorías son abiertas, sin un rol de administrador inventado.

## Publicación C4 e identidad local

`server.js` invoca `seedReferenceData` antes de iniciar Express. Prepara `comprador-1` (COMPRADOR), `organizador-1` (COMPRADOR + ORGANIZADOR) y las cinco categorías. La carga es idempotente y no sobrescribe registros; no agrega eventos. No se agregan otros autores ni entidades de negocio. Los ejemplos completos se usan exclusivamente en pruebas.

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
| PATCH | `/compras/:id/estado` | Confirmación de pago simulado/utilización por el organizador, conectada al panel móvil |
| POST | `/compras/:id/cancelacion` | C7: cancelación propia, devolución de cupo y reembolso simulado si estaba confirmada |
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
- `/resenias?eventoId=ID&organizadorId=ID&compraId=ID`: filtros opcionales y combinables. C9 usa compraId para recuperar las reseñas de la compra seleccionada.

### C1: mis compras

`GET /compras`, con `X-Usuario-Id`, exige COMPRADOR almacenado y devuelve únicamente compras de esa identidad, incluidos eventos pasados. No admite un comprador arbitrario en la consulta. El perfil Organizador 1 tiene ambos roles: sin `eventoId` consulta sus compras personales; el filtro de ventas conserva su autorización por propiedad.

Cada DTO de compra (lista, detalle y creación) agrega `evento: {id, nombre, fecha, organizadorId}` para mostrar nombre/fecha sin descargar el catálogo ni hacer una consulta por tarjeta; `organizadorId` permite verificar la propiedad al abrir el chat de C6. Conserva los IDs, el tipo/precio históricos y el total de C12. No serializa el grafo de entidades ni calcula días en el presenter: invoca `Compra.diasRestantes(ahora)`. La lista comparte un instante del reloj del servidor entre todos sus registros.

Solo CONFIRMADA devuelve `diasRestantes`: diferencia hasta el inicio en períodos de 24 horas, redondeada hacia arriba y con mínimo 0; otros estados devuelven null. El frontend muestra ese valor, incluido 0, sin depender del reloj del teléfono. Lista y detalle consultan nuevamente al entrar, actualizar o volver del segundo plano. Los estados CANCELADA/REEMBOLSADA pueden presentarse si existen como datos históricos; su transición sigue pendiente y no se incorporó en C1.

## Reglas implementadas y decisiones técnicas

### Confirmación de pago simulado y utilización desde el panel móvil

El panel del organizador conecta los botones **Confirmar pago simulado** y **Marcar como utilizada** con PATCH `/compras/:id/estado`. Reutiliza las reglas existentes: solo el organizador de la compra, PENDIENTE → CONFIRMADA → UTILIZADA, confirmación estrictamente antes del inicio. No cambia las transiciones ni agrega pasarela, pago real, entidad o endpoint. El historial conserva autor/fecha y confirmar/utilizar no descuentan cupo otra vez.

El cliente obtiene primero la compra privada y valida evento/organizador; envía únicamente `{estado}`. Coalesce llamadas simultáneas y recupera un estado ya alcanzado por GET sin repetir PATCH. La API conserva el rechazo de transiciones repetidas por PATCH; el cliente consulta el estado tras errores o respuestas perdidas. El panel actualiza el resumen completo, bloquea modificaciones si no logra recuperar el estado y mantiene los controles del servidor ante cancelaciones concurrentes, roles falsos e inicio alcanzado.

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

### C9: puntuar y comentar una compra utilizada

`POST /resenias` exige identidad de prueba, rol COMPRADOR almacenado y que la compra pertenezca a esa identidad. El cuerpo solo admite compraId, puntuacion numérica entre 0 y 5 (incluye cero y fracciones) y detalle obligatorio de 1–1500 caracteres tras trim. Evento y comprador se derivan de la compra; no se aceptan autores ni eventos arbitrarios.

**DD-02 actualizada por instrucción explícita del usuario el 2026-11-22:** para reseñar basta con que la compra propia esté UTILIZADA; se elimina la condición anterior de evento finalizado. No depende de fechaFin ni de la fecha actual. El DTO de compra incorpora `puedeReseniar`, derivado por el dominio en cada consulta; el frontend lo valida y usa para habilitar el formulario, y el POST vuelve a verificar la regla frente a cambios entre consulta y publicación. Se conservan los controles de rol COMPRADOR y propiedad. La reseña no modifica cupo, estado, total ni historial de la compra.

La consulta pública existente de reseñas agrega el filtro compraId. La pantalla C9 primero consulta el detalle privado para comprobar propiedad y luego recupera las reseñas de esa compra, validando autor/evento/asociación. C10 presenta las experiencias anteriores desde el detalle público del evento, como se describe a continuación. El puntaje y conteo de C11 se actualizan con las reseñas reales por su cálculo ya existente.

El POST admite Idempotency-Key opcional, validada como las otras publicaciones y limitada a comprador/compra. Repetir clave y contenido normalizado devuelve la misma reseña sin duplicarla ni inflar el promedio; cambiar contenido da 409. Si la reseña fue borrada por la API existente, esa clave no la recrea. Fallos de validación no guardan ni consumen la clave. La app conserva el intento incierto en memoria al navegar/cambiar perfil, sin persistencia tras una recarga completa.

**Cantidad por compra pendiente de definición:** se consultó al usuario y se conserva la regla previa del backend, que permite varias reseñas. No se agregó unicidad por compra ni por usuario/evento. Un reintento de la misma operación no es una segunda reseña. No se incorporan edición/borrado de reseñas desde la app, límites nuevos de frecuencia ni cierre manual del evento. La confirmación de pago simulado y el registro de uso desde UI reutilizan las operaciones existentes del backend, descritas en frontend/README.md.

### C10: experiencias de eventos anteriores del organizador

`GET /eventos/:id/experiencias-anteriores` es público y conserva su selección previa: reseñas del mismo organizador, de un evento distinto con inicio anterior al evento consultado y finalización explícita alcanzada (`fechaFin <= ahora`). Comparte un instante del reloj del servidor para toda la consulta. No restringe por categoría ni exige que el visitante haya comprado. Excluye el propio evento, eventos simultáneos/posteriores y aquellos sin fechaFin o aún en curso. Devuelve `[]` si no hay experiencias elegibles y 404 si el evento consultado no existe.

El controlador usa `experienciaAnteriorDto` en `http/presenters.js`: conserva los campos de reseña `{id, compradorId, eventoId, compraId, detalle, puntuacion}` y agrega `comprador: {id, nombre, apellido}` y `evento: {id, nombre, organizadorId, fecha, fechaFin}`. No serializa las entidades, roles, chat ni detalle de compra; las otras respuestas de reseñas conservan su contrato. No hay consultas adicionales por tarjeta ni nuevas entidades/repositorios.

El detalle conectado consume esta ruta mediante catalog.service y muestra autor, puntuación 0–5, comentario y nombre/fecha del evento de origen. Las publicaciones C9 quedan disponibles en siguientes eventos del organizador cuando cumplen las condiciones C10 descritas arriba. Publicar una reseña de una compra utilizada sin fechaFin o antes del final del evento no convierte a ese evento en finalizado ni agrega su reseña a estas experiencias anteriores. El puntaje/conteo general C11 se sigue calculando sobre todas sus reseñas; puede diferir del conjunto de experiencias anteriores visible en una publicación. No se recalcula a partir de esta lista ni se agrega unicidad, ordenamiento o paginación de reseñas.

### C7: cancelar y obtener un reembolso simulado

`POST /compras/:id/cancelacion`, con `X-Usuario-Id` del comprador y cuerpo `{}`, devuelve 200 con el DTO actualizado. No acepta importe, estado, comprador, cupo ni fecha elegidos por el cliente. Requiere usuario existente, rol COMPRADOR almacenado y propiedad de la compra; el organizador no puede cancelar compras de otros usuarios. Organizador 1 sí puede cancelar una compra personal por su capacidad de comprador.

Reglas confirmadas por el usuario para esta entrega: solo una compra PENDIENTE o CONFIRMADA y estrictamente antes del inicio (`ahora < evento.fecha`). No depende de fechaFin. Utilizadas y solicitudes nuevas desde el instante de inicio se rechazan con 409 sin modificar cupo, estado ni historial. Estas son también las restricciones de C8 necesarias para ejecutar C7; no se agregó una configuración ni acción de cancelación del organizador.

| Estado previo | Resultado | Cupo | Reembolso |
| --- | --- | --- | --- |
| PENDIENTE | CANCELADA | Devuelve toda la cantidad al mismo tipo | Ninguno: no había pago confirmado |
| CONFIRMADA | CANCELADA → REEMBOLSADA | Devuelve toda la cantidad al mismo tipo | Total original completo, simulado, incluido cero |

`Compra.cancelar` conserva el precio, nombre del tipo, cantidad y total históricos. `TipoEntrada.devolver` valida cantidad y precisión segura antes de modificar cupo; la operación síncrona no tiene await entre validación, devolución y estados. Se registran CANCELADA y, si corresponde, REEMBOLSADA con comprador y fecha del servidor. El reembolso es un registro embebido en Compra, no una entidad/repositorio nuevo. No hay pasarela, transferencia, comisiones ni movimiento real de dinero: todos los importes son simulados, conforme a lo confirmado por el usuario.

DTO de compras (creación/lista/detalle/ventas/cancelación) agrega `puedeCancelar`, derivado de dominio y reloj del servidor, y `reembolso`, null o `{importe, fecha: ISO, simulado: true}`. El importe es el total histórico, aunque se editen precios después. Datos históricos que solo tenían estado REEMBOLSADA sin registro conservan null; no se inventan devoluciones. La app distingue ese contrato y exige un registro válido para confirmar el éxito de una nueva cancelación reembolsada.

Cancelar de nuevo una compra CANCELADA/REEMBOLSADA recupera el resultado existente, aun después del inicio, sin repetir cupo, importe ni historial. Se verifican identidad/rol/propiedad antes de recuperar. No se necesita Idempotency-Key para esta operación terminal. El PATCH de estados conserva exclusivamente confirmación/utilización; no permite saltarse la cancelación mediante un estado arbitrario. Chat e historial permanecen disponibles para sus participantes después de cancelar.

### C8: condiciones garantizadas para las cancelaciones del comprador

C8 comparte `Compra.puedeCancelar/cancelar`, el servicio y POST de C7. No agrega otra entidad, endpoint o aprobación del organizador. La regla acordada es estrictamente antes del inicio, para pendientes/confirmadas propias y no utilizadas; se aplica al ejecutar aunque el frontend conserve una elegibilidad anterior. FechaFin no amplía el plazo. El organizador puede consultar estado, disponibilidad y reembolso simulado en el resumen privado de ventas; no puede cancelar compras ajenas.

La misma operación síncrona protege la carrera entre utilizar y cancelar: ambas solicitudes no pueden completar su transición sobre la misma compra. Si utilizar gana, cancelar devuelve 409 sin devolución ni reembolso; si cancelar gana, utilizar devuelve 409 y solo hay una devolución de cupo/reembolso. Los reintentos de una cancelación ya completada recuperan su resultado sin iniciar una cancelación nueva después del plazo. C8 conserva las garantías de C7 y su historial.

### Reglas compartidas

- **Compra:** rol COMPRADOR, tipo perteneciente al evento, evento aún no iniciado y cantidad entera positiva. Total calculado en centavos, sin confiar en valores del cliente; precio unitario, nombre del tipo y total se conservan aunque se edite la entrada. Si se envía precio esperado y difiere del vigente, se rechaza sin reservar. Los precios admiten hasta dos decimales y los importes están limitados por la precisión segura de JavaScript.
- **Cupo:** provisionalmente se reserva al crear `PENDIENTE`; confirmar y utilizar no vuelven a descontar. Comprobación, reserva y guardado son síncronos dentro del mismo proceso. Esto evita sobreventa en este servidor en memoria; no es una transacción distribuida.
- **Estados:** circuito `PENDIENTE → CONFIRMADA → UTILIZADA`, solo por el organizador, con confirmación de pago simulado y uso desde el panel móvil. Cada paso registra fecha/autor; saltos y repeticiones fallan sin modificar datos. No se confirma después del inicio del evento. Este circuito no procesa un pago ni valida un ticket físico.
- **Historial y chat:** historial automático de creación y cambios. Chat disponible en cualquier estado y fecha, exclusivamente para comprador y organizador; mensajes sin edición ni borrado.
- **Reseñas:** exige comprador de la compra, estado `UTILIZADA` y `fechaFin` alcanzada. Escala 0–5, incluidas fracciones y cero. Promedio aritmético de todas las reseñas del organizador; sin reseñas devuelve `null`. La cantidad máxima por compra/comprador sigue sin definirse, por lo que no se impone unicidad en esta etapa.
- **Precios de catálogo:** rango mínimo–máximo y mínimo para ordenar, incluyendo tipos agotados como convención técnica explícita. No se guarda el rango como otro precio.
- **Días:** valor derivado únicamente para compras confirmadas; períodos de 24 horas redondeados hacia arriba y mínimo cero. Para otros estados se devuelve `null`.
- **Integridad:** no se borra categoría usada, usuario con eventos/compras/reseñas, evento con compras/reseñas ni tipo con compras. Siempre queda al menos un tipo por evento. Borrar un evento sin compras limpia favoritos. Reprogramar un evento con compras se rechaza hasta definir ese flujo.
- **Edición de cupo:** `cupo` representa disponibilidad restante, no capacidad inicial. Actualizarlo establece la disponibilidad restante deseada. Una edición de tipos mantiene su ID y las referencias de compras anteriores.

La reserva en pendientes, `fechaFin`, los redondeos y desempates son elecciones de esta implementación, diferenciadas de las decisiones previas confirmadas por el usuario. El 2026-11-22 el usuario confirmó el uso de pagos simulados y registro de utilización desde el panel del organizador. La consulta sobre el momento de descontar cupo queda abierta a su respuesta. Para C7 sí quedaron confirmados corte antes del inicio, devolución de cupo una vez, pendientes sin reembolso y confirmadas con reembolso total simulado.

**Pendientes conservados:** expiración automática de reservas y unicidad de reseñas. No se expone borrado de compras ni edición libre de cantidad, total o asociaciones. Las reservas pendientes no caducan; C7 permite cancelarlas y devolver cupo. No hay pagos reales ni autenticación/persistencia; los importes a pagar/reembolsar son siempre simulados. C3/C11/C4/C12/C1/C2/C5/C6/C9/C10/C7/C8 consumen la API.

## Verificación

Desde la raíz: `npm test`. Se usan `node:test`, `node:assert/strict` y `fetch`, sin dependencias nuevas. Las pruebas HTTP levantan servidores efímeros en `127.0.0.1` con un puerto libre y los cierran al terminar; requieren permiso para abrir sockets locales.

La cobertura incluye dominio previo, aislamiento de repositorios, cupos/precios, transiciones e historial, permisos de chat/ventas, asistencia y reputación, catálogo, favoritos, integridad de borrados, DTOs y dos solicitudes concurrentes por la última entrada. `createApp`, `createRepositories` y `createServices` permiten instancias aisladas y reloj inyectado.

Verificación de C8: 69 pruebas backend y 131 frontend correctas (200 en total), conservando la cobertura anterior. Cancelación pendiente/confirmada, reembolso total histórico/cero y fecha/autor, corte exacto de inicio, utilizada, propiedad/rol/cuerpo, desborde de cupo sin cambios parciales, recuperación tras pérdida de respuesta/recarga, concurrencia y reventa sin duplicar cupo/historial ni importe; chat posterior y ventas actualizadas. C8 agrega pruebas de seguimiento del organizador y carrera utilización/cancelación, con una sola operación completada e historial/cupo consistentes. Exportaciones Android/iOS con Metro; sin prueba propia en celular.

Verificación de DD-07 y guía de arranque: 70 pruebas backend + 133 frontend (203) correctas. Incluye rechazo de autocompra en dominio/POST con y sin clave, cupo/registros sin cambios, clave no consumida y compras permitidas en eventos ajenos con el mismo organizador. Pruebas históricas de chat y compras personales adaptadas sin habilitar nuevas autocompras. Metro Android/iOS exportados sin bytecode en /tmp/ai-ticket-dd07-android y /tmp/ai-ticket-dd07-ios; interacción propia en celular pendiente. Sin nuevas dependencias ni migración de SDK.

Verificación de arranque sin datos de negocio: runner backend 71 y frontend 135 correctos, incluida la carga de fixtures como módulos de prueba. La referencia inicial conserva solo dos perfiles y cinco categorías; no incorpora eventos/compras/reseñas/favoritos. Los escenarios completos de pruebas se movieron fuera de src y no los importa server.js. Se retiraron comandos demo y SEED_DEMO; no se ejecutó una limpieza por API ni se inició otra instancia del usuario.
