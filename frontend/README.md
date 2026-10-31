# Maqueta con sesiones de prueba

La app usa dos perfiles locales, sin login. C3/C11 conectan Explorar, C4 publicación/eventos propios, C12 la compra, C1 mis compras, C2 las compras/disponibilidad de cada evento y C5/C6 el chat entre comprador y organizador con el backend. Los demás recorridos mantienen sus datos de maqueta. Empieza como **Comprador 1**. La barra superior muestra la sesión activa y un botón **Cambiar a Organizador 1 / Comprador 1**, disponible tanto en las pestañas como en los detalles.

| Perfil | Roles | Recorrido |
| --- | --- | --- |
| Comprador 1 | COMPRADOR | Explorar, favoritos propios, compras propias, chat de sus compras y reseñas elegibles |
| Organizador 1 | COMPRADOR, ORGANIZADOR | Todo lo anterior para sus propias compras, más creación, edición básica y consulta de ventas de sus eventos |

El organizador mantiene la posibilidad de comprar, según el modelo acordado. Ser organizador no permite administrar eventos ajenos ni consultar sus ventas o conversaciones. No hay perfil de administrador.

## C3: búsqueda y exploración por categorías

Desde la raíz, iniciar el backend con un catálogo de prueba opcional:

```bash
npm run backend:demo
```

Carga en memoria cinco categorías, cinco eventos futuros y dos pasados (no aparecen en el catálogo), con reseñas históricas para comparar puntajes. El inicio normal `npm run backend` prepara las categorías y los dos perfiles de prueba, sin eventos. El modo demo o `SEED_DEMO=true` agrega los ejemplos. El seeder no importa fixtures del frontend ni sobrescribe registros existentes. Reiniciar el backend pierde los datos de su proceso; no es necesario reiniciar un servidor en uso para ejecutar las pruebas automatizadas.

Configurar en `frontend/.env` una dirección accesible desde el celular:

```dotenv
EXPO_PUBLIC_API_URL=http://IP_DE_LA_PC:3000/api
```

Si se cambia la variable, reiniciar Expo para que la tome. En el celular, localhost apunta al propio teléfono. El túnel de Expo transporta Metro; la API necesita acceso independiente por la red. Comprobar `http://IP_DE_LA_PC:3000/api/health` desde el navegador del celular.

Con Expo abierto, como **Comprador 1 → Explorar**:

1. Se consultan categorías y eventos reales del servidor. No se muestran fixtures si falla la conexión o el servidor está vacío.
2. Buscar `CONCIERTO`, `guitarras` o `musica`: el catálogo de prueba devuelve Concierto del río. La búsqueda incluye nombre, descripción y nombre de categoría, sin distinguir mayúsculas ni acentos.
3. Elegir **Teatro**: aparece El umbral. Mantener Teatro y buscar `concierto`: no hay resultados porque ambos filtros se combinan.
4. Usar **Limpiar filtros** para volver a Todos y búsqueda vacía. El banner de música también selecciona el ID de la categoría real.
5. Abrir un resultado: su detalle se consulta por ID en la API, con nombre de organizador y tipos de entrada reales. Abrirlo no crea una compra; C12 permite seleccionar y confirmar desde ese detalle.
6. Arrastrar para actualizar o usar **Volver a intentar** ante un error. La ausencia de eventos publicados se distingue de una búsqueda sin coincidencias.

Se esperan 300 ms al escribir para no consultar por cada tecla. Al cambiar filtros, volver o alternar perfil se cancela la solicitud pendiente y sus respuestas atrasadas no pueden sobrescribir la consulta actual. Los filtros se conservan por perfil; las categorías se cargan al entrar y al actualizar/reintentar.

C11 conecta el ordenamiento del catálogo con la API, según se describe a continuación. C4 publica eventos reales desde Organizar, C12 permite comprarlos, C1 los consulta desde Compras, C2 muestra sus compras y cupos al organizador y C5/C6 conectan la conversación de cada compra para ambos participantes. Favoritos y reseñas conservan la maqueta, con sus datos separados. El catálogo conectado todavía no muestra acciones de favorito ni publicación de reseñas. El detalle muestra **Lugar a confirmar** porque el dominio actual aún no modela ubicación.

