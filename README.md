# Catalogo Premium de Modelos

Catalogo editorial premium construido con React, Vite, Tailwind CSS 4, Supabase y Cloudflare R2. La app consulta Supabase cuando hay credenciales configuradas y conserva los JSON locales como respaldo para desarrollo o despliegues sin backend.

## Desarrollo local

Instalar dependencias:

```bash
pnpm install
```

Iniciar Vite:

```bash
pnpm dev
```

Abrir:

```text
http://127.0.0.1:5173/
```

## Supabase, Auth y R2

1. Copiar `.env.example` a `.env`.
2. Completar:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_R2_PUBLIC_URL=https://media.example.com
VITE_SUPABASE_TIMEOUT_MS=4000
```

3. En Supabase, abrir `SQL Editor` y ejecutar `supabase/schema.sql`.
4. En `Authentication > Providers`, activar Email y Google. En Google, configurar los redirect URLs:

```text
http://127.0.0.1:5173/auth/callback
https://www.dominio.com/auth/callback
```

5. Registrar la primera cuenta desde `/login` y convertirla en super administrador desde Supabase:

```sql
update public.app_profiles
set role = 'super_admin'
where email = 'tu-correo@dominio.com';
```

6. Desplegar la Edge Function de invitaciones y configurar secretos:

```bash
supabase functions deploy invite-user
supabase secrets set SITE_URL=https://www.dominio.com
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

7. Para Google Calendar, activar Google Calendar API en Google Cloud y agregar este redirect URI al mismo OAuth Client:

```text
https://PROJECT_REF.supabase.co/functions/v1/calendar-oauth-callback
```

Luego configurar secretos y desplegar las funciones:

```bash
supabase secrets set GOOGLE_CLIENT_ID=your-google-oauth-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
supabase functions deploy calendar-connect
supabase functions deploy calendar-oauth-callback --no-verify-jwt
supabase functions deploy calendar-disconnect
supabase functions deploy availability-query
```

El enlace de calendario usa los scopes `https://www.googleapis.com/auth/calendar.freebusy` y `https://www.googleapis.com/auth/calendar.calendarlist.readonly`. La app lista calendarios disponibles para consultar rangos ocupados con FreeBusy; no lee titulos ni crea eventos en Google Calendar.

8. Subir las imagenes a R2 manteniendo las mismas rutas, por ejemplo:

```text
images/models/isabella/cover.jpg
images/models/isabella/profile.jpg
images/models/isabella/gallery-01.jpg
```

Si `VITE_R2_PUBLIC_URL` queda vacio, las imagenes se cargan desde `public/images/`. Si se configura, cualquier ruta relativa de las tablas o JSON se resuelve contra R2.

9. Para administrar las galerias desde el panel, crear un token de API de R2 limitado al bucket de imagenes con permisos de lectura y escritura. Guardar sus datos exclusivamente como secretos de la Edge Function y desplegarla:

En un proyecto Supabase ya existente, ejecutar primero `supabase/migrations/20260714_gallery_r2_media.sql` desde SQL Editor. En una instalacion nueva, estos cambios ya estan incluidos en `supabase/schema.sql`.

```bash
supabase secrets set R2_ACCOUNT_ID=...
supabase secrets set R2_ACCESS_KEY_ID=...
supabase secrets set R2_SECRET_ACCESS_KEY=...
supabase secrets set R2_BUCKET_NAME=...
supabase secrets set R2_PUBLIC_URL=https://media.example.com
supabase functions deploy gallery-media
```

Las credenciales de R2 nunca deben guardarse en variables `VITE_*`: esas variables se publican en el navegador.

## Panel administrativo

El panel privado vive en:

```text
/admin
```

Rutas principales:

```text
/login
/admin/modelos
/admin/portada
/admin/ubicaciones
/admin/categorias
/admin/usuarios
/admin/mi-perfil
/admin/favoritos
/admin/reservas
```

Roles:

```text
super_admin: acceso total, portada del sitio, usuarios, territorios e invitaciones
admin: modelos, ubicaciones, categorias y reservas dentro de sus territorios
model: edicion del modelo vinculado, calendario y reservas propias
user: cuenta, favoritos y solicitudes de reserva desde el perfil publico
```

