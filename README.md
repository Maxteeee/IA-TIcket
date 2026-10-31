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

El frontend conecta **C3 y C11: búsqueda textual, categorías y ordenamiento** con la API; los demás recorridos conservan sus datos locales. Incluye **Comprador 1** y **Organizador 1**, con un botón superior para alternar y acciones según rol y propiedad. Para usar Explorar hay que iniciar el backend y configurar su dirección accesible desde el celular. Ver [perfiles y recorrido de prueba](frontend/README.md).

## Requisitos

- Node.js 24 recomendado (si usás nvm: `nvm use`).
- npm, incluido con Node.js.
- Un celular con Expo Go compatible con el SDK del proyecto.
- Computadora y celular conectados a la misma red Wi-Fi.

El proyecto usa Expo SDK 54, React 19.1 y React Native 0.81.5, siguiendo la [plantilla oficial de Expo para SDK 54](https://github.com/expo/expo/blob/sdk-54/templates/expo-template-blank/package.json). Se eligió SDK 54 para permitir el uso de Expo Go de la App Store en iPhone; la [documentación de compatibilidad](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) indica que esa versión de Expo Go usa SDK 54. En Android, instalá la versión compatible desde [expo.dev/go](https://expo.dev/go). El SDK de Expo Go debe coincidir con el del proyecto.

## Instalación

Desde la raíz del proyecto:

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

La instalación requiere acceso a `registry.npmjs.org`. El proyecto incluye `package-lock.json`; conservá sus actualizaciones en Git.

## Ejecutar el backend

En una terminal, desde la raíz:

```bash
npm run backend
```

Para probar C3/C11 con categorías, eventos y puntajes iniciales, usar `npm run backend:demo` en lugar del arranque vacío. El detalle del recorrido está en [frontend/README.md](frontend/README.md).

El servidor escucha en todas las interfaces en el puerto 3000 y muestra las direcciones de red de la computadora. Abrí `http://localhost:3000/api/health` en la computadora para comprobarlo.

## Conectar el celular y ejecutar el frontend

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