## C11: ordenar los resultados

En **Comprador 1 → Explorar**, los controles **Fecha ↑**, **Precio ↑** y **Puntaje ↓** consultan la API con `orden=fecha|precio|puntaje` y conservan la búsqueda y categoría seleccionadas.

- **Fecha ↑:** primero el evento más próximo. Es el orden inicial.
- **Precio ↑:** de menor a mayor, tomando el tipo de entrada más barato. La tarjeta conserva el rango mínimo–máximo. Se mantiene la convención existente de incluir tipos agotados y se muestran centavos cuando hay importes fraccionarios.
- **Puntaje ↓:** de mayor a menor promedio del organizador sobre todas sus reseñas. Un promedio de cero sigue siendo una puntuación válida; los organizadores sin reseñas quedan al final.

El orden elegido queda resaltado y se conserva al abrir un detalle, volver o cambiar de perfil. Limpiar texto/categoría no cambia ese orden. Cambiar de criterio cancela la consulta anterior; la pantalla respeta el orden recibido del servidor, sin reordenar la lista por su cuenta. Los empates se resuelven por fecha ascendente y luego ID.

Las tarjetas muestran el promedio y la cantidad de reseñas del organizador, o **Sin reseñas**. El backend entrega ambos valores; el frontend no descarga ni inventa reseñas para calcularlos. Los formularios de reseña y experiencias anteriores siguen pendientes de su integración específica.

Con una instancia nueva de `npm run backend:demo` se puede verificar:

| Orden | Secuencia esperada |
| --- | --- |
| Fecha | Ideas que conectan → Concierto del río → El umbral → La ciudad juega → Primavera en el parque |
| Precio | La ciudad juega → Ideas que conectan → Concierto del río → Primavera en el parque → El umbral |
| Puntaje | Concierto del río y Primavera en el parque (4,5; 2 reseñas) → El umbral (0; 1 reseña) → Ideas que conectan y La ciudad juega (sin reseñas) |

Los ejemplos históricos son compras utilizadas de eventos ya finalizados. Los datos de prueba no sustituyen la creación real de reseñas. El seeder no sobrescribe registros existentes. Un reinicio del backend borra su memoria; no reiniciar una instancia con datos que se quieran conservar para cargar los ejemplos nuevos.

## C4: publicar un evento con varios tipos de entrada

Iniciar el backend con `npm run backend` (sin eventos de ejemplo) o `npm run backend:demo`. Ambos preparan cinco categorías y las identidades locales de **Comprador 1** y **Organizador 1**. La app sigue sin login: el servicio envía el ID del perfil activo y el servidor comprueba su rol almacenado. Los roles no se aceptan al crear o editar perfiles por API.

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

La lista de publicaciones propias es real y abre el panel de C2 con sus compras y disponibilidad; después de publicar conserva la confirmación **Tu evento fue publicado**. La edición básica de eventos y las ventas de la maqueta se conservan en **Organizar → Recorrer ventas de ejemplo**, separadas de las publicaciones y compras de API. C12 permite comprar desde el detalle público.

## C12: comprar un tipo de entrada y una cantidad

Con el backend activo y la dirección de API configurada:

1. Publicar un evento futuro como **Organizador 1** con al menos dos tipos, por ejemplo General (precio 1200,50, cupo 3) y VIP (precio 5000, cupo 2). También se puede usar un evento del modo demo.
2. Cambiar a **Comprador 1 → Explorar**, buscarlo y abrirlo. Elegir General y aumentar la cantidad. El selector admite desde 1 hasta el cupo de ese tipo; un tipo agotado no se puede seleccionar.
3. Tocar **Continuar**, revisar tipo, cantidad y total, y **Confirmar compra**. Durante el envío se bloquean los controles y las pulsaciones repetidas.
4. Se consulta y muestra el **Comprobante de compra** real con ID, estado, tipo, cantidad, precio unitario y total registrados. Queda **PENDIENTE**: se reservan las entradas y no se realiza ningún cobro, siguiendo la política actual del backend.
5. Tocar **Volver al evento**: General tiene el cupo reducido y VIP conserva el suyo. Una nueva compra debe respetar la disponibilidad restante. Si otra persona consumió el cupo o cambió el precio entre consulta y confirmación, se muestra el error, se actualiza el detalle y se puede corregir/revisar antes de confirmar nuevamente.
6. Desde **Compras** o **Ver mis compras** en el comprobante se recuperan todas las compras de ese perfil por API (C1). También aparecen después de recargar la app mientras el backend siga activo. El organizador consulta esas mismas compras y la disponibilidad desde el evento en C2.
7. Si se pierde la respuesta, **Reintentar compra** consulta el resultado mediante el mismo intento sin descontar otra vez. La selección queda bloqueada hasta resolverlo; volver al evento o cambiar de perfil conserva ese intento por comprador y evento dentro de la misma ejecución de la app.

