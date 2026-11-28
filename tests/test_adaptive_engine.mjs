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
    easyLike(x, min) { return { ...x, min, quality: false, long: false, trainingRole: 'easy', intensity: 'Facile', title: 'Séance facile' }; },
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
  return { date: dateOffset(2), day: 2, sport, min: 90, title: sport + ' qualité', quality: true, long: false, trainingRole: 'support', ...attrs };
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
    futurePlan('Course', { date: dateOffset(1), quality: false, long: false, min: 45, trainingRole: 'easy' }),
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


test('fatigue générale : les séances support sont allégées avant les séances key', () => {
  const original = [
    futurePlan('Vélo', { trainingRole: 'key' }),
    futurePlan('Course', { trainingRole: 'support' }),
    futurePlan('Natation', { trainingRole: 'easy' }),
    futurePlan('Course', { trainingRole: 'unclassified' }),
  ];
  const f = fixture({ plan: original, rdLog: redLog(3) });
  f.context.applyAdaptiveWeek();
  assert.equal(f.context.plan[0].adaptive7d, undefined, 'la séance clé est préservée');
  assert.equal(f.context.plan[1].adaptive7d, true, 'la séance support est allégée');
  assert.equal(f.context.plan[1].trainingRole, 'easy', 'la séance transformée devient facile');
  assert.equal(f.context.plan[2].adaptive7d, undefined, 'la séance facile reste intacte');
  assert.equal(f.context.plan[3].adaptive7d, undefined, 'la séance non classée reste intacte');
});

test('fatigue locale : la sélection support est limitée à la discipline concernée', () => {
  const original = [
    futurePlan('Course', { trainingRole: 'key' }),
    futurePlan('Course', { trainingRole: 'support' }),
    futurePlan('Vélo', { trainingRole: 'support' }),
  ];
  const f = fixture({
    plan: original,
    workouts: [session('Course', { rpe: 9 }), session('Course', { rpe: 9, date: dateOffset(-2) })],
  });
  f.context.applyAdaptiveWeek();
  assert.equal(f.context.plan[0].adaptive7d, undefined);
  assert.equal(f.context.plan[1].adaptive7d, true);
  assert.equal(f.context.plan[2].adaptive7d, undefined);
});

test('signal rouge sans séance support : une séance key peut être allégée en second recours', () => {
  const original = [futurePlan('Course', { trainingRole: 'key' }), futurePlan('Vélo', { trainingRole: 'easy' })];
  const f = fixture({ plan: original, rdLog: redLog(3) });
  f.context.applyAdaptiveWeek();
  assert.equal(f.context.plan[0].adaptive7d, true);
  assert.equal(f.context.plan[1].adaptive7d, undefined);
});

test('signal orange sans séance support : les séances key restent intactes', () => {
  const original = [futurePlan('Course', { trainingRole: 'key' })];
  const f = fixture({ plan: original, rdLog: redLog(2) });
  f.context.applyAdaptiveWeek();
  assert.deepEqual(f.context.plan, original);
});

