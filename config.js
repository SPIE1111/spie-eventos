// =====================================================================
//  Configuración de la app del evento
//  Deja SUPABASE_URL vacío para usar el MODO DEMO (datos locales en el navegador).
// =====================================================================
window.EVENT_CONFIG = {
  SUPABASE_URL: 'https://hjaucllogdwzeqxxpvpo.supabase.co',            // ej. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYXVjbGxvZ2R3emVxeHhwdnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0MDc4MzksImV4cCI6MjEwOTk4MzgzOX0.aeVc3PQ3eMLw3xDEIqhofthAS0hVoeaAKFmrTZkSc2M',       // Project Settings → API → anon public
  EVENT_ID: 'evento-2026',     // debe coincidir con ev_event.id

  // URL pública de la app (la que lleva el QR). Si se deja vacía se usa la URL actual.
  APP_URL: 'https://spie1111.github.io/spie-eventos/',

  // Apariencia
  ACCENT: '#00a19a',           // color principal de botones y gráficos
  LOGO: '',                    // ej. 'logo.png' (opcional, en la misma carpeta)

  // Fotos
  PHOTO_MAX_SIDE: 1600,        // px del lado mayor tras compresión
  PHOTO_QUALITY: 0.82
};
