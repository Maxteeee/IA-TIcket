# Frontend — IA Ticket IT

Aplicación móvil con React Native 0.81.5, React 19.1 y Expo SDK 54. Consume la API del backend para catálogo, publicaciones, compras, ventas, chat, cancelaciones y reseñas. Los favoritos se mantienen localmente por perfil.

Consultar el [README principal](../README.md) para instalar dependencias, configurar `EXPO_PUBLIC_API_URL` y abrir el proyecto con Expo Go. La aplicación y la API deben permanecer funcionando durante la demostración.

## Perfiles y navegación

| Perfil inicial | Roles | Acceso |
| --- | --- | --- |
| Comprador 1 | `COMPRADOR` | Explorar, Favoritos y Compras. |
| Organizador 1 | `COMPRADOR`, `ORGANIZADOR` | Las anteriores y Organizar. |

El botón superior alterna la identidad activa. Cada cambio limpia la navegación y los borradores de pantalla; las consultas privadas se comprueban por rol y relación con el recurso. Los filtros y favoritos se mantienen separados por perfil durante la ejecución.

La sesión es simulada, sin login. Los IDs `comprador-1` y `organizador-1` coinciden con los preparados por el backend. El organizador puede comprar eventos ajenos; no puede comprar entradas de sus propias publicaciones.

## Recorrido de demostración

### 1. Publicar un evento

Como **Organizador 1 → Organizar → Crear un evento**, completar nombre, descripción, categoría, fecha `DD/MM/AAAA` y hora local `HH:mm`. La fecha debe ser futura; el formulario la convierte a ISO antes de enviarla.

Agregar al menos un tipo de entrada. Cada tipo tiene nombre, descripción opcional, precio de cero o más con hasta dos decimales y cupo entero de cero o más. Se pueden agregar o quitar tipos antes de publicar. Como ejemplo, usar General a `$1000` con cupo `3` y VIP a `$2500` con cupo `2`.

Al publicar se abre el panel de compras del evento. Si aún no tiene ventas, se muestran igualmente sus tipos y disponibilidades. Los eventos y compras iniciales están vacíos: los datos se crean con estos recorridos.

### 2. Buscar y comprar

Alternar a **Comprador 1 → Explorar**. Buscar por texto o seleccionar una categoría; ambos filtros se combinan. Se puede ordenar por fecha más próxima, menor precio o mayor puntaje del organizador. El catálogo muestra eventos cuyo inicio todavía no ocurrió.

Abrir el evento, elegir un tipo y una cantidad y tocar **Continuar**. El resumen permite revisar el total antes de **Confirmar compra**. Esa acción registra una compra **PENDIENTE de pago**, reserva cupo y abre el comprobante; no ejecuta un cobro.

Comprar dos General del ejemplo debe producir un total de `$2000`. Al volver al evento, General queda con `1` disponible y VIP conserva `2`. El servidor valida precio, cantidad y disponibilidad; no se puede superar cupo ni comprar un evento propio.

### 3. Consultar compras y ventas

En **Compras**, el comprador ve sus registros con evento, fecha, tipo, cantidad, total, identificador y estado. Los filtros distinguen **Pendiente de pago**, **Confirmada**, **Utilizada**, **Cancelada** y **Reembolsada**. Abrir una compra consulta nuevamente su comprobante por ID.

En **Organizador 1 → Organizar → evento**, se consultan las ventas de ese evento y el cupo restante de todos sus tipos, incluso los agotados. El filtro de estado afecta solo a las compras; no recalcula la disponibilidad ni oculta tipos. Las ventas no se mezclan con las compras personales del organizador.

Lista vacía, filtro sin resultados, carga y error tienen estados propios. Se puede actualizar y reabrir los recorridos para consultar datos del servidor. Recargar la app conserva las compras mientras el mismo backend permanezca activo.

### 4. Confirmar pago simulado y registrar uso

En la compra pendiente del panel del organizador, tocar **Confirmar pago simulado**, revisar el importe y aceptar **Sí, confirmar pago simulado**. **Volver sin cambios** descarta el aviso. La compra pasa a **CONFIRMADA** sin mover dinero real.