test('séance sans rôle : jamais sélectionnée sur la seule base de quality, long ou durée', () => {
  const original = [futurePlan('Course', { trainingRole: undefined, min: 180, long: true })];
  const f = fixture({ plan: original, rdLog: redLog(3) });
  f.context.applyAdaptiveWeek();
  assert.deepEqual(f.context.plan, original);
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


// --- Seuils et cas limites : les valeurs attendues reflètent les comparateurs du code actuel.
function weekPlan(count = 10, minutes = 60) {
  return Array.from({ length: count }, (_, i) => ({
    ...futurePlan('Vélo'),
    day: { date: dateOffset(-1) },
    min: minutes,
    quality: false,
    long: false,
    title: 'Séance facile',
    trainingRole: 'easy',
    id: i,
  }));
}
function completedSessions(count, duration = 60) {
  return Array.from({ length: count }, () => ({ duration }));
}
function redLog(count) {
  const out = {};
  for (let i = 0; i < count; i++) out[dateOffset(-i)] = { lvl: 'red' };
  return out;
}
function amberLog(count) {
  const out = {};
  for (let i = 0; i < count; i++) out[dateOffset(-i)] = { lvl: 'amber' };
  return out;
}

test('douleur 2/10 : aucun signal local ; douleur 3/10 : surveillance locale', () => {
  const at2 = fixture({ workouts: [session('Course', { pain: 2 })] }).context.adaptiveWeekSignal();
  const at3 = fixture({ workouts: [session('Course', { pain: 3 })] }).context.adaptiveWeekSignal();
  assert.equal(at2.sports.Course.level, 'none');
  assert.equal(at3.sports.Course.level, 'watch');
  assert.equal(at3.level, 'green');
  assert.deepEqual(Array.from(at3.localTargets, x => x.name), ['Course']);
});

test('douleur 4/10 : blocage local et niveau global rouge', () => {
  const signal = fixture({ workouts: [session('Course', { pain: 4 })] }).context.adaptiveWeekSignal();
  assert.equal(signal.sports.Course.level, 'blocked');
  assert.equal(signal.level, 'red');
  assert.equal(signal.painMax, 4);
});

test('RPE : un effort à 8 ne suffit pas, un effort à 9 déclenche la surveillance', () => {
  const at8 = fixture({ workouts: [session('Vélo', { rpe: 8 })] }).context.adaptiveWeekSignal();
  const at9 = fixture({ workouts: [session('Vélo', { rpe: 9 })] }).context.adaptiveWeekSignal();
  assert.equal(at8.sports.Vélo.level, 'none');
  assert.equal(at9.sports.Vélo.level, 'watch');
});

test('RPE : deux efforts à 8 déclenchent la surveillance locale', () => {
  const signal = fixture({
    workouts: [session('Vélo', { rpe: 8 }), session('Vélo', { rpe: 8, date: dateOffset(-2) })],
  }).context.adaptiveWeekSignal();
  assert.equal(signal.sports.Vélo.hard, 2);
  assert.equal(signal.sports.Vélo.level, 'watch');
});

test('RPE moyen : seuil 7,5 avec au moins deux valeurs renseignées', () => {
  const below = fixture({ workouts: [session('Natation', { rpe: 7 }), session('Natation', { rpe: 7, date: dateOffset(-2) })] }).context.adaptiveWeekSignal();
  const at = fixture({ workouts: [session('Natation', { rpe: 7 }), session('Natation', { rpe: 8, date: dateOffset(-2) })] }).context.adaptiveWeekSignal();
  assert.equal(below.sports.Natation.level, 'none');
  assert.equal(at.sports.Natation.avgRpe, 7.5);
  assert.equal(at.sports.Natation.level, 'watch');
});

test('forme basse : deux séances RPE ≥7 et forme ≤2 déclenchent la surveillance', () => {
  const signal = fixture({
    workouts: [session('Course', { rpe: 7, feel: 2 }), session('Course', { rpe: 7, feel: 1, date: dateOffset(-2) })],
  }).context.adaptiveWeekSignal();
  assert.equal(signal.sports.Course.level, 'watch');
});

test('adhérence : 5/10 est sous le seuil ; 6/10 et 7/10 ne le sont pas', () => {
  const make = n => fixture({ plan: weekPlan(), done: completedSessions(n) }).context.adaptiveWeekSignal();
  const at59 = make(5);
  const at60 = make(6);
  const above = make(7);
  assert.equal(at59.adherence, 0.5);
  assert.equal(at59.level, 'soft');
  assert.equal(at60.adherence, 0.6);
  assert.equal(at60.level, 'green');
  assert.equal(above.adherence, 0.7);
  assert.equal(above.level, 'green');
});

test('volume effectué : 124 % et 125 % ne déclenchent pas le signal ; 126 % le déclenche', () => {
  const make = duration => fixture({
    plan: weekPlan(10, 100),
    done: completedSessions(10, duration),
  }).context.adaptiveWeekSignal();
  const at124 = make(124);
  const at125 = make(125);
  const at126 = make(126);
  assert.equal(at124.ratio, 1.24);
  assert.equal(at124.level, 'green');
  assert.equal(at125.ratio, 1.25);
  assert.equal(at125.level, 'green');
  assert.equal(at126.ratio, 1.26);
  assert.equal(at126.level, 'soft');
});

test('bilans rouges : deux jours donnent amber, trois jours donnent red', () => {
  const at2 = fixture({ rdLog: redLog(2) }).context.adaptiveWeekSignal();
  const at3 = fixture({ rdLog: redLog(3) }).context.adaptiveWeekSignal();
  assert.equal(at2.level, 'amber');
  assert.equal(at2.redDays, 2);
  assert.equal(at3.level, 'red');
  assert.equal(at3.redDays, 3);
});

test('bilans orange : deux jours ne suffisent pas, trois jours donnent amber', () => {
  const at2 = fixture({ rdLog: amberLog(2) }).context.adaptiveWeekSignal();
  const at3 = fixture({ rdLog: amberLog(3) }).context.adaptiveWeekSignal();
  assert.equal(at2.level, 'green');
  assert.equal(at3.level, 'amber');
  assert.equal(at3.amberDays, 3);
});
