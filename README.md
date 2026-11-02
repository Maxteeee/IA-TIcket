# TP React Native + Express

Base en JavaScript para desarrollar el trabajo práctico. El frontend es una app React Native con Expo y el backend es una API Node.js + Express. Ambos módulos están organizados con npm workspaces: se instalan desde la raíz con un solo `npm install`.

## Estructura

```text
.
├── backend/
│   ├── src/
│   │   ├── controllers/       # Reciben solicitudes y devuelven respuestas
│   │   ├── domain/            # Entidades y reglas de negocio
│   │   ├── services/          # Casos de uso, contratos y permisos
│   │   ├── repositories/      # Almacenan y consultan datos en memoria
│   │   ├── routes/            # Definen los endpoints
│   │   ├── http/              # DTOs de respuesta sin ciclos
│   │   ├── app.js            # Configuración de Express
│   │   └── server.js         # Inicio del servidor y puerto
│   ├── test/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Componentes visuales reutilizables
│   │   ├── config/            # Dirección de la API
│   │   ├── screens/           # Pantallas de la app
│   │   └── services/          # Solicitudes HTTP al backend
│   ├── App.js                # Componente raíz
│   ├── index.js              # Entrada de Expo
│   ├── app.json              # Configuración de la app
│   ├── .env.example
│   └── package.json
├── .gitignore
├── .nvmrc
└── package.json              # Workspaces y comandos comunes
```

El backend implementa usuarios, categorías, eventos, compras y reseñas mediante rutas → controladores → servicios → dominio/repositorios. Los tipos de entrada pertenecen al evento; los mensajes e historial, a la compra. El [análisis del dominio y contrato de la API](backend/README.md) explica las operaciones, reglas y límites. Se conserva el ejemplo `items`.

El frontend conecta **C3, C11, C4, C12, C1, C2, C5, C6, C9, C10, C7 y C8: catálogo, publicación, compra, mis compras, ventas, chat, reseñas y cancelación/reembolso simulado** con la API; los demás recorridos conservan sus datos locales. Incluye **Comprador 1** y **Organizador 1**, con un botón superior para alternar y acciones según rol y propiedad. Hay que iniciar el backend y configurar su dirección accesible desde el celular. La compra permite elegir un tipo y cantidad, reserva cupo sin sobreventa y muestra un comprobante real; queda pendiente de pago, sin realizar un cobro. **Compras** muestra registros, estados y días restantes para confirmadas; cada compra tiene su conversación. Una compra utilizada permite puntuar y comentar cuando el evento finalizó. Desde el comprobante, C7 permite cancelar antes del inicio y devuelve cupo; las compras confirmadas reciben un reembolso del total original. Todos los importes a pagar/reembolsar son simulados, sin dinero real. **Explorar → evento → Experiencias anteriores** muestra reseñas de eventos anteriores finalizados del mismo organizador, con autor, puntuación, comentario y evento de origen. **Organizar → Tus eventos publicados → evento** muestra sus compras y disponibilidad; el propietario puede responder en el mismo historial del comprador y consultar la política de cancelación y los reembolsos simulados. Ver [perfiles y recorrido de prueba](frontend/README.md).

## Requisitos

- Node.js 24 recomendado (si usás nvm: `nvm use`).
- npm, incluido con Node.js.
- Un celular con **Expo Go compatible con Expo SDK 54**.
- Computadora y celular en la misma red local para acceder a la API (la computadora puede usar Ethernet y el celular Wi-Fi).

