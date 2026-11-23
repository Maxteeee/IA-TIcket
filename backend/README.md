# Backend — IA Ticket IT

API REST con Express 5 y JavaScript. Centraliza reglas de negocio, permisos y almacenamiento en memoria para eventos, entradas, compras, conversaciones y reseñas.

Para instalar dependencias y conectar un teléfono, seguir primero el [README principal](../README.md). Todos los endpoints de esta guía tienen el prefijo `/api`.

## Ejecución y configuración

Desde la raíz:

```bash
npm run backend
```

Desde `backend/`, también están disponibles `npm run dev` con recarga automática y `npm start` sin recarga. El servidor escucha en todas las interfaces; `PORT` vale `3000` por defecto. La variable opcional `PUBLIC_API_URL` solo informa una dirección en la consola, no configura la red ni el frontend.

`GET /api/health` devuelve:

```json
{"status":"ok","message":"Backend conectado"}
```

`server.js` inicializa dos perfiles y cinco categorías. Los datos de negocio comienzan vacíos. `createApp()` permite usar repositorios y reloj independientes para las pruebas; no carga los perfiles por su cuenta.

## Arquitectura y modelo

| Capa | Responsabilidad |
| --- | --- |
| `src/routes/` | Asocia método y ruta con un controlador. |
| `src/controllers/` | Lee cuerpo, parámetros y encabezados; construye la respuesta HTTP. |
| `src/services/` | Aplica casos de uso, valida contratos y permisos y coordina repositorios. |
| `src/domain/` | Representa entidades y reglas, como reservas, cambios de estado y elegibilidad de reseñas. |
| `src/repositories/` | Guarda y consulta entidades en memoria. |
| `src/http/presenters.js` | Construye DTOs JSON con campos explícitos y relaciones sin ciclos. |

| Entidad | Relaciones y composición |
| --- | --- |
| Usuario | Roles no excluyentes y favoritos; puede comprar y organizar eventos ajenos. |
| Evento | Pertenece a una categoría y a un organizador; contiene sus tipos de entrada. |
| TipoEntrada | Define nombre, descripción, precio y disponibilidad restante. |
| Compra | Vincula comprador, evento y un tipo; conserva cantidad, precio y nombre históricos, total y estado. Contiene mensajes, historial y reembolso simulado si corresponde. |
| Mensaje | Pertenece a una compra e identifica autor y fecha de envío. |
| CambioEstadoCompra | Registra estado, actor y fecha dentro de una compra. |
| Reseña | Vincula comprador, compra y evento; contiene puntuación y comentario. |

No se crean entradas individuales ni una entidad de pagos. El estado y la utilización de una compra abarcan toda su cantidad. Las relaciones internas usan las instancias canónicas de los repositorios; las respuestas públicas se serializan mediante DTOs.

## Identidad y permisos

Las operaciones personales utilizan el encabezado de desarrollo:

```http
X-Usuario-Id: comprador-1
```

| ID inicial | Roles |
| --- | --- |
| `comprador-1` | `COMPRADOR` |
| `organizador-1` | `COMPRADOR`, `ORGANIZADOR` |

El encabezado identifica un usuario almacenado, pero **no constituye autenticación**. No hay login, contraseña ni token. Los roles no se pueden asignar enviándolos en los cuerpos públicos de creación o edición de usuarios.

Los listados públicos de eventos, categorías, perfiles básicos y reseñas no requieren ese encabezado. La creación de usuarios y la gestión de categorías también son abiertas en este entorno local. El backend comprueba propiedad y participación para las operaciones privadas.

## Reglas de negocio

### Publicación y catálogo

- Publicar exige rol `ORGANIZADOR`, fecha de inicio futura, categoría existente y al menos un tipo de entrada válido.
- Cada tipo tiene precio no negativo, hasta dos decimales, y cupo entero no negativo. Se permiten entradas gratuitas y tipos agotados.
- `fechaFin` es opcional y, si existe, debe ser posterior al inicio. Solo un fin explícito alcanzado determina `finalizado`.
- La búsqueda combina texto, categoría y organizador. El texto contempla nombre, descripción y categoría, sin distinguir tildes ni mayúsculas.
- El catálogo predeterminado incluye eventos con inicio futuro. `incluirPasados=true` permite consultar también los iniciados.
- El precio representativo es el menor precio de todos los tipos, incluidos los agotados. El puntaje es el promedio de todas las reseñas del organizador; sin reseñas se devuelve `null`.
- No se puede reprogramar un evento con compras. Tampoco eliminar un evento con compras o reseñas, ni un tipo con compras o el último tipo del evento.

### Compra y cupos

