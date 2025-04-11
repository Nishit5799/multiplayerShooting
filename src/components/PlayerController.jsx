import React, { useRef, useState, useMemo, useEffect } from "react";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { isHost } from "playroomkit";
import * as THREE from "three";
import Newplayer from "./Newplayer";
import Crosshair from "./Crosshair";
import PlayerInfo from "./PlayerInfo";

const RUN_SPEED = 5;
const FIRE_RATE = 280;
const CAMERA_FOLLOW_DISTANCE = 4.5;
const CAMERA_HEIGHT = 3;
const ROTATION_SPEED = 0.04;
const MOVEMENT_DAMPING = 0.9;
const NETWORK_LERP_FACTOR = 0.2;

const VERTICAL_AIM_LIMIT = Math.PI / 4;

// Preload audio files
const hurtAudio =
  typeof Audio !== "undefined" ? new Audio("/audios/hurt.mp3") : null;
const deadAudio =
  typeof Audio !== "undefined" ? new Audio("/audios/dead.mp3") : null;

if (hurtAudio) {
  hurtAudio.preload = "auto";
  hurtAudio.volume = 0.4;
  hurtAudio.load();
}

if (deadAudio) {
  deadAudio.preload = "auto";
  deadAudio.volume = 0.5;
  deadAudio.load();
}

const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

const lerpAngle = (start, end, t) => {
  start = normalizeAngle(start);
  end = normalizeAngle(end);

  if (Math.abs(end - start) > Math.PI) {
    if (end > start) {
      start += 2 * Math.PI;
    } else {
      end += 2 * Math.PI;
    }
  }

  return normalizeAngle(start + (end - start) * t);
};

export const WEAPON_OFFSET = {
  x: -0.1,
  y: 1,
  z: 1.5,
};

