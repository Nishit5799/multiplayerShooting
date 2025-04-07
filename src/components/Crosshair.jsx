import React from "react";
import * as THREE from "three";

const Crosshair = ({ verticalAngle = 0, ...props }) => {
  // Apply vertical angle to crosshair position
  const crosshairPositions = [
    { z: 1, opacity: 0.9 },
    { z: 2, opacity: 0.85 },
    { z: 3, opacity: 0.8 },
    { z: 4, opacity: 0.7 },
    { z: 5, opacity: 0.6 },
    { z: 6, opacity: 0.2 },
  ];

  return (
    <group {...props}>
      {crosshairPositions.map((pos, i) => (
        <mesh
          key={i}
          position={[0, Math.sin(verticalAngle) * pos.z * 0.1, pos.z]}
        >
          <boxGeometry args={[0.05, 0.05, 0.05]} />
          <meshBasicMaterial color="black" transparent opacity={pos.opacity} />
        </mesh>
      ))}
    </group>
  );
};

export default Crosshair;
