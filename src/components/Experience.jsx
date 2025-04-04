"use client";
import React, { useEffect,useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, KeyboardControls, SoftShadows } from "@react-three/drei";

import { Physics } from "@react-three/rapier";

import PlayerController from "./PlayerController";

import { insertCoin, Joystick, myPlayer, onPlayerJoin } from "playroomkit";
import { Map } from "./Map";
import Bullet from "./Bullet";

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

  const onFire = (bullet) => {
    setBullets((bullets) => [...bullets, bullet]);
  };

  const onHit = (bulletId) => {
    setBullets((bullets) => bullets.filter((b) => b.id !== bulletId));
  };

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

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas camera={{ position: [0, 4, 4], fov: 60 }} shadows>
        <Environment preset="sunset" />
        <SoftShadows size={42} />
        <Physics>
          {players.map(({ state, joystick }, idx) => (
            <PlayerController
              key={state.id}
              state={state}
              position-x={idx * 2}
              joystick={joystick}
              userPlayer={state.id === myPlayer()?.id}
              onFire={onFire}
            />
          ))}
          {bullets.map((bullet) => (
            <Bullet
              key={bullet.id}
              {...bullet}
              onHit={() => onHit(bullet.id)}
            />
          ))}
          <Map />
        </Physics>
      </Canvas>
    </KeyboardControls>
  );
};

export default Experience;