El frontend envía únicamente evento, tipo, cantidad y precio esperado, con identidad del perfil y una clave de reintento. El backend exige rol COMPRADOR almacenado, valida fecha/tipo/cantidad/cupo y calcula el total en centavos. Dos compradores no pueden quedarse con la última entrada. El comprobante conserva el precio y nombre del tipo al comprar aunque después se editen.

La compra vive en el backend y sobrevive a recargar la app mientras ese proceso siga activo; C1 recupera todas las compras de la identidad activa. Las claves pendientes del cliente viven en memoria y se pierden al recargar completamente la app; no hay recuperación automática de un intento incierto después de esa recarga, pero el listado permite comprobar si se registró. C5 conecta el chat del comprador. No se conectaron pagos, cancelación ni reseñas de estas compras; las reservas pendientes no caducan por ahora.

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

Actualizar Compras en el teléfono para ver el cambio y los días. Esto usa el circuito manual existente, sin ejecutar un pago. Las pruebas automatizadas cubren los cinco estados con datos aislados; C1 no agrega transiciones de cancelación/reembolso. El modo demo del backend conserva su catálogo anterior: no precarga compras en los dos perfiles locales.

**Compras → Recorrer compras de ejemplo** conserva el recorrido anterior para probar chat/reseñas de la maqueta. Sus registros están separados de la lista real; no aparecen como respaldo si la API falla.

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

El panel de C2 no agrega edición, pagos, cancelación ni devolución de cupo. C6 agrega **Abrir conversación** en cada compra, reutilizando el chat de C5. El recorrido previo continúa en **Organizar → Recorrer ventas de ejemplo**, separado de API. Las pruebas de canceladas/reembolsadas usan históricos aislados; no implementan esas transiciones.

## C5: enviar mensajes desde una compra

1. Como **Comprador 1**, comprar un evento con C12 y abrir **Compras → compra → Abrir conversación**. También está disponible desde el comprobante inmediatamente después de comprar.
2. Aparece el chat real asociado al ID de esa compra. Si está vacío, se invita a escribir la primera consulta. Escribir y tocar **Enviar mensaje**: se muestra como **Vos · Enviado**, con la fecha/hora registrada por el servidor. No aparece como enviado hasta recibir su confirmación.
3. Volver a la compra, abrir el chat otra vez o recargar la app: los mensajes guardados reaparecen mientras el mismo backend permanezca activo. Comprar otra entrada en una compra distinta no comparte la conversación, aunque sea el mismo evento.
4. Usar **Actualizar conversación**, arrastrar para actualizar o volver del segundo plano para consultar el historial nuevamente. Los mensajes del organizador se distinguen como **Organizador** y son los mismos que envía desde C6. No se agregaron actualizaciones por WebSocket ni notificaciones.
5. Se puede abrir y enviar en cualquier estado, incluso utilizada, cancelada o reembolsada, y después del evento. No hay bloqueo por fecha ni estado en el botón del comprobante o el servicio. Estas operaciones no cambian el estado, el cupo ni el historial de cambios de compra.
6. Texto vacío/solo espacios no se envía. El límite es 2000 caracteres, acorde con backend; admite saltos de línea y caracteres especiales. Durante envío se bloquea el compositor y las pulsaciones repetidas.
7. Si falla el envío, se conserva el texto. Si no se conoce el resultado, **Reintentar envío** usa el mismo mensaje e intento para recuperar el registro sin duplicarlo; la selección queda bloqueada hasta resolverlo. Navegar o alternar perfil mantiene ese intento por comprador/compra durante la misma ejecución de la app.

