# ✅ CHECKLIST DE DESPLIEGUE A NEON - Proyecto Wahu

**Fecha**: 23 de Abril de 2026  
**Versión**: 1.0.0  
**Estado**: Listo para Producción  

---

## 📋 PASO 1: VERIFICACIÓN LOCAL (30 MINUTOS)

### 1.1 Verificar Base de Datos Local
```bash
# Conectar a PostgreSQL local
psql -U postgres -d wahu_db

# Ejecutar queries de verificación
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'cards' AND column_name IN ('card_type', 'like_count');

SELECT tablename FROM pg_tables WHERE tablename IN ('card_likes', 'pet_tags');
```

**Esperado:**
- ✅ Columnas: `card_type`, `like_count`, `value1_name`, `value1_value`, `value2_name`, `value2_value`
- ✅ Tablas: `card_likes`, `pet_tags`

### 1.2 Verificar Backend
```bash
cd C:/claude/mascotas/backend
npm run build  # Compilar
npm run dev    # Iniciar servidor
```

**Esperado:**
- ✅ Backend corriendo en `http://localhost:3001`
- ✅ Sin errores en consola
- ✅ Conexión a BD exitosa

### 1.3 Verificar Frontend
```bash
cd C:/claude/mascotas/frontend
npm run dev
```

**Esperado:**
- ✅ Frontend corriendo en `http://localhost:5173`
- ✅ Sin errores de compilación
- ✅ Bundle size: ~491 KB (gzip)

### 1.4 Verificar Git
```bash
cd C:/claude/mascotas
git status  # Debe estar limpio

# Verificar commits
git log --oneline -5
# Esperado: 5 commits recientes
```

---

## 📦 PASO 2: PREPARAR NEON (30 MINUTOS)

### 2.1 Acceder a Neon Console
1. Abre https://console.neon.tech
2. Login con tu cuenta
3. Selecciona proyecto "wahu"
4. Anota la `DATABASE_URL` (la necesitarás)

### 2.2 Aplicar Migración de BD
**Opción A: Neon Console (Recomendado)**
1. Ve a **SQL Editor**
2. Abre archivo: `C:/claude/mascotas/backend/migration_incremental.sql`
3. Copia TODO el contenido
4. Pega en Neon Console
5. Click en **Execute**
6. Espera mensaje de éxito

**Opción B: Usar Script Node.js**
```bash
cd C:/claude/mascotas/backend

# Crear archivo .env.production si no existe
echo "DATABASE_URL=postgresql://user:password@host:port/database" > .env.production

# Ejecutar migración
DATABASE_URL="tu_neon_url" node scripts/migrate.js
```

### 2.3 Verificar Migración en Neon
Ejecuta en Neon Console:

```sql
-- Verificar columnas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cards' 
AND column_name IN ('card_type', 'value1_name', 'like_count')
ORDER BY column_name;

-- Verificar tablas
SELECT tablename FROM pg_tables 
WHERE tablename IN ('card_likes', 'pet_tags');

-- Verificar índices
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('card_likes', 'pet_tags')
ORDER BY indexname;
```

**Esperado:**
```
✅ Columnas: 6 registros
✅ Tablas: 2 registros  
✅ Índices: 3 registros
```

---

## 🚀 PASO 3: CONFIGURAR DEPLOYMENT (30 MINUTOS)

### 3.1 Configurar Variables de Ambiente en Producción

**En tu plataforma de hosting (Vercel, Heroku, etc):**

```env
# BACKEND
DATABASE_URL=postgresql://user:password@host/wahu_db
JWT_SECRET=wahu_super_secret_key_2024
NODE_ENV=production
PORT=3001

# FRONTEND
VITE_API_URL=https://api.wahu.example.com
VITE_GOOGLE_CLIENT_ID=224025465676-hfud6mpmpf1qqf1a77tocpbc4vh7q760.apps.googleusercontent.com
```

### 3.2 Configurar Google OAuth
1. Abre https://console.cloud.google.com
2. Ve a Credentials
3. Actualiza URI de redirección autorizado:
   - `https://wahu.example.com`
   - `https://app.wahu.example.com`

### 3.3 Configurar CORS en Backend
Actualiza `backend/index.js`:
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://wahu.example.com', 'https://app.wahu.example.com']
    : 'http://localhost:5173'
};
```

---

## 📤 PASO 4: PUSH A REPOSITORIOS REMOTOS (10 MINUTOS)

```bash
cd C:/claude/mascotas

# Root
git push origin master

# Backend (si tienes acceso)
cd backend && git push origin main

