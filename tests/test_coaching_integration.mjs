import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function load(startMarker,endMarker,extra={}) {
 const start=html.indexOf(startMarker),end=html.indexOf(endMarker,start);
 assert.ok(start>=0&&end>start,'Bloc introuvable : '+startMarker);
 const context={...extra,Object,Array,Number,Math,String,Date};
 vm.createContext(context);vm.runInContext(html.slice(start,end),context,{timeout:1000});return context;
}
const role=x=>x&&['key','support','easy'].includes(x.trainingRole)?x.trainingRole:'unclassified';
const realityCtx=load('function trainingRealitySummary(','function raceSpecificFocus(',{
 adaptiveRoleOf:role,planDayISO:day=>day===6?'2026-12-02':'2026-11-27'
});
const painCtx=load('function updatePostSessionPainLog(','function savePostSession(',{iso:d=>d.toISOString().slice(0,10)});
const readinessCtx=load('function readinessAvailabilityScore(','function currentReadinessAvailability(');
const raceCtx=load('function raceSpecificFocus(','function adaptiveForecast(');

test('réalité entraînement : distingue les rôles et calcule le RPE réellement ressenti',()=>{
 const plan=[{min:60,trainingRole:'key',intensity:'Soutenu'},{min:45,trainingRole:'easy',intensity:'Facile'},{min:30,trainingRole:'support'}];
 const done=[{duration:55,rpe:7},{duration:40,rpe:9,pain:3},null];
 const r=realityCtx.trainingRealitySummary(plan,done);
 assert.equal(r.roles.key.planned,1);assert.equal(r.roles.key.done,1);
 assert.equal(r.roles.easy.done,1);assert.equal(r.roles.support.done,0);
 assert.equal(r.avgRpe,8);assert.equal(r.maxPain,3);
 assert.equal(r.unexpectedHard,1);assert.equal(r.keyPlanned,1);assert.equal(r.keyDone,1);
});
test('conseils issus du réel : ne propose ni rattrapage ni hausse automatique',()=>{
 const advice=realityCtx.trainingRealityAdvice({total:3,keyPlanned:2,keyDone:1,shortened:1,extended:1,unexpectedHard:1,maxPain:3,avgRpe:8,adherence:2/3});
 assert.ok(advice.some(x=>/non réalisée.*sans les rattraper/i.test(x)));
 assert.ok(advice.some(x=>/raccourcie.*sans compensation/i.test(x)));
 assert.ok(advice.some(x=>/plus longue.*récupération/i.test(x)));
 assert.ok(advice.some(x=>/douleur signalée/i.test(x)));
});
test('douleur post-séance : crée puis actualise un seul signalement par séance',()=>{
 const w={ext:'icu123',date:'2026-11-27',sport:'Course à pied',duration:50};
 let a=painCtx.updatePostSessionPainLog([],w,4,'hanche','2026-11-27T18:00:00Z');
 a=painCtx.updatePostSessionPainLog(a,w,3,'hanche','2026-11-27T18:30:00Z');
 assert.equal(a.length,1);assert.equal(a[0].pain,3);assert.equal(a[0].z,'hanche');
});
test('douleur post-séance : supprimer la douleur corrigée à zéro sans effacer les autres sources',()=>{
 const w={ext:'icu123',date:'2026-11-27',sport:'Course à pied',duration:50};
 const legacy={d:'2026-11-26',z:'dos',pain:2,sport:'Vélo'};
 let a=painCtx.updatePostSessionPainLog([legacy],w,4,'hanche','2026-11-27T18:00:00Z');
 a=painCtx.updatePostSessionPainLog(a,w,0,'general','2026-11-27T19:00:00Z');
 assert.deepEqual(a,[legacy]);
});
test('disponibilité : un signal rouge pèse davantage qu’un signal orange',()=>{
 const red=readinessCtx.readinessAvailabilityScore({sleep:7,fatigue:'Faible',feeling:'Très bonnes',life:'Normale',painMax:0,recentLevel:'red'});
 const amber=readinessCtx.readinessAvailabilityScore({sleep:7,fatigue:'Faible',feeling:'Très bonnes',life:'Normale',painMax:0,recentLevel:'amber'});
 assert.ok(red.score<amber.score);assert.ok(red.factors.includes('signal de récupération rouge'));
});
test('préparation course : signale les séances clés manquées et la douleur',()=>{
 const f=raceCtx.raceSpecificFocus('Ironman','spec',{keyPlanned:3,keyDone:2,adherence:.8},{painMax:3});
 assert.match(f,/Ironman spécifique/i);assert.match(f,/séances prioritaires.*non réalisées/i);assert.match(f,/douleur signalée/i);
});
