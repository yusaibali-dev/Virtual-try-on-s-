"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Jewelry3DSceneProps {
  itemType: "earring" | "necklace" | "ring" | "bracelet";
  metalColor?: string;
  gemColor?: string;
}

function JewelryMesh({ itemType, metalColor = "#f59e0b", gemColor = "#06b6d4" }: Jewelry3DSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.8;
    }
  });

  if (itemType === "earring") {
    return (
      <group ref={groupRef}>
        {/* Hook */}
        <mesh position={[0, 0.7, 0]}>
          <torusGeometry args={[0.2, 0.03, 16, 32, Math.PI * 1.3]} />
          <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Connector */}
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.3, 16]} />
          <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Teardrop / Gem */}
        <mesh position={[0, 0, 0]}>
          <octahedronGeometry args={[0.4, 1]} />
          <meshPhysicalMaterial
            color={gemColor}
            metalness={0.1}
            roughness={0.05}
            transmission={0.8}
            ior={2.4}
            thickness={0.5}
          />
        </mesh>
      </group>
    );
  }

  if (itemType === "necklace") {
    return (
      <group ref={groupRef}>
        {/* Curved collar band */}
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[1.2, 0.05, 16, 64, Math.PI]} />
          <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Center Pendant */}
        <mesh position={[0, -0.6, 0.4]}>
          <dodecahedronGeometry args={[0.35, 0]} />
          <meshPhysicalMaterial
            color={gemColor}
            metalness={0.1}
            roughness={0.05}
            transmission={0.85}
            ior={2.4}
          />
        </mesh>
      </group>
    );
  }

  if (itemType === "ring") {
    return (
      <group ref={groupRef} rotation={[Math.PI / 4, 0, 0]}>
        {/* Ring Band */}
        <mesh>
          <torusGeometry args={[0.65, 0.09, 24, 48]} />
          <meshStandardMaterial color={metalColor} metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Crown Setting */}
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.15, 0.1, 0.15, 6]} />
          <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Brilliant Solitaire Gem */}
        <mesh position={[0, 0.8, 0]}>
          <icosahedronGeometry args={[0.25, 0]} />
          <meshPhysicalMaterial
            color={gemColor}
            metalness={0.05}
            roughness={0.05}
            transmission={0.9}
            ior={2.417}
          />
        </mesh>
      </group>
    );
  }

  // Bracelet
  return (
    <group ref={groupRef} rotation={[Math.PI / 4, 0, 0]}>
      {/* Heavy cuff / bangle */}
      <mesh>
        <torusGeometry args={[1.0, 0.14, 24, 48]} />
        <meshStandardMaterial color={metalColor} metalness={0.95} roughness={0.12} />
      </mesh>
      {/* Embedded gems */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.25, 0.18, 0.18]} />
        <meshPhysicalMaterial color={gemColor} metalness={0.1} roughness={0.05} transmission={0.85} />
      </mesh>
    </group>
  );
}

export default function Jewelry3DViewer({
  itemType,
  metalColor,
  gemColor
}: Jewelry3DSceneProps) {
  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 0, 2.5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <pointLight position={[5, 5, 5]} intensity={1.5} />
        <pointLight position={[-5, -5, -5]} intensity={0.8} color="#93c5fd" />
        <JewelryMesh itemType={itemType} metalColor={metalColor} gemColor={gemColor} />
      </Canvas>
    </div>
  );
}