Crear una compra exige rol `COMPRADOR`, evento no iniciado, tipo perteneciente al evento y cantidad entera positiva con disponibilidad suficiente. El servidor calcula el total en centavos y conserva el precio unitario y nombre del tipo vigentes al comprar.

La compra nace `PENDIENTE` y reserva inmediatamente el cupo de ese tipo. No hay vencimiento automático de reservas. La comprobación y el descuento se ejecutan sin operaciones asincrónicas intermedias en el mismo proceso; esa protección no representa una transacción entre múltiples servidores.

### Decisión de diseño DD-07: no comprar entradas de eventos propios

Un usuario no puede comprar entradas para un evento del que es organizador, aunque tenga ambos roles. El dominio y el servicio rechazan la autocompra con `409` antes de reservar cupo o registrar una nueva compra. El rol comprador sigue disponible para eventos ajenos.

### Estados y pagos simulados

| Operación | Estado inicial | Resultado | Actor y condiciones |
| --- | --- | --- | --- |
| Comprar | — | `PENDIENTE` | Comprador; reserva cupo sin cobrar. |
| Confirmar pago simulado | `PENDIENTE` | `CONFIRMADA` | Organizador del evento, antes del inicio. |
| Registrar uso | `CONFIRMADA` | `UTILIZADA` | Organizador del evento; aplica a toda la compra. |
| Cancelar pendiente | `PENDIENTE` | `CANCELADA` | Comprador propietario, antes del inicio; devuelve cupo sin reembolso. |
| Cancelar confirmada | `CONFIRMADA` | `REEMBOLSADA` | Comprador propietario, antes del inicio; registra cancelación y reembolso simulado del total original. |

Confirmar y utilizar no vuelven a descontar cupo. Cada transición registra actor y fecha. El PATCH de estado rechaza saltos, retrocesos y repeticiones. No agrega una restricción temporal de uso ni verifica tickets físicos.

El panel móvil conecta las confirmaciones previas con `PATCH /compras/:id/estado`. Antes de escribir, el cliente consulta la compra privada. Ante un reintento que ya alcanzó el estado solicitado, la recupera por GET sin repetir PATCH ni historial; no cambia por ello el contrato del endpoint.

Solo `CONFIRMADA` devuelve `diasRestantes`: períodos de 24 horas hasta el inicio, redondeados hacia arriba y con mínimo cero. Los demás estados devuelven `null`.

### Cancelaciones

El corte es estricto: el reloj del servidor debe ser anterior al inicio. Una compra utilizada no se cancela. Se devuelve toda la cantidad al mismo tipo, una sola vez; una confirmada conserva un registro `{importe, fecha, simulado: true}` por su total original, aunque después cambie el precio del tipo.

Repetir la cancelación de una compra ya cancelada o reembolsada recupera el resultado existente, incluso después del inicio, sin repetir cupo, importe o historial. El permiso se comprueba antes de recuperar ese resultado. No requiere una nueva clave de idempotencia.

### Chat

Solo el comprador de la compra y el organizador de su evento acceden al chat, con el rol correspondiente almacenado. No depende del estado ni de las fechas del evento. Mensajes e historial quedan vinculados a la compra; el servidor asigna autor y fecha.

### Reseñas y experiencias anteriores

Publicar una reseña exige rol `COMPRADOR` y una compra propia `UTILIZADA`. **No exige `fechaFin` ni finalización del evento.** La puntuación es numérica de `0` a `5`, admite fracciones y requiere comentario de `1` a `1500` caracteres. Se permite más de una reseña por compra. Publicar no modifica cupo, estado, total ni historial.

La consulta de **experiencias anteriores** selecciona reseñas de un evento distinto, del mismo organizador, con inicio estrictamente anterior al evento consultado. No restringe por categoría ni exige `fechaFin` o finalización. Excluye el propio evento, los simultáneos y los posteriores. La comparación es entre las fechas de los eventos, sin una condición adicional sobre el reloj actual.

El formulario móvil no ofrece `fechaFin`, pero el recorrido completo de publicación → compra → utilización → reseña → experiencias anteriores funciona sin ese campo. El DTO de experiencias conserva `fechaFin` como fecha ISO o `null`; si está presente, el frontend valida su formato y su relación con el inicio. La definición de `finalizado` del evento sigue siendo independiente y no cambia por publicar o consultar reseñas. El promedio general del organizador continúa incluyendo todas sus reseñas.

## Contrato HTTP

Se reciben y devuelven objetos JSON. Los campos desconocidos en los cuerpos se rechazan. Las fechas deben ser ISO 8601 con zona horaria, por ejemplo `2030-12-01T21:00:00Z`. Express limita el cuerpo a `100kb`.

