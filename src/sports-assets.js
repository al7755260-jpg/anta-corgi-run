import * as T from 'three';
import {toonMaterial} from './art-direction.js';
import {assetUrl} from './assets.js';

// These are the user's ImageGen -> Rodin models, with their original UVs intact.
const definitions = {
  gate: {file:'finish-arch-web.glb', size:[5,3.4,1.15]},
  cone: {file:'gym-dumbbell-web.glb', width:.95, rotateY:Math.PI/2},
  block: {file:'gym-plyobox-web.glb', size:[1.2,1.7,1.15]},
};
const templates = new Map(), materialCache = new WeakMap(), signs = new Map();
let loading;

function sportsMaterial(source) {
  if (materialCache.has(source)) return materialCache.get(source);
  const material = toonMaterial({
    color:source.color.clone(), map:source.map, normalMap:source.normalMap,
    normalScale:source.normalScale?.clone().multiplyScalar(.7) || new T.Vector2(1,1),
    side:source.side, opacity:source.opacity, transparent:source.transparent,
    alphaTest:source.alphaTest,
  });
  material.name = `Rodin sports · ${source.name}`;
  if (material.map) material.map.colorSpace = T.SRGBColorSpace;
  if (material.normalMap) material.normalMap.colorSpace = T.NoColorSpace;
  for (const texture of [material.map,material.normalMap]) {
    if (!texture) continue;
    texture.magFilter = T.NearestFilter;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }
  materialCache.set(source,material);
  return material;
}

function normalizedAsset(scene,definition,key) {
  scene.rotation.y += definition.rotateY || 0;
  scene.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(scene), size = bounds.getSize(new T.Vector3());
  const center = bounds.getCenter(new T.Vector3());
  center.y = bounds.min.y;
  scene.position.sub(center);
  const normalization = new T.Group();
  if (definition.size) normalization.scale.fromArray(definition.size).divide(size);
  else normalization.scale.setScalar(definition.width/size.x);
  normalization.add(scene);
  // Keep the outer transform free for lane scaling, route placement and impacts.
  const root = new T.Group();
  root.name = `Rodin ${key}`;
  root.add(normalization);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(sportsMaterial) : sportsMaterial(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
  });
  root.updateMatrixWorld(true);
  root.userData.assetSource = 'ImageGen + Rodin';
  root.userData.assetFile = definition.file;
  root.userData.assetSize = new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray();
  root.userData.sharedResources = true;
  return root;
}

export async function loadSportsAssets(loader) {
  if (!loading) {
    loading = Promise.all(Object.entries(definitions).map(async ([key,definition]) => {
      const gltf = await loader.loadAsync(assetUrl(definition.file));
      return [key,normalizedAsset(gltf.scene,definition,key)];
    })).then(async assets => {
      if (typeof document !== 'undefined' && document.fonts) await document.fonts.load('64px CampusPixel');
      for (const [key,asset] of assets) templates.set(key,asset);
    }).catch(error => {
      loading = null;
      throw new Error('运动器械或终点拱门模型加载失败，请刷新重试。',{cause:error});
    });
  }
  await loading;
}

export function sportObstacle(type) {
  if (type !== 'cone' && type !== 'block') return null;
  const template = templates.get(type);
  if (!template) throw new Error('请先等待 loadSportsAssets 完成，再创建健身器械。');
  // Geometry and textures are shared. ObstacleImpact clones only the hit instance's
  // materials, so its flash/fade/dispose cannot change or dispose these templates.
  return template.clone(true);
}

function plaqueText(text) {
  if (signs.has(text)) return signs.get(text);
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 256;
  const context = canvas.getContext('2d');
  let fontSize = 184;
  const setFont = () => {context.font = `${fontSize}px CampusPixel,"Microsoft YaHei",sans-serif`;};
  setFont();
  while (context.measureText(text).width > 1436 && fontSize > 56) {fontSize -= 4;setFont();}
  context.textAlign = 'center';context.textBaseline = 'middle';context.fillStyle = '#173b58';
  context.fillText(text,768,132);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;texture.magFilter = T.NearestFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;texture.anisotropy = 4;
  const material = new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.04,depthWrite:false});
  const sign = {geometry:new T.PlaneGeometry(2.7,.34),material};
  signs.set(text,sign);
  return sign;
}

export function sportGate(text) {
  const template = templates.get('gate');
  if (!template) throw new Error('请先等待 loadSportsAssets 完成，再创建终点拱门。');
  const gate = template.clone(true), sign = plaqueText(String(text));
  // Front/back text sits just above the original blank plaque. No extra gate,
  // crossbar or opaque sign covers the Rodin frame, cyan trim or paw medallion.
  for (const side of [1,-1]) {
    const label = new T.Mesh(sign.geometry,sign.material);
    label.name = 'Original plaque lettering';
    label.position.set(0,2.60,side*.319);
    if (side < 0) label.rotation.y = Math.PI;
    gate.add(label);
  }
  gate.userData.clearance = {width:2.86,height:2.2};
  return gate;
}
