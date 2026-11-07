import {MathUtils} from 'three';

export const LANDING_SECONDS = .26;
const neutral = () => ({phase: 'idle', airborne: false, active: false,
  weight: 0, tuck: 0, reach: 0, launch: 0, landing: 0, pitch: 0, hindStretch: 0});

/** Presentation-only jump state. Physics supplies actual velocity/contact;
 * this never delays a jump, moves the player, or changes platform collisions.
 */
export function createPuddingJump() {
  let wasGrounded = null, startedRising = false, airTime = 0, lastVelocity = 0;
  let landingAge = LANDING_SECONDS, impact = 0, weight = 0, pitch = 0;
  let hindStretch = 0;
  let pose = neutral();
  return {
    update(dt, {grounded = true, verticalVelocity = 0, takeoff = false, landedSpeed = 0, paused = false} = {}) {
      if (paused || dt <= 0) return pose;
      dt = Math.min(dt, .05);
      // Respawning begins ungrounded in the existing physics. Do not mistake
      // that initial placement for a fall or invent a landing squash at spawn.
      if (wasGrounded === null && !grounded && !takeoff) return pose;
      if (!grounded && (wasGrounded !== false || takeoff)) {
        startedRising = takeoff || verticalVelocity > 0;
        airTime = 0; impact = 0; landingAge = LANDING_SECONDS;
      }
      let phase = 'idle', tuck = 0, reach = 0, launch = 0, landing = 0, targetPitch = 0, targetStretch = 0;
      if (!grounded) {
        airTime += dt; weight = MathUtils.damp(weight, 1, 25, dt);
        const rising = MathUtils.clamp(verticalVelocity / 8, 0, 1);
        const descending = MathUtils.clamp(-verticalVelocity / 6, 0, 1);
        const apex = 1 - MathUtils.clamp(Math.abs(verticalVelocity) / 5.5, 0, 1);
        tuck = (startedRising ? .42 + .43 * apex : .18) * (1 - .92 * descending) * weight;
        reach = descending * weight;
        launch = startedRising ? Math.exp(-airTime / .075) * weight : 0;
        // Tilt along the arc: nose up on ascent, level near the apex,
        // nose down on descent. Ease the trailing hind legs toward contact.
        targetPitch = -.40 * rising + .46 * descending;
        targetStretch = 1 - .30 * descending;
        phase = !startedRising ? 'falling' : verticalVelocity > .65 ? 'rising' : verticalVelocity < -.65 ? 'falling' : 'apex';
        lastVelocity = verticalVelocity;
      } else {
        if ((wasGrounded === false && weight > 0) || landedSpeed > 0) {
          landingAge = 0;
          impact = MathUtils.clamp((Math.max(landedSpeed, -lastVelocity) - 1) / 8, .25, 1);
        }
        weight = MathUtils.damp(weight, 0, 28, dt);
        if (weight < 1e-4) weight = 0;
        landingAge = Math.min(LANDING_SECONDS, landingAge + dt);
        landing = landingAge < LANDING_SECONDS ? Math.sin(Math.PI * landingAge / LANDING_SECONDS) * impact : 0;
        targetPitch = landing * .04;
        phase = landing > 0 ? 'landing' : 'idle';
      }
      pitch = MathUtils.damp(pitch, targetPitch, 24, dt);
      hindStretch = MathUtils.damp(hindStretch, targetStretch, 28, dt);
      if (Math.abs(pitch) < 1e-4 && targetPitch === 0) pitch = 0;
      if (hindStretch < 1e-4 && targetStretch === 0) hindStretch = 0;
      wasGrounded = grounded;
      pose = {phase, airborne: !grounded, weight, tuck, reach, launch, landing, pitch, hindStretch,
        active: !grounded || weight > 0 || landing > 0 || pitch !== 0 || hindStretch > 0};
      return pose;
    },
    reset() {
      wasGrounded = null; startedRising = false; airTime = 0; lastVelocity = 0;
      landingAge = LANDING_SECONDS; impact = 0; weight = 0; pitch = 0; hindStretch = 0; pose = neutral();
    },
  };
}