La confirmación debe realizarse antes del inicio del evento, según el reloj del servidor. Al volver a Compras como comprador, se muestran los días restantes únicamente para confirmadas: períodos de 24 horas, redondeados hacia arriba y con mínimo cero.

Para registrar uso, el organizador toca **Marcar como utilizada** sobre una confirmada y acepta el aviso. La acción afecta a toda la cantidad de esa compra. No vuelve a descontar cupo y no ofrece saltos ni retrocesos de estado. Una compra utilizada permite reseñar y ya no admite cancelación.

Durante una escritura se bloquean la doble pulsación y el refresco concurrente. Si se pierde una respuesta, se consulta el estado actual. Si tampoco se logra leer, las nuevas modificaciones quedan bloqueadas hasta **Actualizar compras** o arrastrar para actualizar. El cliente puede recuperar por GET una transición ya alcanzada sin repetir PATCH ni historial.

### 5. Conversar sobre una compra

El comprador accede desde **Compras → compra → Abrir conversación**. El organizador utiliza **Organizar → evento → compra → Abrir conversación**. Ambos ven el mismo historial con autor y fecha; las etiquetas distinguen mensajes propios y del otro participante.

Se puede escribir en todos los estados y después del evento. Los mensajes admiten hasta `2000` caracteres y se muestran como enviados al confirmarse la respuesta. **Actualizar conversación**, arrastrar, reabrir o volver del segundo plano recupera novedades. No hay recepción en tiempo real, notificaciones ni confirmación de lectura.

### 6. Cancelar y consultar el reembolso simulado

Para este recorrido, crear otra compra y conservarla pendiente o confirmarla desde el panel del organizador. Como comprador, abrir el comprobante y tocar **Cancelar compra**. Revisar el efecto y elegir **Confirmar cancelación** o **Conservar compra**.

| Estado previo | Resultado |
| --- | --- |
| Pendiente | Cancelada, con devolución de cupo y sin reembolso monetario. |
| Confirmada | Reembolsada, con devolución de cupo y registro del total original como reembolso simulado. |

Solo se permite cancelar antes del inicio y si no se utilizó. Reintentar una cancelación ya aplicada no devuelve cupo o importe por segunda vez. Las compras y el panel del organizador reflejan el cambio al consultar nuevamente; el chat sigue disponible.

### 7. Puntuar y comentar

Como comprador, abrir una compra **UTILIZADA** y elegir **Reseña de mi compra**. Ingresar una puntuación numérica de `0` a `5`, con coma o punto para fracciones, y un comentario obligatorio de hasta `1500` caracteres. Tocar **Publicar reseña** y esperar la confirmación.

No es necesario esperar a que termine el evento ni cargar `fechaFin`. El servidor vuelve a verificar rol, propiedad y utilización. Las reseñas guardadas se recuperan al reabrir la compra y actualizan el promedio y conteo del organizador. Se permite más de una reseña por compra; un reintento de la misma publicación no la duplica.

### 8. Consultar experiencias anteriores y favoritos

En **Explorar → evento → Experiencias anteriores**, se muestran autor, puntuación, comentario y evento de origen de las reseñas elegibles del organizador. La sección tiene carga, error, reintento y actualización propios, sin reiniciar la selección de entradas.

Esta lista muestra reseñas de un evento de origen distinto, del mismo organizador y con fecha de inicio anterior a la del evento consultado. **No exige `fechaFin` ni finalización.** Para probarla, publicar dos eventos con fechas distintas del mismo organizador, comprar en el primero, confirmar el pago simulado, registrar el uso y publicar una reseña. Al abrir el segundo evento, aparece en **Experiencias anteriores** sin modificar fechas por API. Las reseñas del propio evento, de eventos con igual fecha o posteriores y las de otros organizadores quedan excluidas.

El corazón de las tarjetas y del detalle guarda o quita eventos en **Favoritos**. La selección es local, independiente por perfil y se pierde con una recarga completa. Aunque el backend tiene endpoints de favoritos, este recorrido no los utiliza.

## Correspondencia con las historias

