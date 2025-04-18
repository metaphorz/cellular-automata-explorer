import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import { stepAutomaton } from './CellularAutomata';

// Helper to create a shadow-casting directional light for the scene
function createShadowLight(resolution) {
  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(resolution * 2, resolution * 3, resolution * 2);
  light.castShadow = true;
  light.shadow.mapSize.width = 2048;
  light.shadow.mapSize.height = 2048;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = resolution * 10;
  light.shadow.camera.left = -resolution * 12;
  light.shadow.camera.right = resolution * 12;
  light.shadow.camera.top = resolution * 12;
  light.shadow.camera.bottom = -resolution * 12;
  light.shadow.bias = -0.001;
  return light;
}

// Helper to create a ground plane that receives shadows
function createGroundPlane(resolution) {
  const groundGeo = new THREE.PlaneGeometry(resolution * 20, resolution * 20);
  const groundMat = new THREE.MeshPhongMaterial({ color: 0x888888, depthWrite: false });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  return ground;
}

export default function Automata3D({
  resolution = 32,
  rule = 'life',
  speed = 10,
  running = false,
  onStart = () => {},
  onClear = () => {},
  grid: externalGrid = null,
}) {
  const mountRef = useRef();
  const sceneRef = useRef();
  const rendererRef = useRef();
  const cameraRef = useRef();
  const cubesRef = useRef([]);
  const [localGrid, setLocalGrid] = useState(
    Array.from({ length: resolution }, () => Array(resolution).fill(0))
  );
  const [showLight, setShowLight] = useState(false);

  // When the grid resolution changes, reset the local grid and stop the simulation
  useEffect(() => {
    setLocalGrid(Array.from({ length: resolution }, () => Array(resolution).fill(0)));
    setIsRunning(false);
  }, [resolution]);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  // Synchronize the local grid with an externally provided grid (e.g., when clearing)
  useEffect(() => {
    if (externalGrid) {
      // If externalGrid is a flat array, convert to 2D array
      if (Array.isArray(externalGrid) && typeof externalGrid[0] === 'number') {
        const newGrid = [];
        for (let i = 0; i < resolution; i++) {
          newGrid.push(Array.from(externalGrid.slice(i * resolution, (i + 1) * resolution)));
        }
        setLocalGrid(newGrid);
      } else if (Array.isArray(externalGrid) && Array.isArray(externalGrid[0])) {
        // If already 2D, clone the array to prevent mutation
        setLocalGrid(externalGrid.map(row => row.slice()));
      }
    }
  }, [externalGrid, resolution]);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    // --- THREE.js Scene Setup ---
    // Set up the 3D scene, camera, and grid helper
    const width = 600;
    const height = 600;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(resolution * 1.2, resolution * 1.2, resolution * 1.2);
    camera.lookAt(0, 0, 0);
    // Add a grid helper for orientation reference
    const gridHelper = new THREE.GridHelper(resolution * 14, resolution, 0x888888, 0xcccccc);
    scene.add(gridHelper);
    sceneRef.current = scene;
    cameraRef.current = camera;

    // --- Lighting Setup ---
    // Add ambient light for general illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    let dir;
    let shadowLight;
    let ground;
    if (showLight) {
      // Add a directional light that orbits the grid and casts shadows
      shadowLight = createShadowLight(resolution);
      scene.add(shadowLight);
      // Add a ground plane to receive shadows from cubes
      ground = createGroundPlane(resolution);
      scene.add(ground);
    }
    } else {
      dir = new THREE.DirectionalLight(0xffffff, 0.6);
      dir.position.set(1, 2, 2);
      scene.add(dir);
    }

    // --- Renderer Setup ---
    // Create and configure the WebGL renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = showLight;
    if (showLight) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    mountRef.current.appendChild(renderer.domElement);

    // --- Grid of Cubes ---
    // Create a grid of cubes representing the automaton cells
    const cubes = [];
    const cellSize = 14;
    const gap = 2; // spacing between cubes
    const flatHeight = 2; // initial flat cube height
    for (let x = 0; x < resolution; x++) {
      for (let z = 0; z < resolution; z++) {
        const geometry = new THREE.BoxGeometry(cellSize, flatHeight, cellSize);
        const material = new THREE.MeshPhongMaterial({ color: 0x3399ff });
        const cube = new THREE.Mesh(geometry, material);
        if (showLight) {
          cube.castShadow = true;
          cube.receiveShadow = true;
        }
        cube.position.set(
          x * (cellSize + gap) - (resolution * (cellSize + gap)) / 2 + cellSize / 2,
          showLight ? 10 : flatHeight / 2,
          z * (cellSize + gap) - (resolution * (cellSize + gap)) / 2 + cellSize / 2
        );
        scene.add(cube);
        cubes.push(cube);
      }
    }
    cubesRef.current = cubes;

    // --- Mouse Interaction for Editing ---
    // Allow users to select and modify cell states by clicking/dragging on cubes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function getIntersects(event) {
      // Convert mouse event to normalized device coordinates and find intersected cubes
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects(cubesRef.current);
    }

    function handlePointerDown(event) {
      // Start drawing (cell selection)
      isDrawingRef.current = true;
      handlePointerMove(event);
    }

    function handlePointerUp() {
      // Stop drawing
      isDrawingRef.current = false;
    }

    function handlePointerMove(event) {
      // Set cell state when dragging or clicking
      if (!isDrawingRef.current) return;
      const intersects = getIntersects(event);
      if (intersects.length > 0) {
        const cube = intersects[0].object;
        const idx = cubesRef.current.indexOf(cube);
        if (idx !== -1) {
          const x = Math.floor(idx / resolution);
          const z = idx % resolution;
          setLocalGrid(prevGrid => {
            const newGrid = prevGrid.map(row => row.slice());
            newGrid[x][z] = newGrid[x][z] ? 0 : 1;
            return newGrid;
          });
        }
      }
    }

    // OrbitControls for rotation (enabled only when running)
    let controls = null;
    if (isRunning) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = true;
      controls.update();
    } else {
      renderer.domElement.addEventListener('pointerdown', handlePointerDown);
      renderer.domElement.addEventListener('pointerup', handlePointerUp);
      renderer.domElement.addEventListener('pointerleave', handlePointerUp);
      renderer.domElement.addEventListener('pointermove', handlePointerMove);
    }

    // Animation/render loop
    let animId;
    let orbitAngle = 0;
    function animate() {
      if (controls) controls.update();
      // Animate light orbit when enabled
      if (showLight && shadowLight) {
        orbitAngle += 0.01; // Speed of orbit
        const radius = resolution * 3;
        shadowLight.position.set(
          Math.cos(orbitAngle) * radius,
          resolution * 3,
          Math.sin(orbitAngle) * radius
        );
        shadowLight.target.position.set(0, 0, 0);
        shadowLight.target.updateMatrixWorld();
      }
      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    }
    animate();

    // Clean up
    return () => {
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      if (controls) controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(animId);
    };
    // eslint-disable-next-line
  }, [resolution, isRunning]);

  // Simulation interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setLocalGrid(prevGrid => {
          const flat = prevGrid.flat();
          const nextFlat = stepAutomaton(flat, rule, resolution);
          const nextGrid = [];
          for (let i = 0; i < resolution; i++) {
            nextGrid.push(Array.from(nextFlat.slice(i * resolution, (i + 1) * resolution)));
          }
          return nextGrid;
        });
      }, 1000 / speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, rule, resolution, speed]);

  // Update cube heights when localGrid changes
  useEffect(() => {
    const cellSize = 14;
    const gap = 2;
    const flatHeight = 2;
    // Defensive: ensure localGrid is valid and matches resolution
    if (!Array.isArray(localGrid) || localGrid.length !== resolution) return;
    for (let row of localGrid) {
      if (!Array.isArray(row) || row.length !== resolution) return;
    }
    cubesRef.current.forEach((cube, idx) => {
      const x = Math.floor(idx / resolution);
      const z = idx % resolution;
      const isAlive = localGrid[x]?.[z] || 0;
      const height = isAlive ? cellSize : flatHeight;
      cube.scale.y = height / flatHeight;
      cube.position.y = (height / 2);
      cube.material.color.set(isAlive ? 0x3399ff : 0xe0e0e0);
    });
    if (sceneRef.current && cameraRef.current && rendererRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [localGrid, resolution]);

  return (
    <div>
      <div style={{ textAlign: 'center', margin: '12px 0' }}>
        <button
          onClick={() => {
            setIsRunning(running => !running);
            if (!isRunning) onStart();
          }}
        >
          {isRunning ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => {
            setIsRunning(false);
            setLocalGrid(Array.from({ length: resolution }, () => Array(resolution).fill(0)));
            onClear();
          }}
          style={{ marginLeft: 8 }}
        >
          Clear
        </button>
        <button
          onClick={() => setShowLight(l => !l)}
          style={{ marginLeft: 8 }}
        >
          {showLight ? 'Light On' : 'Light Off'}
        </button>
      </div>
      <div ref={mountRef} style={{ width: 600, height: 600, margin: '0 auto', cursor: isRunning ? 'grab' : 'pointer' }} />
    </div>
  );
}