const PlayerController = ({
  state,
  joystick,
  userPlayer,
  onFire,
  onKilled,
  downgradedPerformance,
  ...props
}) => {
  const group = useRef();
  const character = useRef();
  const rigidbody = useRef();
  const lastShoot = useRef(0);
  const { camera } = useThree();

  const [animation, setAnimation] = useState("idle");
  const [targetRotation, setTargetRotation] = useState(0);
  const [verticalAngle, setVerticalAngle] = useState(0);

  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(), []);

  const scene = useThree((state) => state.scene);

  const spawnRandomly = () => {
    const spawns = [];
    for (let i = 0; i < 1000; i++) {
      const spawn = scene.getObjectByName(`spawn_${i}`);
      if (spawn) {
        spawns.push(spawn);
      } else {
        break;
      }
    }
    const spawnPos = spawns[Math.floor(Math.random() * spawns.length)].position;
    rigidbody.current.setTranslation(spawnPos);
  };

  useEffect(() => {
    if (isHost()) {
      spawnRandomly();
    }
  }, []);

  const playAudio = (audio) => {
    if (!audio) return;

    try {
      if (audio.context === undefined && typeof window !== "undefined") {
        audio.context = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      audio.currentTime = 0;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("Audio play failed, trying to resume context:", error);
          if (audio.context && audio.context.state === "suspended") {
            audio.context.resume().then(() => audio.play());
          }
        });
      }
    } catch (error) {
      console.error("Audio playback error:", error);
    }
  };

  useEffect(() => {
    if (state.state.dead) {
      playAudio(deadAudio);
    }
  }, [state.state.dead]);

  useEffect(() => {
    if (state.state.health < 100) {
      playAudio(hurtAudio);
    }
  }, [state.state.health]);

  const handleHealthUpdate = (newHealth) => {
    if (isHost()) {
      state.setState("health", newHealth);
    }
  };

  useFrame((_, delta) => {
    if (!rigidbody.current || !character.current) return;

    if (state.state.dead) {
      setAnimation("death");
      return;
    }

    // Handle horizontal movement and rotation
    const angle = joystick.angle();
    const isPressed = joystick.isJoystickPressed();
    let velocity = { ...rigidbody.current.linvel() };

    if (isPressed && angle !== null) {
      const characterAngle = character.current.rotation.y;
      const relativeAngle = angle + characterAngle;

      const movement = {
        x: -Math.sin(relativeAngle),
        z: -Math.cos(relativeAngle),
      };

      const newTargetRotation = Math.atan2(movement.x, movement.z);
      setTargetRotation(newTargetRotation);

      character.current.rotation.y = lerpAngle(
        character.current.rotation.y,
        newTargetRotation,
        ROTATION_SPEED
      );

      const speed = RUN_SPEED;
      velocity.x = movement.x * speed;
      velocity.z = movement.z * speed;

      setAnimation("running");
    } else {
      velocity.x *= MOVEMENT_DAMPING;
      velocity.z *= MOVEMENT_DAMPING;
      setAnimation("idle");
    }

    // Apply movement for all players
    rigidbody.current.setLinvel(velocity, true);

    // Network synchronization
    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
      state.setState("rotation", character.current.rotation.y);
      state.setState("animation", animation);
    } else {
      const pos = state.getState("pos");
      const rotation = state.getState("rotation");
      const networkAnimation = state.getState("animation");

      if (pos) {
        const currentPos = vec3(rigidbody.current.translation());
        const newPos = currentPos.lerp(pos, NETWORK_LERP_FACTOR);
        rigidbody.current.setTranslation(newPos);
      }

      if (rotation !== undefined) {
        character.current.rotation.y = rotation;
      }

      if (networkAnimation) {
        setAnimation(networkAnimation);
      }
    }

    // Handle vertical aiming
    if (joystick.isPressed("up")) {
      setVerticalAngle((prev) =>
        Math.max(prev - delta * 2, -VERTICAL_AIM_LIMIT)
      );
    }
    if (joystick.isPressed("down")) {
      setVerticalAngle((prev) =>
        Math.min(prev + delta * 2, VERTICAL_AIM_LIMIT)
      );
    }

    if (userPlayer) {
      const playerPosition = vec3(rigidbody.current.translation());
      const cameraOffset = new THREE.Vector3(
        0,
        CAMERA_HEIGHT,
        -CAMERA_FOLLOW_DISTANCE
      ).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        character.current.rotation.y
      );

      cameraPosition.set(
        playerPosition.x + cameraOffset.x,
        playerPosition.y + cameraOffset.y,
        playerPosition.z + cameraOffset.z
      );

      cameraLookAt.set(
        playerPosition.x,
        playerPosition.y + 1.5,
        playerPosition.z
      );

      camera.position.lerp(cameraPosition, 0.1);
      camera.lookAt(cameraLookAt);
    }

    if (joystick.isPressed("fire")) {
      setAnimation("shooting");
      if (isHost()) {
        if (Date.now() - lastShoot.current > FIRE_RATE) {
          lastShoot.current = Date.now();
          const playerPos = vec3(rigidbody.current.translation());

          const crosshairOffset = new THREE.Vector3(
            WEAPON_OFFSET.x,
            WEAPON_OFFSET.y + Math.sin(verticalAngle) * 0.5,
            WEAPON_OFFSET.z
          );

          const worldOffset = crosshairOffset
            .clone()
            .applyQuaternion(character.current.quaternion);

          const bulletPos = {
            x: playerPos.x + worldOffset.x,
            y: playerPos.y + worldOffset.y,
            z: playerPos.z + worldOffset.z,
          };

          const bulletDirection = new THREE.Vector3(
            0,
            Math.sin(verticalAngle),
            Math.cos(verticalAngle)
          ).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            character.current.rotation.y
          );

          const newBullet = {
            id: state.id + "-" + Date.now(),
            position: bulletPos,
            angle: character.current.rotation.y,
            angleY: verticalAngle,
            direction: [
              bulletDirection.x,
              bulletDirection.y,
              bulletDirection.z,
            ],
            player: state.id,
          };
          onFire(newBullet);
        }
      }
    }
  });

  return (
    <group ref={group} {...props}>
      <RigidBody
        ref={rigidbody}
        colliders={false}
        lockRotations
        gravityScale={9.8}
        type="dynamic"
        onIntersectionEnter={({ other }) => {
          if (
            isHost() &&
            other.rigidBody.userData.type === "bullet" &&
            state.state.health > 0
          ) {
            const newHealth =
              state.state.health - other.rigidBody.userData.damage;
            if (newHealth <= 0) {
              state.setState("deaths", state.state.deaths + 1);
              state.setState("dead", true);
              state.setState("health", 0);
              rigidbody.current.setEnabled(false);
              setTimeout(() => {
                spawnRandomly();
                rigidbody.current.setEnabled(true);
                state.setState("health", 100);
                state.setState("dead", false);
              }, 2000);
              onKilled(state.id, other.rigidBody.userData.player);
            } else {
              state.setState("health", newHealth);
            }
          }
        }}
      >
        <PlayerInfo state={state.state} onHealthUpdate={handleHealthUpdate} />
        <group ref={character} rotation={[0, Math.PI, 0]}>
          <Newplayer animation={animation} />
          {userPlayer && (
            <Crosshair
              position={[WEAPON_OFFSET.x, WEAPON_OFFSET.y, WEAPON_OFFSET.z]}
              verticalAngle={verticalAngle}
            />
          )}
        </group>
        <CapsuleCollider args={[0.3, 0.64]} position={[0, 1, 0]} />
      </RigidBody>
    </group>
  );
};

export default PlayerController;