# Frontend (si tienes acceso)
cd ../frontend && git push origin main
```

**Esperado:**
- ✅ Todos los commits pushados exitosamente
- ✅ CI/CD pipeline disparado automáticamente
- ✅ Builds iniciados

---

## ✅ PASO 5: VERIFICACIÓN POST-DESPLIEGUE (20 MINUTOS)

### 5.1 Verificar que App Carga
```
1. Abre https://wahu.example.com
2. ¿Carga sin errores? ✅ SI / ❌ NO
3. ¿Ves el landing page o login? ✅ SI / ❌ NO
```

### 5.2 Verificar Registro
```
1. Click en "Registrarse"
2. Completa email, password, nombre
3. Click "Registrarse"
4. ¿Recibiste email de confirmación? ✅ SI / ❌ NO
5. ¿Puedes login? ✅ SI / ❌ NO
```

### 5.3 Verificar Funcionalidades Nuevas
```
1. Login exitosamente
2. Ve a "Compañero" → Crear mascota
3. Crea una mascota nueva
4. Ve a "Mis mascotas" → haz click en mascota
5. Agrega tarjeta con tipo "doble" o "triple"
6. ¿Se guarda correctamente? ✅ SI / ❌ NO
7. Dale "like" a la tarjeta
8. ¿Se incrementa contador? ✅ SI / ❌ NO
9. Agrega etiqueta "juguetón"
10. ¿Se persiste en BD? ✅ SI / ❌ NO
```

### 5.4 Revisar Consola de Browser
```
Abre DevTools (F12):
1. ¿Errores en Console? ✅ NINGUNO / ❌ ALGUNOS
2. ¿Errores de Network? ✅ NINGUNO / ❌ ALGUNOS
3. ¿Warnings? ✅ POCOS / ❌ MUCHOS
```

### 5.5 Revisar Logs del Backend
```bash
# En tu plataforma de hosting, revisar logs:
# Buscar errores o warnings anormales
# Si ves errores de BD, revisar DEPLOYMENT.md
```

---

## 🚨 PASO 6: MANEJO DE ERRORES

### Error: "Migration already exists"
**Solución:**
- Esto es NORMAL - las migraciones son idempotentes
- La BD ya tiene los cambios
- Continúa con verificación

### Error: "Table already exists"
**Solución:**
- Usar `DROP TABLE IF EXISTS` antes de crear
- O usar `CREATE TABLE IF NOT EXISTS`
- Ya está implementado en nuestro script

### Error: "Permission denied for schema"
**Solución:**
- Usuario de Neon no tiene permisos suficientes
- Contactar support de Neon
- O crear nuevo usuario con admin access

### Error: CORS en frontend
**Solución:**
```javascript
// Verificar que VITE_API_URL sea correcto
console.log(import.meta.env.VITE_API_URL)

// Debe ser: https://api.wahu.example.com
```

### Error: "Invalid email" en registro
**Solución:**
- Usar email válido (contiene @)
- Dominio debe existir
- Backend valida con: `validateEmail`

---

## 📊 PASO 7: MONITOREO (CONTINUO)

### Métricas a Vigilar
- [ ] Uptime > 99.9%
- [ ] Response time < 500ms
- [ ] Error rate < 0.1%
- [ ] BD queries < 1000ms

### Logs a Revisar (cada día primeros 7 días)
- [ ] Errores de conexión a BD
- [ ] Fallos de autenticación
- [ ] Errores en API de tarjetas
- [ ] Errores en API de tags
- [ ] Crashes del backend

### Alertas Configurar
```
Si:
- Uptime cae < 95% → Alert
- Error rate > 1% → Alert
- Response time > 2000ms → Alert
- BD lag > 500ms → Alert
```

---

## 🔄 ROLLBACK (Si es Necesario)

**Si algo falla en producción:**

```sql
-- ADVERTENCIA: Perderás datos en las nuevas tablas

DROP TABLE IF EXISTS public.card_likes CASCADE;
DROP TABLE IF EXISTS public.pet_tags CASCADE;

ALTER TABLE public.cards DROP COLUMN IF EXISTS card_type;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value1_name;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value1_value;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value2_name;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value2_value;
ALTER TABLE public.cards DROP COLUMN IF EXISTS like_count;
```

Luego revertir código a commits anteriores en git.

---

## 📚 DOCUMENTACIÓN DE REFERENCIA

| Problema | Documento |
|----------|-----------|
| Migración BD | `NEON_MIGRATION.md` |
| Componentes | `COMPONENTS.md` |
| Arquitectura | `IMPROVEMENTS_SUMMARY.md` |
| Deployment | `DEPLOYMENT.md` |
| Dev futuro | `CLAUDE.md` |

---

## ✨ CHECKLIST FINAL

### Pre-Deployment
- [ ] BD local tiene todas las nuevas columnas
- [ ] Backend compila sin errores
- [ ] Frontend compila sin errores
- [ ] Todos los commits están en git
- [ ] Variables de ambiente configuradas

### Deployment
- [ ] Migración aplicada a Neon
- [ ] Consultas de verificación pasadas
- [ ] Push a repositorios remotos
- [ ] CI/CD pipeline completado
- [ ] App cargando en producción

### Post-Deployment
- [ ] Login/Registro funciona
- [ ] Crear mascota funciona
- [ ] Agregar tarjeta funciona
- [ ] Likes en tarjetas funciona
- [ ] Agregar tags funciona
- [ ] Console del browser limpia
- [ ] Logs del backend normales

### Monitoring (Primeros 7 Días)
- [ ] Día 1: Revisión a las 2 horas
- [ ] Día 1: Revisión al final del día
- [ ] Día 2-7: Revisión diaria
- [ ] Sin alertas críticas
- [ ] Uptime > 99%

---

## 🎉 CUANDO ESTÉ LISTO

**Si todas las casillas están marcadas:**

✅ **PROYECTO LISTO PARA PRODUCCIÓN**

Puedes notificar a stakeholders y usuarios de la nueva versión.

---

**Tiempo total estimado**: 2-3 horas  
**Fecha recomendada**: Inmediatamente después de completar sesión  
**Responsable**: Equipo DevOps/Deployment  

¿Necesitas ayuda? Revisa los documentos de referencia o contacta al equipo técnico.

---

**Última actualización**: 2026-04-23  
**Versión**: 1.0.0
