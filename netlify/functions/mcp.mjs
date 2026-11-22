// Serveur MCP (Streamable HTTP, sans état) qui donne à Claude un accès à ton compte intervals.icu.
// Déploiement : Netlify Functions v2. Aucune dépendance.
//
// Variables d'environnement (Netlify > Site configuration > Environment variables) :
//   INTERVALS_API_KEY     clé API intervals.icu (Settings > Developer Settings)
//   MCP_TOKEN             jeton secret d'au moins 24 caractères : il fait partie de l'adresse du connecteur
//   INTERVALS_ATHLETE_ID  optionnel, "0" par défaut (= le propriétaire de la clé)
//   ALLOW_WRITE           optionnel : "true" active la création/suppression de séances (désactivé par défaut)

const SERVER = { name: 'intervals-coach', version: '1.0.0' };
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const BASE = 'https://intervals.icu/api/v1';
const env = (k) => process.env[k] || '';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// ---------- Sécurité : l'adresse contient un jeton secret (ou en-tête Authorization: Bearer <jeton>) ----------
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function authorized(req, url) {
  const t = env('MCP_TOKEN');
  if (t.length < 24) return false; // refuse de fonctionner sans jeton long
  const parts = url.pathname.split('/').filter(Boolean);
  const fromPath = parts[0] === 'mcp' ? parts[1] || '' : '';
  const auth = req.headers.get('authorization') || '';
  const fromHeader = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return safeEqual(fromPath, t) || safeEqual(fromHeader, t);
}

// ---------- Appels intervals.icu ----------
const AID = () => encodeURIComponent(env('INTERVALS_ATHLETE_ID') || '0');
async function icu(path, { method = 'GET', body } = {}) {
  const key = env('INTERVALS_API_KEY');
  if (!key) throw new Error('INTERVALS_API_KEY n’est pas définie sur le serveur');
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: 'Basic ' + Buffer.from('API_KEY:' + key).toString('base64'), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`intervals.icu a répondu HTTP ${r.status}${txt ? ' : ' + txt.slice(0, 200) : ''}`);
  return txt ? JSON.parse(txt) : null;
}
function range(a) {
  if (!DATE.test(a.oldest || '') || !DATE.test(a.newest || '')) throw new Error('oldest et newest doivent être au format AAAA-MM-JJ');
  const d = (Date.parse(a.newest) - Date.parse(a.oldest)) / 864e5;
  if (!(d >= 0) || d > 400) throw new Error('période invalide (400 jours au maximum)');
  return [a.oldest, a.newest];
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));
const clip = (s, n) => (typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : s);
const mins = (s) => (s ? Math.round(s / 60) : null);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
function activityId(a) {
  if (!ID.test(a.activity_id || '')) throw new Error('activity_id invalide');
  return a.activity_id;
}
function downsample(arr, max) {
  if (!Array.isArray(arr) || arr.length <= max) return arr;
  const step = arr.length / max, out = [];
  for (let i = 0; i < max; i++) {
    const s = Math.floor(i * step), e = Math.max(s + 1, Math.floor((i + 1) * step));
    const blk = arr.slice(s, e).filter((v) => typeof v === 'number');
    out.push(blk.length ? +(blk.reduce((x, y) => x + y, 0) / blk.length).toFixed(2) : null);
  }
  return out;
}
const writeOn = () => env('ALLOW_WRITE') === 'true';

