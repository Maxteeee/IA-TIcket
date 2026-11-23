# IA Ticket IT

Aplicación móvil para descubrir eventos, comprar entradas y gestionar ventas. Desarrollada como trabajo práctico con React Native y Expo en el frontend, y una API REST con Node.js y Express en el backend.

El proyecto se ejecuta localmente y utiliza almacenamiento en memoria. Los pagos y reembolsos son simulados; no se procesa dinero real.

## Funcionalidades

| Perfil | Funcionalidades |
| --- | --- |
| Comprador | Buscar eventos por texto y categoría; ordenar por fecha, precio y puntaje del organizador; guardar favoritos; seleccionar tipo y cantidad de entradas; consultar compras, estados y días restantes; conversar con el organizador; cancelar compras elegibles y publicar reseñas después del uso. |
| Organizador | Publicar eventos con distintos tipos de entrada, precios y cupos; consultar ventas y disponibilidad por evento; confirmar pagos simulados; registrar utilización de entradas y responder consultas de compradores. |

La aplicación permite alternar entre **Comprador 1** y **Organizador 1**. El segundo perfil también puede comprar entradas para eventos ajenos. Los permisos se comprueban por rol, propiedad y participación en cada compra.

## Tecnologías y estructura

| Componente | Tecnología |
| --- | --- |
| Aplicación móvil | React Native 0.81.5, React 19.1 y Expo SDK 54 |
| API | Node.js y Express 5 |
| Lenguaje | JavaScript |
| Dependencias | npm workspaces y un único `package-lock.json` |
| Pruebas | `node:test`, aserciones e integración HTTP |
| Almacenamiento | Repositorios en memoria dentro del proceso del backend |

```text
.
├── backend/
│   ├── src/
│   │   ├── routes/          # Endpoints HTTP
│   │   ├── controllers/     # Entrada y salida HTTP
│   │   ├── services/        # Casos de uso y permisos
│   │   ├── domain/          # Entidades y reglas de negocio
│   │   ├── repositories/    # Almacenamiento en memoria
│   │   ├── http/            # DTOs de respuesta
│   │   ├── data/            # Perfiles y categorías iniciales
│   │   ├── app.js           # Configuración de Express
│   │   └── server.js        # Inicio de la API
│   └── test/
├── frontend/
│   ├── App.js              # Componente raíz
│   ├── src/
│   │   ├── screens/        # Pantallas y recorridos
│   │   ├── components/     # Componentes visuales
│   │   ├── services/       # Cliente HTTP y servicios
│   │   ├── session/        # Perfiles y permisos
│   │   ├── hooks/          # Consultas del catálogo
│   │   ├── utils/          # Validación y presentación
│   │   └── config/         # Dirección de la API
│   └── test/
├── package.json            # Workspaces y comandos comunes
├── package-lock.json
└── .nvmrc
```

La API sigue el recorrido **ruta → controlador → servicio → dominio y repositorio**. El frontend consume JSON mediante servicios separados de las pantallas. Los DTOs evitan serializar directamente las relaciones entre entidades.

## Requisitos

- Node.js **22.13 o superior**. `.nvmrc` selecciona Node.js **24**: con nvm, ejecutar `nvm use`.
- npm, incluido con Node.js.
- Un teléfono con **Expo Go compatible con SDK 54**.
- Acceso a Internet para instalar dependencias y una conexión entre el teléfono y la computadora para consultar la API.

