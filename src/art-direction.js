import * as T from 'three';

const bands = new T.DataTexture(new Uint8Array([52, 114, 187, 242]), 4, 1, T.RedFormat);
bands.minFilter = bands.magFilter = T.NearestFilter;
bands.generateMipmaps = false;
bands.needsUpdate = true;
export function toonMaterial(parameters = {}) {
  return new T.MeshToonMaterial({ ...parameters, gradientMap: bands });
}

export function trackMaterial() {
  const material = toonMaterial({ side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec4 routeSurface; varying vec4 vRouteSurface;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRouteSurface = routeSurface;');
    shader.fragmentShader = 'varying vec4 vRouteSurface;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float offset = vRouteSurface.x, spacing = vRouteSurface.y;
      float distanceAlong = vRouteSurface.z, halfWidth = vRouteSurface.w;
      float threeLanes = smoothstep(.34, .42, spacing);
      vec3 turquoise = vec3(.007, .56, .69), blue = vec3(.003, .28, .58);
      vec3 coral = vec3(.97, .16, .095);
      vec3 laneColor = mix(turquoise, blue, step(-spacing * .5, offset));
      laneColor = mix(laneColor, coral, step(spacing * .5, offset));
      diffuseColor.rgb = mix(turquoise, laneColor, threeLanes);
      // The two lines sit halfway between actual lane centres. Their width is
      // in metres, and they follow the same curve and slope as the dog.
      float dividerDistance = abs(abs(offset) - spacing * .5);
      float separator = (1. - step(.034, dividerDistance)) * threeLanes;
      float edge = step(halfWidth - .045, abs(offset));
      float ink = (1. - step(.055, dividerDistance)) * threeLanes;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.015, .095, .18), ink * .5);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.95, .99, 1.), max(separator, edge));
      // Short forward chevrons reinforce all three lane centres without props.
      float nearestLane = floor(offset / max(spacing, .1) + .5) * spacing;
      float laneOffset = abs(offset - nearestLane);
      float chevron = abs(mod(distanceAlong + laneOffset * 1.6, 5.) - 2.5);
      float arrow = (1. - step(.055, chevron)) * (1. - step(.15, laneOffset));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.95, .99, 1.), arrow * threeLanes * .78);
    `);
  };
  material.customProgramCacheKey = () => 'sport-track-three-clear-lanes-v2';
  return material;
}

const campusMaterials = new WeakMap();
export function styleCampusMaterial(source) {
  if (campusMaterials.has(source)) return campusMaterials.get(source);
  const name = source.name;
  let color = source.color.clone();
  if (/Metal - Main|White ·|Stone ·|GRC ·|Plaster \(12\)|Plaster \(14\)/.test(name)) color.set('#f1f6ff');
  if (/Slab ·/.test(name)) color.set('#b9d0ec');
  if (/Metal soffit/.test(name)) color.set('#385b80');
  if (/Columns|Metal columns|Metal Mullion/.test(name)) color.set('#afcfe8');
  if (/MULLIONS|Division|dark metal|Shadow box/.test(name)) color.set('#173e68');
  if (/CURTAIN WALL/.test(name)) color.set('#064f8d');
  if (/Glass/.test(name)) color.set(/Railing/.test(name) ? '#39b7e3' : '#079cdd');
  if (/grass · R0052|Custom \(7\)|Plaster · R0073/.test(name)) color.set('#9edb36');
  if (/Tall [Gg]rass/.test(name)) color.set(source.map ? '#aeeb64' : '#59b83e');
  if (/Plaster44|Custom \(18\)/.test(name)) color.set('#318d44');
  if (/R0007|R0817|Paint ·/.test(name)) color.set('#f66a51');
  if (/R1216|R0825/.test(name)) color.set('#10bace');
  if (/Paving 2/.test(name)) color.set('#d4e7eb');
  if (/Paving ·/.test(name)) color.set('#afc9d8');
  if (/Rhino Default/.test(name)) color.set('#86a6b7');
  if (/Road/.test(name)) color.set('#abc2d4');
  if (/R0049/.test(name)) color.set('#188eac');
  if (/R0110/.test(name)) color.set('#b9d8dc');
  if (/R0006/.test(name)) color.set('#a7dc44');
  if (/R0008/.test(name)) color.set('#f0d3aa');
  if (/R0039/.test(name)) color.set('#adc1d2');
  const material = toonMaterial({
    name, color, map: source.map, alphaMap: source.alphaMap,
    alphaTest: source.alphaTest, transparent: source.transparent,
    opacity: source.opacity, side: T.DoubleSide,
  });
  // Keep original texture resolution and UVs, with stable distant mipmaps.
  if (material.map) {
    material.map.magFilter = T.NearestFilter;
    material.map.minFilter = T.LinearMipmapLinearFilter;
    material.map.anisotropy = 4;
  }
  if (/LIGHT|Light White/.test(name)) {
    material.emissive.set('#fff2cd'); material.emissiveIntensity = .7;
  }
  if (/Glass/.test(name)) {
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vCampusPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvCampusPosition = (modelMatrix * vec4(transformed, 1.)).xyz;');
      shader.fragmentShader = 'varying vec3 vCampusPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float panel = floor((vCampusPosition.x + vCampusPosition.z) / 2.8);
        float tone = fract(sin(panel * 127.1) * 43758.5453);
        diffuseColor.rgb *= .72 + floor(tone * 4.) * .13;
        float stripe = fract((vCampusPosition.x + vCampusPosition.z + vCampusPosition.y * .8) / 17.);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.22, .72, .92), step(.86, stripe) * .24);
      `);
    };
    material.customProgramCacheKey = () => 'campus-glass-v1';
  }
  campusMaterials.set(source, material);
  return material;
}

