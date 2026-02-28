import {
  Color,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Mesh,
  SphereGeometry,
  MeshMatcapMaterial,
  AxesHelper,
  PlaneGeometry,
  MeshBasicMaterial,
  BoxGeometry,
  AmbientLight,
  DirectionalLight,
  PointLight,
  Group,
  Vector3,
  Quaternion,
  AnimationMixer,
  CircleGeometry,
  Shape,
  ShapeGeometry,
  Box3,
  CubeCamera,
  WebGLCubeRenderTarget,
  LinearMipmapLinearFilter,
  ShaderMaterial,
  DoubleSide,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import Stats from 'stats-js'
import LoaderManager from '@/js/managers/LoaderManager'
import GUI from 'lil-gui'

// Import shaders
import curvedMirrorVertexShader from '@/js/glsl/curved-mirror.vert?raw'
import curvedMirrorFragmentShader from '@/js/glsl/curved-mirror.frag?raw'

export default class MainScene {
  #canvas
  #renderer
  #scene
  #camera
  #controls
  #stats
  #width
  #height
  #mesh
  #model
  #mixer
  #animations
  #animationActions = []
  #maxAnimationDuration = 0
  #axesHelper
  #mirror
  #mirror2
  #dynamicMirrors = [] // Array to store dynamically created mirrors
  #virtualCameraMarker
  #virtualCameraMarker2
  #cubeCamera
  #cubeRenderTarget
  #lastFrameTime = 0
  #frameInterval = 16.67 // ~60fps
  #guiObj = {
    y: 0,
    showTitle: true,
    showVirtualCameras: false,
    showMirrors: false,
    showAxesHelper: false,
    flipMirrors: true, // Default: flipped mirrors
    mirrorWidth: 3.0, // Default: 3x width
    mirrorHeight: 3.0, // Default: 3x height
    mirrorScale: 1.0,
    mirrorShape: 'rectangle',
    mirrorCurvature: 0.0, // 0 = flat, positive = convex, negative = concave
    mirrorRadius: 5.0, // radius of curvature
    animationSpeed: 1.0,
    animationTime: 0.0,
    playAnimation: true,
    cpuOnly: false, // CPU-only mode (disables GPU-intensive features)
    lowMemoryMode: false, // Low memory mode for Smart TVs and low-end devices
    targetFPS: 60, // Target FPS (30 for low-end devices)
    exportGLTF: () => this.exportSceneToGLTF(),
    exportSettings: () => this.exportSettings(),
    importSettings: () => this.importSettings(),
    resetSettings: () => this.resetSettings(),
  }

  constructor() {
    this.#canvas = document.querySelector('.scene')

    this.init()
  }

  init = async () => {
    // Load CPU mode setting first
    this.loadCPUModeSetting()
    
    // Preload assets before initiating the scene
    const assets = [
      {
        name: 'matcap',
        texture: './img/matcap.png',
      },
    ]

    await LoaderManager.load(assets)

    this.setStats()
    this.setGUI()
    this.setScene()
    this.setRender()
    this.setCamera()
    this.setControls()
    this.setAxesHelper()
    this.setLights()

    this.loadModel()
    this.setMirror()

    this.handleResize()

    // Load saved settings from localStorage
    this.loadSavedSettings()

    // start RAF
    this.events()
  }

  /**
   * Our Webgl renderer, an object that will draw everything in our canvas
   * https://threejs.org/docs/?q=rend#api/en/renderers/WebGLRenderer
   */
  setRender() {
    this.#renderer = new WebGLRenderer({
      canvas: this.#canvas,
      antialias: !this.#guiObj.cpuOnly && !this.#guiObj.lowMemoryMode,
      powerPreference: (this.#guiObj.cpuOnly || this.#guiObj.lowMemoryMode) ? 'low-power' : 'high-performance',
      precision: this.#guiObj.lowMemoryMode ? 'lowp' : 'highp', // Low precision for Smart TVs
      stencil: !this.#guiObj.lowMemoryMode, // Disable stencil buffer in low memory mode
      depth: true,
      logarithmicDepthBuffer: false, // Disable for better performance
    })
    
    // Disable shadows in low memory mode
    if (this.#guiObj.lowMemoryMode) {
      this.#renderer.shadowMap.enabled = false
    }
  }

  /**
   * This is our scene, we'll add any object
   * https://threejs.org/docs/?q=scene#api/en/scenes/Scene
   */
  setScene() {
    this.#scene = new Scene()
    this.#scene.background = new Color(0x808080)
    
    // Setup CubeCamera for environment reflections (skip in low memory mode)
    if (!this.#guiObj.lowMemoryMode) {
      const cubeSize = this.#guiObj.cpuOnly ? 128 : 256 // Smaller texture in CPU mode
      this.#cubeRenderTarget = new WebGLCubeRenderTarget(cubeSize, {
        generateMipmaps: !this.#guiObj.lowMemoryMode,
        minFilter: LinearMipmapLinearFilter,
      })
      
      this.#cubeCamera = new CubeCamera(0.1, 1000, this.#cubeRenderTarget)
      this.#scene.add(this.#cubeCamera)
    }
  }

  /**
   * Our Perspective camera, this is the point of view that we'll have
   * of our scene.
   * A perscpective camera is mimicing the human eyes so something far we'll
   * look smaller than something close
   * https://threejs.org/docs/?q=pers#api/en/cameras/PerspectiveCamera
   */
  setCamera() {
    const aspectRatio = this.#width / this.#height
    const fieldOfView = 60
    const nearPlane = 0.1
    const farPlane = 10000

    this.#camera = new PerspectiveCamera(fieldOfView, aspectRatio, nearPlane, farPlane)
    
    // Default camera position from saved settings
    this.#camera.position.x = -0.29616269737491346
    this.#camera.position.y = 0.5536197835771841
    this.#camera.position.z = 2.2819253056699145
    
    // Default camera rotation
    this.#camera.rotation.x = -0.1247514335412133
    this.#camera.rotation.y = -0.13577442993308741
    this.#camera.rotation.z = -0.016972579045198086
    
    this.#camera.lookAt(0, 0, 0)

    this.#scene.add(this.#camera)
  }

  /**
   * Threejs controls to have controls on our scene
   * https://threejs.org/docs/?q=orbi#examples/en/controls/OrbitControls
   */
  setControls() {
    this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement)
    this.#controls.enableDamping = true
    // this.#controls.dampingFactor = 0.04
  }

  /**
   * Axes Helper
   * https://threejs.org/docs/?q=Axesh#api/en/helpers/AxesHelper
   */
  setAxesHelper() {
    this.#axesHelper = new AxesHelper(3)
    this.#axesHelper.visible = false // Hidden by default
    this.#scene.add(this.#axesHelper)
  }

  /**
   * Add lights to the scene
   */
  setLights() {
    // Ambient light for overall illumination
    const ambientLight = new AmbientLight(0xffffff, 0.5)
    this.#scene.add(ambientLight)

    // Directional light (like sunlight)
    const directionalLight = new DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 10, 5)
    this.#scene.add(directionalLight)

    // Point light for additional highlights
    const pointLight = new PointLight(0xffffff, 0.8, 100)
    pointLight.position.set(-5, 5, 5)
    this.#scene.add(pointLight)
  }

  /**
   * Create a SphereGeometry
   * https://threejs.org/docs/?q=box#api/en/geometries/SphereGeometry
   * with a Basic material
   * https://threejs.org/docs/?q=mesh#api/en/materials/MeshBasicMaterial
   */
  setSphere() {
    const geometry = new SphereGeometry(1, 32, 32)
    const material = new MeshMatcapMaterial({ matcap: LoaderManager.assets['matcap'].texture })

    this.#mesh = new Mesh(geometry, material)
    this.#scene.add(this.#mesh)
  }

  /**
   * Load the GLB model
   */
  loadModel() {
    const loader = new GLTFLoader()
    loader.load(
      './CBSE-N_VIII_SCI_L10_ACT10.5_Reflectedrayonpaper.glb',
      (gltf) => {
        this.#model = gltf.scene
        this.#model.name = 'MainModel'
        this.#scene.add(this.#model)
        console.log('Model loaded successfully!')
        
        // Auto-fit camera to model
        this.fitCameraToModel()
        
        // Setup animations if they exist
        if (gltf.animations && gltf.animations.length > 0) {
          console.log('Animations found:', gltf.animations.length)
          this.#mixer = new AnimationMixer(this.#model)
          this.#animations = gltf.animations
          
          // Play all animations and store actions
          gltf.animations.forEach((clip, index) => {
            console.log(`Playing animation ${index}: ${clip.name}, duration: ${clip.duration}s`)
            const action = this.#mixer.clipAction(clip)
            action.play()
            this.#animationActions.push(action)
            
            // Track max duration
            if (clip.duration > this.#maxAnimationDuration) {
              this.#maxAnimationDuration = clip.duration
            }
          })
          
          console.log('Max animation duration:', this.#maxAnimationDuration)
        } else {
          console.log('No animations found in GLB')
        }
        
        // Find and convert planes named "Mirror" into reflectors
        this.createMirrorsFromModel()
      },
      (progress) => {
        console.log('Loading...', (progress.loaded / progress.total * 100) + '%')
      },
      (error) => {
        console.error('Error loading model:', error)
      }
    )
  }

  /**
   * Find objects named "Mirror" in the loaded model and convert them to reflectors
   */
  createMirrorsFromModel() {
    if (!this.#model) {
      console.warn('No model loaded yet!')
      return
    }

    console.log('=== SEARCHING FOR MIRROR OBJECTS ===')
    console.log('Model structure:', this.#model)
    
    // Print hierarchy
    const printHierarchy = (obj, depth = 0) => {
      const indent = '  '.repeat(depth)
      const meshInfo = obj.isMesh ? ` [MESH] (${obj.geometry?.type || 'unknown'})` : ''
      console.log(`${indent}├─ "${obj.name}" (${obj.type})${meshInfo}`)
      
      if (obj.children && obj.children.length > 0) {
        obj.children.forEach(child => printHierarchy(child, depth + 1))
      }
    }
    
    console.log('=== HIERARCHY ===')
    printHierarchy(this.#model)
    console.log('=================')
    
    let foundObjects = []

    this.#model.traverse((child) => {
      foundObjects.push({
        name: child.name,
        type: child.type,
        isMesh: child.isMesh,
        geometryType: child.geometry?.type || 'N/A'
      })
      
      // Check if object name is EXACTLY "Mirror" or "Mirror_Plane" (not just starts with)
      const mirrorNames = ['mirror', 'mirror_plane', 'mirrorplane', 'plane_mirror', 'wall_mirror']
      const isNamedMirror = mirrorNames.some(name => 
        child.name.toLowerCase() === name || 
        child.name.toLowerCase().endsWith('_mirror') ||
        child.name.toLowerCase().endsWith('_mirror_plane')
      )
      
      if (child.isMesh && isNamedMirror) {
        console.log('✅ MIRROR PLANE FOUND:', child.name)
        console.log('Geometry type:', child.geometry.type)
        console.log('Geometry:', child.geometry)
        
        // Get the plane's dimensions
        const geometry = child.geometry
        
        if (!geometry.boundingBox) {
          geometry.computeBoundingBox()
        }
        
        const bbox = geometry.boundingBox
        console.log('Bounding box:', bbox)
        
        if (!bbox) {
          console.error('❌ Could not compute bounding box for', child.name)
          return
        }
        
        const width = Math.abs(bbox.max.x - bbox.min.x)
        const height = Math.abs(bbox.max.y - bbox.min.y)
        const depth = Math.abs(bbox.max.z - bbox.min.z)
        
        console.log(`Mirror dimensions: width=${width.toFixed(2)}, height=${height.toFixed(2)}, depth=${depth.toFixed(2)}`)
        
        // Use the two largest dimensions for the plane
        let planeWidth, planeHeight
        if (depth < width && depth < height) {
          // XY plane
          planeWidth = width
          planeHeight = height
        } else if (width < height && width < depth) {
          // YZ plane
          planeWidth = depth
          planeHeight = height
        } else {
          // XZ plane
          planeWidth = width
          planeHeight = depth
        }
        
        console.log(`Using plane dimensions: ${planeWidth.toFixed(2)} x ${planeHeight.toFixed(2)}`)
        console.log('Mirror position:', child.position)
        console.log('Mirror rotation:', child.rotation)
        
        // Check if mirror should be flipped (name contains "_flip")
        const shouldFlip = child.name.toLowerCase().includes('_flip')
        if (shouldFlip) {
          console.log('⚠️ Mirror will be flipped (180°)')
        }
        
        // Determine if we should use curved mirror or flat reflector
        const useCurvedMirror = Math.abs(this.#guiObj.mirrorCurvature) > 0.001
        
        let reflector
        
        if (useCurvedMirror) {
          // Create curved mirror with custom shader
          console.log('Creating CURVED mirror with curvature:', this.#guiObj.mirrorCurvature)
          const mirrorGeometry = this.createMirrorGeometry(planeWidth, planeHeight, this.#guiObj.mirrorShape)
          
          // Get world position for mirror center
          child.updateWorldMatrix(true, false)
          const mirrorPosition = child.getWorldPosition(new Vector3())
          
          const curvedMaterial = this.createCurvedMirrorMaterial(mirrorPosition)
          reflector = new Mesh(mirrorGeometry, curvedMaterial)
          
          // Copy position, rotation, and scale
          reflector.position.copy(mirrorPosition)
          reflector.quaternion.copy(child.getWorldQuaternion(new Quaternion()))
          reflector.scale.copy(child.getWorldScale(new Vector3()))
        } else {
          // Create flat reflector (original behavior)
          console.log('Creating FLAT mirror')
          const mirrorGeometry = this.createMirrorGeometry(planeWidth, planeHeight, this.#guiObj.mirrorShape)
          reflector = new Reflector(mirrorGeometry, {
            clipBias: 0.003,
            textureWidth: window.innerWidth * window.devicePixelRatio,
            textureHeight: window.innerHeight * window.devicePixelRatio,
            color: 0x889999,
          })
          
          // Copy position, rotation, and scale from the original plane
          child.updateWorldMatrix(true, false)
          reflector.position.copy(child.getWorldPosition(new Vector3()))
          reflector.quaternion.copy(child.getWorldQuaternion(new Quaternion()))
          reflector.scale.copy(child.getWorldScale(new Vector3()))
        }
        
        // Flip the mirror if needed (rotate 180° around Y axis)
        if (shouldFlip) {
          reflector.rotateY(Math.PI)
        }
        
        reflector.name = child.name + '_Reflector'
        
        this.#scene.add(reflector)
        
        // Create a black backing plane (mirror's back side) with same shape
        const backingGeometry = this.createMirrorGeometry(planeWidth, planeHeight, this.#guiObj.mirrorShape)
        const backingMaterial = new MeshBasicMaterial({ 
          color: 0x000000,
          side: 1 // BackSide
        })
        const backingPlane = new Mesh(backingGeometry, backingMaterial)
        backingPlane.name = child.name + '_Backing'
        
        // Position backing slightly behind the reflector
        backingPlane.position.copy(reflector.position)
        backingPlane.quaternion.copy(reflector.quaternion)
        backingPlane.translateZ(-0.01) // Slightly behind
        
        this.#scene.add(backingPlane)
        
        // Create virtual camera marker
        const markerGeometry = new BoxGeometry(0.5, 0.5, 0.5)
        const markerMaterial = new MeshBasicMaterial({ 
          color: Math.random() * 0xffffff, // Random color for each marker
          wireframe: true 
        })
        const marker = new Mesh(markerGeometry, markerMaterial)
        marker.name = child.name + '_VirtualCamera'
        marker.visible = this.#guiObj.showVirtualCameras
        this.#scene.add(marker)
        
        // Store mirror data
        this.#dynamicMirrors.push({
          reflector: reflector,
          backing: backingPlane,
          marker: marker,
          originalMesh: child,
          name: child.name,
          baseRotation: reflector.quaternion.clone(), // Store original rotation
          isFlipped: shouldFlip,
          originalWidth: planeWidth,
          originalHeight: planeHeight
        })
        
        // Hide the original plane mesh
        child.visible = false
        
        console.log(`✅ Created reflector for: ${child.name}`)
      }
    })
    
    console.log('=== SEARCH COMPLETE ===')
    console.log(`Total objects in model: ${foundObjects.length}`)
    console.log(`Total mirrors created: ${this.#dynamicMirrors.length}`)
    
    if (this.#dynamicMirrors.length === 0) {
      console.warn('⚠️ NO MIRRORS FOUND! Make sure your plane objects are named "Mirror" (case insensitive)')
      console.table(foundObjects)
    }
  }

  /**
   * Auto-fit camera to model
   */
  fitCameraToModel() {
    if (!this.#model) return
    
    // Calculate bounding box of the model
    const box = new Box3().setFromObject(this.#model)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    
    // Get the max dimension
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.#camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    
    // Add some padding
    cameraZ *= 1.5
    
    // Position camera
    this.#camera.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.5, center.z + cameraZ)
    this.#camera.lookAt(center)
    
    // Update controls target
    if (this.#controls) {
      this.#controls.target.copy(center)
      this.#controls.update()
    }
    
    console.log('Camera fitted to model:', {
      center: center,
      size: size,
      cameraPosition: this.#camera.position
    })
  }

  /**
   * Create mirror geometry based on shape
   */
  createMirrorGeometry(width, height, shape) {
    switch(shape) {
      case 'circle':
        // Use average of width and height as radius
        const radius = (width + height) / 4
        return new CircleGeometry(radius, 64)
      
      case 'oval':
        // Create ellipse shape
        const ellipse = new Shape()
        const radiusX = width / 2
        const radiusY = height / 2
        ellipse.absellipse(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0)
        return new ShapeGeometry(ellipse)
      
      case 'rectangle':
      default:
        return new PlaneGeometry(width, height, 32, 32) // More segments for curvature
    }
  }

  /**
   * Create curved mirror material using custom shader
   */
  createCurvedMirrorMaterial(mirrorPosition) {
    return new ShaderMaterial({
      uniforms: {
        uCameraPosition: { value: this.#camera.position.clone() },
        envMap: { value: this.#cubeRenderTarget.texture },
        curvature: { value: this.#guiObj.mirrorCurvature },
        mirrorRadius: { value: this.#guiObj.mirrorRadius },
        mirrorCenter: { value: mirrorPosition.clone() },
      },
      vertexShader: curvedMirrorVertexShader,
      fragmentShader: curvedMirrorFragmentShader,
      side: DoubleSide,
    })
  }

  /**
   * Create a mirror plane in front of the sphere
   */
  setMirror() {
    // First mirror (front)
    const geometry = new PlaneGeometry(10, 10)
    
    // Reduce texture resolution in low memory mode
    const texScale = this.#guiObj.lowMemoryMode ? 0.5 : 1.0
    const dpr = this.#guiObj.lowMemoryMode ? 1 : (window.devicePixelRatio || 1)
    
    this.#mirror = new Reflector(geometry, {
      clipBias: 0.003,
      textureWidth: window.innerWidth * dpr * texScale,
      textureHeight: window.innerHeight * dpr * texScale,
      color: 0x889999,
    })
    
    this.#mirror.name = 'MirrorPlane_Front'
    this.#mirror.position.z = -3
    this.#mirror.visible = false // Hidden by default
    this.#scene.add(this.#mirror)

    // Create a visible marker to show where the virtual camera is
    const markerGeometry = new BoxGeometry(0.5, 0.5, 0.5)
    const markerMaterial = new MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    this.#virtualCameraMarker = new Mesh(markerGeometry, markerMaterial)
    this.#virtualCameraMarker.name = 'VirtualCameraMarker_Front'
    this.#virtualCameraMarker.visible = false // Hidden by default
    this.#scene.add(this.#virtualCameraMarker)

    // Second mirror (right side)
    const geometry2 = new PlaneGeometry(10, 10)
    
    this.#mirror2 = new Reflector(geometry2, {
      clipBias: 0.003,
      textureWidth: window.innerWidth * dpr * texScale,
      textureHeight: window.innerHeight * dpr * texScale,
      color: 0x998899,
    })
    
    this.#mirror2.name = 'MirrorPlane_Right'
    this.#mirror2.position.x = 3
    this.#mirror2.rotation.y = -Math.PI / 2 // Rotate 90 degrees to face left
    this.#mirror2.visible = false // Hidden by default
    this.#scene.add(this.#mirror2)

    // Create marker for second virtual camera
    const markerGeometry2 = new BoxGeometry(0.5, 0.5, 0.5)
    const markerMaterial2 = new MeshBasicMaterial({ color: 0x0000ff, wireframe: true })
    this.#virtualCameraMarker2 = new Mesh(markerGeometry2, markerMaterial2)
    this.#virtualCameraMarker2.name = 'VirtualCameraMarker_Right'
    this.#virtualCameraMarker2.visible = false // Hidden by default
    this.#scene.add(this.#virtualCameraMarker2)
  }

  /**
   * Build stats to display fps
   */
  setStats() {
    this.#stats = new Stats()
    this.#stats.showPanel(0)
    document.body.appendChild(this.#stats.dom)
  }

  setGUI() {
    const titleEl = document.querySelector('.main-title')

    const handleChange = () => {
      if (this.#model) {
        this.#model.position.y = this.#guiObj.y
      }
      if (titleEl) titleEl.style.display = this.#guiObj.showTitle ? 'block' : 'none'
      
      // Toggle virtual camera markers
      if (this.#virtualCameraMarker) {
        this.#virtualCameraMarker.visible = this.#guiObj.showVirtualCameras
      }
      if (this.#virtualCameraMarker2) {
        this.#virtualCameraMarker2.visible = this.#guiObj.showVirtualCameras
      }
      
      // Toggle dynamic mirror markers (from GLB)
      this.#dynamicMirrors.forEach((mirrorData) => {
        mirrorData.marker.visible = this.#guiObj.showVirtualCameras
      })
      
      // Toggle ONLY manual mirrors (not GLB mirrors)
      if (this.#mirror) {
        this.#mirror.visible = this.#guiObj.showMirrors
      }
      if (this.#mirror2) {
        this.#mirror2.visible = this.#guiObj.showMirrors
      }
      
      // Toggle axes helper
      if (this.#axesHelper) {
        this.#axesHelper.visible = this.#guiObj.showAxesHelper
      }
      
      // Flip GLB mirrors
      this.#dynamicMirrors.forEach((mirrorData) => {
        const reflector = mirrorData.reflector
        const baseRotation = mirrorData.baseRotation
        
        if (this.#guiObj.flipMirrors) {
          // Apply flip (180° rotation on Y axis)
          reflector.quaternion.copy(baseRotation)
          reflector.rotateY(Math.PI)
        } else {
          // Reset to base rotation
          reflector.quaternion.copy(baseRotation)
        }
        
        // Update mirror scale based on GUI sliders
        const originalWidth = mirrorData.originalWidth
        const originalHeight = mirrorData.originalHeight
        reflector.scale.x = this.#guiObj.mirrorWidth
        reflector.scale.y = this.#guiObj.mirrorHeight
      })
    }

    const gui = new GUI()
    
    // Performance controls
    const performanceFolder = gui.addFolder('Performance')
    performanceFolder.add(this.#guiObj, 'cpuOnly').name('CPU Only Mode').onChange(() => {
      alert('Please refresh the page for changes to take effect.')
      this.savePerformanceSettings()
    })
    performanceFolder.add(this.#guiObj, 'lowMemoryMode').name('Low Memory Mode (Smart TV)').onChange(() => {
      alert('Please refresh the page for changes to take effect.')
      this.savePerformanceSettings()
    })
    performanceFolder.add(this.#guiObj, 'targetFPS', [30, 60]).name('Target FPS').onChange(() => {
      this.savePerformanceSettings()
    })
    
    // Model controls
    const modelFolder = gui.addFolder('Model Controls')
    modelFolder.add(this.#guiObj, 'y', -3, 3).onChange(handleChange).name('Y Position')
    
    // Visibility controls
    const visibilityFolder = gui.addFolder('Visibility')
    visibilityFolder.add(this.#guiObj, 'showTitle').name('Show Title').onChange(handleChange)
    visibilityFolder.add(this.#guiObj, 'showVirtualCameras').name('Show Virtual Cameras').onChange(handleChange)
    visibilityFolder.add(this.#guiObj, 'showMirrors').name('Show Manual Mirrors').onChange(handleChange)
    visibilityFolder.add(this.#guiObj, 'showAxesHelper').name('Show Axes (RGB Arrows)').onChange(handleChange)
    
    // Mirror controls
    const mirrorFolder = gui.addFolder('Mirror Controls')
    mirrorFolder.add(this.#guiObj, 'mirrorShape', ['rectangle', 'circle', 'oval']).name('Mirror Shape').onChange(() => {
      // Recreate mirrors with new shape
      console.log('Mirror shape changed to:', this.#guiObj.mirrorShape)
      this.updateMirrorShapes()
    })
    mirrorFolder.add(this.#guiObj, 'mirrorCurvature', -1.0, 1.0, 0.01).name('Curvature (0=flat)').onChange(() => {
      console.log('Mirror curvature changed to:', this.#guiObj.mirrorCurvature)
      this.updateMirrorCurvature()
    })
    mirrorFolder.add(this.#guiObj, 'mirrorRadius', 1.0, 20.0, 0.1).name('Curvature Radius').onChange(() => {
      this.updateMirrorCurvature()
    })
    mirrorFolder.add(this.#guiObj, 'flipMirrors').name('Flip Mirrors').onChange(handleChange)
    mirrorFolder.add(this.#guiObj, 'mirrorWidth', 0.1, 3.0).name('Mirror Width').onChange(handleChange)
    mirrorFolder.add(this.#guiObj, 'mirrorHeight', 0.1, 3.0).name('Mirror Height').onChange(handleChange)
    mirrorFolder.add(this.#guiObj, 'mirrorScale', 0.1, 5.0).name('Mirror Scale').onChange(handleChange)
    
    // Animation controls
    const animationFolder = gui.addFolder('Animation')
    animationFolder.add(this.#guiObj, 'playAnimation').name('Play Animation')
    animationFolder.add(this.#guiObj, 'animationSpeed', 0.0, 3.0).name('Speed')
    animationFolder.add(this.#guiObj, 'animationTime', 0, 10).name('Timeline (seconds)').listen()
    
    // Note: Timeline slider will work only if GLB has animations
    
    // Export
    gui.add(this.#guiObj, 'exportGLTF').name('Export Scene to GLB')
    gui.add(this.#guiObj, 'exportSettings').name('Export Settings JSON')
    gui.add(this.#guiObj, 'importSettings').name('Import Settings JSON')
    gui.add(this.#guiObj, 'resetSettings').name('Reset to Default')
  }

  /**
   * Export the scene to GLTF/GLB format
   */
  exportSceneToGLTF() {
    const exporter = new GLTFExporter()
    
    // Create a group with all exportable objects
    const exportGroup = new Group()
    exportGroup.name = 'ExportedScene'
    
    // Clone and add objects with proper names
    if (this.#model) {
      const modelClone = this.#model.clone()
      modelClone.name = 'MainModel'
      exportGroup.add(modelClone)
    }
    
    // Create a simple plane mesh for mirror (Reflector can't be exported directly)
    if (this.#mirror) {
      const mirrorGeometry = new PlaneGeometry(10, 10)
      const mirrorMaterial = new MeshBasicMaterial({ color: 0x889999 })
      const mirrorMesh = new Mesh(mirrorGeometry, mirrorMaterial)
      mirrorMesh.name = 'MirrorPlane_Front'
      mirrorMesh.position.copy(this.#mirror.position)
      mirrorMesh.rotation.copy(this.#mirror.rotation)
      exportGroup.add(mirrorMesh)
    }

    // Add second mirror
    if (this.#mirror2) {
      const mirrorGeometry2 = new PlaneGeometry(10, 10)
      const mirrorMaterial2 = new MeshBasicMaterial({ color: 0x998899 })
      const mirrorMesh2 = new Mesh(mirrorGeometry2, mirrorMaterial2)
      mirrorMesh2.name = 'MirrorPlane_Right'
      mirrorMesh2.position.copy(this.#mirror2.position)
      mirrorMesh2.rotation.copy(this.#mirror2.rotation)
      exportGroup.add(mirrorMesh2)
    }
    
    if (this.#virtualCameraMarker) {
      const markerClone = this.#virtualCameraMarker.clone()
      markerClone.name = 'VirtualCameraMarker_Front'
      // Explicitly set position values
      markerClone.position.set(
        this.#virtualCameraMarker.position.x,
        this.#virtualCameraMarker.position.y,
        this.#virtualCameraMarker.position.z
      )
      markerClone.rotation.set(
        this.#virtualCameraMarker.rotation.x,
        this.#virtualCameraMarker.rotation.y,
        this.#virtualCameraMarker.rotation.z
      )
      exportGroup.add(markerClone)
    }

    if (this.#virtualCameraMarker2) {
      const markerClone2 = this.#virtualCameraMarker2.clone()
      markerClone2.name = 'VirtualCameraMarker_Right'
      markerClone2.position.set(
        this.#virtualCameraMarker2.position.x,
        this.#virtualCameraMarker2.position.y,
        this.#virtualCameraMarker2.position.z
      )
      markerClone2.rotation.set(
        this.#virtualCameraMarker2.rotation.x,
        this.#virtualCameraMarker2.rotation.y,
        this.#virtualCameraMarker2.rotation.z
      )
      exportGroup.add(markerClone2)
    }
    
    console.log('=== EXPORT POSITIONS ===')
    console.log('Main Camera:', {
      x: this.#camera.position.x.toFixed(2),
      y: this.#camera.position.y.toFixed(2),
      z: this.#camera.position.z.toFixed(2)
    })
    console.log('Mirror 1 (Front):', {
      x: this.#mirror?.position.x.toFixed(2),
      y: this.#mirror?.position.y.toFixed(2),
      z: this.#mirror?.position.z.toFixed(2)
    })
    console.log('Virtual Camera Marker 1:', {
      x: this.#virtualCameraMarker?.position.x.toFixed(2),
      y: this.#virtualCameraMarker?.position.y.toFixed(2),
      z: this.#virtualCameraMarker?.position.z.toFixed(2)
    })
    console.log('Mirror 2 (Right):', {
      x: this.#mirror2?.position.x.toFixed(2),
      y: this.#mirror2?.position.y.toFixed(2),
      z: this.#mirror2?.position.z.toFixed(2)
    })
    console.log('Virtual Camera Marker 2:', {
      x: this.#virtualCameraMarker2?.position.x.toFixed(2),
      y: this.#virtualCameraMarker2?.position.y.toFixed(2),
      z: this.#virtualCameraMarker2?.position.z.toFixed(2)
    })
    
    // Export to GLB (binary GLTF)
    exporter.parse(
      exportGroup,
      (result) => {
        const blob = new Blob([result], { type: 'application/octet-stream' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'scene_export.glb'
        link.click()
        console.log('Scene exported to GLB!')
      },
      (error) => {
        console.error('Export error:', error)
      },
      { binary: true }
    )
  }

  /**
   * Export mirror settings to JSON
   */
  exportSettings() {
    const settings = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      camera: {
        position: {
          x: this.#camera.position.x,
          y: this.#camera.position.y,
          z: this.#camera.position.z
        },
        rotation: {
          x: this.#camera.rotation.x,
          y: this.#camera.rotation.y,
          z: this.#camera.rotation.z
        }
      },
      scene: {
        background: this.#scene.background.getHex(),
        modelYPosition: this.#guiObj.y,
        modelScale: this.#guiObj.modelScale
      },
      visibility: {
        showTitle: this.#guiObj.showTitle,
        showVirtualCameras: this.#guiObj.showVirtualCameras,
        showManualMirrors: this.#guiObj.showMirrors
      },
      mirrorSettings: {
        flipMirrors: this.#guiObj.flipMirrors,
        mirrorWidth: this.#guiObj.mirrorWidth,
        mirrorHeight: this.#guiObj.mirrorHeight,
        mirrorScale: this.#guiObj.mirrorScale,
        mirrorShape: this.#guiObj.mirrorShape,
        mirrorCurvature: this.#guiObj.mirrorCurvature,
        mirrorRadius: this.#guiObj.mirrorRadius
      },
      animation: {
        speed: this.#guiObj.animationSpeed,
        time: this.#guiObj.animationTime,
        playing: this.#guiObj.playAnimation
      },
      mirrors: {
        manual: [
          {
            name: 'MirrorPlane_Front',
            position: { x: this.#mirror?.position.x, y: this.#mirror?.position.y, z: this.#mirror?.position.z },
            visible: this.#mirror?.visible
          },
          {
            name: 'MirrorPlane_Right',
            position: { x: this.#mirror2?.position.x, y: this.#mirror2?.position.y, z: this.#mirror2?.position.z },
            visible: this.#mirror2?.visible
          }
        ],
        dynamic: this.#dynamicMirrors.map(mirrorData => ({
          name: mirrorData.name,
          position: {
            x: mirrorData.reflector.position.x,
            y: mirrorData.reflector.position.y,
            z: mirrorData.reflector.position.z
          },
          rotation: {
            x: mirrorData.reflector.rotation.x,
            y: mirrorData.reflector.rotation.y,
            z: mirrorData.reflector.rotation.z
          },
          scale: {
            x: mirrorData.reflector.scale.x,
            y: mirrorData.reflector.scale.y,
            z: mirrorData.reflector.scale.z
          },
          isFlipped: mirrorData.isFlipped,
          originalWidth: mirrorData.originalWidth,
          originalHeight: mirrorData.originalHeight
        }))
      }
    }
    
    // Download as JSON
    const json = JSON.stringify(settings, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'mirror_settings.json'
    link.click()
    
    console.log('Settings exported!')
    console.log(settings)
    
    // Save to localStorage
    localStorage.setItem('mirrorSettings', json)
    console.log('Settings saved to localStorage')
  }

  /**
   * Import mirror settings from JSON file
   */
  importSettings() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const settings = JSON.parse(event.target.result)
          this.applySettings(settings)
          console.log('Settings imported successfully!')
        } catch (error) {
          console.error('Error importing settings:', error)
          alert('Invalid JSON file!')
        }
      }
      reader.readAsText(file)
    }
    
    input.click()
  }

  /**
   * Apply imported settings
   */
  applySettings(settings) {
    // Apply GUI settings
    if (settings.scene) {
      this.#guiObj.y = settings.scene.modelYPosition || 0
    }
    
    if (settings.visibility) {
      this.#guiObj.showTitle = settings.visibility.showTitle ?? true
      this.#guiObj.showVirtualCameras = settings.visibility.showVirtualCameras ?? false
      this.#guiObj.showMirrors = settings.visibility.showManualMirrors ?? false
    }
    
    if (settings.mirrorSettings) {
      this.#guiObj.flipMirrors = settings.mirrorSettings.flipMirrors ?? false
      this.#guiObj.mirrorWidth = settings.mirrorSettings.mirrorWidth ?? 1.0
      this.#guiObj.mirrorHeight = settings.mirrorSettings.mirrorHeight ?? 1.0
      this.#guiObj.mirrorScale = settings.mirrorSettings.mirrorScale ?? 1.0
      this.#guiObj.mirrorShape = settings.mirrorSettings.mirrorShape ?? 'rectangle'
      this.#guiObj.mirrorCurvature = settings.mirrorSettings.mirrorCurvature ?? 0.0
      this.#guiObj.mirrorRadius = settings.mirrorSettings.mirrorRadius ?? 5.0
    }
    
    if (settings.animation) {
      this.#guiObj.animationSpeed = settings.animation.speed ?? 1.0
      this.#guiObj.animationTime = settings.animation.time ?? 0.0
      this.#guiObj.playAnimation = settings.animation.playing ?? true
    }
    
    // Trigger GUI update
    this.updateGUI()
    
    // Save to localStorage
    localStorage.setItem('mirrorSettings', JSON.stringify(settings))
    console.log('Settings applied and saved!')
  }

  /**
   * Reset settings to default
   */
  resetSettings() {
    this.#guiObj.y = 0
    this.#guiObj.showTitle = true
    this.#guiObj.showVirtualCameras = false
    this.#guiObj.showMirrors = false
    this.#guiObj.flipMirrors = true // Default: flipped
    this.#guiObj.mirrorWidth = 3.0 // Default: 3x
    this.#guiObj.mirrorHeight = 3.0 // Default: 3x
    this.#guiObj.mirrorScale = 1.0
    this.#guiObj.mirrorShape = 'rectangle'
    this.#guiObj.mirrorCurvature = 0.0
    this.#guiObj.mirrorRadius = 5.0
    this.#guiObj.animationSpeed = 1.0
    this.#guiObj.animationTime = 0.0
    this.#guiObj.playAnimation = true
    
    // Reset camera to default position
    this.#camera.position.set(-0.29616269737491346, 0.5536197835771841, 2.2819253056699145)
    this.#camera.rotation.set(-0.1247514335412133, -0.13577442993308741, -0.016972579045198086)
    
    this.updateGUI()
    
    // Clear localStorage
    localStorage.removeItem('mirrorSettings')
    console.log('Settings reset to default!')
  }

  /**
   * Update GUI to reflect current values
   */
  updateGUI() {
    // Manually trigger change handlers
    const titleEl = document.querySelector('.main-title')
    
    if (this.#model) {
      this.#model.position.y = this.#guiObj.y
    }
    if (titleEl) titleEl.style.display = this.#guiObj.showTitle ? 'block' : 'none'
    
    if (this.#virtualCameraMarker) {
      this.#virtualCameraMarker.visible = this.#guiObj.showVirtualCameras
    }
    if (this.#virtualCameraMarker2) {
      this.#virtualCameraMarker2.visible = this.#guiObj.showVirtualCameras
    }
    
    this.#dynamicMirrors.forEach((mirrorData) => {
      mirrorData.marker.visible = this.#guiObj.showVirtualCameras
    })
    
    if (this.#mirror) {
      this.#mirror.visible = this.#guiObj.showMirrors
    }
    if (this.#mirror2) {
      this.#mirror2.visible = this.#guiObj.showMirrors
    }
  }

  /**
   * Load settings from localStorage on init
   */
  loadSavedSettings() {
    const saved = localStorage.getItem('mirrorSettings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        this.applySettings(settings)
        console.log('Loaded saved settings from localStorage')
      } catch (error) {
        console.error('Error loading saved settings:', error)
      }
    }
  }

  /**
   * Update mirror shapes when shape changes
   */
  updateMirrorShapes() {
    this.#dynamicMirrors.forEach((mirrorData) => {
      const reflector = mirrorData.reflector
      const backing = mirrorData.backing
      const originalWidth = mirrorData.originalWidth
      const originalHeight = mirrorData.originalHeight
      
      // Create new geometry with current shape
      const newGeometry = this.createMirrorGeometry(originalWidth, originalHeight, this.#guiObj.mirrorShape)
      
      // Update reflector geometry
      reflector.geometry.dispose() // Clean up old geometry
      reflector.geometry = newGeometry
      
      // Update backing geometry
      if (backing) {
        backing.geometry.dispose()
        backing.geometry = this.createMirrorGeometry(originalWidth, originalHeight, this.#guiObj.mirrorShape)
      }
    })
    
    console.log('Mirror shapes updated to:', this.#guiObj.mirrorShape)
  }

  /**
   * Update mirror curvature - switch between flat and curved mirrors
   */
  updateMirrorCurvature() {
    console.log('Updating mirror curvature to:', this.#guiObj.mirrorCurvature)
    
    const useCurvedMirror = Math.abs(this.#guiObj.mirrorCurvature) > 0.001
    
    this.#dynamicMirrors.forEach((mirrorData) => {
      const reflector = mirrorData.reflector
      const originalMesh = mirrorData.originalMesh
      
      // Check if we need to switch mirror type
      const isCurvedMaterial = reflector.material && reflector.material.uniforms && reflector.material.uniforms.curvature
      
      if (useCurvedMirror && !isCurvedMaterial) {
        // Switch from flat to curved
        console.log('Switching to CURVED mirror for:', mirrorData.name)
        
        // Dispose old material
        if (reflector.material && reflector.material.dispose) {
          reflector.material.dispose()
        }
        
        // Create new curved material
        const curvedMaterial = this.createCurvedMirrorMaterial(reflector.position)
        reflector.material = curvedMaterial
        
      } else if (!useCurvedMirror && isCurvedMaterial) {
        // Switch from curved to flat
        console.log('Switching to FLAT mirror for:', mirrorData.name)
        
        // Need to recreate as Reflector
        // This is complex, so just recreate all mirrors
        this.recreateAllMirrors()
        return
      } else if (useCurvedMirror && isCurvedMaterial) {
        // Already curved, just update uniforms
        console.log('Updating curved mirror uniforms for:', mirrorData.name)
        if (reflector.material.uniforms.curvature) {
          reflector.material.uniforms.curvature.value = this.#guiObj.mirrorCurvature
        }
        if (reflector.material.uniforms.mirrorRadius) {
          reflector.material.uniforms.mirrorRadius.value = this.#guiObj.mirrorRadius
        }
      }
    })
  }
  
  /**
   * Recreate all mirrors from scratch
   */
  recreateAllMirrors() {
    console.log('Recreating all mirrors...')
    
    // Clear existing dynamic mirrors
    this.#dynamicMirrors.forEach((mirrorData) => {
      this.#scene.remove(mirrorData.reflector)
      this.#scene.remove(mirrorData.backing)
      this.#scene.remove(mirrorData.marker)
      
      if (mirrorData.reflector.geometry) mirrorData.reflector.geometry.dispose()
      if (mirrorData.reflector.material) {
        if (mirrorData.reflector.material.dispose) {
          mirrorData.reflector.material.dispose()
        }
      }
      if (mirrorData.backing.geometry) mirrorData.backing.geometry.dispose()
      if (mirrorData.backing.material) mirrorData.backing.material.dispose()
      if (mirrorData.marker.geometry) mirrorData.marker.geometry.dispose()
      if (mirrorData.marker.material) mirrorData.marker.material.dispose()
      
      // Show original mesh again
      if (mirrorData.originalMesh) {
        mirrorData.originalMesh.visible = true
      }
    })
    
    this.#dynamicMirrors = []
    
    // Recreate mirrors with new settings
    this.createMirrorsFromModel()
  }

  /**
   * Load CPU mode setting from localStorage
   */
  loadCPUModeSetting() {
    const cpuMode = localStorage.getItem('cpuOnlyMode')
    const lowMemMode = localStorage.getItem('lowMemoryMode')
    const fps = localStorage.getItem('targetFPS')
    
    if (cpuMode !== null) {
      this.#guiObj.cpuOnly = cpuMode === 'true'
    }
    if (lowMemMode !== null) {
      this.#guiObj.lowMemoryMode = lowMemMode === 'true'
    }
    if (fps !== null) {
      this.#guiObj.targetFPS = parseInt(fps)
    }
    
    console.log('Performance Settings:', {
      cpuOnly: this.#guiObj.cpuOnly,
      lowMemory: this.#guiObj.lowMemoryMode,
      targetFPS: this.#guiObj.targetFPS
    })
  }

  /**
   * Save performance settings to localStorage
   */
  savePerformanceSettings() {
    localStorage.setItem('cpuOnlyMode', this.#guiObj.cpuOnly.toString())
    localStorage.setItem('lowMemoryMode', this.#guiObj.lowMemoryMode.toString())
    localStorage.setItem('targetFPS', this.#guiObj.targetFPS.toString())
    console.log('Performance settings saved')
  }
  
  /**
   * Save CPU mode setting to localStorage (legacy support)
   */
  saveCPUModeSetting() {
    this.savePerformanceSettings()
  }

  /**
   * List of events
   */
  events() {
    window.addEventListener('resize', this.handleResize, { passive: true })
    
    // Initialize frame timing for FPS limiting
    this.#lastFrameTime = performance.now()
    this.#frameInterval = 1000 / this.#guiObj.targetFPS
    
    this.draw(0)
  }

  // EVENTS

  /**
   * Request animation frame function
   * This function is called 60/time per seconds with no performance issue
   * Everything that happens in the scene is drawed here
   * @param {Number} now
   */
  draw = (currentTime) => {
    // FPS limiting for low-end devices
    const elapsed = currentTime - this.#lastFrameTime
    
    if (elapsed < this.#frameInterval) {
      this.raf = window.requestAnimationFrame(this.draw)
      return
    }
    
    this.#lastFrameTime = currentTime - (elapsed % this.#frameInterval)
    
    this.#stats.begin()

    if (this.#controls) this.#controls.update() // for damping
    
    // Update CubeCamera for environment reflections (for curved mirrors)
    // Skip in CPU-only or low memory mode to reduce GPU load
    if (!this.#guiObj.cpuOnly && !this.#guiObj.lowMemoryMode && this.#cubeCamera && this.#cubeRenderTarget && Math.abs(this.#guiObj.mirrorCurvature) > 0.001) {
      // Position cube camera at scene center for better environment capture
      this.#cubeCamera.position.set(0, 0, 0)
      
      // Hide mirrors temporarily to avoid recursive reflections
      this.#dynamicMirrors.forEach((mirrorData) => {
        if (mirrorData.reflector) {
          mirrorData.reflector.visible = false
        }
      })
      
      // Update cube camera
      this.#cubeCamera.update(this.#renderer, this.#scene)
      
      // Show mirrors again
      this.#dynamicMirrors.forEach((mirrorData) => {
        if (mirrorData.reflector) {
          mirrorData.reflector.visible = true
        }
      })
    }
    
    // Update animation mixer
    if (this.#mixer) {
      if (this.#guiObj.playAnimation) {
        // Auto play with speed control
        const delta = 0.016 * this.#guiObj.animationSpeed
        this.#mixer.update(delta)
        
        // Update time slider
        if (this.#maxAnimationDuration > 0) {
          this.#guiObj.animationTime = (this.#mixer.time % this.#maxAnimationDuration)
        }
      } else {
        // Manual control - set time from slider
        this.#mixer.setTime(this.#guiObj.animationTime)
      }
    }
    
    // Update virtual camera marker 1 (front mirror)
    if (this.#virtualCameraMarker) {
      const mirrorZ = this.#mirror.position.z
      
      // Calculate mirrored position (reflect across the mirror plane at z = -3)
      this.#virtualCameraMarker.position.x = this.#camera.position.x
      this.#virtualCameraMarker.position.y = this.#camera.position.y
      this.#virtualCameraMarker.position.z = 2 * mirrorZ - this.#camera.position.z
      
      // Make marker look at origin (same as camera)
      this.#virtualCameraMarker.lookAt(0, 0, 0)
    }

    // Update virtual camera marker 2 (right mirror)
    if (this.#virtualCameraMarker2) {
      const mirrorX = this.#mirror2.position.x
      
      // Calculate mirrored position (reflect across the mirror plane at x = 3)
      this.#virtualCameraMarker2.position.x = 2 * mirrorX - this.#camera.position.x
      this.#virtualCameraMarker2.position.y = this.#camera.position.y
      this.#virtualCameraMarker2.position.z = this.#camera.position.z
      
      // Make marker look at origin
      this.#virtualCameraMarker2.lookAt(0, 0, 0)
    }

    // Update dynamic mirrors' virtual camera markers
    // In CPU-only mode, skip complex shader uniform updates
    this.#dynamicMirrors.forEach((mirrorData) => {
      const reflector = mirrorData.reflector
      const backing = mirrorData.backing
      const marker = mirrorData.marker
      const originalMesh = mirrorData.originalMesh
      
      // Sync reflector position/rotation with animated original mesh
      if (originalMesh) {
        originalMesh.updateWorldMatrix(true, false)
        reflector.position.copy(originalMesh.getWorldPosition(new Vector3()))
        
        // Get base rotation from original mesh
        const baseQuat = originalMesh.getWorldQuaternion(new Quaternion())
        
        // Apply flip if enabled
        if (this.#guiObj.flipMirrors) {
          reflector.quaternion.copy(baseQuat)
          reflector.rotateY(Math.PI)
        } else {
          reflector.quaternion.copy(baseQuat)
        }
        
        // Apply custom scale from GUI
        const baseScale = originalMesh.getWorldScale(new Vector3())
        reflector.scale.set(
          baseScale.x * this.#guiObj.mirrorWidth * this.#guiObj.mirrorScale,
          baseScale.y * this.#guiObj.mirrorHeight * this.#guiObj.mirrorScale,
          baseScale.z * this.#guiObj.mirrorScale
        )
        
        // Update backing plane to match reflector
        if (backing) {
          backing.position.copy(reflector.position)
          backing.quaternion.copy(reflector.quaternion)
          backing.scale.copy(reflector.scale)
          backing.translateZ(-0.01) // Keep it slightly behind
        }
      }
      
      // Update curved mirror material uniforms if using custom shader
      // Skip in CPU-only or low memory mode to reduce overhead
      if (!this.#guiObj.cpuOnly && !this.#guiObj.lowMemoryMode && reflector.material && reflector.material.uniforms) {
        if (reflector.material.uniforms.uCameraPosition) {
          reflector.material.uniforms.uCameraPosition.value.copy(this.#camera.position)
        }
        if (reflector.material.uniforms.curvature) {
          reflector.material.uniforms.curvature.value = this.#guiObj.mirrorCurvature
        }
        if (reflector.material.uniforms.mirrorRadius) {
          reflector.material.uniforms.mirrorRadius.value = this.#guiObj.mirrorRadius
        }
        if (reflector.material.uniforms.mirrorCenter) {
          reflector.material.uniforms.mirrorCenter.value.copy(reflector.position)
        }
      }
      
      // Get mirror's normal vector (facing direction)
      const normal = new Vector3(0, 0, 1)
      normal.applyQuaternion(reflector.quaternion)
      
      // Calculate reflection of camera position across the mirror plane
      const mirrorPos = reflector.position
      const cameraPos = this.#camera.position
      
      // Vector from mirror to camera
      const toCamera = new Vector3().subVectors(cameraPos, mirrorPos)
      
      // Project onto normal to get distance along normal
      const distance = toCamera.dot(normal)
      
      // Reflect: mirror position - distance along normal
      const reflected = new Vector3().copy(mirrorPos).sub(normal.clone().multiplyScalar(2 * distance))
      
      marker.position.copy(reflected)
      marker.lookAt(mirrorPos)
    })
    
    this.#renderer.render(this.#scene, this.#camera)

    this.#stats.end()
    this.raf = window.requestAnimationFrame(this.draw)
  }

  /**
   * On resize, we need to adapt our camera based
   * on the new window width and height and the renderer
   */
  handleResize = () => {
    this.#width = window.innerWidth
    this.#height = window.innerHeight

    // Update camera
    this.#camera.aspect = this.#width / this.#height
    this.#camera.updateProjectionMatrix()

    // Use lower pixel ratio in CPU-only or low memory mode
    let DPR = 1
    if (!this.#guiObj.cpuOnly && !this.#guiObj.lowMemoryMode) {
      DPR = Math.min(window.devicePixelRatio || 1, 2) // Cap at 2x for performance
    }

    this.#renderer.setPixelRatio(DPR)
    this.#renderer.setSize(this.#width, this.#height)
  }
}
