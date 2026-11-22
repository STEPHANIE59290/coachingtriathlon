import handler from '../netlify/functions/mcp.mjs';
process.env.INTERVALS_API_KEY='DUMMY-KEY';
process.env.MCP_TOKEN='tok_'+'x'.repeat(30);
const TOKEN=process.env.MCP_TOKEN;
const calls=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async(u,o={})=>{
  const url=String(u);calls.push({u:url,m:o.method||'GET',auth:o.headers&&o.headers.Authorization,body:o.body});
  const R=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json'}});
  if(url.includes('/activities?'))return R([{id:'i2',start_date_local:'2026-03-02T07:00:00',type:'Run',name:'B',moving_time:3600,distance:10000,average_heartrate:140,icu_training_load:60,icu_rpe:5,feel:2,description:'x'.repeat(500)},{id:'i1',start_date_local:'2026-03-01T07:00:00',type:'Ride',name:'A',moving_time:5400,distance:40000,icu_average_watts:150,icu_training_load:80}]);
  if(url.includes('/streams.json'))return R([{type:'time',data:Array.from({length:3000},(_,i)=>i)},{type:'watts',data:Array.from({length:3000},(_,i)=>150+(i%10))}]);
  if(/\/activity\/[^/?]+\?intervals=true/.test(url))return R({id:'i1',name:'A',type:'Ride',moving_time:5400,icu_intervals:[{type:'WORK',start_index:0,end_index:600,moving_time:600,average_watts:200,average_heartrate:150,secret_field:'x'}],laps:[]});
  if(url.includes('/wellness?'))return R([{id:'2026-03-01',ctl:55.2,atl:61,rampRate:3.1,sleepSecs:25200,restingHR:50,hrv:60,email:'secret@x'}]);
  if(url.includes('/events/bulk-delete'))return R({deleted:2});
  if(url.includes('/events/bulk'))return R(JSON.parse(o.body).map((e,i)=>({id:900+i,...e})));
  if(url.includes('/events?'))return R([{id:7,start_date_local:'2026-03-04T00:00:00',category:'WORKOUT',type:'Run',name:'Seuil',description:'- 10m 80%',moving_time:3600,icu_training_load:55,external_id:'e1'}]);
  if(/\/athlete\/[^/?]+$/.test(url))return R({name:'Prénom Nom',email:'a@b.c',icu_weight:64,sportSettings:[{types:['Ride'],ftp:180,lthr:160,secret:'no'}]});
  return R({},404);
};
const post=(body,path=`/mcp/${TOKEN}`,headers={})=>handler(new Request('https://site.netlify.app'+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}));
const J=async r=>r.status===202?'(202 vide)':await r.json();
const T=async(name,args)=>{const r=await J(await post({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}));return r.result?{err:!!r.result.isError,data:JSON.parse(r.result.content[0].text.startsWith('Erreur')?JSON.stringify(r.result.content[0].text):r.result.content[0].text)}:r;};
const out=(l,v)=>console.log(l.padEnd(34),typeof v==='string'?v:JSON.stringify(v).slice(0,230));

