# TP React Native + Express

Base en JavaScript para desarrollar el trabajo práctico. El frontend es una app React Native con Expo y el backend es una API Node.js + Express. Ambos módulos están organizados con npm workspaces: se instalan desde la raíz con un solo `npm install`.

## Estructura

```text
.
├── backend/
│   ├── src/
│   │   ├── controllers/       # Reciben solicitudes y devuelven respuestas
│   │   ├── repositories/      # Almacenan y consultan datos en memoria
│   │   ├── routes/            # Definen los endpoints
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

El ejemplo permite crear y listar elementos para comprobar la comunicación entre ambos módulos. Se puede reemplazar `items` por las entidades del enunciado. Cuando haya reglas de negocio, se puede agregar `backend/src/services/` entre los controladores y los repositorios.

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

La instalación requiere acceso a `registry.npmjs.org`. Al preparar esta estructura, ese acceso falló con `EAI_AGAIN`: las dependencias y el archivo `package-lock.json` quedan pendientes de generar con `npm install`. Una vez generado, conservá el lockfile en Git.

## Ejecutar el backend

En una terminal, desde la raíz:

```bash
npm run backend
```

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

Los elementos se guardan en un arreglo dentro del proceso de Node.js. Cerrar y abrir la app conserva los datos mientras el backend siga activo. Reiniciar el backend borra todos los datos, incluso los reinicios automáticos de `node --watch` al editar código. No se utiliza una base de datos, archivos ni AsyncStorage.

## Endpoints de ejemplo

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Verificar que el backend responde |
| GET | `/api/items` | Listar los elementos en memoria |
| POST | `/api/items` | Crear un elemento con `{"name":"Ejemplo"}` |

El nombre debe tener entre 1 y 100 caracteres. Este ejemplo es una base para adaptar al enunciado, no la implementación completa del TP.

## Verificaciones

```bash
npm test
npm run check --workspace=frontend
```

Las pruebas del repositorio usan el runner de Node y se pueden ejecutar sin instalar dependencias. El chequeo de Expo requiere instalar las dependencias y puede consultar la red. La ejecución completa de Express y la app en un celular queda pendiente hasta completar la instalación y configurar la IP.

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
