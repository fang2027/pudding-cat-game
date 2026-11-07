import * as THREE from 'three';

export function createGirlWorryPose(model){
 const bones=new Map();
 model.traverse(node=>{if(node.isBone)bones.set(node.userData.name??node.name,node);});
 const names=['DEF-upper_arm.L','DEF-forearm.L','DEF-hand.L','DEF-upper_arm.R','DEF-forearm.R','DEF-hand.R','DEF-foot.L','DEF-foot.R','DEF-spine.006'];
 const [shoulder,elbow,hand,otherShoulder,otherElbow,otherHand,leftFoot,rightFoot,head]=names.map(name=>bones.get(name));
 if(names.some(name=>!bones.has(name)))return ()=>{};
 const rest=new Map([shoulder,elbow,hand,otherShoulder,otherElbow,leftFoot,rightFoot,head].map(bone=>[bone,bone.quaternion.clone()]));
 const local=bone=>model.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
 const shoulderPoint=local(shoulder),elbowPoint=local(elbow),handPoint=local(hand),headPoint=local(head);
 const upper=shoulderPoint.distanceTo(elbowPoint),lower=elbowPoint.distanceTo(handPoint);
 // The cheek surface is near x=.71, y=1.65, z=.57 in the rig's rest pose.
 // Put the wrist below it and aim the fingers up along the outside of the cheek.
 const cheekWrist=head.worldToLocal(model.localToWorld(headPoint.clone().add(new THREE.Vector3(.80,.01,.40))));
 const cheekFingers=head.worldToLocal(model.localToWorld(headPoint.clone().add(new THREE.Vector3(.87,.17,.61))));
 const palmAxis=hand.getWorldPosition(new THREE.Vector3()).sub(elbow.getWorldPosition(new THREE.Vector3()))
  .normalize().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
 // Keep the elbow under the wrist and slightly forward of the torso.
 const pole=new THREE.Vector3(.65,-1,.65);
 const axes=[leftFoot,rightFoot,head].map((bone,i)=>{
  const axis=i===2?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  return axis.applyQuaternion(model.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
 });
 const delta=new THREE.Quaternion(),world=new THREE.Quaternion();
 let weight=0,time=0;

 function aim(bone,child,target){
  const origin=bone.getWorldPosition(new THREE.Vector3());
  const from=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const to=model.localToWorld(target.clone()).sub(origin).normalize();
  delta.setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(world));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(world).invert().multiply(delta));
  bone.updateWorldMatrix(false,true);
 }

 return (dt,worried,dancing)=>{
  time+=dt;
  const next=dancing?0:THREE.MathUtils.damp(weight,Number(worried),9,dt);
  if(next<.001&&weight===0)return;
  weight=next<.001?0:next;
  for(const [bone,rotation] of rest)bone.quaternion.copy(rotation);
  model.updateWorldMatrix(true,true);
  if(!weight)return;

  head.quaternion.multiply(delta.setFromAxisAngle(axes[2],(-.19+.035*Math.sin(time*2))*weight));
  head.updateWorldMatrix(false,true);
  const target=handPoint.clone().lerp(model.worldToLocal(head.localToWorld(cheekWrist.clone())),weight);
  const line=target.clone().sub(shoulderPoint);
  const distance=THREE.MathUtils.clamp(line.length(),Math.abs(upper-lower)+.001,upper+lower-.001);
  line.normalize();
  const bend=pole.clone().addScaledVector(line,-pole.dot(line)).normalize();
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance);
  const elbowTarget=shoulderPoint.clone().addScaledVector(line,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
  aim(shoulder,elbow,elbowTarget);
  aim(elbow,hand,shoulderPoint.clone().addScaledVector(line,distance));
  hand.getWorldQuaternion(world);
  const palm=palmAxis.clone().applyQuaternion(world);
  const fingers=head.localToWorld(cheekFingers.clone()).sub(hand.getWorldPosition(new THREE.Vector3())).normalize();
  delta.setFromUnitVectors(palm,fingers).multiply(world);
  delta.premultiply(hand.parent.getWorldQuaternion(world).invert());
  hand.quaternion.slerp(delta,weight);
  // Keep the relaxed elbow and wrist outside the dress silhouette.
  const relaxed=local(otherShoulder).add(new THREE.Vector3(-.24,-.22,.08).multiplyScalar(upper/.32));
  aim(otherShoulder,otherElbow,local(otherElbow).lerp(relaxed,weight));
  aim(otherElbow,otherHand,local(otherHand).lerp(relaxed.clone().add(new THREE.Vector3(-.14,-.26,.07).multiplyScalar(upper/.32)),weight));
  [leftFoot,rightFoot].forEach((bone,i)=>{
   const angles=[-.32,.32];
   bone.quaternion.multiply(delta.setFromAxisAngle(axes[i],angles[i]*weight));
  });
 };
}
