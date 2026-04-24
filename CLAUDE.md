# Proyecto Wahu — Guía para Claude

## ¿Qué es?
Red social para mascotas. Los dueños (Compañeros) registran sus mascotas y las mascotas tienen vida social: amigos, clanes, tarjetas de atributos, certámenes, hidrante (encuentro virtual).

## Stack
- **Frontend**: React 18 + Vite + TailwindCSS → `frontend/` → puerto 5173
- **Backend**: Node.js + Express + JWT → `backend/` → puerto 3001
- **BD**: PostgreSQL 16 local → base `wahu_db`

## Cómo arrancar
```bash
# 1. PostgreSQL (si no está corriendo)
"C:/Program Files/PostgreSQL/16/bin/pg_ctl.exe" start -D "C:/Program Files/PostgreSQL/16/data"

# 2. Backend
cd C:/claude/mascotas/backend && npm run dev

# 3. Frontend
cd C:/claude/mascotas/frontend && npm run dev
```

## Credenciales
- **PostgreSQL**: host=localhost port=5432 db=wahu_db user=postgres pass=postgres
- **JWT_SECRET**: wahu_super_secret_key_2024
- **Google Client ID**: 224025465676-hfud6mpmpf1qqf1a77tocpbc4vh7q760.apps.googleusercontent.com
- **Usuario demo**: ana@wahu.com / password123 (también carlos@wahu.com, maria@wahu.com)

## Arquitectura frontend
```
src/
  pages/        — Una página por ruta
  components/   — Sidebar, PetCard, WahuLogo, GoogleAuthButton
  hooks/        — useAuth.jsx, useMyPets.jsx
  services/     — api.js (todas las llamadas al backend)
```

## Rutas
| Ruta | Página | Estado |
|------|--------|--------|
| /login, /register | Auth | ✅ funcional + Google OAuth |
| /home | Home | ✅ mascotas populares reales |
| /pets | Pets | ✅ lista + búsqueda |
| /pets/:username | PetProfile | ✅ perfil completo |
| /companion | Companion | ✅ mis mascotas CRUD |
| /cards | Cards | ✅ votar, agregar a mascota |
| /clans | Clans | ✅ explorar, crear, unirse |
| /hydrant | Hydrant | ✅ toggle persiste en BD |
| /pack | Pack | ✅ manada/jauría desde BD |
| /contests | Contests | UI estática (sin certámenes activos) |

## Backend routes
- `GET /api/pets?search=&limit=` — lista paginada
- `GET /api/pets/popular` — top 6 para Home
- `GET /api/pets/my/pets` — mascotas del usuario autenticado
- `GET /api/pets/:username` — perfil completo con cards y amigos
- `DELETE /api/pets/:id` — eliminar mascota propia
- `GET /api/clans`, `POST /api/clans`, `POST /api/clans/:id/join`
- `GET /api/clans/my/:pet_id` — mis clanes
- `GET /api/cards`, `POST /api/cards`, `POST /api/cards/:id/paw`, `POST /api/cards/:id/add-to-pet`
- `GET /api/hydrant`, `PUT /api/hydrant/:pet_id/toggle`
- `GET /api/friendships/:pet_id` → `{ manada, jauria }`
- `GET /api/stats` — conteos reales (pets, clans, companions)

## Patrones importantes
- `api.js` centraliza todas las llamadas. El token JWT se guarda en `localStorage` como `wahu_token`
- `useMyPets()` hook devuelve `{ pets, firstPet, loading }` — muchas páginas necesitan `firstPet.id` para llamadas autenticadas
- Demo fallback: si el backend está caído, `useAuth.login()` acepta `ana@wahu.com/password123` sin red
- `GoogleAuthButton` tiene error boundary — si Google OAuth falla no tira toda la app
- Las páginas usan skeleton loading (`animate-pulse`) mientras cargan

## Diseño
- Colores: `wahu-500` = naranja principal (#F97316 aprox)
- Fuente de clases CSS custom: `card`, `btn-primary`, `btn-secondary`, `input`, `badge`, `page-header`, `page-title`, `page-subtitle`, `page-icon`
- Logo: `frontend/public/logo-wahu.png` (PNG real, W naranja con huellas)
- `WahuLogo` component acepta props: `size`, `stacked`, `iconOnly`, `textColor`
