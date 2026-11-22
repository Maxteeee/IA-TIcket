# Maqueta con sesiones de prueba

## Arranque, SDK y conexión

La [guía principal](../README.md) reúne requisitos, instalación de Expo Go **compatible con SDK 54**, comandos de cada módulo, LAN/túnel, archivos .env y diagnóstico de conexión. El frontend usa Expo SDK 54, React 19.1 y React Native 0.81.5; no se requiere instalar un SDK de Android en el celular. En Android físico, usar la [descarga oficial de Expo Go para SDK 54](https://expo.dev/go?sdkVersion=54&platform=android&device=true).

Desde la raíz, `npm run backend` inicia la API en una terminal y `npm run frontend` inicia Metro por LAN en otra. Para el recorrido con túnel usado en este entorno, desde frontend ejecutar `npx expo start --go --tunnel`; limpiar caché con `--clear` si conserva una dirección anterior. Backend y frontend deben seguir funcionando simultáneamente. El túnel de Expo no expone la API: frontend/.env debe tener `EXPO_PUBLIC_API_URL=http://IP_ACCESIBLE:3000/api` y esa dirección debe responder `/api/health` desde el navegador del teléfono.

En WSL usar la IP de Windows y el reenvío TCP3000 explicado en [backend/README.md](../backend/README.md#acceso-desde-el-celular-con-wsl). Cambiar `PUBLIC_API_URL` del backend solo informa una dirección al arrancar; no configura la app ni habilita puertos. Reiniciar la API pierde sus datos; recargar la app conserva lo guardado mientras viva el backend.

La app **IA Ticket IT** usa dos perfiles locales, sin login. C3/C11 conectan Explorar, C4 publicación/eventos propios, C12 la compra, C1 mis compras, C2 ventas/disponibilidad, C5/C6 el chat C9/C10 las reseñas del comprador y experiencias anteriores, C7 la cancelación con reembolso simulado y C8 sus condiciones y seguimiento del organizador en el backend. No se precargan datos de negocio ni favoritos; las selecciones manuales de favoritos son locales por perfil. Empieza como **Comprador 1**. La barra superior muestra la sesión activa y un botón **Cambiar a Organizador 1 / Comprador 1**, disponible tanto en las pestañas como en los detalles.

| Perfil | Roles | Recorrido |
| --- | --- | --- |
| Comprador 1 | COMPRADOR | Explorar, favoritos propios, compras propias, chat de sus compras y reseñas elegibles |
| Organizador 1 | COMPRADOR, ORGANIZADOR | Todo lo anterior para sus propias compras, más creación y consulta de ventas de sus eventos |

El organizador mantiene la posibilidad de comprar, según el modelo acordado. Ser organizador no permite administrar eventos ajenos ni consultar sus ventas o conversaciones. No hay perfil de administrador.

## C3: búsqueda y exploración por categorías

Desde la raíz, iniciar con `npm run backend`. Se preparan solo Comprador 1, Organizador 1 y las cinco categorías base. El catálogo arranca vacío: primero crear un evento desde **Organizador 1 → Organizar → Crear un evento**. No se cargan eventos, compras, reseñas, conversaciones o favoritos de ejemplo, y los accesos Recorrer ejemplos se retiraron. Los escenarios completos existen únicamente en fixtures de pruebas.

Configurar en `frontend/.env` una dirección accesible desde el celular:

```dotenv
EXPO_PUBLIC_API_URL=http://IP_DE_LA_PC:3000/api
```

Si se cambia la variable, reiniciar Expo para que la tome. En el celular, localhost apunta al propio teléfono. El túnel de Expo transporta Metro; la API necesita acceso independiente por la red. Comprobar `http://IP_DE_LA_PC:3000/api/health` desde el navegador del celular.

Con Expo abierto, como **Comprador 1 → Explorar**:

1. Se consultan categorías y eventos reales del servidor. No se muestran fixtures si falla la conexión o el servidor está vacío.
2. Publicar un evento llamado Concierto de prueba, con descripción que incluya guitarras y categoría Música. Buscar `CONCIERTO`, `guitarras` o `musica`: debe aparecer el evento creado. La búsqueda incluye nombre, descripción y nombre de categoría, sin distinguir mayúsculas ni acentos.
3. Elegir **Teatro**: solo aparecen eventos que hayas creado en esa categoría. Mantener Teatro y buscar el concierto anterior: no debe aparecer porque ambos filtros se combinan.
4. Usar **Limpiar filtros** para volver a Todos y búsqueda vacía. El banner de música también selecciona el ID de la categoría real.
5. Abrir un resultado: su detalle se consulta por ID en la API, con nombre de organizador y tipos de entrada reales. Abrirlo no crea una compra; C12 permite seleccionar y confirmar desde ese detalle.
6. Arrastrar para actualizar o usar **Volver a intentar** ante un error. La ausencia de eventos publicados se distingue de una búsqueda sin coincidencias.

Se esperan 300 ms al escribir para no consultar por cada tecla. Al cambiar filtros, volver o alternar perfil se cancela la solicitud pendiente y sus respuestas atrasadas no pueden sobrescribir la consulta actual. Los filtros se conservan por perfil; las categorías se cargan al entrar y al actualizar/reintentar.

C11 conecta el ordenamiento del catálogo con la API, según se describe a continuación. C4 publica, C12 compra, C1 consulta compras, C2 muestra ventas/cupos y C5/C6 conectan su chat. C9 permite reseñar desde una compra utilizada sin exigir finalización del evento, y C10 muestra experiencias anteriores del organizador en el detalle conectado. Favoritos consulta el mismo catálogo real y conserva la selección local por usuario; la publicación de reseñas se hace desde la compra. El detalle muestra **Lugar a confirmar** porque el dominio actual aún no modela ubicación.

## C11: ordenar los resultados

En **Comprador 1 → Explorar**, los controles **Fecha ↑**, **Precio ↑** y **Puntaje ↓** consultan la API con `orden=fecha|precio|puntaje` y conservan la búsqueda y categoría seleccionadas.

- **Fecha ↑:** primero el evento más próximo. Es el orden inicial.
- **Precio ↑:** de menor a mayor, tomando el tipo de entrada más barato. La tarjeta conserva el rango mínimo–máximo. Se mantiene la convención existente de incluir tipos agotados y se muestran centavos cuando hay importes fraccionarios.
- **Puntaje ↓:** de mayor a menor promedio del organizador sobre todas sus reseñas. Un promedio de cero sigue siendo una puntuación válida; los organizadores sin reseñas quedan al final.

El orden elegido queda resaltado y se conserva al abrir un detalle, volver o cambiar de perfil. Limpiar texto/categoría no cambia ese orden. Cambiar de criterio cancela la consulta anterior; la pantalla respeta el orden recibido del servidor, sin reordenar la lista por su cuenta. Los empates se resuelven por fecha ascendente y luego ID.

Las tarjetas y el detalle muestran el promedio y la cantidad de reseñas del organizador, o **Sin reseñas**. El backend entrega ambos valores; el frontend no descarga ni inventa reseñas para calcularlos. C9 publica reseñas reales que actualizan esos valores. C10 presenta las experiencias anteriores en el detalle sin recalcular ese promedio general a partir de la lista visible.

Para comparar fecha/precio, publicar varios eventos con valores diferentes desde Organizador 1. Para comparar reputación se necesitan reseñas reales de eventos anteriores según C9/C10. Los escenarios automáticos de prueba cubren promedio 4,5, cero y ausencia sin precargarlos en la app. No reiniciar un backend con datos que se quieran conservar.

## C4: publicar un evento con varios tipos de entrada

Iniciar el backend con `npm run backend`, sin eventos de ejemplo. Prepara cinco categorías y las identidades locales de **Comprador 1** y **Organizador 1**. La app sigue sin login: el servicio envía el ID del perfil activo y el servidor comprueba su rol almacenado. Los roles no se aceptan al crear o editar perfiles por API.

Recorrido para probar:

1. Cambiar a **Organizador 1 → Organizar → Crear un evento**. La lista de publicaciones propias proviene de la API y puede estar vacía al comenzar.
2. Completar nombre, descripción, una fecha futura `DD/MM/AAAA`, hora local `HH:mm` y una categoría del servidor. La fecha/hora se convierten a ISO con zona horaria al enviar.
3. Agregar **General**, **Platea** o **VIP**, con sus descripciones opcionales, precios y cupos independientes. Se pueden agregar y quitar filas, conservando al menos una.
4. Publicar. Durante el envío se bloquean nuevas pulsaciones y la edición de campos. Al completar, aparece **Tu evento fue publicado**, con los tipos, precios y cupos reales consultados por su ID.
5. Volver a **Tus eventos publicados** o usar **Ver publicación en el catálogo**. Cambiar a **Comprador 1 → Explorar** y buscar el nombre: el mismo evento aparece en C3 y se puede ordenar con C11.
6. Recargar la app y volver a Organizar: la publicación sigue disponible mientras el mismo backend permanezca activo. Reiniciar el servidor pierde sus datos en memoria.
7. Probar una fecha imposible, precio negativo/con más de dos decimales o cupo fraccionario: se informa el error sin publicar parcialmente. Si falla la conexión, el formulario conserva lo ingresado y permite reintentar.

Los precios admiten coma o punto decimal y hasta dos decimales; cupos enteros y precios de 0 o más, de acuerdo con la validación vigente del backend. Los identificadores temporales de las filas no se envían al servidor. El organizador se deriva de `X-Usuario-Id`; el cuerpo no puede asignarlo a otra persona.

La misma publicación conserva una clave de reintento mientras no cambie su contenido. El backend evita duplicados si llegan dos solicitudes con esa clave o si se perdió la respuesta después de guardar. Una clave reutilizada con otro contenido produce conflicto. Estas claves, como los eventos, duran durante el proceso del servidor.

La lista de publicaciones propias es real y abre el panel de C2 con sus compras y disponibilidad; después de publicar conserva la confirmación **Tu evento fue publicado**. Los accesos a ventas/edición de ejemplo se retiraron; las publicaciones y compras visibles provienen de la API. C12 permite comprar desde el detalle público.

## C12: comprar un tipo de entrada y una cantidad

**DD-07 — Eventos propios:** el perfil organizador conserva su rol de comprador para eventos ajenos. Al abrir una publicación propia se ve **Este evento es tuyo** y se consultan tipos/cupos, con compra y reintentos bloqueados. La API también rechaza autocompras con 409, sin reservar ni guardar. La [decisión de diseño](../backend/README.md#decisión-de-diseño-dd-07-no-comprar-entradas-de-eventos-propios) está confirmada y documentada en el backend; no se cancelan registros anteriores automáticamente.

Con el backend activo y la dirección de API configurada:

1. Publicar un evento futuro como **Organizador 1** con al menos dos tipos, por ejemplo General (precio 1200,50, cupo 3) y VIP (precio 5000, cupo 2). No se precargan eventos para este recorrido.
2. Cambiar a **Comprador 1 → Explorar**, buscarlo y abrirlo. Elegir General y aumentar la cantidad. El selector admite desde 1 hasta el cupo de ese tipo; un tipo agotado no se puede seleccionar.
3. Tocar **Continuar**, revisar tipo, cantidad y total, y **Confirmar compra**. Durante el envío se bloquean los controles y las pulsaciones repetidas.
4. Se consulta y muestra el **Comprobante de compra** real con ID, estado, tipo, cantidad, precio unitario y total registrados. Queda **PENDIENTE**: se reservan las entradas y no se realiza ningún cobro, siguiendo la política actual del backend.
5. Tocar **Volver al evento**: General tiene el cupo reducido y VIP conserva el suyo. Una nueva compra debe respetar la disponibilidad restante. Si otra persona consumió el cupo o cambió el precio entre consulta y confirmación, se muestra el error, se actualiza el detalle y se puede corregir/revisar antes de confirmar nuevamente.
6. Desde **Compras** o **Ver mis compras** en el comprobante se recuperan todas las compras de ese perfil por API (C1). También aparecen después de recargar la app mientras el backend siga activo. El organizador consulta esas mismas compras y la disponibilidad desde el evento en C2.
7. Si se pierde la respuesta, **Reintentar compra** consulta el resultado mediante el mismo intento sin descontar otra vez. La selección queda bloqueada hasta resolverlo; volver al evento o cambiar de perfil conserva ese intento por comprador y evento dentro de la misma ejecución de la app.

El frontend envía únicamente evento, tipo, cantidad y precio esperado, con identidad del perfil y una clave de reintento. El backend exige rol COMPRADOR almacenado, valida fecha/tipo/cantidad/cupo y calcula el total en centavos. Dos compradores no pueden quedarse con la última entrada. El comprobante conserva el precio y nombre del tipo al comprar aunque después se editen.

La compra vive en el backend y sobrevive a recargar la app mientras ese proceso siga activo; C1 recupera todas las compras de la identidad activa. Las claves pendientes del cliente viven en memoria y se pierden al recargar completamente la app; no hay recuperación automática de un intento incierto después de esa recarga, pero el listado permite comprobar si se registró. C5 conecta el chat del comprador y C9 sus reseñas elegibles. C7 conecta cancelación y reembolso simulado desde el comprobante; las reservas pendientes no caducan automáticamente. No hay cobros ni movimientos reales de dinero.

## C1: consultar mis compras, estados y días restantes

1. Como **Comprador 1**, realizar una o varias compras con C12 y entrar a **Compras**. Se consultan todas las compras de ese usuario, con nombre/fecha del evento, tipo adquirido, cantidad, total, ID y estado escrito con un color distintivo.
2. Usar los filtros **Todas**, **Confirmada**, **Pendiente de pago**, **Utilizada**, **Cancelada** y **Reembolsada**. Un estado sin registros muestra su propio mensaje; no tener compras muestra una invitación a explorar. Los filtros solo seleccionan las compras recibidas de la sesión activa.
3. Abrir una tarjeta: el comprobante se consulta de nuevo por ID y permite regresar a **Mis compras** o al evento. Tanto lista como detalle muestran los días restantes únicamente en estado CONFIRMADA; los demás estados no llevan cuenta regresiva.
4. Alternar a **Organizador 1 → Compras**: muestra sus compras como comprador, separadas de las de Comprador 1 y de las ventas de sus eventos. No necesita haber comprado nada para mostrar correctamente la lista vacía.
5. Recargar completamente la app y volver a Compras: recupera los registros de la API, sin depender del último ID guardado en React. Reiniciar el backend sí borra las compras por el almacenamiento en memoria.
6. Arrastrar para actualizar o volver del segundo plano para consultar estados/días otra vez. Se distinguen carga, error con reintento, lista vacía y filtro sin resultados. Salir o cambiar de perfil cancela la consulta y descarta respuestas tardías.

Los días provienen del reloj del servidor: períodos de 24 horas hasta el inicio, redondeados hacia arriba, mínimo cero. Se muestra **1 día restante**, **2 días restantes**, etc.; una confirmada cuyo evento comenzó muestra **0 días restantes**. No se usa la hora del teléfono para recalcularlos ni se ocultan las compras de eventos pasados. El DTO incluye el nombre y fecha del evento, evitando depender del catálogo de próximos eventos o consultar cada tarjeta por separado.

Las compras nuevas siguen PENDIENTE porque no hay pagos conectados. Para revisar manualmente una confirmada de un evento publicado por Organizador 1, se puede usar la operación de estado existente del backend con el ID del comprobante, antes de que empiece el evento:

```bash
curl -X PATCH http://localhost:3000/api/compras/ID_COMPRA/estado \
  -H 'Content-Type: application/json' \
  -H 'X-Usuario-Id: organizador-1' \
  -d '{"estado":"CONFIRMADA"}'
```

Actualizar Compras en el teléfono para ver el cambio y los días. Esto usa el circuito manual existente, sin ejecutar un pago. Las pruebas automatizadas cubren los cinco estados con datos aislados; C1 no agrega transiciones de cancelación/reembolso. El arranque solo prepara los dos perfiles y categorías; las compras deben crearse desde la app.

Compras muestra únicamente registros de la API. Sin compras creadas por el usuario, la lista está vacía; no hay datos de ejemplo como respaldo.

## C2: compras de un evento y disponibilidad por tipo

Con el backend activo y la API configurada:

1. Como **Organizador 1 → Organizar**, crear un evento con General (precio 1200,50, cupo 3) y VIP (precio 5000, cupo 2), o abrir una publicación propia anterior en **Tus eventos publicados**.
2. Se abre **Compras del evento**. Se muestran nombre/fecha del evento y disponibilidad de cada tipo, incluidos los agotados con **0 · Agotadas**. Si todavía no tiene compras, el mensaje lo indica sin ocultar sus cupos.
3. Cambiar a **Comprador 1**, buscar ese evento en Explorar y comprar 2 General con C12.
4. Volver a **Organizador 1 → Organizar → evento**: aparece la compra del comprador, con ID, estado **Pendiente de pago**, tipo, cantidad 2, precio unitario histórico y total registrado. General queda con **1 disponible** y VIP conserva **2 disponibles**.
5. Usar los filtros de estado. Solo cambia la lista de compras; los cupos siguen correspondiendo al evento completo. El mensaje de filtro vacío se distingue de un evento que todavía no tiene compras. Confirmada, utilizada, cancelada y reembolsada tienen etiquetas y colores propios si existen registros en esos estados.
6. Arrastrar para actualizar o volver del segundo plano: se consultan compras y cupos juntos nuevamente. Salir o alternar perfil cancela la consulta y descarta respuestas tardías. Error y reintento no sustituyen datos reales con ejemplos.
7. Recargar la app y abrir de nuevo la publicación: conserva compras y disponibilidad mientras el backend siga activo. Los eventos pasados también están accesibles desde Organizar; las compras personales de la pestaña Compras siguen separadas de las ventas.

Solo el propietario con rol ORGANIZADOR puede consultar esta información. El backend lo valida aun si el frontend declara un rol falso; haber comprado una entrada no permite acceder a todas las ventas. Las compras de otros eventos no se mezclan. **Ver publicación en el catálogo** permite volver al detalle público cuando la sesión también tiene capacidad de comprador.

El cupo mostrado ya es la cantidad restante del backend: no se descuentan las compras una segunda vez. Las pendientes reservan según la regla existente y confirmar/utilizar no vuelven a descontar. La operación manual de confirmación de la sección C1 permite revisar otro estado sin agregar pagos ni botones de modificación en esta pantalla. Si se edita un tipo por API, la disponibilidad muestra sus datos actuales y cada compra conserva su nombre/precio originales.

El panel de C2 no agrega edición, pagos, cancelación ni devolución de cupo. C6 agrega **Abrir conversación** en cada compra, reutilizando el chat de C5. El panel muestra únicamente las compras reales del evento. Además de históricos aislados, C7 ahora genera cancelaciones/reembolsos simulados reales del backend, visibles al consultar este panel otra vez.

## C5: enviar mensajes desde una compra

1. Como **Comprador 1**, comprar un evento con C12 y abrir **Compras → compra → Abrir conversación**. También está disponible desde el comprobante inmediatamente después de comprar.
2. Aparece el chat real asociado al ID de esa compra. Si está vacío, se invita a escribir la primera consulta. Escribir y tocar **Enviar mensaje**: se muestra como **Vos · Enviado**, con la fecha/hora registrada por el servidor. No aparece como enviado hasta recibir su confirmación.
3. Volver a la compra, abrir el chat otra vez o recargar la app: los mensajes guardados reaparecen mientras el mismo backend permanezca activo. Comprar otra entrada en una compra distinta no comparte la conversación, aunque sea el mismo evento.
4. Usar **Actualizar conversación**, arrastrar para actualizar o volver del segundo plano para consultar el historial nuevamente. Los mensajes del organizador se distinguen como **Organizador** y son los mismos que envía desde C6. No se agregaron actualizaciones por WebSocket ni notificaciones.
5. Se puede abrir y enviar en cualquier estado, incluso utilizada, cancelada o reembolsada, y después del evento. No hay bloqueo por fecha ni estado en el botón del comprobante o el servicio. Estas operaciones no cambian el estado, el cupo ni el historial de cambios de compra.
6. Texto vacío/solo espacios no se envía. El límite es 2000 caracteres, acorde con backend; admite saltos de línea y caracteres especiales. Durante envío se bloquea el compositor y las pulsaciones repetidas.
7. Si falla el envío, se conserva el texto. Si no se conoce el resultado, **Reintentar envío** usa el mismo mensaje e intento para recuperar el registro sin duplicarlo; la selección queda bloqueada hasta resolverlo. Navegar o alternar perfil mantiene ese intento por comprador/compra durante la misma ejecución de la app.

Se comprueban rol de comprador y propiedad al consultar y enviar; comprar el mismo evento no permite leer la conversación de otra compra. El backend autoriza exclusivamente sus participantes con el rol correspondiente y deriva autor/fecha de la identidad y reloj del servidor, rechazando esos campos en el cuerpo. El perfil Organizador 1 usa esta entrada para sus compras personales como comprador; para responder a ventas abre la conversación desde Organizar, según C6.

C7 genera cancelaciones/reembolsos simulados y conserva la conversación; las pruebas anteriores también usan históricos aislados. Para revisar una conversación después del evento basta mantener la compra y abrirla desde Mis compras cuando pase la fecha. El backend no se reinicia para probarlo: reiniciar borra compras y mensajes.

La clave de un envío incierto del cliente es volátil: una recarga completa la pierde. Consultar el historial antes de volver a enviar en ese caso. No hay edición/borrado de mensajes, persistencia externa ni indicación de lectura. El chat consulta únicamente las compras creadas en la API; no hay conversaciones de ejemplo.

## C6: responder como organizador

1. Como **Organizador 1**, publicar un evento con C4. Cambiar a **Comprador 1**, comprarlo con C12 y enviar una consulta desde **Compras → compra → Abrir conversación** (C5).
2. Cambiar a **Organizador 1 → Organizar → Tus eventos publicados → evento**. En la tarjeta de esa compra tocar **Abrir conversación**: aparece **Chat de la venta** con el mismo ID e historial que consulta el comprador.
3. La consulta recibida se identifica como **Comprador**. Escribir una respuesta y tocar **Responder mensaje**. Aparece como **Vos · Enviado**, con la fecha/hora del servidor cuando confirma el envío.
4. Volver a **Comprador 1 → Compras → compra → Abrir conversación**: la respuesta aparece como **Organizador**. También se puede usar **Actualizar conversación**, arrastrar para actualizar o volver del segundo plano. Recargar la app conserva el historial mientras siga activo el backend.
5. Volver como organizador al evento y abrir otras compras: cada una mantiene su conversación propia. No se mezclan compradores ni eventos. El botón permanece disponible en todos los estados y para eventos pasados, incluso utilizados, cancelados o reembolsados si esos registros existen.
6. Ante una respuesta de red incierta, el texto y la clave se conservan por autor/compra en la misma ejecución. **Reintentar envío** recupera la respuesta sin duplicarla aunque el comprador ya la haya recibido. Se mantienen límites de texto, bloqueos de envío y errores/reintentos de C5; el chat no cambia cupos ni estados.

Se exige ORGANIZADOR y que la compra pertenezca al evento seleccionado y al organizador activo, tanto al consultar como al responder. No hace falta tener también rol de comprador. Cambiar la perspectiva del chat no concede permisos; organizadores ajenos y compradores que intenten entrar como organizador son rechazados. Los mensajes se distinguen por la identidad del autor y se validan contra los dos participantes.

Las compras personales de Organizador 1 siguen en **Compras** con la perspectiva comprador; sus ventas y conversaciones se abren desde **Organizar**. Se reutilizan la pantalla y servicio de C5 y los mensajes embebidos en Compra; no se crea un segundo chat. Puede iniciar una conversación vacía sobre una compra existente, sin exigir que el comprador haya escrito primero.

C6 no agrega notificaciones, lectura, edición/borrado ni WebSocket/polling. C7 permite generar canceladas/reembolsadas simuladas sin bloquear esta conversación; las pruebas anteriores también usan históricos aislados. La clave de envío incierto se pierde con una recarga completa: consultar historial antes de reenviar en ese caso. Los chats de ejemplos siguen separados de los reales.

## C9: puntuar y comentar un evento desde la compra

1. Como **Comprador 1 → Compras**, abrir una compra real. Cuando esté UTILIZADA aparece **Tu experiencia cuenta** y se habilita **Reseña de mi compra**, según el backend. No hace falta esperar a que termine el evento ni cargar fechaFin.
2. Abrir la reseña e ingresar una puntuación numérica de **0 a 5**, con coma o punto para decimales, y un comentario obligatorio de hasta **1500 caracteres**. Cero es una puntuación válida, distinta de dejar el campo vacío.
3. Tocar **Publicar reseña**. Los campos se bloquean durante el envío; se confirma que fue publicada y se muestran el puntaje/comentario guardados para esa compra. No se presenta una reseña como guardada antes de recibir la respuesta válida del servidor.
4. Volver al comprobante, abrir la reseña otra vez o recargar la app: sus reseñas se consultan por ID de compra y se recuperan mientras permanezca activo el mismo backend. No se mezclan con compras de otros usuarios ni con reseñas de la maqueta.
5. Consultar un próximo evento del mismo organizador en Explorar: C11 muestra el promedio y conteo que incluyen la reseña publicada. C10 muestra también el texto, autor, puntaje y evento de origen en **Experiencias anteriores** cuando el evento reseñado es anterior y está finalizado por fechaFin; esa selección conserva su regla independiente.
6. Error de validación conserva el formulario. Si se pierde la respuesta, **Reintentar publicación** conserva puntuación, comentario y clave para recuperar la misma reseña sin duplicar ni alterar dos veces la reputación. Salir/perfil cancela solicitudes y evita respuestas tardías. Actualizar o volver a la app vuelve a consultar la habilitación del servidor.

**DD-02 actualizada el 2026-11-22 por el usuario:** basta con una compra propia UTILIZADA, sin exigir finalización del evento ni fechaFin. La elegibilidad viene en `puedeReseniar`, calculada por el servidor; no se confía en el estado enviado por el cliente. El backend vuelve a comprobar identidad/rol/propiedad y elegibilidad al guardar. Organizador 1 puede reseñar una compra personal, pero no las compras de los compradores de sus eventos.

**Preparar una prueba real:** el circuito de utilización ya existe en el backend; C9 no agrega botones para marcar uso. Publicar un evento futuro, comprar antes de que comience y usar las operaciones siguientes con el ID de la compra del evento publicado por Organizador 1:

```bash
curl -X PATCH http://localhost:3000/api/compras/ID_COMPRA/estado \
  -H 'Content-Type: application/json' -H 'X-Usuario-Id: organizador-1' \
  -d '{"estado":"CONFIRMADA"}'
curl -X PATCH http://localhost:3000/api/compras/ID_COMPRA/estado \
  -H 'Content-Type: application/json' -H 'X-Usuario-Id: organizador-1' \
  -d '{"estado":"UTILIZADA"}'
```

Confirmar debe hacerse antes del inicio. Una vez marcada UTILIZADA, actualizar el comprobante y publicar la reseña: no es necesario modificar el evento ni esperar una fecha. No hay compras precargadas para los perfiles locales. Las pruebas automatizadas no necesitan esperar ni reiniciar el servidor del usuario.

**Cantidad de reseñas pendiente de definición:** se mantiene la posibilidad previa del backend de publicar varias por compra; no se agregó una restricción de unicidad sin confirmación. Cada publicación confirmada es una reseña independiente; los reintentos con la misma clave recuperan la misma. La pantalla muestra las reseñas de esa compra. Las claves inciertas del cliente sobreviven navegación/perfil, pero se pierden al recargar completamente: consultar lo guardado antes de volver a publicar en ese caso.

C9 no agrega edición/borrado desde la app, cambios de estado ni cancelación/reembolso. C10 incorpora la lectura pública descrita a continuación. No hay formularios alimentados con compras o reseñas precargadas.

## C7: cancelar una compra y recuperar el importe simulado

1. Como **Comprador 1**, comprar un evento futuro y abrir **Compras → compra → Cancelar compra**. Se muestra el efecto antes de confirmar y se puede elegir **Conservar compra**.
2. Para una **pendiente**, confirmar la cancelación: queda **Cancelada** y devuelve sus entradas al cupo. El comprobante muestra el total/importe pendiente como simulado; no hay reembolso porque no había pago confirmado.
3. Para una **confirmada**, preparar otra compra y confirmar mediante el PATCH manual del apartado C1, siempre antes del inicio. Actualizar el comprobante y cancelar: se anticipa el total original a reembolsar; al recibir la respuesta queda **Reembolsada**, con importe, fecha y aviso explícito de simulación. El historial guarda CANCELADA y luego REEMBOLSADA. Si el precio del tipo cambió, devuelve el total original de esa compra. Una compra gratuita conserva reembolso cero.
4. Volver a **Mis compras**: aparece el estado actualizado. Como **Organizador 1**, consultar el evento en Organizar para ver el estado de la venta y el cupo recuperado del tipo elegido. El chat continúa disponible.
5. Compra utilizada o evento iniciado: no ofrece cancelación y explica la restricción. Si el inicio ocurre después de cargar la pantalla, el servidor rechaza al confirmar y se vuelve a consultar el comprobante. No depende de la hora del teléfono ni de fechaFin.
6. Si falla la conexión, muestra **Reintentar cancelación** y **Actualizar compra** para recuperar el resultado. Reabrir el comprobante o recargar la app también consulta el estado guardado mientras viva el backend. Reintentar nunca devuelve cupo ni importe por segunda vez, incluso si el evento comenzó o esas entradas ya fueron vendidas de nuevo.

Reglas confirmadas: solo comprador propietario con rol COMPRADOR; PENDIENTE/CONFIRMADA y estrictamente antes del inicio. Devolución completa de cupo una vez; pendientes sin reembolso, confirmadas con devolución simulada del total original. Las restricciones expresadas en C8 se aplican en esta misma operación necesaria para C7; no hay una acción adicional del organizador para aprobar o ejecutar la cancelación. **Todos los importes a pagar y reembolsar son simulados; no hay dinero real.** La confirmación/utilización siguen siendo manuales por API, sin agregar pagos ni sus botones.

`purchasesService.cancel` hace POST `/compras/:id/cancelacion` con `{}` e identidad de prueba, coalesce doble pulsación por comprador/compra y valida estado/autor/ID/reembolso del servidor. El DTO incluye `puedeCancelar` y `reembolso: null | {importe,fecha,simulado:true}`; las otras pantallas los preservan. Los históricos con solo estado REEMBOLSADA sin registro no inventan un importe devuelto. Comprobante bloquea envío/refresco simultáneos, cancela solicitudes al salir/perfil y descarta respuestas tardías. Backend realiza la operación completa de forma síncrona e idempotente; no necesita conservar una clave de cancelación en el teléfono ni crea entidad/repositorio de pagos.

## C8: condiciones de cancelación y seguimiento del organizador

**Organizador 1 → Organizar → Tus eventos publicados → evento** muestra la política en **Cancelaciones de compradores**: cada comprador puede cancelar una compra propia pendiente/confirmada antes del inicio, siempre que no se haya utilizado. Es una regla fija confirmada, aplicada por el backend en la operación de C7; no requiere aprobación del organizador ni agrega un interruptor para desactivarla.

Para probar el seguimiento:

1. Crear un evento con General y VIP, y comprar como Comprador 1. En Organizar se ven la compra y el cupo reservado.
2. Cancelar desde el comprobante del comprador según C7. Reabrir el panel del evento o arrastrar para actualizar: se ve **Cancelada**, o **Reembolsada** si estaba confirmada, y el cupo recuperado del mismo tipo. Los otros tipos no cambian. Los filtros conservan todos esos estados.
3. Cada venta muestra **Total simulado** y, si tiene registro, **Reembolso simulado** con el importe original. Los registros históricos sin datos de reembolso no inventan un monto. El chat permanece disponible.
4. Utilizar otra compra con el circuito manual existente: la cancelación del comprador se bloquea, conserva estado/cupo y no genera un reembolso. Desde el instante de inicio también se bloquea, aunque no tenga fechaFin o el comprador haya abierto el comprobante antes del límite.

La validación usa el reloj del servidor. Ante utilización/cancelación simultáneas solo una puede completarse: si se utiliza primero no hay devolución; si se cancela primero no puede utilizarse luego. El panel consulta el resultado actual del backend; no resta ni devuelve cupo por su cuenta, y se actualiza al entrar, arrastrar o volver a la app. El organizador consulta sus ventas, mientras el comprador ejecuta la cancelación de su propia compra.

## C10: leer experiencias anteriores antes de comprar

1. Como **Comprador 1**, abrir **Explorar → evento → Experiencias anteriores**. Cada tarjeta muestra autor, puntuación, comentario y nombre/fecha del evento reseñado. El detalle también muestra el promedio y cantidad de reseñas del organizador.
2. En el arranque vacío se muestra el estado sin experiencias. Crear eventos y reseñas reales por C4/C9 permite comprobar que otra edición del mismo organizador muestre esas experiencias; no se incorporan ejemplos históricos automáticamente.
3. Para probar datos nuevos, publicar una reseña por C9 y abrir una siguiente edición del mismo organizador: aparecerá al consultar. **Actualizar reseñas**, reabrir el detalle o volver de segundo plano consulta la API nuevamente.
4. Si falla la consulta, aparece un error con **Reintentar reseñas**. La carga/reintento de esta sección es independiente del detalle y la compra: conserva tipo/cantidad seleccionados. Salir del detalle o cambiar perfil cancela la consulta y descarta respuestas tardías.

Se reutiliza `GET /eventos/:id/experiencias-anteriores`, público. Solo incluye eventos distintos, anteriores por fecha de inicio al evento consultado, del mismo organizador y con fechaFin alcanzada según el servidor; admite otras categorías. El propio evento, posteriores/simultáneos y eventos sin fin o aún en curso quedan excluidos. El vacío indica que no hay experiencias elegibles para esa publicación, aunque el promedio general del organizador pueda incluir otras reseñas. Se conservan todas las reseñas elegibles, incluso cero/fracciones, sin imponer una nueva regla de unicidad.

`catalog.service` adapta los DTOs con los resúmenes de autor/evento; `PreviousEventReviews` maneja consulta, tarjetas y estados dentro del scroll de `EventDetailScreen`. No hay consultas por tarjeta ni fallback a fixtures. La maqueta anterior sigue separada. No se agregan dependencias, persistencia, autenticación, ordenamiento/paginación de reseñas ni cambios en la selección de compra.

## Cómo probar en el celular

Desde `frontend/`, usar el modo de Expo que ya funciona en el dispositivo:

```bash
npx expo start --go --tunnel
```

1. Como Organizador 1, publicar un evento futuro con varios tipos de entrada. Al iniciar, sus publicaciones están vacías.
2. Como Comprador 1, buscarlo en Explorar, abrirlo y comprar. Verificar comprobante, listado propio y cupos desde Organizador 1. El organizador no compra entradas de su propio evento (DD-07).
3. Abrir el chat desde el comprobante, enviar y responder como organizador desde esa venta. No hay conversaciones anteriores precargadas.
4. En Explorar o el detalle, tocar el corazón para guardar un evento real. Favoritos comienza vacío, permite quitarlo y conserva selecciones separadas por perfil durante esta ejecución de la app. La selección es local: todavía no se persiste por la API y se pierde con una recarga completa. Los favoritos no los asigna el organizador ni se cargan automáticamente.
5. Preparar manualmente los estados según C1/C7/C9 para probar días, cancelación/reembolso simulado y reseñas; el arranque no inventa esos estados ni sus datos.

Los eventos/compras/mensajes/reseñas creados viven en el backend mientras el proceso siga activo; los favoritos locales viven en la app. Hacer una recarga completa de Expo Go tras actualizar desde una versión con fixtures para descartar el estado anterior conservado por Fast Refresh. Reiniciar el backend elimina su memoria, incluidas creaciones propias; no se ejecuta un borrado de registros por API.

## Organización

- `src/services/api.client.js`: GET/POST JSON con timeout, cancelación y errores; identidad de prueba y clave de reintento para publicar/comprar.
- `src/services/catalog.service.js`: categorías, filtros HTTP y adaptación explícita de DTOs a las pantallas.
- `src/hooks/useCatalog.js`: carga, espera al escribir, cancelación por filtros/orden y reintentos.
- `src/screens/ConnectedCatalogScreen.js` y `CatalogEventScreen.js`: listado C3/C11 y detalle con datos reales, separados del resto de la maqueta.
- `src/services/events.service.js`: publicación y listado propio por sesión, con validación de rol e identidad de respuestas.
- `src/utils/eventDraft.js`: validación y preparación del formulario, sin IDs temporales en el contrato.
- `src/screens/ConnectedCreateEventScreen.js` y `ConnectedOrganizerScreen.js`: categorías, envío, publicaciones propias y estados de carga/error/vacío.
- `src/services/sales.service.js`: consulta privada de compras y cupos de un evento, validando organizador, evento, tipos y compradores del resumen.
- `src/screens/EventSalesScreen.js`: panel C2 desde publicaciones propias, disponibilidad completa, compras por estado y actualización/reintento.
- `src/services/chat.service.js`: perspectivas comprador/organizador, propiedad/relación con evento, mensajes, validación de texto/DTOs e intentos de envío por autor/compra.
- `src/screens/ConnectedChatScreen.js`: chat compartido desde comprobante o venta, etiquetas por perspectiva, historial, compositor, envío confirmado, errores y reintentos sin duplicados.
- `src/services/reviews.service.js`: carga por compra, validación de puntuación/comentario/DTOs y publicación con reintento sin duplicados.
- `src/screens/PurchaseReviewScreen.js`: formulario y reseñas reales de la compra, habilitación del servidor, confirmación y errores.
- `src/components/PreviousEventReviews.js`: experiencias públicas C10 en el detalle, autor/evento, carga/error/vacío y actualización independiente de la compra.
- `src/services/purchases.service.js`: creación/consulta privada y cancelación C7, adaptación de comprobantes/reembolsos, intentos por comprador/evento y reintentos sin duplicados.
- `src/screens/ConnectedPurchasesScreen.js`: listado propio de API, filtros por estado, carga/error/vacíos y actualización al entrar/refrescar/volver a la app.
- `src/components/PurchaseCountdown.js` y `src/utils/purchasePresentation.js`: días del servidor para confirmadas, compartidos por tarjeta y comprobante.
- `src/utils/purchaseIntent.js`: selección de tipo/cantidad y cálculo del total mostrado en centavos.
- `src/screens/EventDetailScreen.js` y `PurchaseReceiptScreen.js`: selección, resumen, envío, disponibilidad actualizada, errores/reintento y comprobante real. El modo de compra de ejemplos sigue explícitamente separado.
- `src/session/roles.js`: enum congelado de roles.
- `src/services/auth.mock.js`: respuesta simulada `{ usuario, roles }` y alternancia entre los dos perfiles. Cada respuesta copia sus datos para evitar modificaciones de otro consumidor.
- `src/session/MockSessionProvider.js`: contexto React con sesión activa y cambio de perfil. Reemplazable por el servicio real al integrar autenticación.
- `src/session/permissions.js`: permisos por rol, propiedad y participación, acceso a rutas y selección de datos por usuario.
- `src/components/SessionSwitcher.js`: identidad activa y botón para alternar.
- `src/MockApp.js`: navegación con rutas protegidas, acciones verificadas y estado de la maqueta. El contenido de las pantallas se vuelve a montar al cambiar de identidad para limpiar borradores.
- `src/data/mockData.js`: categorías visuales y colecciones iniciales vacías. Los escenarios antiguos se conservan únicamente en `test/fixtures/mockData.js`, fuera de la aplicación.

El rol de la sesión expresa capacidades. La perspectiva `comprador`/`organizador` de un detalle expresa desde qué relación se consulta una compra y también se valida: cambiar esa perspectiva por sí solo no otorga acceso.

Los IDs `comprador-1` y `organizador-1` de la sesión simulada corresponden a perfiles preparados por `server.js` en el backend local. El dominio distingue roles COMPRADOR y ORGANIZADOR no excluyentes. El backend exige ORGANIZADOR para publicar/consultar ventas (además de propiedad) y COMPRADOR para comprar/consultar compras propias, y los formularios de usuario no permiten otorgarse roles. Esto sigue siendo identidad de prueba por encabezado, sin autenticación real. La consulta del catálogo continúa siendo pública y no envía ese encabezado.

## Verificación

Desde la raíz:

```bash
npm test --workspace=frontend
```

Las pruebas usan el runner de Node, sin dependencias nuevas. Además de sesiones/permisos, verifican filtros HTTP, transformación de DTOs, cancelación, timeout, errores y el servicio real del frontend contra Express con dominio y repositorios en memoria. Las pruebas de integración necesitan dependencias del backend instaladas y permiso para abrir puertos locales temporales. Para ver cada caso en Node 24: `npm test --workspace=frontend -- --test-isolation=none`.

La exportación de Metro para Android/iOS verifica compilación y resolución de módulos; no sustituye la revisión de interacción en un dispositivo.

Verificado para C8: 131 pruebas de frontend y 69 de backend correctas (200 en total). Se conserva la cobertura anterior y se agregan cancelación pendiente/confirmada, importe histórico simulado/cero y fecha/autor, cupo, corte exacto, utilizadas, permisos/cuerpo, respuesta perdida/recarga/concurrencia sin duplicados, reventa de cupo, historial y chat posterior. C8 agrega seguimiento del organizador por tipo y prueba de utilización/cancelación concurrentes con solo una transición válida. Exportaciones Metro de Android/iOS sin bytecode en `/tmp/ai-ticket-c8-android` y `/tmp/ai-ticket-c8-ios`; no son instalaciones en el celular. La interacción en dispositivo queda pendiente.

Verificación de DD-07 y guía de arranque: 133 pruebas frontend y 70 backend correctas (203). Permisos bloquean eventos propios y conservan publicación/administración y compras ajenas. API rechaza autocompras con ambos roles y sin reservar cupo; formularios históricos de prueba usan eventos ajenos. Metro Android/iOS sin bytecode en /tmp/ai-ticket-dd07-android y /tmp/ai-ticket-dd07-ios; falta revisión de interacción en el dispositivo. La guía de SDK/enlaces oficiales se verificó el 2026-11-02 sin cambiar las dependencias.

Verificación de arranque sin datos de negocio: runner backend 71 y frontend 135 correctos (incluye carga de fixtures como módulos de prueba), nueva prueba de estado inicial vacío y referencias/permisos conservados. Se mantienen los escenarios de los CUs en fixtures exclusivos de tests. Metro Android/iOS sin bytecode en /tmp/ia-ticket-sin-demo-android e /tmp/ia-ticket-sin-demo-ios; no se verificó interacción propia en celular. Favoritos manuales sobre catálogo real, sin precarga ni persistencia nueva en API.
