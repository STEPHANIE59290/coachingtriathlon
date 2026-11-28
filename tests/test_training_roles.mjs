/**
 * Tests des métadonnées de rôle des séances.
 * Exécution : node --test tests/test_training_roles.mjs
 * Les helpers et easyLike sont extraits du code réel de index.html.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');

function helperContext() {
  const start = html.indexOf('const TRAINING_ROLES=');
  const end = html.indexOf('// Endurance :', start);
  assert.ok(start >= 0 && end > start, 'Helpers de rôles introuvables dans index.html');
  const context = { Object, Array };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { timeout: 1000 });
  Object.assign(context, vm.runInContext('({ mkS, normalizeTrainingRole, tagTrainingCatalog, catalogTrainingRoles, copyTrainingMetadata })', context));
  return context;
}

function easyLikeFunction() {
  const start = html.indexOf('function easyLike(');
  const end = html.indexOf('// Séance proposée', start);
  assert.ok(start >= 0 && end > start, 'Fonction easyLike introuvable dans index.html');
  const helpers = helperContext();
  const context = {
    ...helpers,
    Math,
    r5: value => Math.round(value / 5) * 5,
    endur: (sport, title, min) => () => ({ sport, title, min, trainingRole: 'unclassified' }),
    mkS: (sport, title, min, desc, intensity, extra = {}) => ({ sport, title, min, desc, intensity, ...extra }),
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { timeout: 1000 });
  return context.easyLike;
}

test('une séance créée sans rôle est classée unclassified', () => {
  const c = helperContext();
  const session = c.mkS('Vélo', 'Séance libre', 60, '', 'Libre');
  assert.equal(session.trainingRole, 'unclassified');
});

test('les rôles inconnus sont normalisés en unclassified', () => {
  const c = helperContext();
  assert.equal(c.normalizeTrainingRole('priority'), 'unclassified');
  assert.equal(c.normalizeTrainingRole('key'), 'key');
});

test('le catalogue applique les rôles explicitement sans déduire du titre ou de la durée', () => {
  const c = helperContext();
  const factories = [
    () => ({ title: 'Très longue sortie', min: 240 }),
    () => ({ title: 'Rappel court', min: 20 }),
    () => ({ title: 'Séance facile', min: 40 }),
  ];
  const tagged = c.tagTrainingCatalog(factories, ['support', 'key', 'easy']).map(fn => fn(1));
  assert.deepEqual(Array.from(tagged, x => x.trainingRole), ['support', 'key', 'easy']);
});

test('Ironman et 70.3 identifient des séances prioritaires différentes en phase spécifique', () => {
  const c = helperContext();
  const im = c.catalogTrainingRoles('balanced', 'spec', false, 3, 'Ironman', 8);
  const half = c.catalogTrainingRoles('balanced', 'spec', false, 3, '70.3', 8);
  assert.equal(im[3], 'key');       // vélo long spécifique Ironman
  assert.equal(half[4], 'key');     // séance de qualité vélo spécifique 70.3
  assert.equal(im[5], 'easy');
  assert.equal(half[5], 'easy');
});

test('les listes vélo et course attribuent la priorité selon le format sans utiliser la durée', () => {
  const c = helperContext();
  assert.equal(c.catalogTrainingRoles('bike', 'spec', false, 4, 'Ironman', 7)[2], 'key');
  assert.equal(c.catalogTrainingRoles('bike', 'spec', false, 4, '70.3', 7)[3], 'key');
  assert.equal(c.catalogTrainingRoles('run', 'spec', false, 4, '70.3', 7)[4], 'key');
});

test('une semaine de récupération ne reçoit pas de séance clé artificielle', () => {
  const c = helperContext();
  for (const focus of ['balanced', 'bike', 'run', 'swim']) {
    assert.ok(c.catalogTrainingRoles(focus, 'spec', true, 6, 'Ironman', 9).every(x => x !== 'key'));
  }
});

test('un footing de la semaine de recharge reste facile, mais une sortie longue ne l’est pas par défaut', () => {
  const c = helperContext();
  const assimilation = c.catalogTrainingRoles('balanced', 'taper', false, 2, '70.3', 9);
  const recharge = c.catalogTrainingRoles('balanced', 'taper', false, 1, '70.3', 8);
  assert.equal(assimilation[5], 'easy');
  assert.equal(recharge[5], 'support');
});

test('la copie des métadonnées conserve le rôle et le groupe sans modifier la source', () => {
  const c = helperContext();
  const source = { trainingRole: 'key', brickGroupId: 'brick-2026-01' };
  const target = { title: 'Séance facile' };
  const copied = c.copyTrainingMetadata(source, target);
  assert.equal(copied.trainingRole, 'key');
  assert.equal(copied.brickGroupId, 'brick-2026-01');
  assert.deepEqual(target, { title: 'Séance facile' });
});

test('easyLike convertit le rôle en easy et conserve le groupe de séance pour chaque discipline', () => {
  const easyLike = easyLikeFunction();
  for (const sport of ['Vélo', 'Course', 'Natation', 'Renforcement']) {
    const source = { sport, trainingRole: 'key', brickGroupId: 'brick-test' };
    const adapted = easyLike(source, 50);
    assert.equal(adapted.trainingRole, 'easy', sport);
    assert.equal(adapted.brickGroupId, 'brick-test', sport);
  }
});

test('easyLike classe une ancienne séance transformée en facile sans rôle initial comme easy', () => {
  const easyLike = easyLikeFunction();
  const adapted = easyLike({ sport: 'Course', title: 'Ancien plan' }, 45);
  assert.equal(adapted.trainingRole, 'easy');
});

test('les scripts JavaScript intégrés à index.html sont syntaxiquement valides', () => {
  const pattern = new RegExp('<script\\b([^>]*)>([\\s\\S]*?)<\\/script>', 'gi');
  const scripts = Array.from(html.matchAll(pattern))
    .filter(([, attrs]) => !attrs.toLowerCase().includes('src='))
    .map(([, , body]) => body)
    .filter(body => body.trim());
  assert.ok(scripts.length > 0, 'Aucun script JavaScript intégré détecté');
  scripts.forEach((source, index) => new vm.Script(source, { filename: 'index.html:inline-script-' + (index + 1) }));
});

test('un athlète peut corriger le rôle de sa séance dans son propre planning', () => {
  const start = html.indexOf('function setTrainingRole(');
  const end = html.indexOf('function applyAdaptiveWeek(', start);
  assert.ok(start >= 0 && end > start, 'Fonction setTrainingRole introuvable dans index.html');
  const stored = [];
  const context = {
    plan: [{ title: 'Vélo spécifique', trainingRole: 'support' }],
    put(key, value) { stored.push([key, structuredClone(value)]); },
    renderPlan() {},
    toast() {},
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { timeout: 1000 });
  context.setTrainingRole(0, 'key');
  assert.equal(context.plan[0].trainingRole, 'key');
  assert.equal(stored.at(-1)[0], 'plan');
});

test('la correction du rôle pendant une adaptation modifie le rôle initial, pas la séance facile affichée', () => {
  const start = html.indexOf('function setTrainingRole(');
  const end = html.indexOf('function applyAdaptiveWeek(', start);
  const context = {
    plan: [{ title: 'Course clé', trainingRole: 'easy', adapted: true, orig: { trainingRole: 'key' } }],
    put() {}, renderPlan() {}, toast() {},
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { timeout: 1000 });
  context.setTrainingRole(0, 'support');
  assert.equal(context.plan[0].trainingRole, 'easy');
  assert.equal(context.plan[0].orig.trainingRole, 'support');
});

test('un rôle invalide ne modifie pas le planning', () => {
  const start = html.indexOf('function setTrainingRole(');
  const end = html.indexOf('function applyAdaptiveWeek(', start);
  const context = {
    plan: [{ title: 'Séance', trainingRole: 'support' }],
    put() {}, renderPlan() {}, toast() {},
  };
  vm.createContext(context);
  vm.runInContext(html.slice(start, end), context, { timeout: 1000 });
  context.setTrainingRole(0, 'admin');
  assert.equal(context.plan[0].trainingRole, 'support');
});
