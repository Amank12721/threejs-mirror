import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

// Scene setup
const scene = new THREE.Scene()

// Camera
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  1,
  20000
)
camera.position.set(30, 30, 100)

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.appendChild(renderer.domElement)

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.maxPolarAngle = Math.PI * 0.495
controls.target.set(0, 10, 0)
controls.minDistance = 40.0
controls.maxDistance = 200.0
controls.enableDamping = true

// Sun
const sun = new THREE.Vector3()

// Water
const waterGeometry = new THREE.PlaneGeometry(10000, 10000)

const water = new Water(waterGeometry, {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals: new THREE.TextureLoader().load(
    'https://threejs.org/examples/textures/waternormals.jpg',
    function (texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    }
  ),
  sunDirection: new THREE.Vector3(),
  sunColor: 0xffffff,
  waterColor: 0x001e0f,
  distortionScale: 3.7,
  fog: scene.fog !== undefined
})

water.rotation.x = -Math.PI / 2
scene.add(water)

// Sky
const sky = new Sky()
sky.scale.setScalar(10000)
scene.add(sky)

const skyUniforms = sky.material.uniforms

skyUniforms['turbidity'].value = 10
skyUniforms['rayleigh'].value = 2
skyUniforms['mieCoefficient'].value = 0.005
skyUniforms['mieDirectionalG'].value = 0.8

const parameters = {
  elevation: 2,
  azimuth: 180
}

const pmremGenerator = new THREE.PMREMGenerator(renderer)

function updateSun() {
  const phi = THREE.MathUtils.degToRad(90 - parameters.elevation)
  const theta = THREE.MathUtils.degToRad(parameters.azimuth)

  sun.setFromSphericalCoords(1, phi, theta)

  sky.material.uniforms['sunPosition'].value.copy(sun)
  water.material.uniforms['sunDirection'].value.copy(sun).normalize()

  scene.environment = pmremGenerator.fromScene(sky).texture
}

updateSun()

// Add some objects to reflect
const cubeGeometry = new THREE.BoxGeometry(10, 10, 10)
const cubeMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff6b6b,
  metalness: 0.5,
  roughness: 0.5
})
const cube1 = new THREE.Mesh(cubeGeometry, cubeMaterial)
cube1.position.set(-30, 10, 0)
scene.add(cube1)

const sphereGeometry = new THREE.SphereGeometry(8, 32, 32)
const sphereMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x4ecdc4,
  metalness: 0.7,
  roughness: 0.3
})
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
sphere.position.set(30, 8, 0)
scene.add(sphere)

const torusGeometry = new THREE.TorusGeometry(8, 3, 16, 100)
const torusMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xffe66d,
  metalness: 0.6,
  roughness: 0.4
})
const torus = new THREE.Mesh(torusGeometry, torusMaterial)
torus.position.set(0, 10, -30)
scene.add(torus)

// Animation
function animate() {
  requestAnimationFrame(animate)
  
  // Rotate objects
  cube1.rotation.y += 0.01
  sphere.rotation.y += 0.01
  torus.rotation.x += 0.01
  torus.rotation.y += 0.005
  
  // Update water
  water.material.uniforms['time'].value += 1.0 / 60.0
  
  controls.update()
  renderer.render(scene, camera)
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
