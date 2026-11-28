/**
 * Tests unitaires du moteur d'adaptation.
 * Exécution : node --test tests/test_adaptive_engine.mjs
 * Aucune dépendance externe, aucun accès réseau/Supabase, données entièrement synthétiques.
 *
 * Les fonctions testées sont extraites du code réel de index.html afin d'éviter
 * de maintenir une seconde implémentation du moteur dans les tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const start = html.indexOf('function adaptiveSportKey(');
const end = html.indexOf('// Prévision de charge sur les 7 prochains jours', start);
assert.ok(start >= 0 && end > start, 'Fonctions du moteur introuvables dans index.html');
const engineSource = html.slice(start, end);

function dateOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fixture({ workouts = [], rdLog = {}, plan = [], done = [] } = {}) {
  const store = { feel: {}, rdLog, plan, planStart: dateOffset(-7) };
  const messages = [];
  const context = {
    workouts: structuredClone(workouts),
    plan: structuredClone(plan),
    get(key, fallback) { return Object.hasOwn(store, key) ? store[key] : fallback; },
    put(key, value) { store[key] = structuredClone(value); if (key === 'plan') context.plan = structuredClone(value); },
    iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); },
    matchDone() { return done.slice(); },
    planDayISO(x) { return x.date || dateOffset(x.offset || 1); },
    easyLike(x, min) { return { ...x, min, quality: false, long: false, intensity: 'Facile', title: 'Séance facile' }; },
    toast(message) { messages.push(message); },
    renderPlan() {}, refreshStats() {}, renderToday() {},
    Object, Date, Math, Set, String, Number,
  };
  vm.createContext(context);
  vm.runInContext(engineSource, context, { timeout: 1000 });
  return { context, store, messages };
}

function session(sport, attrs = {}) {
  return { date: dateOffset(-1), sport, duration: 60, ...attrs };
}
function futurePlan(sport, attrs = {}) {
  return { date: dateOffset(2), day: 2, sport, min: 90, title: sport + ' qualité', quality: true, long: false, ...attrs };
}

test('semaine normale : aucun signal et plan inchangé', () => {
  const original = [futurePlan('Vélo')];
  const f = fixture({ plan: original });
  const signal = f.context.adaptiveWeekSignal();
  assert.equal(signal.level, 'green');
  f.context.applyAdaptiveWeek();
  assert.deepEqual(f.context.plan, original);
});

test('fatigue localisée en course : seule la séance de course est allégée', () => {
  const original = [futurePlan('Course'), futurePlan('Vélo'), futurePlan('Natation')];
  const f = fixture({
    plan: original,
    workouts: [session('Course', { rpe: 9 }), session('Course', { rpe: 9, date: dateOffset(-2) })],
  });
  const signal = f.context.adaptiveWeekSignal();
  assert.deepEqual(Array.from(signal.localTargets, x => x.name), ['Course']);
  f.context.applyAdaptiveWeek();
  assert.equal(f.context.plan[0].adaptive7d, true);
  assert.equal(f.context.plan[0].min, 65);
  assert.equal(f.context.plan[1].adaptive7d, undefined);
  assert.equal(f.context.plan[2].adaptive7d, undefined);
});

test('douleur à 4/10 : aucune adaptation automatique', () => {
  const original = [futurePlan('Course')];
  const f = fixture({ plan: original, workouts: [session('Course', { pain: 4, rpe: 8 })] });
  f.context.applyAdaptiveWeek();
  assert.deepEqual(f.context.plan, original);
  assert.ok(f.messages.some(x => x.includes('Douleur ≥ 4/10')));
});

test('trois bilans rouges : adaptation globale des séances exigeantes', () => {
  const original = [futurePlan('Course'), futurePlan('Vélo')];
  const rdLog = {};
  for (let i = 0; i < 3; i++) rdLog[dateOffset(-i)] = { lvl: 'red' };
  const f = fixture({ plan: original, rdLog });
  assert.equal(f.context.adaptiveWeekSignal().level, 'red');
  f.context.applyAdaptiveWeek();
  assert.equal(f.context.plan.filter(x => x.adaptive7d).length, 2);
  assert.equal(f.context.plan[0].min, 50);
  assert.equal(f.context.plan[1].min, 50);
});

test('séances réalisées, événements, openers et séances faciles restent intactes', () => {
  const original = [
    futurePlan('Course'),
    futurePlan('Vélo', { event: true }),
    futurePlan('Natation', { opener: true }),
    futurePlan('Course', { date: dateOffset(1), quality: false, long: false, min: 45 }),
    futurePlan('Vélo', { date: dateOffset(9) }),
    futurePlan('Course', { date: dateOffset(2), title: 'Séance déjà réalisée' }),
  ];
  const f = fixture({
    plan: original,
    workouts: [session('Course', { rpe: 9 }), session('Course', { rpe: 9, date: dateOffset(-2) })],
    done: [false, false, false, false, false, true],
  });
  f.context.applyAdaptiveWeek();
  assert.equal(f.context.plan[0].adaptive7d, true);
  for (let i = 1; i < original.length; i++) assert.deepEqual(f.context.plan[i], original[i]);
});

test('annulation : restaure exactement le plan initial', () => {
  const original = [futurePlan('Course', { description: 'Intervalles', custom: { keep: true } })];
  const f = fixture({
    plan: original,
    workouts: [session('Course', { rpe: 9 }), session('Course', { rpe: 9, date: dateOffset(-2) })],
  });
  f.context.applyAdaptiveWeek();
  assert.notDeepEqual(f.context.plan, original);
  f.context.undoAdaptiveWeek();
  assert.deepEqual(f.context.plan, original);
});

test('données de récupération absentes : aucune progression ni adaptation', () => {
  const original = [futurePlan('Course')];
  const f = fixture({ plan: original });
  const signal = f.context.adaptiveWeekSignal();
  assert.equal(signal.avgRpe, null);
  assert.equal(signal.level, 'green');
  f.context.applyAdaptiveWeek();
  assert.deepEqual(f.context.plan, original);
});

test('historique RPE : seuil de hausse exige deux valeurs récentes et trois antérieures', () => {
  const workouts = [
    session('Vélo', { date: dateOffset(-1), rpe: 8 }),
    session('Vélo', { date: dateOffset(-2), rpe: 8 }),
    session('Vélo', { date: dateOffset(-9), rpe: 5 }),
    session('Vélo', { date: dateOffset(-15), rpe: 5 }),
    session('Vélo', { date: dateOffset(-22), rpe: 5 }),
  ];
  const f = fixture({ workouts });
  const response = f.context.adaptiveSportResponse().Vélo;
  assert.equal(response.worsening, true);
  assert.equal(response.recentRated, 2);
  assert.equal(response.priorRated, 3);
});
