import * as T from './vendor/three.module.min.js';
import {computeViewports,playerCameraPose} from './viewports.mjs';
export function createScene(canvas){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene();scene.fog=new T.Fog(0x352943,30,65);const camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(13.5,16,19);camera.lookAt(0,0,0);
 const playerCameras=[0,1].map(()=>new T.PerspectiveCamera(64,1,.08,100));
 scene.add(new T.HemisphereLight(0xf6edff,0x574771,2.2));const sun=new T.DirectionalLight(0xffefce,3);sun.position.set(-8,16,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;scene.add(sun);
 const mat=(c,r=1)=>new T.MeshStandardMaterial({color:c,roughness:r});const cream=mat(0xf7f3d8),purple=mat(0x413252),mint=mat(0x579986),outer=mat(0x6fafa1),dark=mat(0x30263e);
 function box(w,h,d,m,x=0,y=0,z=0){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.receiveShadow=true;scene.add(o);return o;}
 function sphere(r,m,x,y,z,parent=scene){const o=new T.Mesh(new T.SphereGeometry(r,16,12),m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
 box(30,.3,34,purple,0,-.42,0);box(10.6,.2,18.4,outer,0,-.16,0);box(6.1,.06,13.4,mint,0,-.02,0);
 const kitchen=mat(0x8fc5ad);box(6.1,.025,2.13,kitchen,0,.025,1.065);box(6.1,.025,2.13,kitchen,0,.025,-1.065);
 function line(x,z,w,d){box(w,.025,d,cream,x,.05,z);}for(const x of [-3.05,3.05])line(x,0,.045,13.4);for(const z of [-6.7,-2.13,2.13,6.7])line(0,z,6.1,.045);line(0,4.415,.045,4.57);line(0,-4.415,.045,4.57);
 for(const x of [-3.4,3.4])box(.1,1.12,.1,dark,x,.55,0);box(6.9,.045,.06,cream,0,.93,0);
 const netGeo=new T.BufferGeometry(),positions=[];for(let i=0;i<=40;i++){const x=-3.4+i*.17;positions.push(x,.06,0,x,.91,0);}for(let i=0;i<=8;i++)positions.push(-3.4,.05+i*.105,0,3.4,.05+i*.105,0);netGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));scene.add(new T.LineSegments(netGeo,new T.LineBasicMaterial({color:0x293e37,transparent:true,opacity:.65})));
 for(const x of [-6.6,6.6]){box(.6,.4,12,dark,x,.1,0);for(const z of [-5.5,0,5.5]){box(1.1,.22,1.9,mat(0x785c8d),x,.45,z);box(.12,.6,1.9,dark,x+(x>0?.4:-.4),.65,z);} }
 const treeMat=mat(0xabbf80);for(const x of [-10,10])for(const z of [-10,-4,4,10]){const trunk=box(.16,1,.16,mat(0x7e5a67),x,.3,z);const crown=new T.Mesh(new T.ConeGeometry(.8,2,7),treeMat);crown.position.set(x,1.4,z);crown.castShadow=true;scene.add(crown);}
 function label(text,color,w=5,h=1){const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#2c203c';ctx.fillRect(0,0,768,160);ctx.fillStyle=color;ctx.font='bold 76px Arial';ctx.textAlign='center';ctx.fillText(text,384,104);const tex=new T.CanvasTexture(c),m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});const o=new T.Mesh(new T.PlaneGeometry(w,h),m);return o;}
 const banner=label('CAHK  ARENA','#d7ff72',6.8,1.25);banner.position.set(0,1,-9.4);scene.add(banner);
 const playerMats=[mat(0x66e2df),mat(0xff9c7c)],skin=mat(0xf2c6a3),shoe=mat(0xfff4e2);const players=playerMats.map((shirt,i)=>{
   const group=new T.Group();scene.add(group);const body=new T.Mesh(new T.CapsuleGeometry(.25,.4,4,10),shirt);body.position.y=.95;body.castShadow=true;group.add(body);sphere(.23,skin,0,1.6,0,group);const hair=sphere(.235,mat(i?0x523245:0x382b3a),0,1.69,-.045,group);hair.scale.y=.6;
   const legs=[];for(const x of [-.14,.14]){const leg=new T.Mesh(new T.CapsuleGeometry(.085,.38,4,8),dark);leg.position.set(x,.38,0);leg.castShadow=true;group.add(leg);legs.push(leg);const foot=new T.Mesh(new T.BoxGeometry(.16,.12,.28),shoe);foot.position.set(x,.09,.05);group.add(foot);}
   const arm=new T.Group();arm.position.set(.26,1.12,0);group.add(arm);const hand=new T.Mesh(new T.CapsuleGeometry(.07,.4,4,8),skin);hand.rotation.z=-.7;hand.position.set(.16,-.12,0);arm.add(hand);const paddle=new T.Mesh(new T.CylinderGeometry(.21,.21,.07,18),mat(i?0xfb8061:0x2ab6b2));paddle.rotation.x=Math.PI/2;paddle.position.set(.43,-.25,.1);arm.add(paddle);const grip=new T.Mesh(new T.CylinderGeometry(.04,.04,.25,8),dark);grip.position.set(.34,-.46,.1);arm.add(grip);return {group,arm,legs,lastX:0,lastZ:0};
 });
 const ball=sphere(.105,mat(0xe7ff64),0,1,4.2),shadow=new T.Mesh(new T.CircleGeometry(.16,20),new T.MeshBasicMaterial({color:0x22372e,transparent:true,opacity:.4}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.065;scene.add(shadow);
 // Each player sees a handheld paddle attached to their own camera. The cameras
 // use distinct layers, so the other view and overview never show these paddles.
 const firstPersonArms=playerCameras.map((cam,i)=>{scene.add(cam);cam.layers.enable(i+1);const arm=new T.Group();arm.position.set(.4,-.4,-.72);arm.rotation.set(-.18,-.22,.15);cam.add(arm);
   const face=new T.Mesh(new T.CylinderGeometry(.19,.19,.055,24),playerMats[i]);face.rotation.x=Math.PI/2;face.position.y=.12;arm.add(face);
   const edge=new T.Mesh(new T.TorusGeometry(.19,.018,8,28),cream);edge.position.set(0,.12,.03);arm.add(edge);
   const handle=new T.Mesh(new T.CylinderGeometry(.035,.035,.26,10),dark);handle.position.y=-.17;arm.add(handle);
   const hand=new T.Mesh(new T.CapsuleGeometry(.065,.12,4,8),skin);hand.position.set(0,-.2,.015);arm.add(hand);
   arm.traverse(o=>o.layers.set(i+1));return arm;
 });
 let width=0,height=0;const resize=()=>{const r=canvas.getBoundingClientRect(),w=Math.round(r.width),h=Math.round(r.height);if(w===width&&h===height)return;width=w;height=h;if(width>0&&height>0)renderer.setSize(width,height,false);};
 const observer=new ResizeObserver(resize);observer.observe(canvas);let lost=false;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;});canvas.addEventListener('webglcontextrestored',()=>{lost=false;});
 return {draw(g,time,{layout='split',overview=true}={}){if(lost)return;resize();if(!width||!height)return;canvas.dataset.layout=layout;canvas.dataset.stacked=String(width/height<1.1);canvas.dataset.overview=String(layout==='split'&&overview);
   players.forEach((v,i)=>{const p=g.players[i],walking=Math.hypot(p.x-v.lastX,p.z-v.lastZ)>.001;v.group.position.set(p.x,0,p.z);v.group.rotation.y=i?Math.PI:0;v.arm.rotation.x=-p.pose*1.7;v.arm.rotation.z=p.pose*.8;v.legs.forEach((l,j)=>l.rotation.x=walking?Math.sin(time*12+j*Math.PI)*.38:0);v.lastX=p.x;v.lastZ=p.z;firstPersonArms[i].rotation.x=-.18-p.pose*.95;firstPersonArms[i].rotation.z=.15-p.pose*.6;});
   ball.position.set(g.ball.x,Math.max(.1,g.ball.y),g.ball.z);ball.rotation.x+=.05;shadow.position.x=g.ball.x;shadow.position.z=g.ball.z;shadow.material.opacity=.45/(1+g.ball.y*.3);
   renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.setClearColor(0x352943,1);renderer.clear();renderer.setScissorTest(true);renderer.autoClear=false;
   for(const view of computeViewports(width,height,{layout,overview})){
     const {x,y,width:w,height:h}=view;
     if(view.inset){renderer.setViewport(x-3,y-3,w+6,h+6);renderer.setScissor(x-3,y-3,w+6,h+6);renderer.setClearColor(0xd7ff72,1);renderer.clear();}
     renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setClearColor(0x352943,1);renderer.clear();
     let activeCamera=camera;
     if(view.kind==='player'){
       const i=view.player,pose=playerCameraPose(g.players[i],i);activeCamera=playerCameras[i];activeCamera.position.set(pose.eye.x,pose.eye.y,pose.eye.z);activeCamera.lookAt(pose.target.x,pose.target.y,pose.target.z);activeCamera.aspect=w/h;activeCamera.fov=w/h<.8?74:64;activeCamera.updateProjectionMatrix();players[i].group.visible=false;
     }else{camera.aspect=w/h;camera.fov=w/h<1.2?52:38;camera.updateProjectionMatrix();}
     renderer.render(scene,activeCamera);players.forEach(p=>p.group.visible=true);
   }
   renderer.autoClear=true;renderer.setScissorTest(false);
 },dispose(){observer.disconnect();renderer.dispose();}};
}