| Historia | Recorrido |
| --- | --- |
| C1 | Compras propias, estados y días restantes para confirmadas. |
| C2 | Organizar → evento: ventas y disponibilidad por tipo. |
| C3 | Explorar: búsqueda textual y categorías. |
| C4 | Organizar → Crear un evento: tipos, precios y cupos. |
| C5 | Chat del comprador desde su comprobante. |
| C6 | Chat del organizador desde la venta. |
| C7 | Cancelar compra y consultar reembolso simulado. |
| C8 | Restricciones de cancelación y seguimiento del organizador. |
| C9 | Puntuación y comentario desde una compra utilizada. |
| C10 | Experiencias de otros eventos anteriores del organizador, sin exigir fecha de fin. |
| C11 | Ordenamiento por precio, fecha y puntaje. |
| C12 | Selección de tipo y cantidad, reserva y comprobante de compra. |

## Organización del código

| Ubicación | Responsabilidad |
| --- | --- |
| `App.js` | Configura proveedores y componente principal. |
| `src/MockApp.js` | Navegación por pestañas y pila local; conecta pantallas y sesión. |
| `src/session/` | Roles, sesión simulada y permisos por propiedad y participación. |
| `src/services/api.client.js` | GET/POST/PATCH, JSON, identidad de desarrollo, cancelación y timeout. |
| `src/services/catalog.service.js` | Catálogo, filtros, DTOs y experiencias anteriores. |
| `src/services/events.service.js` | Publicación y listado de eventos propios. |
| `src/services/purchases.service.js` | Creación, comprobante, listado propio y cancelación. |
| `src/services/sales.service.js` | Ventas por evento y cambios de estado del organizador. |
| `src/services/chat.service.js` | Historial, autoría y envíos por compra. |
| `src/services/reviews.service.js` | Compra propia, consulta y publicación de reseñas. |
| `src/hooks/useCatalog.js` | Carga del catálogo, espera al escribir y cancelación de consultas. |
| `src/screens/` | Pantallas; las variantes conectadas consumen la API mediante servicios. |
| `src/components/` | Controles, tarjetas, estados, cuenta regresiva y experiencias anteriores. |
| `src/utils/` | Validación de borradores y selección de compra; presentación de fechas e importes. |
| `src/data/mockData.js` | Referencias visuales y colecciones de negocio vacías. |
| `test/fixtures/` | Escenarios exclusivos de pruebas. |

El nombre `MockApp` corresponde a la sesión y navegación local; los recorridos activos de catálogo, compra, ventas, chat y reseñas consumen la API. Permanecen componentes de prototipo sin acceso desde los recorridos actuales y sin datos de negocio precargados.

## Estado local y recuperación

- Los filtros y favoritos viven en React por identidad. La app no usa AsyncStorage.
- Los intentos inciertos de compra, mensaje y reseña conservan datos y clave durante la ejecución del cliente. Se pierden con una recarga completa: consultar compras o historial antes de repetir entonces.
- La búsqueda espera `300 ms` al escribir; los filtros y el orden se resuelven en el backend.
- Las consultas cancelan solicitudes y descartan respuestas tardías al salir o cambiar de perfil. Compras, comprobantes, ventas, chat y reseñas permiten refrescar su información.
- El dominio no modela ubicación; el detalle público muestra **Lugar a confirmar**. La edición de eventos reales, tipos y `fechaFin` está disponible por API, sin un formulario móvil de edición.

## Pruebas y verificación móvil

Desde la raíz:

```bash
npm test --workspace=frontend
```

Se verifican permisos, contratos, servicios y solicitudes HTTP reales contra Express con datos aislados. Las integraciones requieren las dependencias del backend y permiso para abrir puertos locales temporales.

Para comprobar resolución de módulos y compilación de ambas plataformas, desde `frontend/`:

```bash
npx expo export --platform android --platform ios --output-dir dist
```

La exportación produce bundles, no un APK o una aplicación instalada. La verificación visual debe realizarse por separado en el teléfono: controles, teclado, navegación, estados y legibilidad. Para conservar los datos durante una demostración, evitar reiniciar el backend o editarlo en modo watch.
