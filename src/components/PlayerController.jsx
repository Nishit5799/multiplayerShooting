import React, { useRef, useState, useMemo, useEffect } from "react";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { isHost } from "playroomkit";
import * as THREE from "three";
import Newplayer from "./Newplayer";
import Crosshair from "./Crosshair";
import PlayerInfo from "./PlayerInfo";

const RUN_SPEED = 4.2;
const FIRE_RATE = 280;
const CAMERA_FOLLOW_DISTANCE = 5;
const CAMERA_HEIGHT = 3;
const ROTATION_SPEED = 0.04;
const MOVEMENT_DAMPING = 0.9;

const VERTICAL_AIM_LIMIT = Math.PI / 4; // 45 degrees up/down

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
  z: 0.8,
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
  const [targetRotation, setTargetRotation] = useState(Math.PI); // Start facing backward
  const [verticalAngle, setVerticalAngle] = useState(0);

  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(), []);
  const moveDirection = useMemo(() => new THREE.Vector3(), []);

  const scene = useThree((state) => state.scene);

  const directionalLight = useRef();

  useEffect(() => {
    if (character.current && userPlayer) {
      directionalLight.current.target = character.current;
    }
  }, [character.current]);

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

  useEffect(() => {
    if (state.state.dead) {
      const audio = new Audio("/audios/dead.mp3");
      audio.volume = 0.5;
      audio.play();
    }
  }, [state.state.dead]);

  useEffect(() => {
    if (state.state.health < 100) {
      const audio = new Audio("/audios/hurt.mp3");
      audio.volume = 0.4;
      audio.play();
    }
  }, [state.state.health]);

  useFrame((_, delta) => {
    if (!rigidbody.current || !character.current) return;

    if (state.state.dead) {
      setAnimation("death");
      return;
    }

    // Handle movement
    let velocity = { ...rigidbody.current.linvel() };
    const isPressed = joystick.isJoystickPressed();
    const angle = joystick.angle();

    if (isPressed && angle !== null) {
      // Calculate movement direction relative to character's current rotation
      const moveAngle = angle + character.current.rotation.y;
      moveDirection.set(-Math.sin(moveAngle), 0, -Math.cos(moveAngle));

      // Calculate target rotation based on movement direction
      const newTargetRotation = Math.atan2(moveDirection.x, moveDirection.z);
      setTargetRotation(newTargetRotation);

      // Smoothly rotate character towards movement direction
      character.current.rotation.y = lerpAngle(
        character.current.rotation.y,
        targetRotation,
        ROTATION_SPEED
      );

      // Apply movement
      velocity.x = moveDirection.x * RUN_SPEED;
      velocity.z = moveDirection.z * RUN_SPEED;

      setAnimation("running");
    } else {
      // Apply damping when not moving
      velocity.x *= MOVEMENT_DAMPING;
      velocity.z *= MOVEMENT_DAMPING;
      setAnimation("idle");
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

    rigidbody.current.setLinvel(velocity, true);

    // Network synchronization
    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
    } else {
      const pos = state.getState("pos");
      if (pos) {
        rigidbody.current.setTranslation(pos);
      }
    }

    // Camera follow for user player
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

    // Shooting logic
    if (joystick.isPressed("fire")) {
      setAnimation("shooting");
      if (isHost()) {
        if (Date.now() - lastShoot.current > FIRE_RATE) {
          lastShoot.current = Date.now();
          const playerPos = vec3(rigidbody.current.translation());

          // Calculate bullet position with vertical offset
          const crosshairOffset = new THREE.Vector3(
            WEAPON_OFFSET.x,
            WEAPON_OFFSET.y + Math.sin(verticalAngle) * 0.5,
            WEAPON_OFFSET.z
          );

          // Apply player's rotation to the offset
          const worldOffset = crosshairOffset
            .clone()
            .applyQuaternion(character.current.quaternion);

          const bulletPos = {
            x: playerPos.x + worldOffset.x,
            y: playerPos.y + worldOffset.y,
            z: playerPos.z + worldOffset.z,
          };

          // Calculate bullet direction with vertical angle
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
        type={isHost() ? "dynamic" : "kinematicPosition"}
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
        <PlayerInfo state={state.state} />
        <group ref={character}>
          <Newplayer animation={animation} />
          {userPlayer && (
            <Crosshair
              position={[WEAPON_OFFSET.x, WEAPON_OFFSET.y, WEAPON_OFFSET.z]}
              verticalAngle={verticalAngle}
            />
          )}
          {userPlayer && (
            <directionalLight
              ref={directionalLight}
              position={[25, 18, -25]}
              intensity={0.3}
              castShadow={!downgradedPerformance}
              shadow-camera-near={0}
              shadow-camera-far={100}
              shadow-camera-left={-20}
              shadow-camera-right={20}
              shadow-camera-top={20}
              shadow-camera-bottom={-20}
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-bias={-0.0001}
            />
          )}
        </group>
        <CapsuleCollider args={[0.3, 0.64]} position={[0, 1, 0]} />
      </RigidBody>
    </group>
  );
};

export default PlayerController;