En Android, descargar la versión compatible desde [Expo Go para SDK 54](https://expo.dev/go?sdkVersion=54&platform=android&device=true). Para iPhone, comprobar la compatibilidad de la versión disponible siguiendo la [documentación oficial de Expo](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). El SDK de Expo Go debe coincidir con el del proyecto.

El arranque en un teléfono físico con Expo Go no requiere Android Studio ni Xcode. No se necesita una base de datos ni Docker para ejecutar este repositorio.

## Instalación y configuración

Desde la raíz:

```bash
npm ci
```

Crear los archivos locales a partir de las plantillas, sin sobrescribir una configuración existente. En Bash, Linux, macOS o WSL:

```bash
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

En Windows también se pueden copiar las plantillas desde el explorador o el editor, quitando el sufijo `.example`.

| Archivo | Variable | Uso |
| --- | --- | --- |
| `backend/.env` | `PORT` | Puerto de la API; por defecto, `3000`. |
| `backend/.env` | `PUBLIC_API_URL` | Opcional: dirección que se informa al iniciar. No configura el acceso de red. |
| `frontend/.env` | `EXPO_PUBLIC_API_URL` | URL de la API accesible desde el teléfono, con el sufijo `/api`. |

En `frontend/.env`, reemplazar `IP_DE_TU_PC` por la dirección IPv4 de la computadora en la red local:

```dotenv
EXPO_PUBLIC_API_URL=http://IP_DE_TU_PC:3000/api
```

`IP_DE_TU_PC` es un marcador: debe reemplazarse antes de usar la aplicación. En un teléfono, `localhost` se refiere al propio teléfono. Si la API se ejecuta en WSL, seguir la [configuración de acceso desde la red local](backend/README.md#acceso-desde-el-celular-con-wsl).

Los archivos `.env` reales están excluidos de Git. Las variables `EXPO_PUBLIC_` forman parte de la aplicación cliente y no deben contener secretos.

## Ejecución local

Mantener **dos terminales abiertas**: una para la API y otra para Expo/Metro.

### 1. Iniciar la API

Desde la raíz:

```bash
npm run backend
```

La API escucha en `0.0.0.0:3000` y muestra sus direcciones al arrancar. Comprobar desde la computadora:

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{"status":"ok","message":"Backend conectado"}
```

El modo de desarrollo usa `node --watch`. **Reiniciar la API o editar código del backend en ese modo elimina sus datos en memoria.** Para realizar una demostración sin recarga automática, usar `npm start` desde `backend/` en lugar del comando anterior.

### 2. Iniciar la aplicación móvil

En otra terminal, desde la raíz:

```bash
npm run frontend
```

Escanear el QR con Expo Go en Android o con la cámara en iPhone. Para el modo túnel, ejecutar desde `frontend/`:

```bash
npx expo start --go --tunnel
```

El túnel de Expo permite acceder a Metro, pero **no expone la API del backend**. El teléfono debe poder abrir `http://IP_DE_TU_PC:3000/api/health` por separado. Para la configuración por LAN, conectar ambos dispositivos a la misma red; la computadora puede usar Ethernet y el teléfono Wi-Fi.

Si se modifica `frontend/.env`, reiniciar Expo y recargar la app. La [guía de Expo CLI](https://docs.expo.dev/more/expo-cli/#tunneling) explica los requisitos del modo túnel.

## Primer recorrido

El backend prepara únicamente dos perfiles y cinco categorías: Música, Teatro, Festivales, Conferencias y Deportes. **No hay eventos, compras, mensajes ni reseñas precargados.**

1. Alternar a **Organizador 1 → Organizar → Crear un evento**. Publicar un evento futuro con General a `$1000`, cupo `3`, y VIP a `$2500`, cupo `2`.
2. Como **Comprador 1**, buscarlo en **Explorar**, seleccionar dos General y confirmar la compra. El comprobante debe mostrar `$2000` y estado **Pendiente de pago**.
3. Volver al evento: General debe tener `1` disponible y VIP conservar `2`.
4. Como **Organizador 1 → Organizar → evento**, localizar la compra y elegir **Confirmar pago simulado**. Aceptar el aviso. Como comprador, consultar la compra confirmada y sus días restantes.
5. Desde esa venta, el organizador puede elegir **Marcar como utilizada**. Después, el comprador puede publicar una reseña numérica con comentario.
6. Para probar la cancelación y el reembolso simulado, crear otra compra, confirmarla y cancelarla como comprador antes del inicio del evento. Una compra utilizada no admite cancelación.

El chat se abre desde el comprobante del comprador o desde la venta del organizador. Ambos consultan la misma conversación. Ver la [guía funcional del frontend](frontend/README.md) para los recorridos completos.

## Reglas y límites del alcance actual

- La compra reserva cupo al quedar pendiente. Confirmarla o utilizarla no vuelve a descontar entradas. Las reservas pendientes no tienen vencimiento automático.
- Solo el organizador del evento confirma el pago simulado y registra el uso. La confirmación exige que el evento no haya comenzado. El uso afecta a todas las entradas de la compra.
- Cancelar una pendiente devuelve cupo sin reembolso; cancelar una confirmada devuelve cupo y registra el reembolso simulado del total original. Ambas requieren que el evento no haya comenzado.
- Para reseñar se exige una compra propia **UTILIZADA**, sin requerir `fechaFin`. Se admite más de una reseña por compra; los reintentos de una misma publicación no la duplican.
- **Experiencias anteriores** selecciona reseñas de eventos anteriores y finalizados del mismo organizador. Conserva la condición `fechaFin` alcanzada; el formulario móvil no permite cargar ese campo. Es una condición distinta de la habilitación para publicar una reseña.
- Los perfiles son simulados y la API usa `X-Usuario-Id` como identidad de desarrollo. No hay login ni autenticación real.
- Los datos del backend se pierden al reiniciar su proceso. Los favoritos y filtros viven en el cliente por perfil; los favoritos no se sincronizan con la API y se pierden al recargar la app.
- El chat se actualiza al abrirlo, solicitar actualización o volver del segundo plano. No incorpora recepción en tiempo real ni notificaciones.

## Comandos disponibles

| Desde | Comando | Descripción |
| --- | --- | --- |
| Raíz | `npm run backend` | API con recarga automática. |
| Raíz | `npm run frontend` | Expo por LAN. |
| `backend/` | `npm start` | API sin recarga automática. |
| `frontend/` | `npx expo start --go --tunnel --clear` | Expo por túnel limpiando caché. |
| Raíz | `npm test --workspace=backend` | Pruebas del backend. |
| Raíz | `npm test --workspace=frontend` | Pruebas del frontend e integraciones HTTP. |
| Raíz | `npm run check --workspace=frontend` | Comprobar dependencias de Expo; puede consultar la red. |

`npm test` desde la raíz ejecuta **solo las pruebas del backend**. Los scripts `android` e `ios` del frontend abren el entorno correspondiente instalado en la computadora; no son necesarios para escanear el QR en un teléfono físico.

Las pruebas utilizan instancias aisladas y puertos locales temporales. Cubren reglas de negocio, permisos, contratos, cupos, estados, cancelaciones, chat, reseñas y recuperación de solicitudes. La compilación y las pruebas automatizadas complementan la revisión visual en el teléfono; no la sustituyen.

## Solución de problemas

| Síntoma | Comprobación |
| --- | --- |
| La app abre pero no carga eventos o categorías | Abrir `/api/health` y `/api/categorias` desde el teléfono; revisar la URL de la API, la IP y el acceso al puerto `3000`. |
| El catálogo está vacío | Crear el primer evento como Organizador 1. Los eventos ya iniciados no aparecen en el catálogo predeterminado. |
| Funciona `localhost` en la PC, pero falla desde el teléfono | Comprobar la red local, el firewall y, si corresponde, el reenvío de WSL. |
| Error de SDK incompatible | Instalar Expo Go compatible con SDK 54 y consultar la guía oficial; no actualizar dependencias sin revisar su compatibilidad. |
| La app conserva una URL anterior | Reiniciar Expo y usar `--clear` si hace falta; luego recargar la app. |
| `EADDRINUSE` | Ya hay un proceso usando el puerto. Conservar la instancia que corresponda o detenerla antes de iniciar otra. |
| Desaparecieron los datos tras editar el backend | El proceso se reinició y su almacenamiento en memoria se vació. |

## Documentación de los módulos

- [Backend: arquitectura, reglas, API y acceso con WSL](backend/README.md).
- [Frontend: perfiles, recorridos y relación con el código](frontend/README.md).
