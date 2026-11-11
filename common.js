/* =====================================================================
   common.js — capa de datos (Supabase o demo local), utilidades y gráficos
   Usado por index.html, pantalla.html y admin.html
   ===================================================================== */
(function () {
  'use strict';
  const C = window.EVENT_CONFIG || {};
  const EID = C.EVENT_ID || 'evento-2026';
  const DEMO = !C.SUPABASE_URL || !C.SUPABASE_ANON_KEY;

  if (C.ACCENT) document.documentElement.style.setProperty('--accent', C.ACCENT);

  /* ---------------- utilidades ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));
  const ls = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const fmt = {
    time(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); },
    date(iso) { if (!iso) return ''; return new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); },
    dateShort(iso) { if (!iso) return ''; return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); },
    rel(iso) {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 45) return 'hace un momento';
      if (s < 3600) return `hace ${Math.round(s / 60)} min`;
      if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
      return fmt.dateShort(iso);
    },
    pct(n) { return `${Math.round(n)}%`; }
  };

  function toast(msg, kind = 'ok') {
    let host = $('#toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
  }

  function errMsg(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/fetch|network/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
    if (/row-level security|violates/i.test(m)) return 'No tienes permiso para esta acción o la pregunta ya está cerrada.';
    if (/Anonymous sign-ins are disabled/i.test(m)) return 'El acceso anónimo está desactivado en Supabase (Authentication → Providers → Anonymous).';
    if (/rate limit/i.test(m)) return 'Demasiados accesos desde esta red. Espera un momento e intenta de nuevo.';
    return m;
  }

  /* =====================================================================
     Backend Supabase
     ===================================================================== */
  function supabaseBackend(storageKey) {
    const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: storageKey || ('ev-auth-' + EID) },
      realtime: { params: { eventsPerSecond: 10 } }
    });
    const scope = (table, q) => q.eq(table === 'ev_event' ? 'id' : 'event_id', EID);
    const ok = ({ data, error }) => { if (error) throw error; return data; };

    return {
      mode: 'supabase', client: sb,
      async uid() { const { data } = await sb.auth.getSession(); return data.session?.user?.id || null; },
      async ensureAnon() {
        const id = await this.uid(); if (id) return id;
        const { data, error } = await sb.auth.signInAnonymously(); if (error) throw error; return data.user.id;
      },
      async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); return this.uid(); },
      async signOut() { await sb.auth.signOut(); },
      async currentEmail() { const { data } = await sb.auth.getSession(); return data.session?.user?.email || null; },
      async claimAdmin(pin) {
        await this.ensureAnon();
        return !!ok(await sb.rpc('ev_claim_admin', { p_pin: pin }));
      },
      async isAdmin() {
        const id = await this.uid(); if (!id) return false;
        const { data } = await sb.from('ev_admins').select('user_id').eq('user_id', id).maybeSingle();
        return !!data;
      },
      async select(table, o = {}) {
        const build = () => {
          let q = sb.from(table).select(o.cols || '*');
          if (o.scoped !== false) q = scope(table, q);
          for (const [k, v] of Object.entries(o.eq || {})) q = v === null ? q.is(k, null) : q.eq(k, v);
          if (o.in) q = q.in(o.in[0], o.in[1]);
          if (o.order) q = q.order(o.order[0], { ascending: o.order[1] !== 'desc' });
          return q;
        };
        if (o.in && !o.in[1].length) return [];
        if (o.limit) return ok(await build().limit(o.limit)) || [];
        // paginar: Supabase devuelve máx. 1000 filas por consulta
        const out = []; const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const rows = ok(await build().range(from, from + PAGE - 1)) || [];
          out.push(...rows);
          if (rows.length < PAGE) break;
        }
        return out;
      },
      async one(table, eq) { const r = await this.select(table, { eq, limit: 1 }); return r[0] || null; },
      async insert(table, row) { return ok(await sb.from(table).insert(row).select().single()); },
      async insertMany(table, rows) { return ok(await sb.from(table).insert(rows).select()); },
      async insertQuiet(table, row) { const { error } = await sb.from(table).insert(row); if (error) throw error; },
      async upsert(table, row, onConflict) { return ok(await sb.from(table).upsert(row, { onConflict }).select().single()); },
      async update(table, match, patch) {
        let q = sb.from(table).update(patch);
        for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
        ok(await q);
      },
      async remove(table, match) {
        let q = sb.from(table).delete();
        for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
        ok(await q);
      },
      async upload(blob, path) {
        const { error } = await sb.storage.from('ev-photos').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
        if (error) throw error;
        return sb.storage.from('ev-photos').getPublicUrl(path).data.publicUrl;
      },
      async removeFile(path) { await sb.storage.from('ev-photos').remove([path]); },
      async participantCount() { return ok(await sb.rpc('ev_participant_count', { eid: EID })) || 0; },
      subscribe(tables, cb) {
        const ch = sb.channel('ev-' + Math.random().toString(36).slice(2));
        tables.forEach((t) => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) => cb(t, p)));
        let status = 'connecting';
        ch.subscribe((s) => { status = s; EV.emitStatus(s === 'SUBSCRIBED' ? 'live' : 'retry'); });
        // red de seguridad: refresco periódico por si se pierde el websocket
        const iv = setInterval(() => tables.forEach((t) => cb(t, null)), status === 'SUBSCRIBED' ? 30000 : 15000);
        return () => { clearInterval(iv); sb.removeChannel(ch); };
      }
    };
  }

  /* =====================================================================
     Backend DEMO (localStorage; se sincroniza entre pestañas del mismo navegador)
     ===================================================================== */
  function demoBackend() {
    const K = (t) => `evdemo:${EID}:${t}`;
    const listeners = new Set();
    const read = (t) => ls.get(K(t), []);
    const write = (t, rows) => {
      if (!ls.set(K(t), rows)) throw new Error('El almacenamiento del navegador está lleno (modo demo). Borra algunas fotos.');
      listeners.forEach((fn) => fn(t));
    };
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(`evdemo:${EID}:`)) { const t = e.key.split(':').pop(); listeners.forEach((fn) => fn(t)); }
    });
    const match = (r, eq) => Object.entries(eq || {}).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));
    const now = () => new Date().toISOString();
    let uidv = ls.get('evdemo-uid');
    if (!uidv) { uidv = uuid(); ls.set('evdemo-uid', uidv); }

    function afterWrite(table, row) {
      if (table === 'ev_sq_votes') {
        const all = read('ev_sq_votes');
        const qs = read('ev_speaker_q').map((q) => ({ ...q, votes: all.filter((v) => v.question_id === q.id).length }));
        write('ev_speaker_q', qs);
      }
    }
    function beforeInsert(table, row) {
      const base = { id: uuid(), created_at: now(), ...row };
      if (table !== 'ev_event' && !base.event_id) base.event_id = EID;
      if (table === 'ev_speaker_q') {
        const ev = read('ev_event')[0] || {};
        base.votes = 0;
        if (!row.status) base.status = ev.moderate_questions ? 'pending' : 'approved';
      }
      if (table === 'ev_answers') {
        const q = read('ev_questions').find((x) => x.id === row.question_id);
        if (!q || !q.is_open) throw new Error('row-level security: pregunta cerrada');
      }
      if (table === 'ev_sq_votes') delete base.id;
      if (table === 'ev_questions') base.options = base.options || [];
      return base;
    }

    const api = {
      mode: 'demo',
      async uid() { return uidv; },
      async ensureAnon() { return uidv; },
      async signIn() { return uidv; },
      async signOut() {},
      async currentEmail() { return 'demo@local'; },
      async claimAdmin() { return true; },
      async isAdmin() { return true; },
      async select(table, o = {}) {
        let rows = read(table);
        if (o.eq) rows = rows.filter((r) => match(r, o.eq));
        if (o.in) rows = rows.filter((r) => o.in[1].includes(r[o.in[0]]));
        if (o.order) {
          const [c, d] = o.order;
          rows = rows.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1));
        }
        if (o.limit) rows = rows.slice(0, o.limit);
        return JSON.parse(JSON.stringify(rows));
      },
      async one(table, eq) { return (await this.select(table, { eq, limit: 1 }))[0] || null; },
      async insert(table, row) {
        const r = beforeInsert(table, row);
        const rows = read(table);
        if (table === 'ev_sq_votes' && rows.some((x) => x.question_id === r.question_id && x.participant_id === r.participant_id)) throw new Error('duplicate');
        rows.push(r); write(table, rows); afterWrite(table, r); return r;
      },
      async insertMany(table, list) { const out = []; for (const r of list) out.push(await this.insert(table, r)); return out; },
      async insertQuiet(table, row) {
        if (table === 'ev_activity') { const rows = read(table); rows.push({ id: Date.now() + Math.random(), created_at: now(), ...row }); write(table, rows.slice(-2000)); return; }
        await this.insert(table, row);
      },
      async upsert(table, row, onConflict) {
        const cols = (onConflict || 'id').split(',').map((s) => s.trim());
        const rows = read(table);
        const i = rows.findIndex((r) => cols.every((c) => r[c] === row[c]));
        if (i >= 0) {
          if (table === 'ev_answers') beforeInsert(table, row);
          rows[i] = { ...rows[i], ...row }; write(table, rows); afterWrite(table, rows[i]); return rows[i];
        }
        return this.insert(table, row);
      },
      async update(table, eq, patch) {
        const rows = read(table).map((r) => (match(r, eq) ? { ...r, ...patch } : r));
        write(table, rows);
      },
      async remove(table, eq) {
        write(table, read(table).filter((r) => !match(r, eq)));
        afterWrite(table, null);
        if (table === 'ev_questions') write('ev_answers', read('ev_answers').filter((a) => read('ev_questions').some((q) => q.id === a.question_id)));
      },
      async upload(blob) {
        return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
      },
      async removeFile() {},
      async participantCount() { return read('ev_participants').length; },
      subscribe(tables, cb) {
        const fn = (t) => { if (tables.includes(t)) cb(t, null); };
        listeners.add(fn);
        setTimeout(() => EV.emitStatus('demo'), 50);
        return () => listeners.delete(fn);
      },
      seedIfEmpty() {
        if (read('ev_event').length) return;
        const S1 = uuid(), S2 = uuid(), S3 = uuid();
        const day = new Date(); day.setHours(9, 0, 0, 0);
        const at = (h, m = 0) => { const d = new Date(day); d.setHours(h, m); return d.toISOString(); };
        write('ev_event', [{
          id: EID, name: 'Foro de Innovación y Seguridad 2026', subtitle: 'Energía, operación y cultura preventiva',
          starts_at: at(9), ends_at: at(18), venue: 'Centro Citibanamex · Sala B',
          address: 'Av. del Conscripto 311, Lomas de Sotelo, Miguel Hidalgo, 11200 CDMX',
          maps_url: 'https://maps.google.com/?q=Centro+Citibanamex+CDMX',
          description: 'Un día de conferencias sobre seguridad operativa, innovación en campo y cultura preventiva. Participa respondiendo en vivo, enviando preguntas a los ponentes y compartiendo tus fotos.',
          wifi: 'Red: FORO-2026 · Clave: seguridad26', contact: 'Mesa de registro, planta baja',
          current_session_id: S1, survey_open: true, moderate_questions: false, screen_mode: 'auto', screen_question_id: null, updated_at: now()
        }]);
        write('ev_sessions', [
          { id: S1, event_id: EID, title: 'Cultura preventiva: del reporte a la acción', speaker: 'Ana Torres', speaker_role: 'Directora HSE LATAM', room: 'Sala B', starts_at: at(9, 30), ends_at: at(10, 30), sort: 1, created_at: now() },
          { id: S2, event_id: EID, title: 'Digitalización en campo: apps que sí se usan', speaker: 'Carlos Ruiz', speaker_role: 'Líder de TI', room: 'Sala B', starts_at: at(11), ends_at: at(12), sort: 2, created_at: now() },
          { id: S3, event_id: EID, title: 'Mantenimiento predictivo en parques eólicos', speaker: 'Laura Méndez', speaker_role: 'Gerente de Operaciones', room: 'Sala B', starts_at: at(13), ends_at: at(14), sort: 3, created_at: now() }
        ]);
        const Q = (o) => ({ id: uuid(), event_id: EID, scope: 'sesion', is_open: false, show_results: true, options: [], created_at: now(), ...o });
        const q1 = Q({ session_id: S1, text: '¿Qué tan seguido reportas un peligro en tu sitio?', qtype: 'opcion', options: ['Todos los días', 'Cada semana', 'Cada mes', 'Casi nunca'], is_open: true, sort: 1 });
        const q2 = Q({ session_id: S1, text: '¿Qué te impide reportar más? (elige todas las que apliquen)', qtype: 'multiple', options: ['Falta de tiempo', 'El formulario es largo', 'No veo seguimiento', 'Miedo a represalias', 'Nada, reporto todo'], is_open: true, sort: 2 });
        const q3 = Q({ session_id: S1, text: 'En una palabra: ¿qué significa para ti la seguridad?', qtype: 'nube', is_open: true, sort: 3 });
        const q4 = Q({ session_id: S2, text: '¿Qué tan fácil es usar las apps de campo actuales?', qtype: 'escala', options: ['1', '2', '3', '4', '5'], sort: 1 });
        const q5 = Q({ session_id: S3, text: '¿Tu equipo ya usa datos para planear mantenimiento?', qtype: 'opcion', options: ['Sí, de forma rutinaria', 'En pruebas piloto', 'Todavía no'], sort: 1 });
        const sv = [
          Q({ scope: 'encuesta', session_id: null, text: 'Calificación general del evento', qtype: 'escala', options: ['1', '2', '3', '4', '5'], is_open: true, sort: 1 }),
          Q({ scope: 'encuesta', session_id: null, text: 'Calidad de las conferencias', qtype: 'escala', options: ['1', '2', '3', '4', '5'], is_open: true, sort: 2 }),
          Q({ scope: 'encuesta', session_id: null, text: 'Organización y logística', qtype: 'escala', options: ['1', '2', '3', '4', '5'], is_open: true, sort: 3 }),
          Q({ scope: 'encuesta', session_id: null, text: '¿Recomendarías este evento a un colega?', qtype: 'opcion', options: ['Sí', 'Tal vez', 'No'], is_open: true, sort: 4 }),
          Q({ scope: 'encuesta', session_id: null, text: '¿Qué tema te gustaría ver en la próxima edición?', qtype: 'abierta', is_open: true, sort: 5 })
        ];
        write('ev_questions', [q1, q2, q3, q4, q5, ...sv]);
        // respuestas de ejemplo para que los gráficos no aparezcan vacíos
        const names = ['Ejemplo 1', 'Ejemplo 2', 'Ejemplo 3', 'Ejemplo 4', 'Ejemplo 5', 'Ejemplo 6', 'Ejemplo 7', 'Ejemplo 8', 'Ejemplo 9', 'Ejemplo 10', 'Ejemplo 11'];
        const pids = names.map(() => uuid());
        const ans = [];
        const pick1 = [0, 1, 1, 2, 1, 0, 3, 1, 2, 0, 1];
        const pickM = [[0, 1], [2], [0, 2], [1], [4], [0], [2, 3], [1, 2], [0], [2], [0, 1, 2]];
        const words = ['Prevención', 'Cuidado', 'Familia', 'Vida', 'Prevención', 'Responsabilidad', 'Equipo', 'Familia', 'Prevención', 'Respeto', 'Vida'];
        pids.forEach((pid, i) => {
          const b = { event_id: EID, participant_id: pid, participant_name: names[i], created_at: now() };
          ans.push({ id: uuid(), ...b, question_id: q1.id, value: { i: pick1[i] } });
          ans.push({ id: uuid(), ...b, question_id: q2.id, value: { is: pickM[i] } });
          ans.push({ id: uuid(), ...b, question_id: q3.id, value: { t: words[i] } });
        });
        write('ev_answers', ans);
        write('ev_participants', pids.map((id, i) => ({ id, event_id: EID, name: names[i], created_at: now(), last_seen: now() })));
        write('ev_speaker_q', [
          { id: uuid(), event_id: EID, session_id: S1, participant_id: pids[0], participant_name: 'Ejemplo 1', anonymous: false, text: '¿Cómo damos seguimiento visible a los reportes para que la gente vea que sí sirven?', status: 'approved', votes: 0, created_at: now() },
          { id: uuid(), event_id: EID, session_id: S1, participant_id: pids[1], participant_name: 'Ejemplo 2', anonymous: true, text: '¿Qué indicador recomiendas para medir cultura preventiva, más allá de los incidentes?', status: 'approved', votes: 0, created_at: now() }
        ]);
        write('ev_sq_votes', [0, 1, 2].map((i) => ({ question_id: read('ev_speaker_q')[0].id, participant_id: pids[i + 2], event_id: EID, created_at: now() })));
        afterWrite('ev_sq_votes');
        write('ev_photos', []);
        write('ev_activity', []);
      },
      resetDemo() {
        ['ev_event', 'ev_sessions', 'ev_questions', 'ev_answers', 'ev_speaker_q', 'ev_sq_votes', 'ev_photos', 'ev_participants', 'ev_activity'].forEach((t) => ls.del(K(t)));
        this.seedIfEmpty();
      }
    };
    return api;
  }

  /* =====================================================================
     Imagen: comprimir y orientar
     ===================================================================== */
  async function compressImage(file, maxSide, quality) {
    maxSide = maxSide || C.PHOTO_MAX_SIDE || 1600;
    quality = quality || C.PHOTO_QUALITY || 0.82;
    if (DEMO) { maxSide = Math.min(maxSide, 900); quality = Math.min(quality, 0.72); }
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      src = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('No se pudo leer la imagen')); img.src = URL.createObjectURL(file); });
    }
    const w = src.width, h = src.height;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.round(w * k), ch = Math.round(h * k);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(src, 0, 0, cw, ch);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('No se pudo procesar la imagen');
    return { blob, width: cw, height: ch };
  }

  /* =====================================================================
     Gráficos de resultados (HTML/CSS animado, sin librerías)
     value por tipo:
       opcion   → {i: índice}
       multiple → {is: [índices]}
       escala   → {n: 1..5}
       nube     → {t: "palabra"}
       abierta  → {t: "texto"}
     ===================================================================== */
  function tally(q, answers) {
    const list = answers.filter((a) => a.question_id === q.id);
    const n = list.length;
    if (q.qtype === 'opcion' || q.qtype === 'multiple') {
      const counts = q.options.map(() => 0);
      list.forEach((a) => {
        const v = a.value || {};
        const idx = q.qtype === 'opcion' ? [v.i] : (v.is || []);
        idx.forEach((i) => { if (counts[i] !== undefined) counts[i]++; });
      });
      return { n, counts };
    }
    if (q.qtype === 'escala') {
      const opts = q.options && q.options.length ? q.options : ['1', '2', '3', '4', '5'];
      const counts = opts.map(() => 0); let sum = 0;
      list.forEach((a) => { const v = +(a.value || {}).n; if (v >= 1 && v <= opts.length) { counts[v - 1]++; sum += v; } });
      return { n, counts, avg: n ? sum / n : 0, max: opts.length };
    }
    // nube / abierta
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    const map = new Map();
    list.forEach((a) => {
      const raw = String((a.value || {}).t || '').trim(); if (!raw) return;
      const key = norm(raw); if (!key) return;
      const e = map.get(key) || { text: raw.charAt(0).toUpperCase() + raw.slice(1), count: 0 };
      e.count++; map.set(key, e);
    });
    const words = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const texts = list.map((a) => ({ t: (a.value || {}).t, who: a.participant_name, at: a.created_at })).filter((x) => x.t);
    return { n, words, texts };
  }

  function renderResults(host, q, answers, opts = {}) {
    const r = tally(q, answers);
    const key = q.id + ':' + q.qtype + ':' + JSON.stringify(q.options);
    const fresh = host.dataset.key !== key;
    host.dataset.key = key;
    host.classList.add('results', 'rt-' + q.qtype);
    if (opts.big) host.classList.add('big');

    const countLine = `<div class="r-count"><span class="r-n">${r.n}</span> ${r.n === 1 ? 'respuesta' : 'respuestas'}</div>`;

    if (q.qtype === 'opcion' || q.qtype === 'multiple') {
      const max = Math.max(1, ...r.counts);
      if (fresh) {
        host.innerHTML = `<div class="bars">${q.options.map((o, i) => `
          <div class="bar-row" data-i="${i}">
            <div class="bar-label"><span class="bar-text">${esc(o)}</span><span class="bar-val"></span></div>
            <div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>
          </div>`).join('')}</div>${countLine}`;
      }
      const top = Math.max(...r.counts);
      $$('.bar-row', host).forEach((row, i) => {
        const c = r.counts[i] || 0;
        const p = r.n ? (c / r.n) * 100 : 0;
        row.classList.toggle('lead', c > 0 && c === top);
        row.classList.toggle('mine', opts.mine != null && (Array.isArray(opts.mine) ? opts.mine.includes(i) : opts.mine === i));
        $('.bar-val', row).textContent = `${fmt.pct(p)} · ${c}`;
        requestAnimationFrame(() => { $('.bar-fill', row).style.width = (c / max) * 100 + '%'; });
      });
      $('.r-n', host).textContent = r.n;
      return r;
    }

    if (q.qtype === 'escala') {
      const max = Math.max(1, ...r.counts);
      if (fresh) {
        host.innerHTML = `<div class="scale">
          <div class="scale-avg"><span class="avg-num">0.0</span><span class="avg-of">de ${r.max}</span><div class="avg-stars"></div></div>
          <div class="cols">${r.counts.map((_, i) => `
            <div class="col" data-i="${i}"><span class="col-val">0</span><div class="col-track"><div class="col-fill" style="height:0%"></div></div><span class="col-label">${i + 1}</span></div>`).join('')}
          </div></div>${countLine}`;
      }
      $('.avg-num', host).textContent = r.avg.toFixed(1);
      $('.avg-stars', host).innerHTML = starsSVG(r.avg, r.max);
      $$('.col', host).forEach((col, i) => {
        const c = r.counts[i];
        $('.col-val', col).textContent = c;
        col.classList.toggle('mine', opts.mine === i + 1);
        requestAnimationFrame(() => { $('.col-fill', col).style.height = (c / max) * 100 + '%'; });
      });
      $('.r-n', host).textContent = r.n;
      return r;
    }

    if (q.qtype === 'nube') {
      const words = r.words.slice(0, opts.big ? 40 : 30);
      const top = words[0] ? words[0].count : 1;
      const minS = opts.big ? 1.1 : 0.95, maxS = opts.big ? 4.2 : 2.4;
      // orden intercalado para que las grandes queden al centro
      const arranged = [];
      words.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));
      host.innerHTML = `<div class="cloud">${arranged.length ? arranged.map((w, i) => {
        const s = minS + (maxS - minS) * Math.sqrt(w.count / top);
        return `<span class="w w${i % 5}" style="font-size:${s.toFixed(2)}em" title="${w.count}">${esc(w.text)}</span>`;
      }).join('') : '<p class="muted">Las palabras aparecerán aquí conforme lleguen.</p>'}</div>${countLine}`;
      return r;
    }

    // abierta
    host.innerHTML = `<ul class="texts">${r.texts.slice().reverse().slice(0, opts.limit || 50).map((x) =>
      `<li><p>${esc(x.t)}</p>${opts.showNames ? `<span class="muted">${esc(x.who || '')}</span>` : ''}</li>`).join('') || '<li class="muted">Sin respuestas todavía.</li>'}</ul>${countLine}`;
    return r;
  }

  function starsSVG(v, max = 5) {
    let out = '';
    for (let i = 1; i <= max; i++) {
      const f = Math.max(0, Math.min(1, v - (i - 1)));
      const id = 'g' + Math.random().toString(36).slice(2, 8);
      out += `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><defs><linearGradient id="${id}"><stop offset="${f * 100}%" stop-color="var(--star)"/><stop offset="${f * 100}%" stop-color="var(--line)"/></linearGradient></defs><path fill="url(#${id})" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>`;
    }
    return `<span class="stars" aria-label="${v.toFixed(1)} de ${max}">${out}</span>`;
  }

  /* ---------------- QR ---------------- */
  function appUrl() {
    if (C.APP_URL) return C.APP_URL;
    const u = new URL(location.href);
    u.hash = ''; u.search = '';
    u.pathname = u.pathname.replace(/[^/]*$/, '') ;
    return u.href;
  }
  function qr(host, text, size = 200, dark = '#0d1b2a', light = '#ffffff') {
    host.innerHTML = '';
    if (!window.QRCode) { host.textContent = text; return null; }
    return new window.QRCode(host, { text, width: size, height: size, colorDark: dark, colorLight: light, correctLevel: window.QRCode.CorrectLevel.M });
  }

  /* ---------------- estado de conexión ---------------- */
  const statusFns = new Set();

  /* =====================================================================
     API pública
     ===================================================================== */
  const EV = {
    C, EID, DEMO, $, $$, esc, uuid, ls, debounce, fmt, toast, errMsg,
    compressImage, tally, renderResults, starsSVG, qr, appUrl,
    db: null,
    init(opts = {}) {
      if (DEMO) { this.db = demoBackend(); this.db.seedIfEmpty(); }
      else {
        if (!window.supabase) throw new Error('No cargó la librería de Supabase. Revisa tu conexión.');
        this.db = supabaseBackend(opts.storageKey);
      }
      return this.db;
    },
    onStatus(fn) { statusFns.add(fn); },
    emitStatus(s) { statusFns.forEach((f) => f(s)); },
    // participante
    me() { return ls.get('ev-me-' + EID); },
    setMe(v) { ls.set('ev-me-' + EID, v); },
    async log(action, detail) {
      const me = this.me(); if (!me || !this.db) return;
      try { await this.db.insertQuiet('ev_activity', { event_id: EID, participant_id: me.id, participant_name: me.name, action, detail: detail || null }); } catch {}
    },
    csv(rows, cols) {
      const q = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      return '﻿' + [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => q(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(','))].join('\n');
    },
    download(name, content, type = 'text/csv;charset=utf-8') {
      const blob = content instanceof Blob ? content : new Blob([content], { type });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };
  window.EV = EV;
})();
