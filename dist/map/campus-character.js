import {WALK} from './campus-walk.js';

// A single reusable, articulated student. Shared geometry, no skinning or assets.
export function createCampusCharacter(T){
  const root=new T.Group();root.name='campus-student';
  const body=new T.Group(),face=new T.Group();face.name='student-head';root.add(body);body.add(face);
  const materials={skin:new T.MeshLambertMaterial({color:0xe0b08a}),shirt:new T.MeshLambertMaterial({color:0x638e7c}),pants:new T.MeshLambertMaterial({color:0x435d68}),hair:new T.MeshLambertMaterial({color:0x3c3935}),shoes:new T.MeshLambertMaterial({color:0xe9e5d3}),bag:new T.MeshLambertMaterial({color:0xc3a56f})};
  const geometry={box:new T.BoxGeometry(1,1,1),limb:new T.CylinderGeometry(1,1,1,8),head:new T.SphereGeometry(1,12,8),hair:new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI*.52)};
  function mesh(parent,kind,material,x,y,z,w,h,d){const m=new T.Mesh(geometry[kind],materials[material]);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
  mesh(body,'box','shirt',0,1.12,0,.48,.53,.28);mesh(body,'box','pants',0,.81,0,.43,.15,.27);
  mesh(body,'limb','skin',0,1.43,0,.07,.12,.07);mesh(face,'head','skin',0,1.61,0,.17,.19,.17);mesh(face,'hair','hair',0,1.65,.012,.18,.18,.18);
  for(const x of [-.061,.061])mesh(face,'head','hair',x,1.64,-.151,.018,.02,.012);
  mesh(body,'box','bag',0,1.13,.21,.34,.42,.17);
  for(const x of [-.13,.13])mesh(body,'box','bag',x,1.17,-.148,.035,.44,.025);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new T.Group();arm.position.set(side*.31,1.35,0);body.add(arm);
    mesh(arm,'limb','shirt',0,-.13,0,.085,.26,.085);mesh(arm,'limb','skin',0,-.37,0,.065,.24,.065);mesh(arm,'head','skin',0,-.51,0,.07,.08,.065);arms.push(arm);
    const leg=new T.Group();leg.position.set(side*.115,.79,0);root.add(leg);const shin=new T.Group();shin.position.y=-.37;leg.add(shin);
    mesh(leg,'limb','pants',0,-.18,0,.095,.36,.095);mesh(shin,'limb','pants',0,-.18,0,.079,.36,.079);mesh(shin,'box','shoes',0,-.35,-.045,.18,.12,.3);legs.push({leg,shin});
  }
  let phase=0;
  function update(player,{seated=false,firstPerson=false,moving=false,seconds=0}={}){
    root.position.set(player.x,player.y-WALK.eyeHeight,player.z);root.rotation.y=-player.yaw;face.visible=!firstPerson;
    body.position.y=seated?-.4:0;if(moving&&!seated)phase+=Math.min(.1,seconds)*10;else phase=0;
    const swing=player.airborne&&!seated ? .24 : Math.sin(phase)*.52;
    for(let i=0;i<2;i++){const side=i?1:-1;arms[i].rotation.x=seated?1.1:-side*swing*.7;legs[i].leg.position.y=seated ? .39 : .79;legs[i].leg.rotation.x=seated?Math.PI/2:side*swing;legs[i].shin.rotation.x=seated?-Math.PI/2:Math.max(0,-side*swing)*.4;}
  }
  return {root,update,face,dispose(){root.removeFromParent();Object.values(geometry).forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());root.clear();}};
}
