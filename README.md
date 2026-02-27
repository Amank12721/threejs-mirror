# Three.js Mirror Reflection System

A real-time mirror reflection system built with Three.js and Vite. Supports dynamic mirrors from GLB files with virtual camera visualization.

## Features

- ✨ Real-time planar reflections using Three.js Reflector
- 🪞 Dynamic mirror detection from GLB files (name objects "Mirror" or ending with "_mirror")
- 📹 Virtual camera visualization (shows where reflection camera is positioned)
- 🎛️ GUI controls for mirror customization (flip, width, height)
- 🎬 Animation controls (play/pause, speed, timeline scrubbing)
- 💾 Export/Import settings as JSON
- 🔄 LocalStorage auto-save
- 📦 Export scene to GLB

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:5173/vite-threejs-template/

## Build

```bash
npm run build
```

## Usage

### Adding Mirrors to Your GLB

1. Create a plane in Blender/3D software
2. Name it with "Mirror" or ending with "_mirror":
   - `Mirror`
   - `Wall_Mirror`
   - `Floor_Mirror`
   - `Mirror_Flip` (will flip 180°)
3. Export as GLB
4. Place in `src/public/` folder
5. Update path in `src/js/components/scene.js`

### GUI Controls

**Visibility:**
- Show Title
- Show Virtual Cameras (red/blue wireframe boxes)
- Show Manual Mirrors
- Show Axes Helper

**Mirror Controls:**
- Flip Mirrors (180° rotation)
- Mirror Width (0.1 - 3.0)
- Mirror Height (0.1 - 3.0)

**Animation:**
- Play Animation (checkbox)
- Speed (0 - 3x)
- Timeline (manual scrubbing)

**Export/Import:**
- Export Scene to GLB
- Export Settings JSON
- Import Settings JSON
- Reset to Default

## How It Works

### Virtual Camera
Each mirror creates a virtual camera positioned symmetrically on the opposite side:

```
Virtual Camera Position = 2 × (Mirror Position) - (Main Camera Position)
```

The virtual camera renders the scene from behind the mirror, creating accurate reflections.

### Mirror Detection
Objects in GLB files are automatically detected if their name:
- Equals "mirror" (case insensitive)
- Ends with "_mirror"
- Ends with "_mirror_plane"

### Settings Persistence
Settings are automatically saved to localStorage and restored on page load.

## Tech Stack

- Three.js - 3D rendering
- Vite - Build tool
- lil-gui - GUI controls
- Stats.js - Performance monitoring

## License

MIT
