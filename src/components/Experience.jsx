"use client";
import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
  KeyboardControls,
  PerformanceMonitor,
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

import Leaderboard from "./Leaderboard";
import BulletHit from "./BulletHit";

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
  const [downgradedPerformance, setDowngradedPerformance] = useState(false);
  const [bullets, setBullets] = useState([]);
  const [networkbullets, setNetworkBullets] = useMultiplayerState(
    "bullets",
    []
  );
  const [hits, setHits] = useState([]);
  const [networkHits, setNetworkHits] = useMultiplayerState("hits", []);

  const onFire = (bullet) => {
    setBullets((bullets) => [...bullets, bullet]);
  };

  const onHit = (bulletId, position) => {
    setBullets((bullets) => bullets.filter((b) => b.id !== bulletId));
    setHits((hits) => [...hits, { id: bulletId, position }]);
  };
  const onHitEnded = (hitId) => {
    setHits((hits) => hits.filter((h) => h.id !== hitId));
  };

  useEffect(() => {
    setNetworkBullets(bullets);
  }, [bullets]);
  useEffect(() => {
    setNetworkHits(hits);
  }, [hits]);
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
        <Leaderboard />
        <Canvas camera={{ position: [0, 4, 4], fov: 60, near: 2 }} shadows>
          <PerformanceMonitor
            // Detect low performance devices
            onDecline={(fps) => {
              setDowngradedPerformance(true);
            }}
          />
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
                downgradedPerformance={downgradedPerformance}
              />
            ))}
            {(isHost() ? bullets : networkbullets).map((bullet) => (
              <Bullet
                key={bullet.id}
                {...bullet}
                onHit={(position) => onHit(bullet.id, position)}
              />
            ))}
            {(isHost() ? hits : networkHits).map((hit) => (
              <BulletHit
                key={hit.id}
                {...hit}
                onEnded={() => onHitEnded(hit.id)}
              />
            ))}
            <Map />
          </Physics>
        </Canvas>
      </>
    </KeyboardControls>
  );
};

export default Experience;
