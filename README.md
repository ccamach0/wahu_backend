# 🐾 Wahu - Red Social para Mascotas

Aplicación web full-stack basada en el diseño Figma de Wahu.

## Estructura del proyecto

```
mascotas/
├── frontend/          # React + Vite + TailwindCSS
├── backend/           # Node.js + Express
└── database/          # Scripts SQL para PostgreSQL
```

## Tecnologías

| Capa       | Tecnología                  |
|------------|-----------------------------|
| Frontend   | React 18, Vite, TailwindCSS, React Router |
| Backend    | Node.js, Express, JWT, bcrypt |
| Base datos | PostgreSQL                  |

## Instalación

### 1. Base de datos (PostgreSQL)

```bash
# Crear la base de datos
psql -U postgres -c "CREATE DATABASE wahu_db;"

# Crear tablas
psql -U postgres -d wahu_db -f database/001_schema.sql

# Insertar datos de prueba
psql -U postgres -d wahu_db -f database/002_seed.sql
```

### 2. Backend

```bash
cd backend

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL

# Instalar dependencias
npm install

# Iniciar servidor (puerto 3001)
npm run dev
```

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (puerto 5173)
npm run dev
```

Abrir: **http://localhost:5173**

## Páginas de la aplicación

| Ruta         | Descripción                            |
|--------------|----------------------------------------|
| `/login`     | Inicio de sesión                       |
| `/register`  | Registro de nuevo compañero            |
| `/home`      | Inicio con mascotas populares          |
| `/pets`      | Explorar todas las mascotas            |
| `/contests`  | Certámenes y concursos                 |
| `/pack`      | Manada (top 20) y Jauría (todos)      |
| `/clans`     | Clanes comunitarios                    |
| `/cards`     | Tarjetas de atributos                  |
| `/hydrant`   | Hidrante virtual para socializar       |
| `/companion` | Perfil del compañero y sus mascotas    |

## Variables de entorno (backend)

```env
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/wahu_db
JWT_SECRET=tu_clave_secreta
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

## API Endpoints

```
POST /api/auth/register    Registrar compañero
POST /api/auth/login       Iniciar sesión
GET  /api/auth/me          Usuario actual

GET  /api/pets             Listar mascotas
GET  /api/pets/popular     Mascotas populares (home)
GET  /api/pets/:username   Ver mascota
POST /api/pets             Crear mascota

GET  /api/cards            Listar tarjetas
POST /api/cards            Crear tarjeta
POST /api/cards/:id/paw    Votar con huella

GET  /api/clans            Listar clanes
POST /api/clans            Crear clan
POST /api/clans/:id/join   Unirse a clan

GET  /api/contests         Certámenes
GET  /api/hydrant          Mascotas en hidrante

GET  /api/friendships/:pet_id  Manada y Jauría
```

## Colores del tema

```css
--color-primary: #FF6B35   /* Naranja Wahu */
--color-bg:      #FFF5F0   /* Fondo crema */
```

## Scripts de base de datos

| Script             | Descripción                     |
|--------------------|---------------------------------|
| `001_schema.sql`   | Crea todas las tablas           |
| `002_seed.sql`     | Datos de prueba iniciales       |
| `003_reset.sql`    | Elimina todo (solo desarrollo)  |
