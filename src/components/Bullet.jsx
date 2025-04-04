import { RigidBody } from "@react-three/rapier";
import React, { useEffect, useRef } from "react";
import { MeshBasicMaterial } from "three";

const BULLET_SPEED = 20;
const bulletMaterial = new MeshBasicMaterial({
  color: "hotpink",
  toneMapped: false,
});
bulletMaterial.color.multiplyScalar(42);

const Bullet = ({ player, angle, position, onHit }) => {
  const rigidbody = useRef();
  useEffect(() => {
    const velocity = {
      x: Math.sin(angle) * BULLET_SPEED,
      y: 0,
      z: Math.cos(angle) * BULLET_SPEED,
    };
    rigidbody.current.setLinvel(velocity, true);
  }, [angle]);

  return (
    <RigidBody
      ref={rigidbody}
      position={[position.x, position.y, position.z]}
      rotation={[0, angle, 0]}
    >
      <mesh position={[0, 0, 0]} material={bulletMaterial} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.5]} />
      </mesh>
    </RigidBody>
  );
};

export default Bullet;