| Código | Significado |
| --- | --- |
| `200` | Consulta o modificación completada. |
| `201` | Recurso creado; también recuperación de una creación idempotente. |
| `204` | Eliminación completada, sin cuerpo. |
| `400` | Datos, campos o JSON inválidos. |
| `401` | Falta identidad de desarrollo en una operación que la requiere. |
| `403` | Falta de permiso. |
| `404` | Recurso, usuario de referencia o ruta inexistente. |
| `409` | Conflicto de estado, cupo, precio o regla de negocio. |
| `413` | Cuerpo demasiado grande. |
| `500` | Error interno no previsto. |

Los errores se responden como `{"message":"Descripción del error"}`.

### Endpoints

| Método | Ruta | Acceso o propósito |
| --- | --- | --- |
| GET | `/health` | Comprobación pública de servicio. |
| GET, POST | `/usuarios` | Listar perfiles o crear un comprador. |
| GET | `/usuarios/:id` | Perfil básico público. |
| PATCH, DELETE | `/usuarios/:id` | Propio usuario; el borrado protege sus relaciones. |
| GET | `/usuarios/:id/favoritos` | Propio usuario. |
| PUT, DELETE | `/usuarios/:id/favoritos/:eventoId` | Agregar o quitar favorito del propio usuario. |
| GET | `/usuarios/:id/resenias` | Reseñas públicas recibidas como organizador. |
| GET | `/usuarios/:id/reputacion` | Promedio y cantidad de reseñas recibidas. |
| GET, POST | `/categorias` | Listar o crear categorías. |
| GET, PATCH, DELETE | `/categorias/:id` | Consultar o gestionar; una categoría en uso no se elimina. |
| GET | `/eventos` | Catálogo y filtros. |
| POST | `/eventos` | Publicación por un organizador. |
| GET | `/eventos/:id` | Detalle público. |
| PATCH, DELETE | `/eventos/:id` | Gestión por el propietario. |
| GET, POST | `/eventos/:id/tipos-entrada` | Consulta pública; alta por el propietario. |
| GET, PATCH, DELETE | `/eventos/:id/tipos-entrada/:tipoEntradaId` | Consulta pública; cambios por el propietario. |
| GET | `/eventos/:id/compras` | Lista privada de ventas del organizador. |
| GET | `/eventos/:id/ventas` | Resumen privado de compras y cupos del organizador. |
| GET | `/eventos/:id/resenias` | Reseñas públicas del evento. |
| GET | `/eventos/:id/experiencias-anteriores` | Reseñas públicas de eventos anteriores del mismo organizador, sin exigir fecha de fin. |
| GET | `/compras` | Compras propias; con `eventoId`, ventas de un evento propio. |
| POST | `/compras` | Comprar entradas como comprador. |
| GET | `/compras/:id` | Comprador u organizador participante con su rol. |
| PATCH | `/compras/:id/estado` | Confirmación o utilización por el organizador. |
| POST | `/compras/:id/cancelacion` | Cancelación por el comprador propietario. |
| GET, POST | `/compras/:id/mensajes` | Conversación privada entre participantes. |
| GET | `/compras/:id/historial` | Historial privado de cambios de estado. |
| GET, POST | `/resenias` | Consulta pública; creación por comprador elegible. |
| GET, PATCH, DELETE | `/resenias/:id` | Consulta pública; cambios por el autor. |
| GET, POST | `/items` | Ejemplo técnico independiente del dominio de entradas. |

`GET /eventos/:id/ventas` devuelve `{evento, compras}` con todos los tipos y cupos, incluso cero, y el comprador mínimo de cada venta. Los filtros de estado del panel se aplican en el cliente. El cupo ya es disponibilidad restante; no se restan las ventas nuevamente.

### Consultas y ordenamiento

| Recurso | Parámetros admitidos |
| --- | --- |
| `/eventos` | `q`, `categoriaId`, `organizadorId`, `orden`, `incluirPasados` |
| `/compras` | `eventoId`, `estado` |
| `/eventos/:id/compras` | `estado` |
| `/resenias` | `eventoId`, `organizadorId`, `compraId` |

`orden` admite `fecha` ascendente, `precio` mínimo ascendente o `puntaje` descendente. Los empates se resuelven por fecha e ID; los organizadores sin reseñas quedan al final al ordenar por puntaje. `incluirPasados` admite `true` o `false`.

### Cuerpos principales

Publicar con identidad de organizador. Sustituir las fechas por valores futuros al momento de ejecutar el ejemplo:

```json
{
  "nombre": "Encuentro musical",
  "descripcion": "Presentación en vivo",
  "categoriaId": "demo-categoria-1",
  "fecha": "2030-12-01T21:00:00Z",
  "fechaFin": "2030-12-01T23:00:00Z",
  "tiposEntrada": [
    {"nombre": "General", "descripcion": "Acceso general", "precio": 1000, "cupo": 3},
    {"nombre": "VIP", "precio": 2500, "cupo": 2}
  ]
}
```

