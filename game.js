import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const $=s=>document.querySelector(s), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let scene,camera,renderer,player,clock,started=false,paused=true,health=100,crystals=0,mission=0,exp=0,level=1,velY=0,onGround=true,elapsed=0;
let move={x:0,y:0},keys={},items=[],enemies=[],portals=[],buildings=[],lastInteract=0;
const SAVE='neon-rift-save-v1';
const missions=[
 {name:'Собери 5 кристаллов',need:5,type:'crystal',reward:120},
 {name:'Активируй первый портал',need:1,type:'portal',reward:180},
 {name:'Собери ещё 8 кристаллов',need:8,type:'crystal',reward:220},
 {name:'Найди 3 энергетических маяка',need:3,type:'beacon',reward:250},
 {name:'Доберись до северной башни',need:1,type:'tower',reward:300},
 {name:'Собери 12 кристаллов',need:12,type:'crystal',reward:350},
 {name:'Активируй второй портал',need:1,type:'portal2',reward:400},
 {name:'Победи 3 дронов',need:3,type:'drone',reward:450},
 {name:'Открой район Синего сада',need:1,type:'garden',reward:500},
 {name:'Найди древний артефакт',need:1,type:'artifact',reward:650},
 {name:'Собери 20 кристаллов',need:20,type:'crystal',reward:700},
 {name:'Открой главный разлом',need:1,type:'final',reward:1000}
];
const progress=Array(12).fill(0), flags={portals:new Set(),beacons:new Set(),drones:new Set(),artifact:false,garden:false,tower:false,final:false};
function save(){try{localStorage.setItem(SAVE,JSON.stringify({health,crystals,exp,level,mission,progress,flags:{...flags,portals:[...flags.portals],beacons:[...flags.beacons],drones:[...flags.drones]}}))}catch{}}
function loadSave(){try{const s=JSON.parse(localStorage.getItem(SAVE));if(!s)return;health=s.health??100;crystals=s.crystals??0;exp=s.exp??0;level=s.level??1;mission=s.mission??0;if(Array.isArray(s.progress))s.progress.forEach((v,i)=>progress[i]=v);Object.assign(flags,s.flags||{});for(const k of ['portals','beacons','drones'])flags[k]=new Set(flags[k]||[])}catch{}}
function mat(color,emissive=0){return new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.2,emissive:color,emissiveIntensity:emissive})}
function box(x,y,z,w,h,d,m,group=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o}
function glow(x,y,z,color,r=.6){const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),new THREE.MeshBasicMaterial({color}));o.position.set(x,y,z);scene.add(o);const l=new THREE.PointLight(color,1.2,6);l.position.copy(o.position);scene.add(l);return o}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x080617);scene.fog=new THREE.FogExp2(0x0a071b,.014);
 camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,300);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;$('#game').appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0x8daaff,0x180d2e,2.1));const sun=new THREE.DirectionalLight(0xc6c2ff,2);sun.position.set(18,28,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
 const floor=box(0,-.4,0,180,.8,180,mat(0x17112e));floor.receiveShadow=true;
 const grid=new THREE.GridHelper(180,90,0x7c3aed,0x34265a);grid.position.y=.02;scene.add(grid);
 // Neon skyline and walkable blocks
 const colors=[0x22184b,0x17284d,0x30204d,0x162f40,0x29204f];
 for(let x=-7;x<=7;x++)for(let z=-7;z<=7;z++){
  if(Math.abs(x)<2&&Math.abs(z)<2)continue;
  if(Math.random()<.28){let w=2.5+Math.random()*2,h=2+Math.random()*10,d=2.5+Math.random()*2;let b=box(x*8+(Math.random()-.5),h/2,z*8+(Math.random()-.5),w,h,d,mat(colors[Math.floor(Math.random()*colors.length)]));buildings.push(b);
   for(let y=1.4;y<h-1;y+=2.2){let win=box(b.position.x,y,b.position.z+d/2+.015,w*.7,.12,.03,mat(Math.random()<.5?0x37e8ff:0x9c4dff,1.5));}
  }
 }
 // bridges and luminous lane markings
 for(let i=-5;i<=5;i++){box(i*5,.02,0,.05,.03,150,mat(i%2?0x4b267c:0x1a5e80,1));box(0,.025,i*5,150,.03,.05,mat(0x3b1f6b,1));}
 // player character
 player=new THREE.Group();const body= new THREE.Mesh(new THREE.CapsuleGeometry(.42,.72,4,8),mat(0x6d4aff,.5));body.position.y=.9;body.castShadow=true;player.add(body);
 const visor=box(0,1.18,.34,.42,.17,.08,mat(0x5df7ff,2),player);const pack=box(0,.85,-.3,.48,.5,.2,mat(0x251447),player);player.position.set(0,0,0);scene.add(player);
 // floating crystals
 for(let i=0;i<70;i++){let x=(Math.random()-.5)*125,z=(Math.random()-.5)*125;if(Math.hypot(x,z)<5){x+=10}const g=new THREE.Group();let gem=new THREE.Mesh(new THREE.OctahedronGeometry(.42),mat(0x54f7ff,1.8));g.add(gem);g.position.set(x,.95+Math.random()*1.3,z);scene.add(g);items.push({kind:'crystal',id:'c'+i,mesh:g,baseY:g.position.y,active:true});glow(x,g.position.y,z,0x19ddff,.12)}
 // beacons
 for(let i=0;i<3;i++){let x=[-25,31,4][i],z=[-23,21,43][i];const g=new THREE.Group();box(x,.7,z,.8,1.4,.8,mat(0x422879),g);let ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.09,8,24),mat(0x4af4ff,2));ring.rotation.x=Math.PI/2;ring.position.set(x,1.5,z);g.add(ring);scene.add(g);items.push({kind:'beacon',id:'b'+i,mesh:g,active:true,position:new THREE.Vector3(x,0,z)});}
 // portals
 [[16,-12,0x9c4dff],[-42,38,0x45f5ff],[55,-48,0xf45cff]].forEach(([x,z,c],i)=>{const g=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1,.22,12,40),mat(c,2));ring.position.set(x,2.3,z);g.add(ring);const core=new THREE.Mesh(new THREE.CircleGeometry(1.85,32),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.17,side:THREE.DoubleSide}));core.position.set(x,2.3,z);g.add(core);scene.add(g);portals.push({id:i,mesh:g,pos:new THREE.Vector3(x,0,z),active:false});});
 // drones
 for(let i=0;i<7;i++){const g=new THREE.Group();const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,1),mat(0xff4d9d,1.2));g.add(core);for(let a=0;a<4;a++){let ang=a*Math.PI/2;box(Math.cos(ang)*.85,0,Math.sin(ang)*.85,.55,.08,.12,mat(0x4df6ff,1.5),g)}let x=(Math.random()-.5)*90,z=(Math.random()-.5)*90;g.position.set(x,1.7,z);scene.add(g);enemies.push({id:'d'+i,mesh:g,baseX:x,baseZ:z,hp:2,alive:true,phase:Math.random()*6})}
 // tower / artifact markers
 glow(45,1,-32,0xff50f0,.8);items.push({kind:'tower',id:'tower',position:new THREE.Vector3(45,0,-32),active:true});
 glow(-55,1,-42,0xffd45c,.75);items.push({kind:'artifact',id:'artifact',position:new THREE.Vector3(-55,0,-42),active:true});
 glow(55,1,52,0x44ffff,.8);items.push({kind:'garden',id:'garden',position:new THREE.Vector3(55,0,52),active:true});
 for(let i=0;i<160;i++){const star=new THREE.Mesh(new THREE.SphereGeometry(.045,5,5),new THREE.MeshBasicMaterial({color:Math.random()<.5?0x8a7aff:0x65f8ff}));star.position.set((Math.random()-.5)*150,8+Math.random()*30,(Math.random()-.5)*150);scene.add(star)}
 clock=new THREE.Clock();addEvents();loadSave();updateHUD();animate();
}
function addEvents(){
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6))});
 addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(e.key===' '){e.preventDefault();jump()}if(e.key.toLowerCase()==='e')interact()});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
 const stick=$('#stick'),nub=$('#nub');let pointer=null;
 stick.addEventListener('pointerdown',e=>{pointer=e.pointerId;stick.setPointerCapture(pointer);setStick(e)});stick.addEventListener('pointermove',e=>{if(pointer===e.pointerId)setStick(e)});function setStick(e){const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),len=Math.hypot(dx,dy),m=Math.min(1,len/38);move.x=dx/(len||1)*m;move.y=dy/(len||1)*m;nub.style.transform=`translate(${move.x*34}px,${move.y*34}px)`}function end(e){if(pointer===e.pointerId){pointer=null;move.x=move.y=0;nub.style.transform=''}}stick.addEventListener('pointerup',end);stick.addEventListener('pointercancel',end);
 $('#jump').addEventListener('pointerdown',e=>{e.preventDefault();jump()});$('#interact').addEventListener('pointerdown',e=>{e.preventDefault();interact()});$('#pause').onclick=()=>{paused=true;showOverlay('Пауза','Твой прогресс сохранён. Можешь продолжить исследование города.','ПРОДОЛЖИТЬ')};$('#start').onclick=()=>{started=true;paused=false;$('#overlay').classList.add('hidden');clock.getDelta()};
}
function jump(){if(started&&!paused&&onGround){velY=7.5;onGround=false}}
function notify(s){const t=$('#toast');t.textContent=s;t.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove('show'),2300)}
function showOverlay(title,txt,btn='ПРОДОЛЖИТЬ'){ $('#overlayTitle').textContent=title;$('#overlayText').textContent=txt;$('#start').textContent=btn;$('#overlay').classList.remove('hidden')}
function updateHUD(){ $('#crystals').textContent=crystals;$('#level').textContent=level;$('#hp').textContent=Math.max(0,Math.round(health));const m=missions[Math.min(mission,missions.length-1)];$('#objective').textContent=mission>=missions.length?'Разлом закрыт — свободное исследование':m.name;$('#progress').style.width=(mission>=missions.length?100:clamp(progress[mission]/m.need*100,0,100))+'%';}
function completeMission(){if(mission>=missions.length)return;const m=missions[mission];if(progress[mission]<m.need)return;crystals+=0;exp+=m.reward;if(exp>=level*250){exp-=level*250;level++;health=Math.min(100,health+25);notify('НОВЫЙ УРОВЕНЬ '+level+' · здоровье восстановлено')}notify('МИССИЯ ВЫПОЛНЕНА · +'+m.reward+' XP');mission++;save();updateHUD();if(mission===missions.length){showOverlay('Ты спас город!','Главная сюжетная линия завершена. Исследуй открытый мир, собирай кристаллы и возвращайся к порталам.','ИГРАТЬ ДАЛЬШЕ');paused=true}}
function inc(type,id){if(mission>=missions.length)return;const m=missions[mission];if(m.type===type)progress[mission]++;if(type==='crystal'&&m.type==='crystal'){}if(type==='portal'&&m.type==='portal'){}if(type==='portal2'&&m.type==='portal2'){}if(type==='beacon'&&m.type==='beacon'){}if(type==='drone'&&m.type==='drone'){}if(type==='tower'&&m.type==='tower'){}if(type==='garden'&&m.type==='garden'){}if(type==='artifact'&&m.type==='artifact'){}if(type==='final'&&m.type==='final'){}completeMission();save();updateHUD()}
function interact(){if(!started||paused)return;let best=null,bd=5;for(const it of items){if(!it.active||!it.position)continue;const d=player.position.distanceTo(it.position);if(d<bd){best=it;bd=d}}
 for(const po of portals){const d=player.position.distanceTo(po.pos);if(d<4&&d<bd){best={kind:'portal',portal:po};bd=d}}
 for(const en of enemies){if(en.alive&&player.position.distanceTo(en.mesh.position)<4&&bd>3){best={kind:'drone',enemy:en};bd=3}}
 if(!best){notify('Рядом нет объекта для действия');return}
 if(best.kind==='beacon'){if(flags.beacons.has(best.id)){notify('Маяк уже активирован');return}flags.beacons.add(best.id);best.active=false;best.mesh.scale.setScalar(.01);inc('beacon',best.id);notify('Энергетический маяк активирован')}
 else if(best.kind==='portal'){const po=best.portal;if(po.active){player.position.copy(po.pos).add(new THREE.Vector3(3,0,3));notify('Прыжок через разлом!');return}if(po.id===0&&mission>=1||po.id===1&&mission>=6||po.id===2&&mission>=11){po.active=true;flags.portals.add(po.id);inc(po.id===0?'portal':po.id===1?'portal2':'final',po.id);notify('ПОРТАЛ АКТИВИРОВАН');player.position.copy(po.pos).add(new THREE.Vector3(3,0,3))}else notify('Портал заблокирован. Выполни сюжетные задания.')}
 else if(best.kind==='drone'){const en=best.enemy;en.hp--;notify('Импульс попал в дрон!');if(en.hp<=0){en.alive=false;scene.remove(en.mesh);flags.drones.add(en.id);inc('drone',en.id);crystals+=2;updateHUD()}else health=Math.max(0,health-3)}
 else if(best.kind==='tower'){best.active=false;flags.tower=true;inc('tower');notify('Северная башня найдена')}
 else if(best.kind==='artifact'){best.active=false;flags.artifact=true;inc('artifact');notify('Древний артефакт найден')}
 else if(best.kind==='garden'){best.active=false;flags.garden=true;inc('garden');notify('Синий сад открыт')}
}
function update(dt){elapsed+=dt;const forward=new THREE.Vector3(-Math.sin(camera.rotation.y),0,-Math.cos(camera.rotation.y)),right=new THREE.Vector3(Math.cos(camera.rotation.y),0,-Math.sin(camera.rotation.y));let x=move.x+(keys.d?1:0)-(keys.a?1:0),y=move.y+(keys.s?1:0)-(keys.w?1:0);x=clamp(x,-1,1);y=clamp(y,-1,1);const dir=right.multiplyScalar(x).add(forward.multiplyScalar(-y));if(dir.length()>1)dir.normalize();player.position.addScaledVector(dir,dt*(7+level*.18));player.position.x=clamp(player.position.x,-85,85);player.position.z=clamp(player.position.z,-85,85);if(dir.lengthSq()>.01)player.rotation.y=Math.atan2(dir.x,dir.z);
 velY-=18*dt;player.position.y+=velY*dt;if(player.position.y<=0){player.position.y=0;velY=0;onGround=true}
 // Follow camera: smooth chase, tilt down into the city
 const target=new THREE.Vector3(player.position.x,player.position.y+2.2,player.position.z);const behind=new THREE.Vector3(0,5.4,9.2);behind.applyAxisAngle(new THREE.Vector3(0,1,0),player.rotation.y);const desired=player.position.clone().add(behind);camera.position.lerp(desired,1-Math.exp(-5*dt));camera.lookAt(target);
 for(const it of items){if(!it.active)continue;if(it.kind==='crystal'){it.mesh.rotation.y+=dt*1.3;it.mesh.rotation.x+=dt*.4;it.mesh.position.y=it.baseY+Math.sin(elapsed*2+it.mesh.position.x)*.2;if(player.position.distanceTo(it.mesh.position)<1.45){it.active=false;scene.remove(it.mesh);crystals++;inc('crystal',it.id);notify('+1 НЕОНОВЫЙ КРИСТАЛЛ');}}
 }
 for(const en of enemies){if(!en.alive)continue;en.phase+=dt;en.mesh.position.y=1.7+Math.sin(en.phase*2)*.3;en.mesh.rotation.y+=dt*.8;en.mesh.position.x=en.baseX+Math.sin(en.phase*.5)*2;en.mesh.position.z=en.baseZ+Math.cos(en.phase*.4)*2;if(player.position.distanceTo(en.mesh.position)<1.5){health=Math.max(0,health-dt*5);if(health===0){health=100;player.position.set(0,0,0);notify('Тебя вернуло на старт · здоровье восстановлено')}}}
 for(const po of portals){po.mesh.rotation.y=Math.sin(elapsed)*.15;po.mesh.children[0].rotation.z+=dt*.35}
 updateHUD();
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock?clock.getDelta():0,.035);if(started&&!paused)update(dt);else if(player&&camera){camera.position.lerp(new THREE.Vector3(0,6,11),.02);camera.lookAt(player.position.x,1,player.position.z)}if(renderer)renderer.render(scene,camera)}
init();
