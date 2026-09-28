import * as T from 'three';

// Retain fine geometry at one scene sample per CSS pixel. Pixel character comes
// from deliberate colour bands and crisp contours, not an enlarged thumbnail.
export class PixelRenderer {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new T.WebGLRenderTarget(1280, 720, {
      minFilter: T.NearestFilter, magFilter: T.NearestFilter,
      type: T.HalfFloatType, depthBuffer: true,
    });
    this.target.depthTexture = new T.DepthTexture(1280, 720, T.UnsignedIntType);
    this.screen = new T.Scene();
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new T.ShaderMaterial({
      uniforms: {
        map: { value: this.target.texture }, depthMap: { value: this.target.depthTexture },
        resolution: { value: new T.Vector2(1280, 720) },
        cameraNear: { value: .12 }, cameraFar: { value: 1600 },
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        uniform sampler2D map, depthMap;
        uniform vec2 resolution;
        uniform float cameraNear, cameraFar;
        varying vec2 vUv;
        float viewDepth(vec2 uv) {
          float z = texture2D(depthMap, uv).x;
          return cameraNear * cameraFar / (cameraFar - z * (cameraFar - cameraNear));
        }
        vec3 displayColor(vec3 c) {
          c = clamp(c, 0., 1.);
          return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(vec3(.0031308), c));
        }
        void main() {
          vec2 uv = (floor(vUv * resolution) + .5) / resolution;
          vec2 px = 1. / resolution;
          vec3 c = displayColor(texture2D(map, uv).rgb);
          float l = dot(c, vec3(.2126, .7152, .0722));
          c = mix(vec3(l), c, 1.09);
          c = clamp((c - .5) * 1.04 + .5, 0., 1.);
          c = floor(c * 47. + .5) / 47.;
          float d = viewDepth(uv);
          float dl = viewDepth(uv - vec2(px.x, 0.));
          float dr = viewDepth(uv + vec2(px.x, 0.));
          float du = viewDepth(uv + vec2(0., px.y));
          float dd = viewDepth(uv - vec2(0., px.y));
          // Second differences reject flat sloping floors; ink only the foreground.
          float curvature = max(abs(dl + dr - 2. * d), abs(du + dd - 2. * d)) / max(d, 1.);
          float front = max(max(dl - d, dr - d), max(du - d, dd - d)) / max(d, 1.);
          float outline = step(.016, curvature) * step(.012, front) * (1. - step(cameraFar * .95, d));
          c = mix(c, vec3(.055, .15, .29), outline * mix(.85, .5, smoothstep(15., 80., d)));
          // Already in display space: do not apply a second sRGB transform.
          gl_FragColor = vec4(c, 1.);
        }`,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.screen.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.material));
    this.resize(innerWidth, innerHeight);
  }
  resize(w, h) {
    const scale = Math.min(1, 1920 / w, 1200 / h);
    const width = Math.round(w * scale), height = Math.round(h * scale);
    this.target.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }
  render(scene, camera) {
    this.material.uniforms.cameraNear.value = camera.near;
    this.material.uniforms.cameraFar.value = camera.far;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.sceneStats = { ...this.renderer.info.render };
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.screen, this.camera);
  }
}
