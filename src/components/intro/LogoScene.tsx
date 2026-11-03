import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Sparkles, useTexture } from "@react-three/drei";
import { CanvasTexture, Group, SRGBColorSpace, PCFShadowMap } from "three";
import relief from "@/assets/trinetra-relief.png.asset.json";

type Palette = { blue: string; gold: string; red: string; light: string; shadow: string };

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(0.15, 0.08, Math.max(9.8, 3.6 / (size.width / size.height)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function Relief({ palette, onReady }: { palette: Palette; onReady: () => void }) {
  const texture = useTexture(relief.url);
  const logo = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const ready = useRef(false);
  useEffect(() => { texture.colorSpace = SRGBColorSpace; }, [texture]);
  useFrame(({ clock }, delta) => {
    if (!ready.current) { ready.current = true; onReady(); }
    const t = clock.elapsedTime;
    if (logo.current) {
      logo.current.rotation.y = Math.sin(t * 0.65) * 0.13;
      logo.current.position.y = Math.sin(t * 0.8) * 0.045;
    }
    if (ring.current) ring.current.rotation.z += Math.min(delta, 0.05) * 0.22;
  });
  return (
    <>
      <group ref={logo} position={[0, 0, 0.12]}>
        {/* Alpha-cut textured layers create shallow relief; they are not a reconstructed solid model. */}
        {[0, 1, 2, 3, 4].map((layer) => (
          <mesh key={layer} position={[0, 0, -0.09 + layer * 0.02]} castShadow>
            <planeGeometry args={[3.3, 3.75]} />
            <meshStandardMaterial map={texture} transparent alphaTest={0.35} color={palette.gold} metalness={0.8} roughness={0.32} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.015]} castShadow>
          <planeGeometry args={[3.3, 3.75]} />
          <meshStandardMaterial map={texture} transparent alphaTest={0.35} metalness={0.42} roughness={0.32} />
        </mesh>
      </group>
      <group ref={ring} position={[0, 0, -0.38]} rotation={[0.15, 0.25, 0]}>
        <mesh castShadow>
          <torusGeometry args={[2.65, 0.025, 8, 96]} />
          <meshStandardMaterial color={palette.gold} metalness={0.95} roughness={0.18} emissive={palette.gold} emissiveIntensity={0.12} />
        </mesh>
        {[0, Math.PI, Math.PI / 2, -Math.PI / 2].map((angle) => (
          <mesh key={angle} position={[Math.cos(angle) * 2.65, Math.sin(angle) * 2.65, 0]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={palette.gold} emissive={palette.gold} emissiveIntensity={1.2} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Backdrop({ palette }: { palette: Palette }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = palette.blue; context.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 256; x += 32) {
        context.fillStyle = palette.light; context.globalAlpha = 0.025;
        context.fillRect(x, 0, 14, 256);
      }
      context.globalAlpha = 1;
    }
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace;
    return result;
  }, [palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0, -0.65]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial map={texture} roughness={0.8} metalness={0.12} />
    </mesh>
  );
}

export default function LogoScene({ onReady, onFailure }: { onReady: () => void; onFailure: () => void }) {
  const palette = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    // Three's CSS parser requires comma-separated HSL, unlike modern browser CSS.
    const color = (name: string) => `hsl(${styles.getPropertyValue(name).trim().split(/\s+/).join(",")})`;
    return { blue: color("--intro-blue"), gold: color("--intro-gold"), red: color("--intro-red"), light: color("--intro-light"), shadow: color("--intro-shadow") };
  }, []);
  return (
    <Canvas shadows={PCFShadowMap} dpr={[1, 1.5]} camera={{ position: [0.15, 0.08, 9.8], fov: 42 }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", onFailure, { once: true })}>
      <color attach="background" args={[palette.blue]} />
      <ResponsiveCamera />
      <ambientLight intensity={0.85} />
      <directionalLight position={[-3, 4, 6]} intensity={3} color={palette.light} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.001} />
      <pointLight position={[3, -1, 3]} intensity={12} color={palette.gold} />
      <Backdrop palette={palette} />
      <Environment resolution={64}>
        <Lightformer position={[0, 3, 4]} intensity={3} scale={[6, 3, 1]} color={palette.light} />
        <Lightformer position={[-4, 0, 2]} intensity={2} scale={[3, 6, 1]} color={palette.gold} />
      </Environment>
      <Suspense fallback={null}><Relief palette={palette} onReady={onReady} /></Suspense>
      <Sparkles count={40} scale={[8, 7, 2]} position={[0, 0, 1]} size={2.5} speed={0.35} opacity={0.65} color={palette.gold} />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.075} minDistance={6.8} maxDistance={13}
        minPolarAngle={Math.PI * 0.35} maxPolarAngle={Math.PI * 0.65} minAzimuthAngle={-0.7} maxAzimuthAngle={0.7}
        autoRotate autoRotateSpeed={0.6} rotateSpeed={0.65} zoomSpeed={0.55} />
    </Canvas>
  );
}