Se comprueban rol de comprador y propiedad al consultar y enviar; comprar el mismo evento no permite leer la conversación de otra compra. El backend autoriza exclusivamente sus participantes con el rol correspondiente y deriva autor/fecha de la identidad y reloj del servidor, rechazando esos campos en el cuerpo. El perfil Organizador 1 usa esta entrada para sus compras personales como comprador; para responder a ventas abre la conversación desde Organizar, según C6.

Los estados cancelada/reembolsada de las pruebas son datos históricos aislados, sin implementar esas transiciones. Para revisar una conversación después del evento basta mantener la compra y abrirla desde Mis compras cuando pase la fecha. El backend no se reinicia para probarlo: reiniciar borra compras y mensajes.

La clave de un envío incierto del cliente es volátil: una recarga completa la pierde. Consultar el historial antes de volver a enviar en ese caso. No hay edición/borrado de mensajes, persistencia externa ni indicación de lectura. El chat anterior sigue separado en **Recorrer compras de ejemplo** y no se usa como respaldo si falla la API.

## C6: responder como organizador

1. Como **Organizador 1**, publicar un evento con C4. Cambiar a **Comprador 1**, comprarlo con C12 y enviar una consulta desde **Compras → compra → Abrir conversación** (C5).
2. Cambiar a **Organizador 1 → Organizar → Tus eventos publicados → evento**. En la tarjeta de esa compra tocar **Abrir conversación**: aparece **Chat de la venta** con el mismo ID e historial que consulta el comprador.
3. La consulta recibida se identifica como **Comprador**. Escribir una respuesta y tocar **Responder mensaje**. Aparece como **Vos · Enviado**, con la fecha/hora del servidor cuando confirma el envío.
4. Volver a **Comprador 1 → Compras → compra → Abrir conversación**: la respuesta aparece como **Organizador**. También se puede usar **Actualizar conversación**, arrastrar para actualizar o volver del segundo plano. Recargar la app conserva el historial mientras siga activo el backend.
5. Volver como organizador al evento y abrir otras compras: cada una mantiene su conversación propia. No se mezclan compradores ni eventos. El botón permanece disponible en todos los estados y para eventos pasados, incluso utilizados, cancelados o reembolsados si esos registros existen.
6. Ante una respuesta de red incierta, el texto y la clave se conservan por autor/compra en la misma ejecución. **Reintentar envío** recupera la respuesta sin duplicarla aunque el comprador ya la haya recibido. Se mantienen límites de texto, bloqueos de envío y errores/reintentos de C5; el chat no cambia cupos ni estados.

Se exige ORGANIZADOR y que la compra pertenezca al evento seleccionado y al organizador activo, tanto al consultar como al responder. No hace falta tener también rol de comprador. Cambiar la perspectiva del chat no concede permisos; organizadores ajenos y compradores que intenten entrar como organizador son rechazados. Los mensajes se distinguen por la identidad del autor y se validan contra los dos participantes.

Las compras personales de Organizador 1 siguen en **Compras** con la perspectiva comprador; sus ventas y conversaciones se abren desde **Organizar**. Se reutilizan la pantalla y servicio de C5 y los mensajes embebidos en Compra; no se crea un segundo chat. Puede iniciar una conversación vacía sobre una compra existente, sin exigir que el comprador haya escrito primero.

C6 no agrega notificaciones, lectura, edición/borrado ni WebSocket/polling. Para probar estados cancelada/reembolsada las pruebas usan históricos aislados; sus transiciones siguen pendientes. La clave de envío incierto se pierde con una recarga completa: consultar historial antes de reenviar en ese caso. Los chats de ejemplos siguen separados de los reales.

## Cómo probar en el celular

Desde `frontend/`, usar el modo de Expo que ya funciona en el dispositivo:

```bash
npx expo start --go --tunnel
```

