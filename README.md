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

## Supabase y R2

1. Copiar `.env.example` a `.env`.
2. Completar:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_R2_PUBLIC_URL=https://media.example.com
```

3. En Supabase, abrir `SQL Editor` y ejecutar `supabase/schema.sql`.
4. Subir las imagenes a R2 manteniendo las mismas rutas, por ejemplo:

```text
images/models/isabella/cover.jpg
images/models/isabella/profile.jpg
images/models/isabella/gallery-01.jpg
```

Si `VITE_R2_PUBLIC_URL` queda vacio, las imagenes se cargan desde `public/images/`. Si se configura, cualquier ruta relativa de las tablas o JSON se resuelve contra R2.

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