El editor de modelos permite cargar una portada y un video para escritorio, una portada y un video para celular, y la foto publica de perfil. Los archivos se guardan en los buckets publicos `model-images` y `model-videos` de Supabase Storage; una modelo solo puede gestionar sus propios archivos y los administradores unicamente los modelos de sus territorios. Las rutas antiguas de R2 siguen siendo compatibles hasta que cada medio se reemplace.

La galeria se gestiona por separado dentro del mismo editor. Cada modelo puede subir, reemplazar, ordenar y eliminar sus propias fotos. La Edge Function `gallery-media` valida los permisos, guarda los archivos bajo `models/{modelId}/gallery/` y elimina el objeto de R2 antes de retirar su registro de la galeria. Las escrituras directas a `gallery_images` estan revocadas para evitar que una ruta manipulada borre archivos de otro modelo.

La portada de Inicio se administra por separado en `/admin/portada`: sus imagenes y videos se suben directamente al bucket publico `site-media` de Supabase Storage, con escritura exclusiva para super administradores.

Para una base de datos ya existente, aplicar una sola vez la migracion incremental antes de desplegar el frontend:

```text
supabase/migrations/20260713_site_media.sql
supabase/migrations/20260713_model_profile_media.sql
supabase/migrations/20260714_gallery_r2_media.sql
```

La portada admite una imagen y un video opcional para escritorio, mas una imagen y un video opcional para celular. Si no hay video compatible se usa la imagen correspondiente; si tampoco existe una imagen configurada se usa `public/images/portada.png`.

En los perfiles de modelos, las imagenes deben pesar menos de 1 MiB y los videos menos de 10 MiB. Primero se guarda el modelo como borrador para obtener su identificador; luego se habilita la carga de medios. No se puede publicar sin portada de escritorio, foto publica de perfil y celular/WhatsApp.

Los permisos territoriales se asignan desde `/admin/usuarios` a cuentas con rol `admin`. Cada asignacion puede cubrir un pais completo o una provincia especifica.

## Build para GitHub Pages

El proyecto esta configurado para generar la version estatica en `docs/`, porque el despliegue elegido es manual desde GitHub Pages usando `main /docs`.

Generar build:

```bash
pnpm build
```

Validar localmente el build:

```bash
pnpm preview
```

Archivos esperados despues del build:

```text
docs/index.html
docs/404.html
docs/assets/
docs/CNAME
docs/.nojekyll
```

`docs/404.html` es una copia de `index.html` para que GitHub Pages permita URLs limpias como `/isabella` o `/modelos` sin usar `/#/`.

## Publicacion manual en GitHub Pages

1. Crear un repositorio nuevo en GitHub desde la interfaz web.
2. Agregar el remoto localmente:

```bash
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

3. En GitHub, ir a `Settings > Pages`.
4. En `Build and deployment`, elegir `Deploy from a branch`.
5. Seleccionar:

```text
Branch: main
Folder: /docs
```

6. Guardar y esperar a que GitHub Pages publique el sitio.

## Dominio con Cloudflare

El dominio configurado actualmente es:

```text
www.dominio.com
```

Si el dominio real sera distinto, actualizar `public/CNAME` y volver a ejecutar:

```bash
pnpm build
```

En Cloudflare, crear un registro DNS:

```text
Type: CNAME
Name: www
Target: USUARIO.github.io
Proxy status: DNS only
```

No usar registros wildcard como `*.dominio.com`.

Despues, en GitHub Pages:

1. Agregar `www.dominio.com` como custom domain.
2. Esperar validacion DNS.
3. Activar `Enforce HTTPS` cuando este disponible.

## Contenido

Las imagenes reales viven en:

```text
public/images/models/
```

Los datos locales viven en:

```text
src/data/models.json
src/data/galleries.json
src/data/categories.json
```

Los componentes no importan JSON directamente; acceden mediante servicios en `src/services/`. Esos servicios consultan Supabase primero y usan los JSON locales como respaldo cuando faltan credenciales, tablas o datos.
