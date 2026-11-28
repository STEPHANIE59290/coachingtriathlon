import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(HERE,'..','index.html'),'utf8');
const start=html.indexOf('function adaptiveLongitudinalLoad('),end=html.indexOf('// Prévision de charge sur les 7 prochains jours',start);
assert.ok(start>=0&&end>start,'Fonction longitudinale introuvable');
function dateOffset(days){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function fixture(workouts){const store={feel:{}};const context={workouts,get(k,f){return Object.hasOwn(store,k)?store[k]:f;},iso(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);},Date,Math,Object,Array,Set};vm.createContext(context);vm.runInContext(html.slice(start,end),context,{timeout:1000});return context.adaptiveLongitudinalLoad();}
function session(days,duration,rpe){return {date:dateOffset(days),duration,rpe};}
test('compare les 7 derniers jours à la moyenne des 3 semaines antérieures',()=>{const w=[];for(let d=-27;d<=-8;d+=3)w.push(session(d,60,5));for(let d=-6;d<=-1;d+=2)w.push(session(d,90,7));const r=fixture(w);assert.equal(r.sufficient,true);assert.equal(r.recentSessions,3);assert.ok(r.recentMinutesRatio>1.2);assert.ok(r.recentSRpeRatio>1.2);});
test('historique trop court : ne conclut pas',()=>{const r=fixture([session(-1,60,6)]);assert.equal(r.sufficient,false);assert.equal(r.recentMinutesRatio,null);assert.equal(r.recentSRpeRatio,null);});
test('sans RPE : volume disponible, charge interne indéterminée',()=>{const w=[];for(let d=-27;d<=-8;d+=3)w.push(session(d,60,0));for(let d=-6;d<=-1;d+=2)w.push(session(d,90,0));const r=fixture(w);assert.equal(r.sufficient,true);assert.ok(r.recentMinutesRatio>1.2);assert.equal(r.recentSRpeRatio,null);});
