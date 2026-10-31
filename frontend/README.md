# Maqueta con sesiones de prueba

La app usa dos perfiles locales, sin login. C3 conecta la pestaña Explorar y su detalle con el backend; los demás recorridos mantienen sus datos de maqueta. Empieza como **Comprador 1**. La barra superior muestra la sesión activa y un botón **Cambiar a Organizador 1 / Comprador 1**, disponible tanto en las pestañas como en los detalles.

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

Carga en memoria cinco categorías, cinco eventos futuros y uno pasado (no aparece en el catálogo). El inicio normal `npm run backend` sigue comenzando vacío, salvo `SEED_DEMO=true` en backend/.env. El seeder no importa fixtures del frontend ni sobrescribe registros existentes. Reiniciar el backend pierde los datos de su proceso; no es necesario reiniciar un servidor en uso para ejecutar las pruebas automatizadas.

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
5. Abrir un resultado: su detalle se consulta por ID en la API, con nombre de organizador y tipos de entrada reales. No crea una compra ni usa el evento de un fixture que tenga un nombre parecido.
6. Arrastrar para actualizar o usar **Volver a intentar** ante un error. La ausencia de eventos publicados se distingue de una búsqueda sin coincidencias.

Se esperan 300 ms al escribir para no consultar por cada tecla. Al cambiar filtros, volver o alternar perfil se cancela la solicitud pendiente y sus respuestas atrasadas no pueden sobrescribir la consulta actual. Los filtros se conservan por perfil; las categorías se cargan al entrar y al actualizar/reintentar.

El ordenamiento del catálogo conectado se incorporará con C11; hoy utiliza el orden por fecha predeterminado del backend. Favoritos, creación, compras, chat y reseñas siguen en la maqueta, con sus datos separados. Por eso el catálogo conectado todavía no muestra acciones de favorito, compra o publicación de reseñas; se incorporarán en sus flujos. El detalle muestra **Lugar a confirmar** porque el dominio actual aún no modela ubicación.

## Cómo probar en el celular

Desde `frontend/`, usar el modo de Expo que ya funciona en el dispositivo:

```bash
npx expo start --go --tunnel
```

1. Como **Comprador 1**, entrar a **Compras → AT-3001 / El umbral → Abrir conversación** y enviar un mensaje.
2. Tocar **Cambiar a Organizador 1**. Se vuelve al panel **Organizar** y se descarta la navegación y cualquier formulario sin guardar del perfil anterior.
3. Entrar a **El umbral → AT-3001 → Abrir conversación**. Aparece el mismo mensaje como recibido; se puede responder.
4. Volver a **Comprador 1** y abrir de nuevo esa compra. La respuesta aparece en su conversación.
5. Probar favoritos distintos para cada perfil. Las selecciones y filtros se conservan al alternar; cada perfil tiene sus propias compras. Las ventas se derivan de una única colección compartida de compras.
6. Como organizador, crear un evento o editar nombre, descripción y categoría de uno propio y consultarlo desde su panel. Sigue siendo una acción de maqueta: no aparece en Explorar conectado hasta integrar C4. El comprador no tiene botones de administración ni la pestaña Organizar.
7. Para reseñar como comprador, usar la compra utilizada **AT-1982 / Noche de vinilos**. Las reseñas requieren compra propia utilizada y evento finalizado; no aparecen como acción de una venta del organizador.

Los cambios guardados, eventos, compras y mensajes permanecen durante la sesión de la app y son compartidos donde corresponde. Recargar la app los reinicia. La edición de fecha/tipos de entrada y cancelación/reembolso siguen pendientes; no se simulan pagos ni se reservan cupos reales.

## Organización

- `src/services/api.client.js`: consultas HTTP con timeout, cancelación y errores, sin autenticación para el catálogo público.
- `src/services/catalog.service.js`: categorías, filtros HTTP y adaptación explícita de DTOs a las pantallas.
- `src/hooks/useCatalog.js`: carga, espera al escribir, cancelación por filtros y reintentos.
- `src/screens/ConnectedCatalogScreen.js` y `CatalogEventScreen.js`: listado C3 y detalle con datos reales, separados del resto de la maqueta.
- `src/session/roles.js`: enum congelado de roles.
- `src/services/auth.mock.js`: respuesta simulada `{ usuario, roles }` y alternancia entre los dos perfiles. Cada respuesta copia sus datos para evitar modificaciones de otro consumidor.
- `src/session/MockSessionProvider.js`: contexto React con sesión activa y cambio de perfil. Reemplazable por el servicio real al integrar autenticación.
- `src/session/permissions.js`: permisos por rol, propiedad y participación, acceso a rutas y selección de datos por usuario.
- `src/components/SessionSwitcher.js`: identidad activa y botón para alternar.
- `src/MockApp.js`: navegación con rutas protegidas, acciones verificadas y estado de la maqueta. El contenido de las pantallas se vuelve a montar al cambiar de identidad para limpiar borradores.
- `src/data/mockData.js`: fixtures con `compradorId` y autores de mensajes por `usuarioId`. La compra AT-3001 vincula ambos perfiles para probar chat y ventas.

El rol de la sesión expresa capacidades. La perspectiva `comprador`/`organizador` de un detalle expresa desde qué relación se consulta una compra y también se valida: cambiar esa perspectiva por sí solo no otorga acceso.

Los IDs `comprador-1` y `organizador-1` pertenecen a la maqueta. Todavía no son usuarios registrados en la API y no se envían como `X-Usuario-Id`. El backend conserva su identidad de prueba anterior y aún no restringe la creación de eventos por rol; la sesión continúa simulada; C3 consulta el catálogo público sin ese encabezado. Al conectar la API habrá que resolver IDs reales y aplicar también los permisos de rol en el servidor.

## Verificación

Desde la raíz:

```bash
npm test --workspace=frontend
```

Las pruebas usan el runner de Node, sin dependencias nuevas. Además de sesiones/permisos, verifican filtros HTTP, transformación de DTOs, cancelación, timeout, errores y el servicio real del frontend contra Express con dominio y repositorios en memoria. Las pruebas de integración necesitan dependencias del backend instaladas y permiso para abrir puertos locales temporales. Para ver cada caso en Node 24: `npm test --workspace=frontend -- --test-isolation=none`.

La exportación de Metro para Android/iOS verifica compilación y resolución de módulos; no sustituye la revisión de interacción en un dispositivo.

Verificado para C3: 24 pruebas de frontend correctas y 38 de backend. Exportaciones Metro de Android e iOS sin bytecode en /tmp/ai-ticket-c3-android y /tmp/ai-ticket-c3-ios; no son instalaciones en el celular. No se ejecutó una prueba propia en dispositivo.
