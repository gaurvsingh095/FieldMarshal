import asyncio, time, json
from playwright.async_api import async_playwright
GL=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
CAP="""(t)=>{let d=document.getElementById('__cap');if(!d){d=document.createElement('div');d.id='__cap';d.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:99999;background:rgba(6,20,15,.93);color:#eafff1;border:1px solid #3cd6aa;border-radius:12px;padding:14px 26px;font:600 22px system-ui,sans-serif;letter-spacing:.2px;box-shadow:0 10px 40px #000a;max-width:1300px;text-align:center;transition:opacity .3s';document.body.appendChild(d)}d.style.opacity=t?1:0;d.innerHTML=t||''}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(channel='chrome',headless=True,args=GL)
        ctx=await b.new_context(viewport={'width':1600,'height':1000},record_video_dir='video/raw',record_video_size={'width':1600,'height':1000})
        pg=await ctx.new_page()
        T0=time.time();marks=[]
        async def cap(t,kind='hold'):
            marks.append({'t':time.time()-T0,'kind':kind,'text':t});await pg.evaluate(CAP,t)
        async def click(sel): await pg.evaluate("(s)=>document.querySelector(s).click()",sel)
        async def sel(id,v): await pg.evaluate("([id,v])=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change'))}",[id,v])
        await pg.goto('http://localhost:8080/',wait_until='networkidle')
        await pg.wait_for_function("document.getElementById('render-status').dataset.state==='ok'",timeout=20000)
        await pg.evaluate("document.querySelector('header').scrollIntoView()")
        await cap('FieldMarshal: live WebGL digital twin of a synthetic Yuma winter-vegetable farm');await pg.wait_for_timeout(3500)
        box=await pg.locator('.webgl-canvas').bounding_box();cx,cy=box['x']+box['width']*.55,box['y']+box['height']*.6
        await cap('8 synthetic fields (romaine, iceberg, broccoli, spinach, alfalfa…), canal, depot, 3 tractors');
        await pg.mouse.move(cx,cy);await pg.mouse.down();await pg.mouse.move(cx+260,cy+10,steps=45);await pg.mouse.up();await pg.wait_for_timeout(600)
        await pg.mouse.wheel(0,-350);await pg.wait_for_timeout(1500)
        await sel('camera','aerial');await pg.wait_for_timeout(500)
        await cap('Each tractor is dispatched to compatible work: sprayer, forage mower, quick-change');
        await sel('speed','160')
        await cap('Each tractor is dispatched to compatible work: sprayer, forage mower, quick-change','fast');await click('#play');await pg.wait_for_timeout(3600);await click('#play')
        xy=await pg.evaluate("""(id)=>{const tw=window.__fieldmarshal.twin();const v=tw.tractorVisuals.get(id);const p=v.grp.position.clone();p.y=1.5;p.project(tw.camera);const r=tw.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height}}""",'T-01')
        await pg.mouse.click(xy['x'],xy['y']);await pg.wait_for_timeout(300)
        await cap('Click any tractor: live assignment, fuel, and a plain-language WHY for the decision');await pg.wait_for_timeout(5200)
        await click('#close-inspector')
        await cap('Pinal Basin: cotton, alfalfa and silage corn, with a different fleet and job mix');
        await sel('region','pinal');await pg.wait_for_timeout(500)
        await sel('camera','low');await pg.wait_for_timeout(2600)
        await sel('speed','160')
        await cap('Run incident demo: the same scripted event schedule used for the benchmark');
        await click('#guided');marks.append({'t':time.time()-T0,'kind':'fast'})
        await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=23",timeout=60000);await click('#play')
        await cap('T+22: Atlas (T-01) breaks down mid-job. J-03 is released with its 46% progress kept and re-dispatched');await pg.wait_for_timeout(5500)
        marks.append({'t':time.time()-T0,'kind':'fast'});await click('#play');await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=51",timeout=60000);await click('#play')
        await cap('T+50: road F-01↔F-02 closes under Cedar. Only that trip is rerouted (via F-08), and the job stays with Cedar');await pg.wait_for_timeout(5500)
        marks.append({'t':time.time()-T0,'kind':'fast'});await click('#play');await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=86",timeout=60000);await click('#play')
        await cap('T+85: J-01 escalated to priority 5. Idle tractors are re-scored; no field work is abandoned');await pg.wait_for_timeout(4800)
        await sel('speed','30');await click('#play')
        await cap('Tractor motion in 3D is driven by the simulation state at every tick','fast');
        await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=180",timeout=90000)
        await cap('Same scenario, same events, same horizon: FieldMarshal vs first-come-first-served');
        await pg.evaluate("document.getElementById('events').scrollIntoView({behavior:'smooth',block:'center'})");await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('.benchmark').animate([{boxShadow:'0 0 0 0 #3cd6aa'},{boxShadow:'0 0 0 6px #3cd6aa'},{boxShadow:'0 0 0 0 #3cd6aa'}],{duration:1600,iterations:3})")
        await pg.wait_for_timeout(3800)
        await cap('Pinal: 10 vs 9 jobs, 7 vs 6 on time, 10% less travel, 0 violations, 0 lost or duplicated work');await pg.wait_for_timeout(5200)
        await cap('Yuma (same schedule): 16% less travel, but 6 vs 7 on time. Tradeoffs are reported, not hidden');await pg.wait_for_timeout(5200)
        await cap('Reproduce: node --test tests/engine.test.mjs  ·  node src/run-demo.mjs   (synthetic data · simulation only)');await pg.wait_for_timeout(4500)
        marks.append({'t':time.time()-T0,'kind':'end'});json.dump(marks,open('video/marks.json','w'),indent=1)
        await ctx.close();await b.close()
asyncio.run(main())