export function styleCorgiMaterial(source) {
  const material = toonMaterial({ name: source.name, map: source.map, color: '#ffffff', side: source.side });
  if (material.map) {
    material.map.magFilter = T.NearestFilter;
    material.map.minFilter = T.LinearMipmapLinearFilter;
    material.map.anisotropy = 4;
  }
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 fur = diffuseColor.rgb;
      float warm = step(fur.b * 1.6 + .035, fur.r) * step(fur.g * 1.14, fur.r);
      float lightness = dot(fur, vec3(.3, .6, .1));
      vec3 orange = mix(vec3(.42, .095, .008), vec3(1., .43, .045), smoothstep(.035, .58, lightness));
      diffuseColor.rgb = mix(fur, orange, warm * .5);
      diffuseColor.rgb = floor(diffuseColor.rgb * 32. + .5) / 32.;
    `);
  };
  material.customProgramCacheKey = () => 'corgi-fur-v1';
  return material;
}

export function makePixelSky() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 640);
  gradient.addColorStop(0, '#079ce5'); gradient.addColorStop(.5, '#17b8f0');
  gradient.addColorStop(.85, '#5fd8f8'); gradient.addColorStop(1, '#bceefa');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2048, 1024);
  let seed = 153;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 27; i++) {
    const x = Math.floor(random() * 512) * 4, y = Math.floor((130 + random() * 345) / 4) * 4;
    const pixel = 2 + Math.floor(random() * 2);
    const puffs = [[8, 9, 6], [15, 6, 6], [22, 8, 7], [29, 11, 5]];
    for (let cy = 0; cy < 17; cy++) for (let cx = 0; cx < 37; cx++) {
      if (puffs.some(([px, py, r]) => ((cx-px) / 1.25) ** 2 + (cy-py) ** 2 < r*r)) {
        ctx.fillStyle = cy > 11 ? '#c1eafa' : cy > 9 ? '#e3f6ff' : '#f8fdff';
        for (const wrap of [-2048, 0, 2048]) ctx.fillRect(x + cx * pixel + wrap, y + cy * pixel, pixel, pixel);
      }
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.mapping = T.EquirectangularReflectionMapping;
  texture.magFilter = T.NearestFilter;
  texture.minFilter = T.LinearFilter;
  return texture;
}