El proyecto usa Expo SDK 54, React 19.1 y React Native 0.81.5, siguiendo la [plantilla oficial de Expo para SDK 54](https://github.com/expo/expo/blob/sdk-54/templates/expo-template-blank/package.json). Se eligió SDK 54 para permitir el uso de Expo Go de la App Store en iPhone; la [documentación de compatibilidad](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) indica que esa versión de Expo Go usa SDK 54. En Android, instalá la versión compatible desde [expo.dev/go](https://expo.dev/go). El SDK de Expo Go debe coincidir con el del proyecto.

### Qué instalar en el celular

- **Android físico:** abrir [Expo Go para SDK 54 / Android](https://expo.dev/go?sdkVersion=54&platform=android&device=true), elegir instalación manual e instalar el APK compatible ofrecido por Expo. Si Android pide autorización, permitir la instalación de ese archivo descargado del sitio oficial. Abrir Expo Go y escanear el QR del servidor de desarrollo.
- **iPhone físico:** instalar Expo Go desde la App Store y comprobar compatibilidad con SDK 54 según [la guía oficial](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/). La guía consultada el 2026-11-02 permite usar el Expo Go de App Store para SDK 54. Si solicita sesión de Expo, usar la misma cuenta en Expo Go y en la CLI (`npx expo login` desde frontend). Escanear el QR con la cámara.
- En el teléfono se instala **Expo Go**; no Node.js ni un SDK de Android. Con este recorrido de dispositivo físico no hace falta preparar Android Studio/JDK ni Xcode en la computadora. Emuladores y compilaciones nativas requieren su entorno correspondiente y no forman parte del arranque con Expo Go.

La versión del proyecto se comprueba en `frontend/package.json` (`expo: ~54.0.37`). Un error de incompatibilidad de SDK se resuelve instalando el Expo Go correspondiente; no cambiar automáticamente las versiones de Expo/React Native del proyecto.

## Instalación

Desde la raíz del proyecto:

```bash
npm install
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

La instalación requiere acceso a `registry.npmjs.org`. El proyecto incluye `package-lock.json`; conservá sus actualizaciones en Git.

Estos comandos son para Bash/Linux/macOS/WSL. `cp -n` prepara los archivos locales solo si no existen, conservando una configuración previa. Instalar dependencias desde la raíz instala ambos workspaces; no hace falta instalar una CLI global de Expo.

## Comandos de cada módulo

El backend ejecuta la API y mantiene los datos en memoria. Expo/Metro sirve el frontend que abre Expo Go. Son **dos procesos**, en terminales separadas; ambos deben permanecer activos.

| Directorio | Uso | Comando |
| --- | --- | --- |
| Raíz | API con recarga al editar | `npm run backend` |
| Raíz | API con catálogo demo | `npm run backend:demo` |
| backend | API con recarga, equivalente | `npm run dev` |
| backend | API sin recarga automática | `npm start` |
| backend | API demo con recarga | `npm run dev:demo` |
| Raíz | Frontend por LAN | `npm run frontend` |
| frontend | Frontend por LAN, equivalente | `npm start` |
| frontend | Expo Go con LAN explícita | `npx expo start --go --lan` |
| frontend | Expo Go con túnel (recorrido usado en este entorno WSL) | `npx expo start --go --tunnel` |
| frontend | Mismo túnel limpiando caché | `npx expo start --go --tunnel --clear` |
| Raíz | Pruebas del backend | `npm test --workspace=backend` |
| Raíz | Pruebas del frontend y sus integraciones HTTP | `npm test --workspace=frontend` |
| frontend | Comprobar dependencias del SDK, puede consultar la red | `npm run check` |

`npm test` desde la raíz ejecuta **solo backend**. Para ver todos los casos individualmente en Node 24 se puede agregar `-- --test-isolation=none` a los comandos de pruebas. Los scripts `npm run android` y `npm run ios` de frontend abren el entorno Android/iOS instalado en la computadora; no son necesarios para escanear el QR en el celular.

No iniciar dos backends sobre el puerto 3000. Detener el servidor con Ctrl+C en su terminal; reiniciar la API o editarla en modo watch borra sus datos. Para conservarlos durante pruebas de UI se puede usar `npm start` desde backend y recargar únicamente Expo/app.

## Ejecutar el backend

En una terminal, desde la raíz:

```bash
npm run backend
```

Para probar C3/C11 con categorías, eventos y puntajes iniciales, usar `npm run backend:demo` en lugar del arranque vacío. El detalle del recorrido está en [frontend/README.md](frontend/README.md).

Ambos modos preparan los perfiles Comprador 1/Organizador 1 y cinco categorías. El modo normal no precarga eventos: podés publicarlos desde Organizar.

El servidor escucha en todas las interfaces en el puerto 3000 y muestra las direcciones de red de la computadora. Abrí `http://localhost:3000/api/health` en la computadora para comprobarlo.

Si el backend corre en WSL, la dirección marcada **API interna WSL** puede no ser accesible desde el celular. Usá la IP de Windows y configurá el reenvío del puerto 3000 según [la guía de WSL](backend/README.md#acceso-desde-el-celular-con-wsl). `PUBLIC_API_URL` en backend/.env permite mostrar esa dirección al iniciar; no configura la red por sí sola.

## Conectar el celular y ejecutar el frontend

La API usa el puerto **3000** y Expo/Metro normalmente **8081**. En WSL usar la IPv4 de Windows para la API y completar primero el reenvío indicado en la guía anterior. Para evitar la limitación de LAN de Metro en WSL, abrir otra terminal en frontend y ejecutar `npx expo start --go --tunnel`; el backend sigue levantándose con su comando habitual.

Editá `frontend/.env` con la IP de tu computadora que muestra el backend, por ejemplo:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api
```

En un celular físico, `localhost` apunta al propio celular. Por eso hay que usar la IP de la computadora. Para el emulador estándar de Android, se puede usar `http://10.0.2.2:3000/api`; para el simulador de iOS ejecutado en la misma Mac que el backend, `http://localhost:3000/api`.

En otra terminal, desde la raíz:

```bash
npm run frontend
```

Escaneá el QR con Expo Go en Android o con la cámara en iPhone. Si Expo Go solicita iniciar sesión, usá la misma cuenta en Expo Go y en la CLI (`npx expo login`, ejecutado desde `frontend/`). Si cambiás `.env`, reiniciá Expo y recargá la app.

Podés comprobar la conexión abriendo `http://IP_DE_TU_PC:3000/api/health` desde el navegador del celular. Si no responde, revisá la IP, la red y el acceso al puerto 3000 en el firewall. Expo usa también el puerto 8081 para servir la app. Un túnel de Expo solo expone Metro; la API necesita seguir siendo accesible desde el celular.

### Verificar conexión y resolver errores de arranque

1. En la computadora, abrir `http://localhost:3000/api/health`: debe devolver `{"status":"ok","message":"Backend conectado"}`. Si falla, revisar la terminal del backend y que esté ejecutándose.
2. En el celular, abrir `http://IP_DE_TU_PC:3000/api/health`. Usar `http://` con **dos barras**, una IP real (no escribir el texto IP_DE_TU_PC) y el puerto. En WSL usar la IP de Windows, no la dirección marcada API interna WSL. Si solo funciona localhost, revisar reenvío/firewall según la guía WSL. Confirmar que ambos dispositivos compartan red y que la red no aísle clientes.
3. Abrir `/api/categorias` en esa misma dirección: el inicio normal prepara cinco categorías y los dos perfiles, sin necesitar crear categorías en la app.
4. Configurar `EXPO_PUBLIC_API_URL=http://IP_DE_TU_PC:3000/api` en frontend/.env. `PUBLIC_API_URL` en backend/.env puede usar el mismo valor para informar la URL; por sí sola no habilita el acceso ni configura el frontend.
5. Abrir la app por el QR y recargarla. Si sigue usando una dirección anterior, detener **solo Expo** y usar el comando con `--clear` de la tabla. El túnel de Expo no soluciona el acceso a la API y un QR que abre la app no demuestra conexión con el backend.
6. Como Organizador 1, publicar un evento futuro; consultarlo por `/api/eventos` desde el navegador. Como Comprador 1, comprar y comprobar desde Organizar que coincidan venta y cupo. Usar los recorridos conectados, separados de Recorrer ejemplos.

Si el error menciona un SDK incompatible, revisar la instalación de Expo Go; si la app abre pero no carga categorías/eventos, comprobar la URL de la API. Si aparece EADDRINUSE, ya hay otro proceso escuchando en ese puerto. Los pasos de uso y la preparación manual de confirmación/utilización/reseñas están en [frontend/README.md](frontend/README.md).

## Persistencia en memoria

Los datos de la API se guardan dentro del proceso de Node.js. Reiniciar el backend borra todos los datos, incluso los reinicios automáticos de `node --watch` al editar código. No se utiliza una base de datos, archivos ni AsyncStorage. La maqueta mantiene su propio estado en React y se reinicia al recargarla.

## Endpoints de ejemplo

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Verificar que el backend responde |
| GET | `/api/items` | Listar los elementos en memoria |
| POST | `/api/items` | Crear un elemento con `{"name":"Ejemplo"}` |

El nombre del ejemplo debe tener entre 1 y 100 caracteres. Los endpoints del dominio, incluidos compra, ventas, favoritos, chat y reseñas, están documentados en [backend/README.md](backend/README.md). Las operaciones personales utilizan el encabezado de desarrollo `X-Usuario-Id`, sin autenticación real.

## Verificaciones

```bash
npm test
npm test --workspace=frontend
npm run check --workspace=frontend
```

Las pruebas usan el runner de Node; las de HTTP requieren Express instalado y abren puertos locales temporales. El chequeo de Expo requiere instalar las dependencias y puede consultar la red. Para conectar el celular a la API hay que configurar una dirección accesible desde su red; el túnel de Expo solo transporta Metro.

## Cómo se inicializa un proyecto así

Los comandos habituales para crear los módulos desde cero serían:

```bash
# Frontend React Native con la plantilla oficial de Expo.
npx create-expo-app@latest frontend --template expo-template-blank@sdk-54

# Backend: dentro de una carpeta backend, inicializar e instalar Express.
npm init -y
npm install express
```

Los archivos de inicialización ya están creados en esta carpeta; para seguir, usá los pasos de instalación y ejecución anteriores.
