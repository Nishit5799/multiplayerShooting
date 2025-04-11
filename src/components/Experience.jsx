"use client";
import React, { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Environment,
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
  const [winner, setWinner] = useState(null);
  const [networkWinner, setNetworkWinner] = useMultiplayerState("winner", null);
  const [countdown, setCountdown] = useState(2);
  const [showInstructions, setShowInstructions] = useState(true); // New state for instructions popup

  useEffect(() => {
    if (networkWinner) {
      setWinner(networkWinner);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 0) {
            clearInterval(timer);
            window.location.reload();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [networkWinner]);

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
    if (isHost()) {
      setNetworkWinner(null);
      setCountdown(2);
    }

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
    const killerState = players.find((p) => p.state.id === killer)?.state;
    if (!killerState) return;

    const newKills = killerState.state.kills + 1;
    killerState.setState("kills", newKills);

    if (isHost() && newKills >= 5) {
      const winnerName = killerState.state.profile?.name || "Anonymous";
      setNetworkWinner(winnerName);
    }
  };

  return (
    <>
      <Leaderboard />
      {/* Instructions Popup */}
      {showInstructions && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <div className="bg-white p-5 rounded-lg text-center max-w-md w-full mx-4">
            <h2 className="text-3xl font-bold mb-4">How to Play</h2>
            <div className="text-left space-y-4 mb-3">
              <p className="text-center">
                <strong>You can play in both Portrait and Landscape.</strong>
              </p>
              <p>
                <strong>Movement:</strong> Use the joystick at bottom left
              </p>
              <p>
                <strong>Shoot:</strong> Press the Fire button
              </p>
              <p>
                <strong>Objective:</strong> Eliminate opponents by reducing
                their health to zero. The first player to reach 5 kills wins the
                match.
              </p>

              <p className="text-sm text-gray-600 mt-4">
                Tip: Move strategically and use the environment for cover!
              </p>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {winner && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <div className="bg-white p-8 rounded-lg text-center max-w-md">
            <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
            <p className="text-xl mb-6">{winner} won the game!</p>
            <div className="text-lg">
              Restarting in <span className="font-bold">{countdown}</span>{" "}
              second{countdown !== 1 ? "s" : ""}...
            </div>
          </div>
        </div>
      )}
      <Canvas camera={{ position: [0, 4, 4], fov: 60, near: 2 }} shadows>
        <PerformanceMonitor
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
  );
};

export default Experience;
