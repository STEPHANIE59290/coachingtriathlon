#!/usr/bin/env python3
"""Banc de test de Mon Coach (données simulées, date figée au 26/11/2026).
   python3 tests/run.py            compare à tests/golden.json (code retour 1 si écart)
   python3 tests/run.py --update   réécrit golden.json (après un changement voulu)
   Options : --file chemin/index.html   --budget 350 (ms de rendu au démarrage, CPU ×4)
   Prérequis : pip install playwright && playwright install chromium"""
import argparse, datetime as dt, hashlib, json, os, random, statistics, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
NOW = dt.datetime(2026, 11, 26, 10, 0, 0)
sha = lambda t: hashlib.sha1(t.encode()).hexdigest()[:12]

def seed(atl_last=45):
    r = random.Random(1); today = NOW.date(); W = {}; c = a = 45
    for i in range(420, 0, -1):
        l = r.choice([0, 40, 60, 80, 120]); c += (l - c) / 42; a += (l - a) / 7
        W[(today - dt.timedelta(days=i)).isoformat()] = {"ctl": round(c, 1), "atl": round(a, 1), "ramp": 3.2, "sleep": 7.2}
    k = sorted(W)[-1]; W[k]["ctl"] = 45; W[k]["atl"] = atl_last
    H = [{"date": "2026-11-17", "sport": "Natation", "duration": 60, "rpe": 5, "load": 40},
         {"date": "2026-11-19", "sport": "Course à pied", "duration": 60, "rpe": 5, "load": 60}]
    for i in range(30, 500):
        H.append({"date": (today - dt.timedelta(days=i // 1.2)).isoformat(), "sport": r.choice(["Natation", "Vélo", "Course"]), "duration": r.choice([45, 60, 90]), "load": r.choice([40, 60, 80]), "rpe": 5})
    sl = [[{"sports": ["Natation", "Vélo", "Course"], "max": 60, "chain": False}], [], [{"sports": ["Course"], "max": 60, "chain": False}], [], [{"sports": ["Natation"], "max": 60, "chain": False}], [{"sports": ["Vélo"], "max": 180, "chain": False}], [{"sports": ["Course"], "max": 120, "chain": False}]]
    return {"races": [{"id": "r0", "name": "Half", "type": "70.3", "prio": "A", "date": "2027-07-04"}, {"id": "r1", "name": "10 km", "type": "Autre", "prio": "C", "date": "2027-03-14"}],
            "raceDay": "2027-07-04", "hrsNow": 7, "hrsPeak": 11, "wellness": W, "history": H, "slots": sl, "tpl": {"slots": sl, "startTimes": ["18:30"] * 7},
            "blockSlots": {k: {"slots": sl, "startTimes": ["18:30"] * 7} for k in ["base", "build", "spec", "taper"]},
            "ftp": 220, "swimMax": "1:40", "runHM": "5:10", "target": 8,
            "planStart": "2026-11-16", "prog": {"level": 1, "week": 1, "n": 1, "last": "2026-11-16"},
            "plan": [{"day": 0, "sport": "Natation", "min": 60, "title": "N", "desc": "d", "intensity": "x"}, {"day": 2, "sport": "Course", "min": 60, "title": "C", "desc": "d", "intensity": "x"}]}

class Srv(BaseHTTPRequestHandler):
    html = b""; delay = 0.0
    def do_GET(self):
        if self.path.startswith("/config.js"): time.sleep(Srv.delay); body, ct = b"window.SB_CONFIG={};", "application/javascript"
        elif self.path in ("/", "/index.html"): body, ct = Srv.html, "text/html; charset=utf-8"
        else: self.send_response(404); self.end_headers(); return
        self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass

JS = """()=>{const o={};
 for(const id of ['pathCard','raceVolCard','blockTplCard']){const c=document.getElementById(id);if(c)toggleFold(c,true);}
 showTab('fitness');showTab('profile');showTab('home');
 const h=i=>document.getElementById(i).innerHTML;
 o.path=h('pathBox');o.vol=h('raceVolBox');o.blk=h('blockTplBox');o.fit=h('fitKpi')+h('fitChart');
 o.wkBilan=document.getElementById('wkBilanBox').innerText;
 const ws=[];let d=mondayOf();for(let i=0;i<70;i++){ws.push(iso(d));d.setDate(d.getDate()+7);}
 o.raceInfo=JSON.stringify(ws.map(w=>{const r=raceInfo(w);return r&&[r.key,r.name,r.wr,r.capMul,r.pf]}));
 const p=planProgression('2026-11-23');o.level=p.level;o.note=p.note;
 o.todo=todoItems().map(x=>x.t);return o;}"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--update", action="store_true"); ap.add_argument("--file", default=os.path.join(HERE, "..", "index.html")); ap.add_argument("--budget", type=float, default=250)
    a = ap.parse_args(); Srv.html = open(a.file, "rb").read()
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Srv); threading.Thread(target=srv.serve_forever, daemon=True).start(); url = f"http://127.0.0.1:{srv.server_port}/"
    res, fails = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch()
        def page(s, throttle=1):
            ctx = b.new_context(viewport={"width": 390, "height": 800}, service_workers="block"); pg = ctx.new_page(); errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:150])); pg.on("dialog", lambda d: d.dismiss())
            pg.clock.set_fixed_time(NOW)
            pg.add_init_script("if(!localStorage.getItem('__seeded')){const s=%s;for(const k in s)localStorage.setItem('half04_'+k,JSON.stringify(s[k]));localStorage.setItem('__seeded','1');}" % json.dumps(s))
            if throttle != 1: ctx.new_cdp_session(pg).send("Emulation.setCPUThrottlingRate", {"rate": throttle})
            return ctx, pg, errs
        for name, atl in (("normal", 45), ("fatigue", 80)):
            ctx, pg, errs = page(seed(atl)); pg.goto(url); pg.wait_for_timeout(600)
            o = pg.evaluate(JS); o["errors"] = errs
            res[name] = {k: (sha(v) if k in ("path", "vol", "blk", "fit", "raceInfo") else v) for k, v in o.items()}; ctx.close()
        ctx, pg, errs = page(seed(45), 4); pg.goto(url); pg.wait_for_timeout(600)
        ms = statistics.median(pg.evaluate("()=>{const a=performance.now();init();return performance.now()-a}") for _ in range(5)); ctx.close()
        Srv.delay = 0.8; ctx, pg, errs = page(seed(45)); pg.goto(url); pg.wait_for_load_state("load"); t0 = time.time(); pg.reload(wait_until="domcontentloaded"); fcp = (time.time() - t0) * 1000; ctx.close(); b.close()
    if a.update:
        json.dump(res, open(os.path.join(HERE, "golden.json"), "w"), indent=1, ensure_ascii=False); print("golden.json réécrit"); return
    gold = json.load(open(os.path.join(HERE, "golden.json")))
    for sc in res:
        for k in res[sc]:
            if res[sc][k] != gold.get(sc, {}).get(k): fails.append(f"[{sc}] {k} : attendu {str(gold.get(sc,{}).get(k))[:90]} / obtenu {str(res[sc][k])[:90]}")
    if ms > a.budget: fails.append(f"démarrage trop lent : {ms:.0f} ms (budget {a.budget:.0f} ms, CPU ×4)")
    if fcp > 600: fails.append(f"page prête trop tard (config.js bloque) à la 2e visite : {fcp:.0f} ms (réseau simulé : +800 ms)")
    print(f"démarrage {ms:.0f} ms (CPU ×4) · page prête à la 2e visite {fcp:.0f} ms (config.js à +800 ms)")
    print("OK : aucune régression" if not fails else "ÉCHEC :\n- " + "\n- ".join(fails)); sys.exit(1 if fails else 0)
main()
