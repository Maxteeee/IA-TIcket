# Maqueta con sesiones de prueba

La app usa dos perfiles locales, sin login ni llamadas al backend. Empieza como **Comprador 1**. La barra superior muestra la sesión activa y un botón **Cambiar a Organizador 1 / Comprador 1**, disponible tanto en las pestañas como en los detalles.

| Perfil | Roles | Recorrido |
| --- | --- | --- |
| Comprador 1 | COMPRADOR | Explorar, favoritos propios, compras propias, chat de sus compras y reseñas elegibles |
| Organizador 1 | COMPRADOR, ORGANIZADOR | Todo lo anterior para sus propias compras, más creación, edición básica y consulta de ventas de sus eventos |

El organizador mantiene la posibilidad de comprar, según el modelo acordado. Ser organizador no permite administrar eventos ajenos ni consultar sus ventas o conversaciones. No hay perfil de administrador.

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
6. Como organizador, crear un evento o editar nombre, descripción y categoría de uno propio. Cambiar al comprador para ver los cambios en el catálogo; no tiene botones de administración ni la pestaña Organizar.
7. Para reseñar como comprador, usar la compra utilizada **AT-1982 / Noche de vinilos**. Las reseñas requieren compra propia utilizada y evento finalizado; no aparecen como acción de una venta del organizador.

Los cambios guardados, eventos, compras y mensajes permanecen durante la sesión de la app y son compartidos donde corresponde. Recargar la app los reinicia. La edición de fecha/tipos de entrada y cancelación/reembolso siguen pendientes; no se simulan pagos ni se reservan cupos reales.

## Organización

- `src/session/roles.js`: enum congelado de roles.
- `src/services/auth.mock.js`: respuesta simulada `{ usuario, roles }` y alternancia entre los dos perfiles. Cada respuesta copia sus datos para evitar modificaciones de otro consumidor.
- `src/session/MockSessionProvider.js`: contexto React con sesión activa y cambio de perfil. Reemplazable por el servicio real al integrar autenticación.
- `src/session/permissions.js`: permisos por rol, propiedad y participación, acceso a rutas y selección de datos por usuario.
- `src/components/SessionSwitcher.js`: identidad activa y botón para alternar.
- `src/MockApp.js`: navegación con rutas protegidas, acciones verificadas y estado de la maqueta. El contenido de las pantallas se vuelve a montar al cambiar de identidad para limpiar borradores.
- `src/data/mockData.js`: fixtures con `compradorId` y autores de mensajes por `usuarioId`. La compra AT-3001 vincula ambos perfiles para probar chat y ventas.

El rol de la sesión expresa capacidades. La perspectiva `comprador`/`organizador` de un detalle expresa desde qué relación se consulta una compra y también se valida: cambiar esa perspectiva por sí solo no otorga acceso.

Los IDs comprador-1 y organizador-1 pertenecen a la maqueta y no son usuarios registrados en la API. La sesión no autentica ni autoriza solicitudes del servidor. La integración de la API resolverá identidades y permisos reales.

## Verificación

Desde la raíz: `npm test --workspace=frontend`. Las 10 pruebas usan node:test sin dependencias nuevas y cubren alternancia, aislamiento, roles, propiedad, compras, ventas, chat, reseñas y consistencia de fixtures.

La maqueta mantiene datos locales durante la sesión. No se probó la interacción en un dispositivo en esta entrega.
