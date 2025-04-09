import { RigidBody, vec3 } from "@react-three/rapier";
import { isHost } from "playroomkit";
import React, { useEffect, useRef, useMemo } from "react";
import { MeshBasicMaterial, Quaternion, Vector3 } from "three";

const BULLET_SPEED = 20;
const bulletMaterial = new MeshBasicMaterial({
  color: "hotpink",
  toneMapped: false,
});
bulletMaterial.color.multiplyScalar(42);

// Preload audio
const rifleAudio =
  typeof Audio !== "undefined" ? new Audio("/audios/rifle.mp3") : null;
if (rifleAudio) {
  rifleAudio.preload = "auto";
  rifleAudio.load();
}

const Bullet = ({
  player,
  angle,
  angleY = 0.5,
  position,
  direction,
  onHit,
}) => {
  const rigidbody = useRef();
  const meshRef = useRef();

  // Calculate initial visual rotation
  const initialVisualRotation = useMemo(() => {
    const rot = new Quaternion();
    if (direction) {
      const forward = new Vector3(0, 0, 1);
      const visualDirection = new Vector3(
        direction[0],
        0,
        direction[2]
      ).normalize();
      rot.setFromUnitVectors(forward, visualDirection);
    } else {
      rot.setFromEuler(new THREE.Euler(0, angle, 0));
    }
    return rot;
  }, [direction, angle]);

  useEffect(() => {
    if (rifleAudio) {
      try {
        // Create a new audio context if needed
        if (rifleAudio.context === undefined && typeof window !== "undefined") {
          rifleAudio.context = new (window.AudioContext ||
            window.webkitAudioContext)();
        }

        // Reset audio and play
        rifleAudio.currentTime = 0;
        const playPromise = rifleAudio.play();

        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Audio play failed, trying to resume context:", error);
            if (
              rifleAudio.context &&
              rifleAudio.context.state === "suspended"
            ) {
              rifleAudio.context.resume().then(() => rifleAudio.play());
            }
          });
        }
      } catch (error) {
        console.error("Audio playback error:", error);
      }
    }

    if (direction) {
      // Set physics velocity
      const velocity = {
        x: direction[0] * BULLET_SPEED,
        y: direction[1] * BULLET_SPEED,
        z: direction[2] * BULLET_SPEED,
      };
      rigidbody.current.setLinvel(velocity, true);
    } else {
      // Fallback to angle-based movement
      const horizontalSpeed = Math.cos(angleY) * BULLET_SPEED;
      const velocity = {
        x: Math.sin(angle) * horizontalSpeed,
        y: Math.sin(angleY) * BULLET_SPEED,
        z: Math.cos(angle) * horizontalSpeed,
      };
      rigidbody.current.setLinvel(velocity, true);
    }
  }, [angle, angleY, direction]);

  return (
    <RigidBody
      ref={rigidbody}
      position={[position.x, position.y, position.z]}
      gravityScale={0}
      sensor
      onIntersectionEnter={(e) => {
        if (isHost() && e.other.rigidBody.userData?.type !== "bullet") {
          rigidbody.current.setEnabled(false);
          onHit(vec3(rigidbody.current.translation()));
        }
      }}
      userData={{
        type: "bullet",
        player,
        damage: 10,
      }}
    >
      <mesh
        ref={meshRef}
        position={[0, 0, 0.25]}
        material={bulletMaterial}
        castShadow
        quaternion={initialVisualRotation}
      >
        <boxGeometry args={[0.05, 0.05, 0.5]} />
      </mesh>
    </RigidBody>
  );
};

export default Bullet;