// ---------- Outils ----------
const READ = { readOnlyHint: true, openWorldHint: true };
const TOOLS = [
  {
    name: 'get_activities',
    description: 'Liste les séances réalisées (course, vélo, natation…) entre deux dates : durée, distance, FC, puissance, charge, RPE, forme ressentie.',
    annotations: READ,
    inputSchema: { type: 'object', properties: { oldest: { type: 'string', description: 'Date de début AAAA-MM-JJ' }, newest: { type: 'string', description: 'Date de fin AAAA-MM-JJ' }, limit: { type: 'integer', description: '300 au maximum' } }, required: ['oldest', 'newest'] },
    run: async (a) => {
      const [o, n] = range(a);
      const list = (await icu(`/athlete/${AID()}/activities?oldest=${o}&newest=${n}`)) || [];
      return list.sort((x, y) => String(x.start_date_local).localeCompare(String(y.start_date_local))).slice(0, Math.min(+a.limit || 200, 300)).map((x) => ({
        id: x.id, date: String(x.start_date_local || '').slice(0, 16), type: x.type, name: x.name, minutes: mins(x.moving_time),
        km: x.distance ? +(x.distance / 1000).toFixed(2) : null, avg_hr: x.average_heartrate, avg_watts: x.icu_average_watts ?? x.average_watts,
        norm_watts: x.icu_weighted_avg_watts, load: x.icu_training_load, intensity: x.icu_intensity, rpe: x.icu_rpe ?? x.perceived_exertion,
        feel: x.feel, decoupling: x.decoupling, description: clip(x.description, 300),
      }));
    },
  },
  {
    name: 'get_activity',
    description: 'Détail d’une séance réalisée : résumé, blocs/intervalles et tours (durée, puissance, allure, FC, cadence).',
    annotations: READ,
    inputSchema: { type: 'object', properties: { activity_id: { type: 'string', description: 'Identifiant renvoyé par get_activities (ex. i123456789)' } }, required: ['activity_id'] },
    run: async (a) => {
      const x = await icu(`/activity/${activityId(a)}?intervals=true`);
      const iv = (l) => (l || []).slice(0, 120).map((v) => pick(v, ['type', 'label', 'start_index', 'end_index', 'moving_time', 'distance', 'average_watts', 'average_heartrate', 'max_heartrate', 'average_cadence', 'average_speed']));
      return {
        ...pick(x, ['id', 'name', 'type', 'start_date_local', 'moving_time', 'elapsed_time', 'distance', 'average_heartrate', 'max_heartrate', 'icu_average_watts', 'icu_weighted_avg_watts', 'icu_training_load', 'icu_intensity', 'icu_efficiency_factor', 'decoupling', 'icu_rpe', 'perceived_exertion', 'feel', 'average_cadence', 'total_elevation_gain', 'icu_zone_times', 'icu_hr_zone_times', 'device_name']),
        description: clip(x.description, 1500), intervals: iv(x.icu_intervals), laps: iv(x.laps),
      };
    },
  },
  {
    name: 'get_activity_streams',
    description: 'Courbes d’une séance (temps, puissance, FC, cadence, vitesse…), ré-échantillonnées pour rester courtes.',
    annotations: READ,
    inputSchema: { type: 'object', properties: { activity_id: { type: 'string' }, types: { type: 'array', items: { type: 'string', enum: ['time', 'watts', 'heartrate', 'cadence', 'velocity_smooth', 'distance', 'altitude', 'temp'] }, description: 'Défaut : time, watts, heartrate, cadence, velocity_smooth' }, max_points: { type: 'integer', description: '300 par défaut, 1000 au maximum' } }, required: ['activity_id'] },
    run: async (a) => {
      const allowed = ['time', 'watts', 'heartrate', 'cadence', 'velocity_smooth', 'distance', 'altitude', 'temp'];
      const types = (Array.isArray(a.types) && a.types.length ? a.types : ['time', 'watts', 'heartrate', 'cadence', 'velocity_smooth']).filter((t) => allowed.includes(t));
      if (!types.length) throw new Error('types invalides');
      const max = Math.min(+a.max_points || 300, 1000);
      const s = await icu(`/activity/${activityId(a)}/streams.json?types=${types.join(',')}`);
      const out = { points: 0, streams: {} };
      const list = Array.isArray(s) ? s : Object.entries(s || {}).map(([type, data]) => ({ type, data }));
      for (const it of list) if (it && Array.isArray(it.data)) { out.streams[it.type] = downsample(it.data, max); out.points = Math.max(out.points, out.streams[it.type].length); out.original_length = Math.max(out.original_length || 0, it.data.length); }
      return out;
    },
  },
  {
    name: 'get_wellness',
    description: 'Récupération et condition physique par jour : fitness (ctl), fatigue (atl), rampe, sommeil, FC de repos, VFC, poids, courbatures, humeur.',
    annotations: READ,
    inputSchema: { type: 'object', properties: { oldest: { type: 'string' }, newest: { type: 'string' } }, required: ['oldest', 'newest'] },
    run: async (a) => {
      const [o, n] = range(a);
      const list = (await icu(`/athlete/${AID()}/wellness?oldest=${o}&newest=${n}`)) || [];
      return list.map((w) => ({ ...pick(w, ['id', 'ctl', 'atl', 'rampRate', 'sleepScore', 'restingHR', 'hrv', 'weight', 'soreness', 'fatigue', 'stress', 'mood', 'motivation', 'readiness', 'steps', 'vo2max']), sleep_h: w.sleepSecs ? +(w.sleepSecs / 3600).toFixed(2) : undefined }));
    },
  },
  {
    name: 'get_events',
    description: 'Calendrier : séances planifiées, courses, notes (avec le texte des séances).',
    annotations: READ,
    inputSchema: { type: 'object', properties: { oldest: { type: 'string' }, newest: { type: 'string' }, category: { type: 'string', enum: ['WORKOUT', 'RACE_A', 'RACE_B', 'RACE_C', 'NOTE', 'TARGET'], description: 'Optionnel' } }, required: ['oldest', 'newest'] },
    run: async (a) => {
      const [o, n] = range(a);
      const cat = a.category && /^[A-Z_]{3,10}$/.test(a.category) ? `&category=${a.category}` : '';
      const list = (await icu(`/athlete/${AID()}/events?oldest=${o}&newest=${n}${cat}`)) || [];
      return list.sort((x, y) => String(x.start_date_local).localeCompare(String(y.start_date_local))).slice(0, 400).map((e) => ({
        id: e.id, date: String(e.start_date_local || '').slice(0, 10), category: e.category, type: e.type, name: e.name,
        minutes: mins(e.moving_time), load: e.icu_training_load, external_id: e.external_id, description: clip(e.description, 3000),
      }));
    },
  },
  {
    name: 'get_athlete_settings',
    description: 'Seuils et réglages de l’athlète par sport (FTP, FC au seuil, allure seuil, zones). Sans nom ni e-mail.',
    annotations: READ,
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const a = await icu(`/athlete/${AID()}`);
      return { weight: a.icu_weight ?? a.weight, sportSettings: (a.sportSettings || []).map((s) => pick(s, ['types', 'ftp', 'indoor_ftp', 'lthr', 'max_hr', 'threshold_pace', 'pace_units', 'hr_zones', 'power_zones', 'pace_zones'])) };
    },
  },
];
if (true) {
  const TYPES = ['Run', 'Ride', 'Swim', 'WeightTraining', 'Workout'];
  TOOLS.push(
    {
      name: 'create_workouts',
      description: 'ÉCRITURE (si activée sur le serveur) : crée ou met à jour des séances planifiées dans le calendrier. La description suit la syntaxe de l’éditeur de séances d’intervals.icu. Un external_id stable permet de mettre à jour au lieu de dupliquer.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: { events: { type: 'array', maxItems: 50, items: { type: 'object', properties: { date: { type: 'string', description: 'AAAA-MM-JJ' }, time: { type: 'string', description: 'HH:MM (optionnel)' }, type: { type: 'string', enum: TYPES }, name: { type: 'string' }, description: { type: 'string' }, external_id: { type: 'string' } }, required: ['date', 'type', 'name'] } } }, required: ['events'] },
      run: async (a) => {
        if (!writeOn()) throw new Error('L’écriture est désactivée sur ce serveur (ALLOW_WRITE).');
        const ev = a.events;
        if (!Array.isArray(ev) || !ev.length || ev.length > 50) throw new Error('events : 1 à 50 séances');
        const body = ev.map((e) => {
          if (!DATE.test(e.date || '') || !TYPES.includes(e.type) || !e.name || String(e.name).length > 120) throw new Error('séance invalide : date, type et name sont obligatoires');
          if (e.time && !/^\d{2}:\d{2}$/.test(e.time)) throw new Error('time doit être HH:MM');
          if (e.external_id && !/^[\w.@:-]{1,100}$/.test(e.external_id)) throw new Error('external_id invalide');
          return { category: 'WORKOUT', start_date_local: `${e.date}T${e.time || '00:00'}:00`, type: e.type, name: String(e.name), description: clip(String(e.description || ''), 8000), ...(e.external_id ? { external_id: e.external_id } : {}) };
        });
        const res = await icu(`/athlete/${AID()}/events/bulk?upsert=true`, { method: 'POST', body });
        return { envoyees: body.length, retour: Array.isArray(res) ? res.map((r) => pick(r, ['id', 'start_date_local', 'name', 'external_id'])) : res };
      },
    },
    {
      name: 'delete_workouts',
      description: 'ÉCRITURE (si activée) : supprime des séances planifiées identifiées par leur external_id. Ne supprime jamais une séance sans external_id.',
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: 'object', properties: { external_ids: { type: 'array', maxItems: 50, items: { type: 'string' } } }, required: ['external_ids'] },
      run: async (a) => {
        if (!writeOn()) throw new Error('L’écriture est désactivée sur ce serveur (ALLOW_WRITE).');
        const ids = a.external_ids;
        if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some((i) => !/^[\w.@:-]{1,100}$/.test(i))) throw new Error('external_ids : 1 à 50 identifiants valides');
        const res = await icu(`/athlete/${AID()}/events/bulk-delete`, { method: 'PUT', body: ids.map((external_id) => ({ external_id })) });
        return { demandees: ids.length, retour: res };
      },
    },
  );
}