`fechaFin` y `multimedia` son opcionales. Los tipos de entrada se gestionan después mediante sus rutas anidadas; PATCH de evento no reemplaza todo el arreglo ni cambia al organizador.

Crear una compra con los IDs devueltos por la publicación e identidad de comprador:

```json
{"eventoId":"ID_EVENTO","tipoEntradaId":"ID_TIPO","cantidad":2,"precioUnitarioEsperado":1000}
```

`precioUnitarioEsperado` es opcional en la API; el cliente móvil lo envía para detectar cambios de precio y solicitar una nueva revisión con `409`. El servidor no acepta comprador, total ni estado elegidos en el cuerpo.

| Operación | Cuerpo |
| --- | --- |
| Confirmar pago simulado | `{"estado":"CONFIRMADA"}` |
| Registrar uso | `{"estado":"UTILIZADA"}` |
| Cancelar | `{}` |
| Enviar mensaje | `{"mensaje":"¿A qué hora abren?"}` |
| Publicar reseña | `{"compraId":"ID_COMPRA","puntuacion":4.5,"detalle":"Buena experiencia"}` |
| Crear usuario | `{"nombre":"Ana","apellido":"Pérez"}` |
| Crear categoría | `{"nombre":"Música","descripcion":"Eventos musicales"}` |

Los mensajes admiten de `1` a `2000` caracteres tras quitar espacios exteriores. El ejemplo `/items` recibe `{"name":"Ejemplo"}`, con nombre de `1` a `100` caracteres.

### Reintentos e idempotencia

POST de eventos, compras, mensajes y reseñas admite `Idempotency-Key`, de `1` a `100` letras ASCII, números o guiones. La clave queda limitada al actor y, para mensajes o reseñas, también a la compra. El mismo intento recupera el recurso; reutilizar la clave para otro contenido produce `409`. Un error de validación no consume la clave.

Las claves del servidor duran lo mismo que sus repositorios. El cliente conserva intentos inciertos de compra, mensaje y reseña durante su ejecución, pero los pierde con una recarga completa. Consultar lo guardado antes de repetir una operación después de esa recarga.

## Acceso desde el celular con WSL

En WSL 2 con red NAT, el acceso a `localhost` desde Windows no garantiza acceso desde otro dispositivo. El backend informa sus direcciones internas y, si está configurada, `PUBLIC_API_URL`. Ver la [documentación de redes de WSL](https://learn.microsoft.com/en-us/windows/wsl/networking).

Obtener la IPv4 de la conexión de Windows con `ipconfig` y la IP de WSL con `wsl hostname -I` desde Windows. En PowerShell **como administrador**, reemplazar los dos marcadores antes de configurar el reenvío:

```powershell
$ipWindows = 'IP_WINDOWS'
$ipWsl = 'IP_WSL'
netsh interface portproxy add v4tov4 listenaddress=$ipWindows listenport=3000 connectaddress=$ipWsl connectport=3000 protocol=tcp
New-NetFirewallRule -Name IATicket-Api-WSL-3000 -DisplayName 'IA Ticket API WSL (TCP 3000, red local)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -LocalAddress $ipWindows -RemoteAddress LocalSubnet -Profile Any
```

La regla de firewall se crea una sola vez. Si ya existe o cambia una IP, revisar y actualizar la configuración correspondiente. Los valores `IP_WINDOWS` e `IP_WSL` son marcadores, no direcciones ejecutables. Si se cambia `PORT`, adaptar también los puertos del reenvío y las URLs.

Configurar `EXPO_PUBLIC_API_URL=http://IP_WINDOWS:3000/api` en `frontend/.env`. Opcionalmente, usar esa misma URL como `PUBLIC_API_URL` en `backend/.env`. Comprobar `/api/health` y `/api/categorias` desde el navegador del teléfono. El túnel de Expo solo transporta Metro; la API necesita acceso independiente.

## Pruebas

Desde la raíz:

```bash
npm test --workspace=backend
```

Las pruebas usan `node:test`, `node:assert/strict` y `fetch`. Crean repositorios y relojes aislados; las integraciones abren puertos locales temporales y los cierran al terminar. Los escenarios de `test/fixtures/demo.js` pertenecen exclusivamente a las pruebas y no se cargan al iniciar la aplicación.

La persistencia es volátil: no hay base de datos, archivos ni recuperación tras reiniciar el backend. El [README del frontend](../frontend/README.md) describe cómo verificar los recorridos en un teléfono.