1. Como **Comprador 1**, entrar a **Compras → Recorrer compras de ejemplo → AT-3001 / El umbral → Abrir conversación** y enviar un mensaje.
2. Tocar **Cambiar a Organizador 1**. Se vuelve al panel **Organizar** y se descarta la navegación y cualquier formulario sin guardar del perfil anterior.
3. Entrar a **Recorrer ventas de ejemplo → El umbral → AT-3001 → Abrir conversación**. Aparece el mismo mensaje como recibido; se puede responder.
4. Volver a **Comprador 1** y abrir de nuevo esa compra. La respuesta aparece en su conversación.
5. Probar favoritos distintos para cada perfil. Las selecciones y filtros se conservan al alternar; cada perfil tiene sus propias compras. Las ventas se derivan de una única colección compartida de compras.
6. Crear eventos desde Organizar usa C4 y publica en la API. Para recorrer la edición básica de la maqueta, entrar a Recorrer ventas de ejemplo y elegir un evento de ejemplo propio. El comprador no tiene acceso a publicación ni a la pestaña Organizar.
7. Para reseñar como comprador, usar la compra utilizada **AT-1982 / Noche de vinilos**. Las reseñas requieren compra propia utilizada y evento finalizado; no aparecen como acción de una venta del organizador.

Los eventos publicados con C4, las compras de C12 y los mensajes de C5/C6 viven en el backend y sobreviven a la recarga de la app mientras el mismo servidor esté activo. Los cambios de la maqueta (favoritos, compras, mensajes y edición de eventos de ejemplo) permanecen solo durante la sesión de la app y se reinician al recargar. La edición de fecha/tipos de entrada y cancelación/reembolso siguen pendientes. C12 reserva cupos reales de la API sin cobrar; la compra simulada de los ejemplos conserva su comportamiento local.

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
- `src/services/purchases.service.js`: creación y consulta privada de compras, adaptación de comprobantes, intentos por comprador/evento y reintentos sin duplicados.
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
- `src/data/mockData.js`: fixtures con `compradorId` y autores de mensajes por `usuarioId`. La compra AT-3001 vincula ambos perfiles para probar chat y ventas.

El rol de la sesión expresa capacidades. La perspectiva `comprador`/`organizador` de un detalle expresa desde qué relación se consulta una compra y también se valida: cambiar esa perspectiva por sí solo no otorga acceso.

Los IDs `comprador-1` y `organizador-1` de la sesión simulada corresponden a perfiles preparados por `server.js` en el backend local. El dominio distingue roles COMPRADOR y ORGANIZADOR no excluyentes. El backend exige ORGANIZADOR para publicar/consultar ventas (además de propiedad) y COMPRADOR para comprar/consultar compras propias, y los formularios de usuario no permiten otorgarse roles. Esto sigue siendo identidad de prueba por encabezado, sin autenticación real. La consulta del catálogo continúa siendo pública y no envía ese encabezado.

## Verificación

Desde la raíz:

```bash
npm test --workspace=frontend
```

Las pruebas usan el runner de Node, sin dependencias nuevas. Además de sesiones/permisos, verifican filtros HTTP, transformación de DTOs, cancelación, timeout, errores y el servicio real del frontend contra Express con dominio y repositorios en memoria. Las pruebas de integración necesitan dependencias del backend instaladas y permiso para abrir puertos locales temporales. Para ver cada caso en Node 24: `npm test --workspace=frontend -- --test-isolation=none`.

La exportación de Metro para Android/iOS verifica compilación y resolución de módulos; no sustituye la revisión de interacción en un dispositivo.

Verificado para C6: 100 pruebas de frontend y 55 de backend correctas (155 en total). Además de los CUs anteriores, cubren intercambio comprador/organizador con historial compartido tras recarga, organizador sin rol comprador, todos los estados y eventos pasados, rol almacenado/propiedad/evento/autor, respuesta perdida y claves por autor/compra. Exportaciones Metro de Android/iOS sin bytecode en `/tmp/ai-ticket-c6-android` y `/tmp/ai-ticket-c6-ios`; no son instalaciones en el celular. La interacción en dispositivo queda pendiente.
