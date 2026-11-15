import asyncio, json, sys
from playwright.async_api import async_playwright
GL=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8080/'
SH=(sys.argv[2] if len(sys.argv)>2 else 'artifacts/screenshots/')
res={}
def ok(name,cond,detail=''):
    res[name]={'pass':bool(cond),'detail':detail};print(('PASS ' if cond else 'FAIL ')+name,detail,flush=True)
PROJ="""(id)=>{const tw=window.__fieldmarshal.twin();const v=tw.tractorVisuals.get(id);const p=v.grp.position.clone();p.y=1.5;p.project(tw.camera);const r=tw.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height}}"""
SYNC="""()=>{const e=window.__fieldmarshal.engine(),tw=window.__fieldmarshal.twin();let worst=0;for(const t of e.state.tractors){const v=tw.tractorVisuals.get(t.id);worst=Math.max(worst,Math.hypot(v.target.x-(t.x-50),v.target.z-(t.y-36)))}return worst}"""
async def run_region(pg,region):
    await pg.select_option('#region',region);await pg.wait_for_timeout(600)
    await pg.select_option('#speed','30')
    await pg.click('#guided')
    await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=30",timeout=60000)
    await pg.click('#play')  # pause
    st=await pg.evaluate("(()=>{const e=window.__fieldmarshal.engine();return {t:e.state.time,failed:e.state.tractors.filter(t=>t.state==='failed').map(t=>t.id),ev:e.state.events.filter(x=>['breakdown','recovery'].includes(x.kind)).map(x=>x.message)}})()")
    ok(f'{region}: breakdown injected and job released with progress kept','T-01' in st['failed'] and any('preserved' in m for m in st['ev']),json.dumps(st))
    drift=await pg.evaluate(SYNC);ok(f'{region}: 3D tractor targets equal engine positions',drift<1e-6,f'max drift {drift}')
    await pg.wait_for_timeout(900);await pg.locator('#map-container').screenshot(path=SH+f'{region}-breakdown-3d.png')
    await pg.click('#play')
    await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=90",timeout=90000)
    await pg.click('#play')
    ev=await pg.evaluate("window.__fieldmarshal.engine().state.events.filter(x=>['block','reroute','priority','recovery'].includes(x.kind)).map(x=>x.at+' '+x.kind+' '+x.message)")
    ok(f'{region}: road block + priority change replanned in 3D session',any(' block ' in e for e in ev) and any(' priority ' in e for e in ev),' | '.join(ev))
    await pg.wait_for_timeout(900);await pg.screenshot(path=SH+f'{region}-full-t90.png')
    await pg.click('#play')
    await pg.wait_for_function("window.__fieldmarshal.engine().state.time>=180",timeout=120000)
    m=await pg.evaluate("window.__fieldmarshal.engine().metrics()")
    ok(f'{region}: full horizon, zero violations, no lost/duplicated work',m['violations']==0 and m['progressLost']==0 and m['duplicateTicks']==0,json.dumps({k:m[k] for k in ['completed','ontime','travel','violations','progressLost','duplicateTicks']}))
    return m
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(channel='chrome',headless=True,args=GL)
        pg=await b.new_page(viewport={'width':1600,'height':1000})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL,wait_until='networkidle')
        await pg.wait_for_function("document.getElementById('render-status').dataset.state!=='pending'",timeout=20000)
        st=await pg.evaluate("document.getElementById('render-status').textContent");ok('3D engine ready after first frame',st=='3D engine ready',st)
        await pg.wait_for_timeout(1200)
        # Pixel evidence: read back the actual WebGL drawing buffer
        px=await pg.evaluate("(()=>{const tw=window.__fieldmarshal.twin();tw.renderer.render(tw.scene,tw.camera);const g=tw.renderer.getContext();const w=g.drawingBufferWidth,h=g.drawingBufferHeight;const a=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,a);const cols=new Set();let n=0;for(let i=0;i<a.length;i+=4*97){cols.add((a[i]>>4)+'-'+(a[i+1]>>4)+'-'+(a[i+2]>>4));n++}return {w,h,distinctColors:cols.size,samples:n}})()")
        ok('WebGL drawing buffer contains a rendered scene (not blank)',px['distinctColors']>40,json.dumps(px))
        info=await pg.evaluate("(()=>{const tw=window.__fieldmarshal.twin();let meshes=0,inst=0;tw.scene.traverse(o=>{if(o.isMesh)meshes++;if(o.isInstancedMesh)inst+=o.count});return {meshes,cropInstances:inst,fields:tw.fieldVisuals.size,tractors:tw.tractorVisuals.size}})()")
        ok('Scene contains fields, crop-row instances, tractors',info['fields']==8 and info['tractors']==3 and info['cropInstances']>=1000,json.dumps(info))
        await pg.locator('#map-container').screenshot(path=SH+'yuma-initial-3d.png')
        # Orbit + zoom
        cam0=await pg.evaluate("window.__fieldmarshal.twin().camera.position.toArray()")
        box=await pg.locator('.webgl-canvas').bounding_box();cx,cy=box['x']+box['width']*.6,box['y']+box['height']*.6
        await pg.mouse.move(cx,cy);await pg.mouse.down();await pg.mouse.move(cx+220,cy+30,steps=12);await pg.mouse.up();await pg.wait_for_timeout(500)
        cam1=await pg.evaluate("window.__fieldmarshal.twin().camera.position.toArray()")
        await pg.mouse.wheel(0,-600);await pg.wait_for_timeout(700)
        d=await pg.evaluate("(()=>{const t=window.__fieldmarshal.twin();return t.camera.position.distanceTo(t.controls.target)})()")
        ok('Orbit drag moves camera',sum((a-b)**2 for a,b in zip(cam0,cam1))>4,f'{cam0} -> {cam1}')
        ok('Scroll zoom changes distance',d<150,f'distance {d:.1f}')
        await pg.select_option('#camera','aerial');await pg.wait_for_timeout(300)
        # Run a few minutes so tractors leave the depot, then click one
        for _ in range(12): await pg.click('#step')
        await pg.wait_for_timeout(1500)
        xy=await pg.evaluate(PROJ,'T-02');await pg.mouse.click(xy['x'],xy['y']);await pg.wait_for_timeout(400)
        txt=await pg.evaluate("document.getElementById('map-inspector').hidden?'':document.getElementById('map-inspector').innerText")
        ok('Raycast click selects tractor and shows WHY explanation','T-02' in txt and 'WHY' in txt,txt.replace('\n',' / ')[:220])
        await pg.locator('#map-container').screenshot(path=SH+'yuma-tractor-selected.png')
        # Animation: tractor visually moves between frames toward simulated target
        a=await pg.evaluate("window.__fieldmarshal.twin().tractorVisuals.get('T-02').grp.position.toArray()")
        await pg.click('#step');await pg.wait_for_timeout(250)
        b2=await pg.evaluate("window.__fieldmarshal.twin().tractorVisuals.get('T-02').grp.position.toArray()")
        ok('Tractor mesh animates after a simulation tick',a!=b2,f'{a} -> {b2}')
        # Risk overlay toggles
        await pg.check('#heatmap');await pg.wait_for_timeout(300);await pg.locator('#map-container').screenshot(path=SH+'risk-overlay.png');await pg.uncheck('#heatmap')
        # 2D toggle and back
        await pg.click('#topview');await pg.wait_for_timeout(300)
        vis=await pg.evaluate("getComputedStyle(document.getElementById('farm')).display!=='none' && document.getElementById('farm').querySelectorAll('rect').length>8")
        ok('Tactical 2D view renders same state',vis)
        await pg.locator('#map-container').screenshot(path=SH+'tactical-2d.png')
        await pg.click('#isoview');await pg.wait_for_timeout(300)
        mY=await run_region(pg,'yuma')
        await pg.screenshot(path=SH+'yuma-end-full.png',full_page=True)
        mP=await run_region(pg,'pinal')
        await pg.locator('#map-container').screenshot(path=SH+'pinal-end-3d.png')
        await pg.screenshot(path=SH+'pinal-end-full.png',full_page=True)
        ok('No uncaught page errors (WebGL run)',not errs,'; '.join(errs))
        await b.close()
        # Fallback: WebGL disabled
        b=await p.chromium.launch(channel='chrome',headless=True,args=['--disable-webgl','--disable-3d-apis'])
        pg=await b.new_page(viewport={'width':1600,'height':1000});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL,wait_until='networkidle');await pg.wait_for_function("document.getElementById('render-status').dataset.state!=='pending'",timeout=20000)
        st=await pg.evaluate("document.getElementById('render-status').textContent")
        await pg.click('#step');await pg.click('#breakdown')
        t=await pg.evaluate("window.__fieldmarshal.engine().state.events.some(e=>e.kind==='breakdown')")
        ok('2D fallback when WebGL disabled; sim + breakdown still work','fallback' in st and t and not errs,st)
        await pg.locator('#map-container').screenshot(path=SH+'fallback-2d.png')
        await b.close()
    json.dump(res,open(SH+'e2e-results.json','w'),indent=1)
    print('TOTAL',sum(v['pass'] for v in res.values()),'/',len(res))
asyncio.run(main())
