# 🚀 Guía de Actualización - Base de Datos Neon

## Cambios en la Base de Datos

### Nuevas Columnas en `cards`
- `card_type` (varchar): Tipo de tarjeta (simple, doble, triple) - DEFAULT: 'simple'
- `value1_name` (varchar): Nombre del primer atributo
- `value1_value` (varchar): Valor del primer atributo
- `value2_name` (varchar): Nombre del segundo atributo
- `value2_value` (varchar): Valor del segundo atributo
- `like_count` (int): Contador de likes - DEFAULT: 0

### Nuevas Tablas
1. **card_likes**
   - id (uuid): Primary Key
   - card_id (uuid): Foreign Key a cards
   - pet_id (uuid): Foreign Key a pets
   - liked_at (timestamp): Fecha del like
   - Unique constraint: (card_id, pet_id)
   - Cascade delete en ambas FK

2. **pet_tags**
   - id (uuid): Primary Key
   - pet_id (uuid): Foreign Key a pets
   - tag_name (varchar): Nombre de la etiqueta
   - created_at (timestamp): Fecha de creación
   - Unique constraint: (pet_id, tag_name)
   - Cascade delete en FK de pets

### Nuevos Índices
- `idx_card_likes_card`: Index en card_likes(card_id)
- `idx_card_likes_pet`: Index en card_likes(pet_id)
- `idx_pet_tags_pet`: Index en pet_tags(pet_id)

## Pasos para Aplicar la Migración

### Opción 1: Desde Neon Console

1. Abre [Neon Console](https://console.neon.tech)
2. Selecciona tu proyecto "wahu"
3. Ve a SQL Editor
4. Copia el contenido de `backend/migration_incremental.sql`
5. Pega en el editor
6. Ejecuta la consulta

### Opción 2: Usando psql (Local)

```bash
# Asegúrate de tener psql instalado
# Reemplaza DATABASE_URL con tu string de conexión

psql "postgresql://user:password@host:port/database" -f backend/migration_incremental.sql
```

### Opción 3: Usando Node.js

```bash
cd backend
npm install pg
node scripts/migrate.js
```

## Verificación

Después de aplicar la migración, verifica que los cambios se hayan aplicado correctamente:

```sql
-- Verificar columnas nuevas en cards
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cards' AND column_name IN ('card_type', 'value1_name', 'like_count')
ORDER BY column_name;

-- Verificar tablas nuevas
SELECT tablename FROM pg_tables WHERE tablename IN ('card_likes', 'pet_tags');

-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename IN ('card_likes', 'pet_tags');

-- Verificar constraints
SELECT constraint_name, table_name FROM information_schema.table_constraints 
WHERE constraint_name LIKE 'card_likes%' OR constraint_name LIKE 'pet_tags%';
```

## Rollback (Si es necesario)

Si necesitas revertir los cambios:

```sql
-- ADVERTENCIA: Esto eliminará datos. Usar con cuidado.

DROP TABLE IF EXISTS public.card_likes CASCADE;
DROP TABLE IF EXISTS public.pet_tags CASCADE;

ALTER TABLE public.cards DROP COLUMN IF EXISTS card_type;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value1_name;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value1_value;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value2_name;
ALTER TABLE public.cards DROP COLUMN IF EXISTS value2_value;
ALTER TABLE public.cards DROP COLUMN IF EXISTS like_count;
```

## API Endpoints Nuevos/Modificados

### POST /api/cards/:id/like
Dar like a una tarjeta
```json
{
  "pet_id": "uuid"
}
```
Respuesta: `{ "like_count": 5 }`

### DELETE /api/cards/:id/like
Remover like de una tarjeta
```json
{
  "pet_id": "uuid"
}
```
Respuesta: `{ "like_count": 4 }`

### POST /api/pets/:pet_id/tags
Agregar etiqueta a mascota
```json
{
  "tag_name": "juguetón"
}
```
Respuesta: `{ "success": true }`

### DELETE /api/pets/:pet_id/tags/:tag_name
Remover etiqueta de mascota

Respuesta: `{ "success": true }`

## Variables de Ambiente

Asegúrate de que tu `.env` contiene:

```env
DATABASE_URL=postgresql://user:password@host:port/database
VITE_API_URL=http://localhost:3001
```

## Contacto para Soporte

Si encuentras problemas durante la migración:
- Revisa los logs de Neon Console
- Verifica que la conexión a la base de datos sea correcta
- Asegúrate de tener los permisos necesarios

---

**Última actualización:** 2026-04-23
**Versión de migración:** 1.0.0
