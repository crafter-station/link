// Micelio background, adapted from linkmi (github.com/Railly/link, MIT).
// Colours are Crafter's dark palette: olive ink, a deeper olive, station soft yellow.

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * snoise(p); p = p * 2.02 + 17.0; a *= 0.5; }
  return v;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 grain(vec3 col, float amt) { return col + (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * amt; }

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  uv += (u_mouse - 0.5) * 0.06;
  float t = u_time * 0.03;
  vec2 q = vec2(fbm(uv * 0.9 + t), fbm(uv * 0.9 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(uv * 1.2 + 2.5 * q + vec2(1.7, 9.2) + t), fbm(uv * 1.2 + 2.5 * q + vec2(8.3, 2.8)));
  float n = fbm(uv * 1.4 + 2.0 * r);
  // thin luminous hyphae: ridged noise kept sparse by a high exponent
  float f1 = pow(1.0 - abs(snoise(uv * 1.8 + 1.6 * r + t)), 40.0);
  float f2 = pow(1.0 - abs(snoise(uv * 3.6 + 1.2 * q - t)), 60.0);
  vec3 col = mix(u_c1, u_c2, smoothstep(-0.2, 0.9, n) * 0.85);
  float mask = smoothstep(-0.3, 0.7, n);
  col += u_c3 * (f1 * 0.7 + f2 * 0.35) * mask;
  col += u_c3 * 0.06 * smoothstep(0.4, 1.2, length(r));
  col *= 1.0 - 0.5 * dot(uv * 0.8, uv * 0.8);
  gl_FragColor = vec4(grain(col, 0.03), 1.0);
}
`

const COLORS: [number, number, number][] = [
  [0x19 / 255, 0x1b / 255, 0x17 / 255],
  [0x34 / 255, 0x36 / 255, 0x22 / 255],
  [0xf8 / 255, 0xe9 / 255, 0xa4 / 255],
]

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

export function mountShader(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false })
  if (!gl) return
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, "a_pos")
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const uRes = uniform("u_res")
  const uTime = uniform("u_time")
  const uMouse = uniform("u_mouse")
  ;["u_c1", "u_c2", "u_c3"].forEach((name, i) => gl.uniform3fv(uniform(name), COLORS[i]))

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
  let time = 7.3
  let last = performance.now()
  let frame = 0

  const draw = (now: number) => {
    time += Math.min((now - last) / 1000, 0.1)
    last = now
    mouse.x += (mouse.tx - mouse.x) * 0.03
    mouse.y += (mouse.ty - mouse.y) * 0.03
    const dpr = Math.min(devicePixelRatio || 1, 1.5)
    const width = Math.floor(canvas.clientWidth * dpr)
    const height = Math.floor(canvas.clientHeight * dpr)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }
    gl.uniform2f(uRes, width, height)
    gl.uniform1f(uTime, time)
    gl.uniform2f(uMouse, mouse.x, mouse.y)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    canvas.style.opacity = "1"
    if (!reduced) frame = requestAnimationFrame(draw)
  }

  addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return
    mouse.tx = 0.5 + (event.clientX / innerWidth - 0.5) * 0.36
    mouse.ty = 0.5 + (0.5 - event.clientY / innerHeight) * 0.36
  })
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame)
    if (!document.hidden) {
      last = performance.now()
      frame = requestAnimationFrame(draw)
    }
  })
  frame = requestAnimationFrame(draw)
}
