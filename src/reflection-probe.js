import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x333333)

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 2, 5)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
document.body.appendChild(renderer.domElement)

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(5, 10, 5)
scene.add(directionalLight)

const pointLight1 = new THREE.PointLight(0xff0000, 1, 50)
pointLight1.position.set(-5, 3, 0)
scene.add(pointLight1)

const pointLight2 = new THREE.PointLight(0x0000ff, 1, 50)
pointLight2.position.set(5, 3, 0)
scene.add(pointLight2)

// Add some environment objects (cubes)
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
const cubeMaterial1 = new THREE.MeshStandardMaterial({ color: 0xff6b6b })
const cubeMaterial2 = new THREE.MeshStandardMaterial({ color: 0x4ecdc4 })
const cubeMaterial3 = new THREE.MeshStandardMaterial({ color: 0xffe66d })

const cube1 = new THREE.Mesh(cubeGeometry, cubeMaterial1)
cube1.position.set(-3, 1, -2)
scene.add(cube1)

const cube2 = new THREE.Mesh(cubeGeometry, cubeMaterial2)
cube2.position.set(3, 1, -2)
scene.add(cube2)

const cube3 = new THREE.Mesh(cubeGeometry, cubeMaterial3)
cube3.position.set(0, 1, -4)
scene.add(cube3)

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(20, 20)
const groundMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x808080,
  roughness: 0.8
})
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
ground.position.y = -0.5
scene.add(ground)

// REFLECTION PROBE - CubeCamera
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
  format: THREE.RGBAFormat,
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter
})

const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget)
cubeCamera.position.set(0, 1, 0)
scene.add(cubeCamera)

// Reflective sphere using the CubeCamera texture
const sphereGeometry = new THREE.SphereGeometry(1, 64, 64)
const sphereMaterial = new THREE.MeshStandardMaterial({
  envMap: cubeRenderTarget.texture,
  roughness: 0.1,
  metalness: 1.0
})
const reflectiveSphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
reflectiveSphere.position.set(0, 1, 0)
scene.add(reflectiveSphere)

// Helper to visualize the reflection probe position
const probeHelper = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
)
probeHelper.position.copy(cubeCamera.position)
scene.add(probeHelper)

// Animation
function animate() {
  requestAnimationFrame(animate)
  
  controls.update()
  
  // Rotate cubes
  cube1.rotation.y += 0.01
  cube2.rotation.y += 0.01
  cube3.rotation.y += 0.01
  
  // Hide the reflective sphere before updating cube camera
  reflectiveSphere.visible = false
  
  // Update the reflection probe (CubeCamera captures environment)
  cubeCamera.update(renderer, scene)
  
  // Show the sphere again
  reflectiveSphere.visible = true
  
  renderer.render(scene, camera)
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
