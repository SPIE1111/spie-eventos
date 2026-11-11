# App de Evento Interactivo

PWA para eventos: los asistentes escanean un QR, entran con su nombre y participan en vivo. Misma arquitectura que las apps HSE/Hazard: **GitHub Pages (frontend) + Supabase (base de datos, tiempo real y fotos)**.

## Qué incluye

| Archivo | Para quién | Qué hace |
|---|---|---|
| `index.html` | Participantes (el QR lleva aquí) | Entrada con nombre · Inicio (info, ubicación con mapa, agenda) · Fotos (tomar/subir + galería) · En vivo (preguntas de la conferencia actual con gráficos en tiempo real) · Preguntas al ponente (con votos) · Encuesta de satisfacción |
| `pantalla.html` | Proyector / pantalla del salón | Resultados en vivo, preguntas al ponente más votadas, galería en carrusel y QR |
| `admin.html` | Moderador | Cambiar conferencia en curso, abrir/cerrar votaciones, fijar qué se ve en pantalla, moderar preguntas y fotos, editar evento/sesiones/preguntas, encuesta, registro de participantes y actividad (CSV), generar QR |
| `supabase/schema.sql` | Una sola vez | Tablas, seguridad (RLS), tiempo real y bucket de fotos |
| `supabase/seed.sql` | Opcional | Evento, conferencias y preguntas de ejemplo |
| `config.js` | Una sola vez | URL y llave de Supabase, ID del evento, color |

Tipos de pregunta y su gráfico: **opción única** y **opción múltiple** → barras · **escala 1–5** → promedio con estrellas y columnas · **nube de palabras** · **respuesta abierta** → lista.

## Probar ya (modo demo)

Con `SUPABASE_URL` vacío en `config.js`, todo funciona con datos locales del navegador.

1. En la carpeta, ejecuta `python -m http.server 8000` (o abre con Live Server de VS Code).
2. Abre `http://localhost:8000/index.html`, `pantalla.html` y `admin.html` en pestañas distintas del **mismo navegador**.
3. Responde en la app y mira cómo cambian la pantalla y el panel.

## Puesta en marcha real

### 1. Supabase
1. Crea un proyecto (o usa uno existente; las tablas llevan prefijo `ev_` y no chocan con Hazard).
2. **SQL Editor** → pega y ejecuta `supabase/schema.sql`. Luego, si quieres los ejemplos, `supabase/seed.sql`.
3. **Authentication → Sign In / Providers → Anonymous Sign-Ins → Enable.** Así cada asistente obtiene una sesión sin cuenta ni contraseña.
4. **Authentication → Rate Limits → "Anonymous users"**: súbelo (por ejemplo a 1000/hora). El valor por defecto (30/hora por IP) se agota si todos entran desde el Wi-Fi del recinto.
5. Moderador: **Authentication → Users → Add user** (correo + contraseña, *Auto confirm*). Después ejecuta el bloque comentado al final de `seed.sql` con ese correo.

### 2. `config.js`
```js
SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',          // Project Settings → API → anon public
EVENT_ID: 'evento-2026',              // = id en ev_event
APP_URL: 'https://TU-USUARIO.github.io/evento/',   // URL fija para el QR
```

### 3. GitHub Pages
Sube toda la carpeta a un repositorio (o a una subcarpeta `evento/` del repo que ya usas), y activa **Settings → Pages**. Con eso:
- App: `https://…/evento/`
- Pantalla: `https://…/evento/pantalla.html`
- Panel: `https://…/evento/admin.html`

### 4. QR
`admin.html` → **Código QR** → *Descargar PNG*. Sale en alta resolución con margen blanco, listo para imprimir. El QR también aparece en la pantalla pública.

## Durante el evento
- En **Control en vivo** elige la conferencia en curso: todos los teléfonos cambian solos.
- **Abrir votación** en cada pregunta cuando el ponente la mencione; **Cerrar** cuando termine. Los resultados quedan visibles.
- **Fijar en pantalla** muestra una pregunta concreta; si no fijas ninguna, la pantalla rota entre las abiertas cada 15 s.
- Modos de pantalla: Automático, Solo resultados, Preguntas al ponente, Galería. En la PC de la pantalla también sirven las teclas `1`–`4` y `f` (pantalla completa).
- **Revisar antes de publicar** (Preguntas al ponente) hace que las preguntas nuevas esperen tu aprobación.
- Al final, activa **Encuesta abierta**: aparece un punto rojo en la pestaña Encuesta de cada asistente.

## Registro de actividad
Cada acción queda en `ev_activity` con el nombre del participante: registro, secciones abiertas, respuestas, preguntas, votos, fotos, cambios de nombre. Se exporta desde **Participantes** (CSV que abre en Excel con acentos correctos).

## Seguridad (resumen)
- Los asistentes solo pueden escribir **sus propias** respuestas, preguntas, votos y fotos (`auth.uid()`).
- Solo se responde una pregunta **abierta**; la base lo valida, no solo la pantalla.
- Respuestas de encuesta: visibles solo para su autor y moderadores. Respuestas de conferencia: públicas para poder graficarlas.
- La pantalla solo lee; el total de participantes sale de una función que no expone nombres.
- La llave `anon` de Supabase es pública por diseño; la protección está en las políticas RLS.

## Ajustes rápidos
- Color: `ACCENT` en `config.js`. Logo: coloca `logo.png` y pon `LOGO: 'logo.png'`.
- Tamaño de fotos: `PHOTO_MAX_SIDE` / `PHOTO_QUALITY`.
- Otro evento: nuevo `EVENT_ID` + fila en `ev_event` (desde el panel se crea solo al entrar).
