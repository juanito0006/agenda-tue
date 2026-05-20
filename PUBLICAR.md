# Publicar Agenda

Esta app puede publicarse como web pública y también instalarse en móvil/escritorio como PWA.

## Login y sincronización

La app ya está preparada para login con Supabase. Así podrás abrirla en móvil y ordenador con la misma cuenta y tener la misma agenda sincronizada.

### Crear Supabase

1. Crea una cuenta en https://supabase.com.
2. Crea un proyecto nuevo.
3. En Supabase, ve a `SQL Editor`.
4. Copia y ejecuta el contenido de `supabase.sql`.
5. Ve a `Project Settings` -> `API`.
6. Copia:
   - `Project URL`
   - `anon public key`

### Variables locales

1. Copia `.env.example` como `.env`.
2. Rellena:

```text
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

3. Reinicia la app.

### Variables en Vercel o Netlify

Cuando publiques, añade esas mismas variables en la configuración del proyecto:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

En Supabase, revisa también `Authentication` -> `URL Configuration` y añade el dominio publicado, por ejemplo:

```text
https://agenda-tue.vercel.app
```

## Opción recomendada: Vercel

1. Crea una cuenta en https://vercel.com.
2. Sube este proyecto a GitHub.
3. En Vercel pulsa `Add New Project`.
4. Importa el repositorio de GitHub.
5. Vercel detectará Vite automáticamente:
   - Build command: `npm run build`
   - Output directory: `dist`
6. Pulsa `Deploy`.

Al terminar tendrás un link tipo:

```text
https://agenda-tue.vercel.app
```

Ese link se abre desde cualquier Wi-Fi, ordenador o móvil.

## Opción alternativa: Netlify

1. Crea una cuenta en https://netlify.com.
2. Sube este proyecto a GitHub.
3. En Netlify pulsa `Add new site`.
4. Importa el repositorio.
5. Usa:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Publica la web.

## Instalar como app

Cuando la app esté publicada con `https`:

- En móvil: abre el link en Chrome/Safari y pulsa `Añadir a pantalla de inicio`.
- En ordenador: abre el link en Chrome/Edge y pulsa el icono de instalar app en la barra de dirección.

## Datos

Si inicias sesión, la agenda se guarda en Supabase y se sincroniza entre móvil y ordenador.

Si no inicias sesión o no configuras Supabase, la app sigue funcionando en modo local con `localStorage`.
