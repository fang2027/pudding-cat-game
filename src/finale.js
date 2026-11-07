export const DANCE_SECONDS=3.6;
export const FINALE_CENTER=-2.65;

export function poseFinale(object,seconds,index,depthOffset=0){
 const beat=seconds*Math.PI*3;
 const sway=Math.sin(beat+index*.7);
 object.position.set(FINALE_CENTER+(index-1.5)*1.3+sway*.1,.09*Math.sin(beat+index*.4)**2,.82+depthOffset);
 object.rotation.set(0,.22+sway*.23,-sway*.17);
}