// 1) sécurité
out('mauvais jeton ->',(await post({jsonrpc:'2.0',id:1,method:'ping'},'/mcp/mauvais')).status);
out('sans jeton ->',(await post({jsonrpc:'2.0',id:1,method:'ping'},'/mcp/')).status);
out('jeton en en-tête Bearer ->',(await post({jsonrpc:'2.0',id:1,method:'ping'},'/mcp/',{authorization:'Bearer '+TOKEN})).status);
out('GET avec bon jeton ->',(await handler(new Request('https://s.netlify.app/mcp/'+TOKEN))).status);
const short=process.env.MCP_TOKEN;process.env.MCP_TOKEN='court';out('jeton trop court (config) ->',(await post({jsonrpc:'2.0',id:1,method:'ping'},'/mcp/court')).status);process.env.MCP_TOKEN=short;
// 2) protocole
out('initialize ->',await J(await post({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'t',version:'1'}}})));
out('notif initialized ->',await J(await post({jsonrpc:'2.0',method:'notifications/initialized'})));
const tl=await J(await post({jsonrpc:'2.0',id:2,method:'tools/list'}));out('outils ->',tl.result.tools.map(t=>t.name).join(', '));
out('lecture seule déclarée ->',tl.result.tools.filter(t=>t.annotations.readOnlyHint).length+'/'+tl.result.tools.length);
out('méthode inconnue ->',await J(await post({jsonrpc:'2.0',id:3,method:'foo'})));
out('JSON invalide ->',(await post('{pas du json')).status);
out('lot (ping + tools/list) ->',(await J(await post([{jsonrpc:'2.0',id:1,method:'ping'},{jsonrpc:'2.0',id:2,method:'tools/list'}]))).map(x=>x.id).join(','));
// 3) outils de lecture
let r=await T('get_activities',{oldest:'2026-03-01',newest:'2026-03-31'});out('get_activities (triées) ->',r.data.map(x=>x.id+':'+x.date.slice(0,10)));out('  description tronquée ->',r.data.find(x=>x.id==='i2').description.length);
out('  auth Basic correcte ->',calls.at(-1).auth==='Basic '+Buffer.from('API_KEY:DUMMY-KEY').toString('base64'));
out('  athlète 0 par défaut ->',/athlete\/0\/activities/.test(calls.at(-1).u));
r=await T('get_activities',{oldest:'2026-03-01',newest:'2027-12-31'});out('période > 400 j ->',r.data);
r=await T('get_activities',{oldest:'mars',newest:'avril'});out('dates invalides ->',r.data);
r=await T('get_activity',{activity_id:'i1'});out('get_activity ->',r.data);out('  champ non listé exclu ->',!JSON.stringify(r.data).includes('secret_field'));
r=await T('get_activity',{activity_id:'../etc/passwd'});out('id malveillant ->',r.data);
r=await T('get_activity_streams',{activity_id:'i1',max_points:100});out('streams ré-échantillonnés ->',{points:r.data.points,original:r.data.original_length,watts:r.data.streams.watts.length,types:Object.keys(r.data.streams)});
r=await T('get_wellness',{oldest:'2026-03-01',newest:'2026-03-02'});out('get_wellness ->',r.data);out('  e-mail exclu ->',!JSON.stringify(r.data).includes('secret@x'));
r=await T('get_events',{oldest:'2026-03-01',newest:'2026-03-10',category:'WORKOUT'});out('get_events ->',r.data);out('  filtre catégorie dans l’URL ->',/category=WORKOUT/.test(calls.at(-1).u));
r=await T('get_athlete_settings',{});out('get_athlete_settings ->',r.data);out('  nom/e-mail exclus ->',!/Prénom|a@b\.c|secret/.test(JSON.stringify(r.data)));
// 4) écriture : désactivée par défaut
r=await T('create_workouts',{events:[{date:'2026-03-10',type:'Run',name:'Test',description:'- 10m 70%'}]});out('écriture désactivée ->',r.data);
const nW=calls.length;
process.env.ALLOW_WRITE='true';
r=await T('create_workouts',{events:[{date:'2026-03-10',time:'07:30',type:'Run',name:'Test',description:'- 10m 70%',external_id:'half-1'}]});out('écriture activée ->',r.data);
const c=calls.at(-1);out('  requête ->',c.m+' '+c.u.replace('https://intervals.icu/api/v1','')+' '+c.body);
r=await T('create_workouts',{events:[{date:'2026-03-10',type:'Surf',name:'x'}]});out('type invalide ->',r.data);
r=await T('create_workouts',{events:[{date:'2026-03-10',type:'Run',name:'x',external_id:'a b/../'}]});out('external_id invalide ->',r.data);
r=await T('delete_workouts',{external_ids:['half-1','half-2']});out('delete_workouts ->',r.data);out('  requête ->',calls.at(-1).m+' '+calls.at(-1).body);
r=await T('delete_workouts',{external_ids:['']});out('suppression sans id valide ->',r.data);
delete process.env.ALLOW_WRITE;
r=await T('delete_workouts',{external_ids:['half-1']});out('suppression désactivée ->',r.data);
// 5) erreur amont
process.env.INTERVALS_API_KEY='';r=await T('get_wellness',{oldest:'2026-03-01',newest:'2026-03-02'});out('clé absente ->',r.data);
console.log('\nsecrets jamais renvoyés au client :',!JSON.stringify(await J(await post({jsonrpc:'2.0',id:9,method:'tools/list'}))).includes('DUMMY-KEY'));
