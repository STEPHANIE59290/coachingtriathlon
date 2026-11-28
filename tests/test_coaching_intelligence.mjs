import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function loadFunction(name,nextName,extra={}){
 const start=html.indexOf('function '+name+'('),end=html.indexOf('function '+nextName+'(',start);
 assert.ok(start>=0&&end>start,'Fonction '+name+' introuvable');
 const context={...extra,Object,Array,Number,Math,String};
 vm.createContext(context);
 vm.runInContext(html.slice(start,end),context,{timeout:1000});
 return context[name];
}

const readiness=loadFunction('readinessAvailabilityScore','currentReadinessAvailability');
const pain=loadFunction('painHistorySummary','painHtml');
const insight=loadFunction('postSessionCoachInsight','renderQuickFeel');
const reality=loadFunction('trainingRealitySummary','raceSpecificFocus',{adaptiveRoleOf:x=>x&&['key','support','easy'].includes(x.trainingRole)?x.trainingRole:'unclassified',planDayISO:day=>day===6?'2026-12-02':'2026-11-27'});
const raceFocus=loadFunction('raceSpecificFocus','adaptiveForecast');

test('disponibilité : un profil sans facteur défavorable reste à 100',()=>{
 const r=readiness({sleep:7.5,fatigue:'Faible',feeling:'Très bonnes',life:'Normale',painMax:0});
 assert.equal(r.score,100);
 assert.equal(r.band,'bonne');
});
test('disponibilité : douleur et fatigue abaissent nettement le repère',()=>{
 const r=readiness({sleep:5,fatigue:'Élevée',feeling:'Mauvaises',life:'Élevée',painMax:5,recentLevel:'amber'});
 assert.ok(r.score<30);
 assert.ok(r.factors.includes('douleur importante signalée'));
});
test('disponibilité : le score est borné entre 0 et 100',()=>{
 const r=readiness({sleep:2,fatigue:'Élevée',feeling:'Mauvaises',life:'Élevée',painMax:10,recentLevel:'amber'});
 assert.ok(r.score>=0&&r.score<=100);
});

test('historique douleur : regroupe les zones et calcule une intensité moyenne connue',()=>{
 const rows=pain([{d:'2026-11-20',z:'hanche',pain:3,sport:'Course'},{d:'2026-11-21',z:'hanche',pain:5,sport:'Course'},{d:'2026-11-22',z:'dos',pain:2,sport:'Vélo'}],'2026-11-01');
 const hip=rows.find(x=>x.zone==='hanche');
 assert.equal(hip.count,2);
 assert.equal(hip.max,5);
 assert.equal(hip.average,4);
 assert.equal(hip.sports.Course,2);
});
test('historique douleur : les anciens signalements sans intensité restent inconnus',()=>{
 const rows=pain([{d:'2026-11-20',z:'hanche'},{d:'2026-11-21',z:'hanche'}],'2026-11-01');
 assert.equal(rows[0].known,0);
 assert.equal(rows[0].average,null);
 assert.equal(rows[0].max,null);
});
test('historique douleur : ignore les entrées hors période',()=>{
 const rows=pain([{d:'2026-10-20',z:'hanche',pain:7},{d:'2026-11-20',z:'dos',pain:2}],'2026-11-01');
 assert.equal(rows.length,1);
 assert.equal(rows[0].zone,'dos');
});

test('bilan séance : douleur importante devient le signal prioritaire',()=>{
 const r=insight({pain:5,rpe:3,duration:40},null);
 assert.equal(r.title,'Douleur à surveiller');
 assert.match(r.message,/ne cherche pas à compenser/i);
});
test('bilan séance : RPE élevé et fatigue élevée appellent à récupérer',()=>{
 const r=insight({rpe:9,feel:4,duration:60},null);
 assert.equal(r.title,'Effort nettement supérieur aux attentes');
 assert.match(r.message,/marge de récupération/i);
});
test('bilan séance : une séance raccourcie ne doit pas être rattrapée',()=>{
 const r=insight({rpe:5,duration:40},{min:60,trainingRole:'support'});
 assert.match(r.message,/ne rattrape pas automatiquement/i);
});
test('bilan séance : une séance prioritaire est identifiée',()=>{
 const r=insight({rpe:5,duration:60},{min:60,trainingRole:'key'});
 assert.match(r.message,/Séance prioritaire/i);
});
test('bilan séance : inconfort digestif pris en compte sans prescription automatique',()=>{
 const r=insight({rpe:5,duration:120,postSession:{fuel:'dig'}},null);
 assert.match(r.message,/inconfort digestif/i);
});

test('prévu/réalisé : calcule adhérence, minutes et séances prioritaires',()=>{
 const plan=[{min:60,trainingRole:'key'},{min:45,trainingRole:'support'},{min:30,event:true}];
 const done=[{duration:55},{duration:30},null];
 const r=reality(plan,done);
 assert.equal(r.total,2);
 assert.equal(r.done,2);
 assert.equal(r.missed,0);
 assert.equal(r.keyPlanned,1);
 assert.equal(r.keyDone,1);
 assert.equal(r.plannedMinutes,105);
 assert.equal(r.actualMinutes,85);
 assert.equal(r.shortened,1);
});
test('prévu/réalisé : ne compte pas les séances futures',()=>{
 const plan=[{min:60,trainingRole:'key',day:1},{min:60,trainingRole:'support',day:6}];
 const done=[{duration:60},null];
 const r=reality(plan,done,'2026-11-28');
 assert.equal(r.total,1);
 assert.equal(r.done,1);
});
test('prévu/réalisé : absence de planning donne un état indéterminé',()=>{
 const r=reality([],[]);
 assert.equal(r.total,0);
 assert.equal(r.adherence,null);
});

test('objectif Ironman spécifique : priorité durabilité vélo et nutrition',()=>{
 assert.match(raceFocus('Ironman','spec'),/durabilité à vélo/i);
 assert.match(raceFocus('Ironman','spec'),/nutrition/i);
});
test('objectif 70.3 spécifique : priorité allure cible et travail soutenu',()=>{
 assert.match(raceFocus('70.3','spec'),/allure cible/i);
 assert.match(raceFocus('70.3','spec'),/travail soutenu/i);
});
test('affûtage : pas de compensation du volume réduit',()=>{
 assert.match(raceFocus('Ironman','taper'),/ne pas compenser/i);
});
