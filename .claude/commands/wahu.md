# /wahu — Estado actual del proyecto Wahu

Muestra el estado completo del proyecto para orientarte rápidamente.

```bash
echo "=== SERVICIOS ===" && \
curl -s http://localhost:3001/api/health && echo "" && \
curl -s http://localhost:3001/api/stats && echo "" && \
echo "=== FRONTEND ===" && \
curl -s -o /dev/null -w "Puerto 5173: %{http_code}" http://localhost:5173 && echo ""
```

## Contexto del proyecto
- **Red social para mascotas** — dueños (Compañeros) registran mascotas que tienen vida social
- Frontend: `C:/claude/mascotas/frontend/` → puerto 5173
- Backend: `C:/claude/mascotas/backend/` → puerto 3001  
- BD: PostgreSQL 16 → `wahu_db` (postgres/postgres)

## Páginas funcionales
/home, /pets, /pets/:username, /companion, /cards, /clans, /hydrant, /pack

## Usuario demo: ana@wahu.com / password123