// ---------- Protocole MCP (JSON-RPC 2.0) ----------
async function handle(msg) {
  const { id, method, params } = msg;
  const notif = id === undefined;
  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: PROTOCOLS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: 'Accès à intervals.icu (séances réalisées, calendrier, récupération, condition physique). Les dates sont au format AAAA-MM-JJ. Les outils d’écriture ne fonctionnent que s’ils sont activés sur le serveur.',
        });
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })) });
      case 'tools/call': {
        const tool = TOOLS.find((t) => t.name === params?.name);
        if (!tool) return err(id, -32602, 'Outil inconnu : ' + params?.name);
        try {
          const out = await tool.run(params.arguments || {});
          return ok(id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
        } catch (e) {
          return ok(id, { content: [{ type: 'text', text: 'Erreur : ' + e.message }], isError: true });
        }
      }
      default:
        return notif ? null : err(id, -32601, 'Méthode inconnue : ' + method);
    }
  } catch (e) {
    return notif ? null : err(id, -32603, 'Erreur interne');
  }
}

export default async (req) => {
  const url = new URL(req.url);
  if (!authorized(req, url)) return json({ error: 'Not found' }, 404);
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  let body;
  try { body = await req.json(); } catch { return json(err(null, -32700, 'JSON invalide'), 400); }
  const batch = Array.isArray(body), out = [];
  for (const m of batch ? body : [body]) {
    if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') { out.push(err(m && m.id, -32600, 'Requête invalide')); continue; }
    const r = await handle(m);
    if (r) out.push(r);
  }
  if (!out.length) return new Response(null, { status: 202 });
  return json(batch ? out : out[0]);
};

export const config = { path: '/mcp/*' };
