import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import './DarkVeil.css';

interface DarkVeilProps {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  speed?: number;
  resolutionScale?: number;
}

const vertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Campo escuro em movimento com leve distorção e scanlines — usado atrás de
// cartões glassmorphism (Supergestora), pedido explícito do dono do produto
// (React Bits "DarkVeil"). Sem código-fonte original disponível localmente
// (o snippet fornecido só tinha o uso), esta é uma reimplementação fiel ao
// efeito visual descrito pelos props documentados: campo escuro roxo/azul,
// leve ruído e linhas de scan horizontais.
const fragment = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uHueShift;
uniform float uNoiseIntensity;
uniform float uScanlineIntensity;
uniform float uScanlineFrequency;
uniform float uWarpAmount;
uniform float uSpeed;

vec3 hueRotate(vec3 color, float angle) {
  const mat3 toYIQ = mat3(0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.211, -0.523, 0.312);
  const mat3 toRGB = mat3(1.0, 0.956, 0.621, 1.0, -0.272, -0.647, 1.0, -1.106, 1.703);
  vec3 yiq = toYIQ * color;
  float hueAngle = atan(yiq.z, yiq.y) + angle;
  float chroma = length(yiq.yz);
  yiq.y = chroma * cos(hueAngle);
  yiq.z = chroma * sin(hueAngle);
  return toRGB * yiq;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 centered = uv - 0.5;
  centered.x *= uResolution.x / uResolution.y;
  float time = uTime * uSpeed;

  float warp = sin(centered.y * 6.0 + time * 0.6) * uWarpAmount;
  vec2 p = centered + vec2(warp, 0.0);
  float radius = length(p) * 1.6;
  float angle = atan(p.y, p.x) + time * 0.05;

  float bands = sin(angle * 3.0 + radius * 5.0 - time) * 0.5 + 0.5;
  float glow = exp(-radius * 2.2) * 0.9;

  vec3 base = vec3(0.02, 0.015, 0.06);
  vec3 accent = vec3(0.10, 0.09, 0.45) * bands;
  vec3 color = base + accent + glow * vec3(0.18, 0.12, 0.45);
  color = hueRotate(color, radians(uHueShift));

  float scan = sin(uv.y * uScanlineFrequency * uResolution.y * 0.5 + time * 4.0) * 0.5 + 0.5;
  color -= scan * uScanlineIntensity;

  float grain = (hash(uv * uResolution.xy + time) - 0.5) * uNoiseIntensity;
  color += grain;

  float vignette = smoothstep(1.1, 0.2, length(centered));
  color *= vignette;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export default function DarkVeil({
  hueShift = 0,
  noiseIntensity = 0.02,
  scanlineIntensity = 0.08,
  scanlineFrequency = 4.4,
  warpAmount = 0.15,
  speed = 3,
  resolutionScale = 1,
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, 2) * resolutionScale });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uResolution: { value: new Float32Array([1, 1]) },
        uTime: { value: 0 },
        uHueShift: { value: hueShift },
        uNoiseIntensity: { value: noiseIntensity },
        uScanlineIntensity: { value: scanlineIntensity },
        uScanlineFrequency: { value: scanlineFrequency },
        uWarpAmount: { value: warpAmount },
        uSpeed: { value: speed },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    let frameId = 0;
    let elapsed = 0;
    let previousTime = performance.now();

    const render = () => renderer.render({ scene: mesh });
    const loop = (now: number) => {
      const delta = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      elapsed += delta;
      program.uniforms.uTime.value = elapsed;
      render();
      frameId = requestAnimationFrame(loop);
    };

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
      program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
      render();
    };

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);

    setSize();
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      if (canvas.parentNode === container) container.removeChild(canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="dark-veil-container" />;
}
