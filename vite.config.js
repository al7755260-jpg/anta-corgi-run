export default {
  // The same build runs at localhost/ and at username.github.io/repository/.
  base: './',
  build: {
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/libs/meshopt_decoder.module.js', 'three/addons/controls/OrbitControls.js', 'three/addons/environments/RoomEnvironment.js'],
          bvh: ['three-mesh-bvh']
        }
      }
    }
  }
};
