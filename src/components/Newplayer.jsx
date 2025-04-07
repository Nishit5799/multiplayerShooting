import React, { useEffect, useMemo, useRef } from "react";
import { useGraph } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import { LoopOnce } from "three";

export default function Newplayer({
  animation = "idle",

  ...props
}) {
  const group = useRef();
  const { scene, animations } = useGLTF("/newplayer.glb");
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);
  const { actions } = useAnimations(animations, group);

  if (actions["death"]) {
    actions["death"].loop = LoopOnce;
    actions["death"].clampWhenFinished = true;
  }
  useEffect(() => {
    // Reset and fade in the selected animation, default to "idle" if no animation is provided
    actions[animation]?.reset().fadeIn(0.24).play();

    return () => actions?.[animation]?.fadeOut(0.24); // Clean up on unmount or animation change
  }, [animation, actions]);
  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="Armature">
          <primitive object={nodes.mixamorigHips} />
          <primitive object={nodes.Ctrl_Master} />
          <primitive object={nodes.Ctrl_ArmPole_IK_Left} />
          <primitive object={nodes.Ctrl_Hand_IK_Left} />
          <primitive object={nodes.Ctrl_ArmPole_IK_Right} />
          <primitive object={nodes.Ctrl_Hand_IK_Right} />
          <primitive object={nodes.Ctrl_Foot_IK_Left} />
          <primitive object={nodes.Ctrl_LegPole_IK_Left} />
          <primitive object={nodes.Ctrl_Foot_IK_Right} />
          <primitive object={nodes.Ctrl_LegPole_IK_Right} />
          <skinnedMesh
            name="Ch14"
            geometry={nodes.Ch14.geometry}
            material={materials.Ch14_Body}
            skeleton={nodes.Ch14.skeleton}
          />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/newplayer.glb");
