import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { airportByIata } from "@contracts/airports";

const R = 1.6;

function latLngToVec3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function arcCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = [];
  const altitude = 0.16 + a.distanceTo(b) * 0.11;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const p = new THREE.Vector3().copy(a).lerp(b, t);
    const lift = Math.sin(Math.PI * t) * altitude;
    p.normalize().multiplyScalar(R + lift);
    points.push(p);
  }
  return new THREE.CatmullRomCurve3(points);
}

const ROUTES: [string, string][] = [
  ["OSL", "JFK"],
  ["OSL", "LHR"],
  ["OSL", "BKK"],
  ["OSL", "DXB"],
  ["BGO", "CPH"],
  ["TRD", "AMS"],
  ["OSL", "TOS"],
  ["OSL", "BCN"],
  ["OSL", "NRT"],
  ["SVG", "AGP"],
];

const MARKER_CITIES = [
  "OSL", "BGO", "TRD", "SVG", "TOS", "CPH", "ARN", "LHR", "CDG", "AMS",
  "JFK", "DXB", "BKK", "NRT", "SIN", "AGP", "BCN", "KEF", "IST", "DOH",
];

function useRouteData() {
  return useMemo(() => {
    return ROUTES.map(([from, to]) => {
      const a = airportByIata(from)!;
      const b = airportByIata(to)!;
      const va = latLngToVec3(a.lat, a.lng, R);
      const vb = latLngToVec3(b.lat, b.lng, R);
      return { curve: arcCurve(va, vb), key: `${from}-${to}` };
    });
  }, []);
}

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color("#7395d7") } },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vNormal;
          uniform vec3 glowColor;
          void main() {
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
            gl_FragColor = vec4(glowColor, 1.0) * intensity;
          }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={material} scale={1.24}>
      <sphereGeometry args={[R, 48, 48]} />
    </mesh>
  );
}

function RouteArcs() {
  const routes = useRouteData();
  const pulses = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    routes.forEach((r, i) => {
      const m = pulses.current[i];
      if (!m) return;
      const speed = 0.09 + (i % 3) * 0.025;
      const pos = r.curve.getPointAt((t * speed + i * 0.37) % 1);
      m.position.copy(pos);
    });
  });

  return (
    <group>
      {routes.map((r, i) => (
        <group key={r.key}>
          <Line
            points={r.curve.getPoints(64)}
            color="#afd2eb"
            transparent
            opacity={0.34}
            lineWidth={1}
          />
          <mesh ref={(el) => (pulses.current[i] = el)}>
            <sphereGeometry args={[0.016, 12, 12]} />
            <meshBasicMaterial color="#2E5BFF" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CityMarkers() {
  const markers = useMemo(
    () =>
      MARKER_CITIES.map((code) => {
        const a = airportByIata(code)!;
        return { code, pos: latLngToVec3(a.lat, a.lng, R * 1.002) };
      }),
    [],
  );
  return (
    <group>
      {markers.map((m) => (
        <mesh key={m.code} position={m.pos}>
          <sphereGeometry args={[0.011, 10, 10]} />
          <meshBasicMaterial color="#afd2eb" transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function GlobeMesh() {
  const graticule = useMemo(() => new THREE.SphereGeometry(R, 36, 24), []);
  return (
    <group>
      {/* solid night sphere */}
      <mesh>
        <sphereGeometry args={[R * 0.995, 64, 64]} />
        <meshStandardMaterial color="#12264e" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* faint graticule */}
      <mesh geometry={graticule}>
        <meshBasicMaterial color="#7395d7" wireframe transparent opacity={0.075} />
      </mesh>
      {/* soft polar cap highlight */}
      <mesh position={[0, R * 0.86, 0]}>
        <sphereGeometry args={[R * 0.34, 24, 12, 0, Math.PI * 2, 0, 0.7]} />
        <meshBasicMaterial color="#afd2eb" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

function RotatingGlobe({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  return (
    <group ref={group} rotation={[0.28, 0, 0.12]}>
      <GlobeMesh />
      <Atmosphere />
      {reducedMotion ? <StaticArcs /> : <RouteArcs />}
      <CityMarkers />
    </group>
  );
}

function StaticArcs() {
  const routes = useRouteData();
  return (
    <group>
      {routes.map((r) => (
        <Line
          key={r.key}
          points={r.curve.getPoints(64)}
          color="#afd2eb"
          transparent
          opacity={0.34}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export default function Globe({ className = "" }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  // Pause rendering entirely while the globe is off-screen
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={className} aria-hidden="true">
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={[1, 2]}
        camera={{ position: [0, 0.4, 4.6], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 2, 4]} intensity={1.1} color="#d7e6ff" />
        <pointLight position={[-5, -2, -3]} intensity={8} color="#223e86" />
        <Stars radius={40} depth={30} count={1400} factor={2.2} saturation={0} fade speed={reducedMotion ? 0 : 0.4} />
        <RotatingGlobe reducedMotion={reducedMotion} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.55}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.35}
          minPolarAngle={Math.PI / 3.4}
          maxPolarAngle={Math.PI / 1.6}
        />
      </Canvas>
    </div>
  );
}
