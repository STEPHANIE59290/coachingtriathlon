/** Tests de cohérence des enchaînements vélo-course. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function brickIntegrityIssues('),end=html.indexOf('function renderPlan()',start);
assert.ok(start>=0&&end>start,'Helper brickIntegrityIssues introuvable');
const context={adaptiveSportKey(s){return s==='Vélo'?'Vélo':s==='Course'?'Course':s;},Map,Array,String};
vm.createContext(context);vm.runInContext(html.slice(start,end),context,{timeout:1000});
const check=context.brickIntegrityIssues;
test('groupe vélo-course complet : aucun avertissement',()=>assert.equal(check([{sport:'Vélo',brickGroupId:'g1'},{sport:'Course',brickGroupId:'g1'}]).length,0));
test('groupe avec une seule jambe : avertissement',()=>assert.equal(check([{sport:'Vélo',brickGroupId:'g1'}]).length,1));
test('groupe avec deux jambes vélo : incohérence',()=>assert.equal(check([{sport:'Vélo',brickGroupId:'g1'},{sport:'Vélo',brickGroupId:'g1'}]).length,1));
test('groupe avec trois séances : incohérence',()=>assert.equal(check([{sport:'Vélo',brickGroupId:'g1'},{sport:'Course',brickGroupId:'g1'},{sport:'Course',brickGroupId:'g1'}]).length,1));
test('séances hors groupe ignorées',()=>assert.equal(check([{sport:'Vélo'},{sport:'Course'}]).length,0));
