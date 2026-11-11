// =====================================================================
//  Configuración de la app del evento
//  Deja SUPABASE_URL vacío para usar el MODO DEMO (datos locales en el navegador).
// =====================================================================
window.EVENT_CONFIG = {
  SUPABASE_URL: '',            // ej. 'https://abcdxyz.supabase.co'
  SUPABASE_ANON_KEY: '',       // Project Settings → API → anon public
  EVENT_ID: 'evento-2026',     // debe coincidir con ev_event.id

  // URL pública de la app (la que lleva el QR). Si se deja vacía se usa la URL actual.
  APP_URL: 'https://spie-eventos.github.io/',

  // Apariencia
  ACCENT: '#00a19a',           // color principal de botones y gráficos
  LOGO: '',                    // ej. 'logo.png' (opcional, en la misma carpeta)

  // Fotos
  PHOTO_MAX_SIDE: 1600,        // px del lado mayor tras compresión
  PHOTO_QUALITY: 0.82
};
