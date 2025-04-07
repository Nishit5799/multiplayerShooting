"use client";
import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  KeyboardControls,
  Loader,
  SoftShadows,
} from "@react-three/drei";

import { Physics } from "@react-three/rapier";

import PlayerController from "./PlayerController";

import {
  insertCoin,
  isHost,
  Joystick,
  myPlayer,
  onPlayerJoin,
  useMultiplayerState,
} from "playroomkit";
import { Map } from "./Map";
import Bullet from "./Bullet";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import Leaderboard from "./Leaderboard";

const keyboardMap = [
  {
    name: "forward",
    keys: ["ArrowUp", "KeyW"],
  },
  {
    name: "backward",
    keys: ["ArrowDown", "KeyS"],
  },
  {
    name: "left",
    keys: ["ArrowLeft", "KeyA"],
  },
  {
    name: "right",
    keys: ["ArrowRight", "KeyD"],
  },
  {
    name: "run",
    keys: ["Shift"],
  },
  {
    name: "jump",
    keys: ["Space"],
  },
];

const Experience = () => {
  const [players, setPlayers] = useState([]);
  const [bullets, setBullets] = useState([]);
  const [networkbullets, setNetworkBullets] = useMultiplayerState(
    "bullets",
    []
  );

  const onFire = (bullet) => {
    setBullets((bullets) => [...bullets, bullet]);
  };

  const onHit = (bulletId) => {
    setBullets((bullets) => bullets.filter((b) => b.id !== bulletId));
  };

  useEffect(() => {
    setNetworkBullets(bullets);
  }, [bullets]);
  const start = async () => {
    await insertCoin();

    onPlayerJoin((state) => {
      const joystick = new Joystick(state, {
        type: "angular",
        buttons: [{ id: "fire", label: "Fire" }],
      });
      const newPlayer = { state, joystick };
      state.setState("health", 100);
      state.setState("deaths", 0);
      state.setState("kills", 0);
      setPlayers((players) => [...players, newPlayer]);
      state.onQuit(() => {
        setPlayers((players) => players.filter((p) => p.state.id !== state.id));
      });
    });
  };

  useEffect(() => {
    start();
  }, []);

  const onKilled = (_victim, killer) => {
    const killerState = players.find((p) => p.state.id === killer).state;
    killerState.setState("kills", killerState.state.kills + 1);
  };
  return (
    <KeyboardControls map={keyboardMap}>
      <>
        <Loader />
        <Leaderboard />
        <Canvas camera={{ position: [0, 4, 4], fov: 60, near: 2 }} shadows>
          <Environment preset="sunset" />
          <SoftShadows size={42} />
          <Physics>
            {players.map(({ state, joystick }, idx) => (
              <PlayerController
                key={state.id}
                state={state}
                joystick={joystick}
                userPlayer={state.id === myPlayer()?.id}
                onFire={onFire}
                onKilled={onKilled}
              />
            ))}
            {(isHost() ? bullets : networkbullets).map((bullet) => (
              <Bullet
                key={bullet.id}
                {...bullet}
                onHit={() => onHit(bullet.id)}
              />
            ))}
            <Map />
          </Physics>

          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={1} intensity={1.5} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </>
    </KeyboardControls>
  );
};

export default Experience;
