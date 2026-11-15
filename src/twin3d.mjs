/* FieldMarshal true WebGL digital twin. Rendering only: planning remains in engine.mjs.
 * Three.js is loaded from pinned ESM versions; browser falls back to SVG if unavailable. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const C={soil:0x8d6543,road:0xd6bd83,canal:0x397d92,green:0x7bbf6b};
const mat=(color,other={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...other});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const center=f=>({x:f.x+f.w/2,y:f.y+f.h/2});
export class FarmTwin3D {
 constructor(root,onSelect){
  this.root=root;this.onSelect=onSelect;this.ready=false;this.failed=false;this.readyPromise=new Promise((resolve,reject)=>{this._resolveReady=resolve;this._rejectReady=reject});this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#9fb8bd');this.scene.fog=new THREE.FogExp2('#9fb8bd',.0036);
  this.renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;
  this.renderer.domElement.className='webgl-canvas';this.root.appendChild(this.renderer.domElement);this.contextLossHandler=e=>{e.preventDefault();this.failed=true;this._rejectReady?.(new Error('WebGL context lost'));this.root.dispatchEvent(new CustomEvent('fieldmarshal-3d-error',{detail:'WebGL context lost; switch to tactical map and retry 3D.'}))};this.renderer.domElement.addEventListener('webglcontextlost',this.contextLossHandler,false);
  this.camera=new THREE.PerspectiveCamera(44,1,.1,600);this.camera.position.set(67,92,97);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.minDistance=14;this.controls.maxDistance=240;this.controls.maxPolarAngle=Math.PI*.49;this.controls.target.set(0,0,0);this.controls.update();
  this.scene.add(new THREE.HemisphereLight('#dbf7ff','#7a5a3c',1.55));
  const sun=new THREE.DirectionalLight('#fff0c6',3.2);sun.position.set(-35,88,-40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;this.scene.add(sun);
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.targets=[];this.groups=[];this.fieldVisuals=new Map();this.tractorVisuals=new Map();this.lines=[];this.current=null;this.heat=false;this.frame=0;this.focusId=null;
  this.renderer.domElement.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY}});
  this.renderer.domElement.addEventListener('pointerup',e=>{if(!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>7)return;const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects(this.targets,true);if(hits.length){let o=hits[0].object;while(o&&!o.userData.target)o=o.parent;if(o?.userData.target)this.onSelect?.(o.userData.target)} });
  this.resizeObs=new ResizeObserver(()=>this.resize());this.resizeObs.observe(root);this.resize();this.loop=this.loop.bind(this);this.raf=requestAnimationFrame(this.loop);
 }
 xyz(x,y,height=0){return new THREE.Vector3(x-50,height,y-36)}
 addMesh(geometry,material,x,y,z,parent=this.world){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);parent.add(o);return o}
 addBox(w,h,d,col,x,y,z,parent=this.world){const o=this.addMesh(new THREE.BoxGeometry(w,h,d),mat(col),x,y,z,parent);o.castShadow=h>.25;o.receiveShadow=true;return o}
 disposeWorld(){if(!this.world)return;this.scene.remove(this.world);this.world.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)m.dispose?.()}});this.world=null;this.targets=[];this.fieldVisuals.clear();this.tractorVisuals.clear();this.lines=[]}
 setScenario(c){this.disposeWorld();this.cfg=c;this.world=new THREE.Group();this.scene.add(this.world);
  this.addBox(140,.35,112,0xc49d6a,0,-.65,0);
  const rim=this.addBox(114,.25,84,0xd9bc88,0,-.38,0);rim.receiveShadow=true;
  this.addBox(106,.13,77,0xb79463,0,-.24,0);
  this.addBox(96,.12,2.3,0xc2aa7a,-2,.0,-1);
  // Regional levees, irrigation conveyance, and sand tracks (illustrative geometry).
  this.addBox(1.9,.35,80,0x7e7261,-43,-.07,0);this.addBox(1.1,.11,80,0x4b93a8,-43,.15,0);
  this.addBox(1.5,.24,80,0xdfce9e,-45,-.05,0);this.addBox(1.5,.24,80,0xdfce9e,-41,-.05,0);
  this.addBox(100,.14,2.4,0xead4a3,0,.04,0);
  this.addBox(1.85,.14,77,0xd7bd8b,18,.03,0);
  for(let k=0;k<8;k++){const x=-70+k*21;const z=-63+((k*17)%10);const peak=8+((k*13)%11);const shape=new THREE.ConeGeometry(9+((k*5)%7),peak,5);const g=this.addMesh(shape,mat(k%2?0x947963:0xa4896d),x,peak/2-3,z);g.rotation.y=k*.47;g.receiveShadow=true;g.castShadow=false}
  const cropBoxes={};
  c.fields.forEach((f,i)=>{const mid=this.xyz(f.x+f.w/2,f.y+f.h/2);const base=this.addBox(f.w,.24,f.h,0x6a4933,mid.x,-.06,mid.z);base.userData.target={kind:'field',id:f.id};this.targets.push(base);
   const face=this.addBox(f.w-.6,.055,f.h-.6,f.color||0x547e45,mid.x,.10,mid.z);face.material.transparent=true;face.material.opacity=.88;face.userData.target={kind:'field',id:f.id};this.targets.push(face);
   const w=f.w-1,h=f.h-1,nrows=8,ncols=17;
   const bedGeom=new THREE.BoxGeometry(w/(ncols+2),.18,h/(nrows*2.5));const bedMat=mat(f.crop?.toLowerCase().includes('alfalfa')?0xa5ba58:f.color||0x75a75a);
   const plants=new THREE.InstancedMesh(bedGeom,bedMat,nrows*ncols);const m=new THREE.Matrix4();let p=0;
   for(let a=0;a<nrows;a++)for(let b=0;b<ncols;b++){const px=mid.x+(b+.5)*w/ncols-w/2,pz=mid.z+(a+.5)*h/nrows-h/2;const ht=.32+.16*Math.sin(a*17+b*13+i*7);m.makeTranslation(px,.19+ht/2,pz);m.scale(new THREE.Vector3(1,ht/.2,1));plants.setMatrixAt(p++,m)}plants.receiveShadow=true;plants.castShadow=false;this.world.add(plants);
   const border=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(f.w,.22,f.h)),new THREE.LineBasicMaterial({color:0xd4c7a6,transparent:true,opacity:.45}));border.position.set(mid.x,.16,mid.z);this.world.add(border);
   const badge=this.makeBadge(f.id+' · '+f.name,mid.x,.65,mid.z-f.h/2-1.4);badge.userData.target={kind:'field',id:f.id};this.targets.push(badge);
   this.fieldVisuals.set(f.id,{base,face,badge,plants,mid,field:f});
  });
  // Depot yard and three charging / refueling bays.
  const dep=this.xyz(c.depot.x,c.depot.y);this.addBox(11,.24,10,0x72847a,dep.x,-.04,dep.z);this.addBox(4,3.4,5.6,0x2a5149,dep.x-2.1,1.5,dep.z-1.2);
  this.addBox(4.8,.32,6.2,0x80a9a2,dep.x-2.1,3.32,dep.z-1.2);this.addBox(.5,2.7,.55,0x8cb2a5,dep.x+3.3,1.33,dep.z-2.4);
  this.makeBadge('OPS DEPOT',dep.x,1,dep.z+7);
  c.tractors.forEach((t,i)=>this.makeTractor(t,i));this.setCamera('aerial');
 }
 makeBadge(label,x,y,z){const canv=document.createElement('canvas');canv.width=512;canv.height=64;const ctx=canv.getContext('2d');ctx.fillStyle='rgba(8,28,22,.88)';ctx.beginPath();ctx.roundRect(0,0,510,64,12);ctx.fill();ctx.font='bold 34px system-ui,sans-serif';ctx.fillStyle='#e8ffe8';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label.toUpperCase().slice(0,34),256,32);const tx=new THREE.CanvasTexture(canv);tx.colorSpace=THREE.SRGBColorSpace;const obj=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false}));obj.position.set(x,y,z);obj.scale.set(17,2.15,1);this.world.add(obj);return obj}
 makeTractor(t,i){const grp=new THREE.Group();grp.scale.setScalar(1.7);this.world.add(grp);grp.userData.target={kind:'tractor',id:t.id};this.targets.push(grp);
  const chassis=mat([0xf4c75c,0x70cba5,0xffa979][i%3]);const dark=mat(0x193c36),metal=mat(0xbacdd1,{metalness:.45,roughness:.45}),glass=mat(0x84b7c6,{metalness:.2,roughness:.27,transparent:true,opacity:.83});
  const lower=this.addBox(2,.65,3.2,dark.color,0,.72,0,grp);lower.material=dark;
  this.addBox(1.9,.72,1.7,chassis.color,0,1.12,-.7,grp).material=chassis;
  this.addBox(1.55,1.4,1.2,glass.color,0,1.62,1.04,grp).material=glass;
  this.addBox(1.8,.2,1.35,chassis.color,0,2.44,1.04,grp).material=chassis;
  const wheels=[];for(let a of [-1,1])for(let z of [-1.15,1.2]){const wheel=this.addMesh(new THREE.CylinderGeometry(.53,.53,.36,14),mat(0x172622),a*1.05,.55,z,grp);wheel.rotation.z=Math.PI/2;wheel.castShadow=true;const hub=this.addMesh(new THREE.CylinderGeometry(.24,.24,.38,14),metal,a*1.06,.55,z,grp);hub.rotation.z=Math.PI/2;wheels.push(wheel)}
  for(let a of [-1,1])this.addBox(.29,.18,.3,0xffedc4,a*.6,1.37,-1.56,grp);
  this.addBox(.17,.65,.17,0x20312b,-.54,2.77,1.12,grp);
  if(t.capabilities.includes('spray')){this.addBox(6.8,.12,.14,0xb9dbe1,0,.85,2.15,grp);for(let k=-3;k<=3;k++){const tip=this.addBox(.08,.21,.12,0x8bdeee,k,.65,2.2,grp);tip.material.emissive=new THREE.Color(0x122b24)}}
  if(t.capabilities.includes('mow')){const deck=this.addBox(2.75,.22,1.0,0x719b58,0,.28,-2.15,grp);deck.material.roughness=.65}
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.8,2.04,40),new THREE.MeshBasicMaterial({color:0x8df0cb,side:THREE.DoubleSide,transparent:true,opacity:.5}));ring.rotation.x=-Math.PI/2;ring.position.y=.12;grp.add(ring);
  const label=this.makeBadge(t.name+' / '+t.id,0,4.1,0);label.scale.set(9,1.15,1);this.world.remove(label);grp.add(label);const color=t.id==='T-01'?0xf4c75c:t.id==='T-02'?0x70cba5:0xffa979;
  this.tractorVisuals.set(t.id,{grp,wheels,ring,label,color,last:null});
 }
 update(state){if(!state)return;this.current=state;for(const t of state.tractors){const v=this.tractorVisuals.get(t.id);if(!v)continue;const x=t.x-50,z=t.y-36;if(!v.target||Math.hypot(x-v.target.x,z-v.target.z)>25)v.grp.position.set(x,0,z);v.target={x,z};v.state=t.state;
   if(t.state==='failed'){v.ring.material.color.set(0xff4656);v.ring.material.opacity=.8;v.grp.rotation.z=.15}else{v.grp.rotation.z=0;v.ring.material.color.set(t.state==='travel'?0xffcb8d:0x8ff0bb);v.ring.material.opacity=t.state==='idle'?.2:.65}
   v.label.material.opacity=t.state==='failed'?.6:1;
  }
  for(const [fid,visual] of this.fieldVisuals){const jobs=state.jobs.filter(j=>j.field===fid);const p=jobs.length?jobs.reduce((a,j)=>a+j.progress,0)/jobs.length:0;const red=jobs.some(j=>j.priority>=4&&j.state!=='done'&&state.time>=j.deadline*.7);
   visual.face.material.color.set(this.heat?(red?0xd4534b:p>.8?0x4ebc77:0xf0bc64):(visual.field.color||'#608853'));
   visual.face.material.emissive.set(this.heat?(red?0x381412:0x132a1b):0x000000);
  }
  for(const l of this.lines){this.world.remove(l);l.geometry.dispose();l.material.dispose()}this.lines=[];
    for(const t of state.tractors){if(t.state!=='travel'||!t.jobId)continue;const j=state.jobs.find(j=>j.id===t.jobId),jf=j&&this.cfg.fields.find(f=>f.id===j.field),to=jf&&center(jf);if(!to)continue;
   const pts=[this.xyz(t.x,t.y,.48),...(t.route||[]).map(p=>this.xyz(p.x,p.y,.48)),this.xyz(to.x,to.y,.48)];
   const path=new THREE.BufferGeometry().setFromPoints(pts);const curve=new THREE.Line(path,new THREE.LineDashedMaterial({color:0xffe9aa,dashSize:.8,gapSize:.45,linewidth:1}));curve.computeLineDistances();this.world.add(curve);this.lines.push(curve);
  }
 }
 setHeatmap(on){this.heat=!!on;this.update(this.current)}
 setCamera(kind){if(kind==='operator'){this.camera.position.set(-40,19,32);this.controls.target.set(2,0,0)}else if(kind==='low'){this.camera.position.set(57,28,56);this.controls.target.set(0,0,0)}else{this.camera.position.set(62,93,88);this.controls.target.set(0,0,0)}this.controls.update()}
 focus(id){const v=this.tractorVisuals.get(id),f=this.fieldVisuals.get(id);const p=v?.grp.position||f?.mid;if(!p)return;this.controls.target.set(p.x,0,p.z);this.camera.position.set(p.x+13,16,p.z+21);this.controls.update()}
 resize(){const w=Math.max(250,this.root.clientWidth),h=Math.max(200,this.root.clientHeight);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false)}
 loop(){if(this.failed||!this.root.isConnected)return;this.raf=requestAnimationFrame(this.loop);try{this.frame++;this.controls.update();for(const v of this.tractorVisuals.values()){v.ring.scale.setScalar(1+Math.sin(this.frame*.037)*.08);if(v.target){const p=v.grp.position,dx=v.target.x-p.x,dz=v.target.z-p.z,d=Math.hypot(dx,dz);if(d>.002){const k=Math.min(1,.09+.6/Math.max(d,1)*.1);p.x+=dx*k;p.z+=dz*k;if(d>.05&&v.state!=='failed'){/* tractor front (headlights) is local -Z */const want=Math.atan2(-dx,-dz);let diff=want-v.grp.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));v.grp.rotation.y+=diff*.18}for(const w of v.wheels)w.rotation.x-=Math.min(.25,d*.35)}else if(v.state==='working')for(const w of v.wheels)w.rotation.x-=.02}}this.renderer.render(this.scene,this.camera);if(!this.ready){this.ready=true;this._resolveReady?.(true)}}catch(e){this.failed=true;this._rejectReady?.(e);this.root.dispatchEvent(new CustomEvent('fieldmarshal-3d-error',{detail:e.message||String(e)}))}}
 dispose(){this.failed=true;cancelAnimationFrame(this.raf);this.renderer?.domElement?.removeEventListener('webglcontextlost',this.contextLossHandler);this.resizeObs.disconnect();this.controls.dispose();this.disposeWorld();this.renderer.dispose();this.renderer.domElement.remove()}
}
