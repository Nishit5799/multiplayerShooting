import { Billboard, Text } from "@react-three/drei";
import React, { useEffect, useRef, useState } from "react";

const PlayerInfo = ({ state, onHealthUpdate }) => {
  const [displayHealth, setDisplayHealth] = useState(state.health);
  const lastHealthChangeTime = useRef(Date.now());
  const animationRef = useRef();
  const refillIntervalRef = useRef();
  const currentHealthRef = useRef(state.health); // Track current health in a ref

  // Health refill configuration
  const REFILL_DELAY = 7000; // 7 seconds before refill starts
  const REFILL_INTERVAL = 1000; // 1 second between refill steps
  const REFILL_AMOUNT = 10; // Health restored per step

  // Sync the ref with displayHealth
  useEffect(() => {
    currentHealthRef.current = displayHealth;
  }, [displayHealth]);

  useEffect(() => {
    // When health changes externally (like from damage or respawn)
    if (state.health !== displayHealth) {
      // Cancel any ongoing refill
      if (refillIntervalRef.current) {
        clearInterval(refillIntervalRef.current);
        refillIntervalRef.current = null;
      }

      // Update display to match actual health
      setDisplayHealth(state.health);
      currentHealthRef.current = state.health;

      // Reset the timer for refill delay
      lastHealthChangeTime.current = Date.now();
    }
  }, [state.health]);

  useEffect(() => {
    const checkHealthRefill = () => {
      const now = Date.now();
      const timeSinceLastChange = now - lastHealthChangeTime.current;

      // Check if we should start refilling
      if (
        timeSinceLastChange > REFILL_DELAY &&
        currentHealthRef.current < 100 &&
        !refillIntervalRef.current
      ) {
        startRefillProcess();
      }

      animationRef.current = requestAnimationFrame(checkHealthRefill);
    };

    animationRef.current = requestAnimationFrame(checkHealthRefill);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (refillIntervalRef.current) clearInterval(refillIntervalRef.current);
    };
  }, []);

  const startRefillProcess = () => {
    // Clear any existing interval just in case
    if (refillIntervalRef.current) {
      clearInterval(refillIntervalRef.current);
    }

    // Start a new interval for continuous refill
    refillIntervalRef.current = setInterval(() => {
      const newHealth = Math.min(currentHealthRef.current + REFILL_AMOUNT, 100);

      // Update both the ref and the state
      currentHealthRef.current = newHealth;
      setDisplayHealth(newHealth);
      onHealthUpdate(newHealth);

      // Stop if we reached max health
      if (newHealth >= 100) {
        clearInterval(refillIntervalRef.current);
        refillIntervalRef.current = null;
      }
    }, REFILL_INTERVAL);
  };

  const name = state.profile.name;
  return (
    <Billboard position-y={2.5}>
      <Text position-y={0.36} fontSize={0.2}>
        {name}
        <meshBasicMaterial color={state.profile.color} />
      </Text>
      <mesh position-z={-0.1}>
        <planeGeometry args={[1, 0.09]} />
        <meshBasicMaterial color="black" transparent opacity={0.5} />
      </mesh>
      <mesh
        scale-x={displayHealth / 100}
        position-x={-0.5 * (1 - displayHealth / 100)}
      >
        <planeGeometry args={[1, 0.09]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </Billboard>
  );
};

export default PlayerInfo;
