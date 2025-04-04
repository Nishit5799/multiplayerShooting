import React, { useRef, useState, useMemo } from "react";
import { CapsuleCollider, RigidBody, vec3 } from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { isHost } from "playroomkit";
import * as THREE from "three";
import Newplayer from "./Newplayer";

const RUN_SPEED = 4;
const FIRE_RATE = 280;
const CAMERA_FOLLOW_DISTANCE = 3;
const CAMERA_HEIGHT = 3;
const ROTATION_SPEED = 0.1;
const MOVEMENT_DAMPING = 0.9;
const BULLET_SPAWN_OFFSET = 1.2;

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

const PlayerController = ({
  state,
  joystick,
  userPlayer,
  onFire,
  ...props
}) => {
  const group = useRef();
  const character = useRef();
  const rigidbody = useRef();
  const lastShoot = useRef(0);
  const { camera } = useThree();

  const [animation, setAnimation] = useState("idle");
  const [targetRotation, setTargetRotation] = useState(0);

  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!rigidbody.current || !character.current) return;

    const angle = joystick.angle();
    const isPressed = joystick.isJoystickPressed();
    let velocity = { ...rigidbody.current.linvel() };

    if (isPressed && angle !== null) {
      const movement = {
        x: Math.sin(angle),
        z: Math.cos(angle),
      };

      const newTargetRotation = Math.atan2(movement.x, movement.z);
      setTargetRotation(newTargetRotation);

      character.current.rotation.y = lerpAngle(
        character.current.rotation.y,
        targetRotation,
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

    rigidbody.current.setLinvel(velocity, true);

    if (isHost()) {
      state.setState("pos", rigidbody.current.translation());
    } else {
      const pos = state.getState("pos");
      if (pos) {
        rigidbody.current.setTranslation(pos);
      }
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

          const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(
            character.current.quaternion
          );
          forwardVector.multiplyScalar(BULLET_SPAWN_OFFSET);

          const bulletPos = {
            x: playerPos.x + forwardVector.x,
            y: playerPos.y + 0.5,
            z: playerPos.z + forwardVector.z,
          };

          const newBullet = {
            id: state.id + "-" + Date.now(),
            position: bulletPos,
            angle: character.current.rotation.y,
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
      >
        <group ref={character}>
          <Newplayer animation={animation} />
        </group>
        <CapsuleCollider args={[0.3, 0.64]} position={[0, 1, 0]} />
      </RigidBody>
    </group>
  );
};

export default PlayerController;
