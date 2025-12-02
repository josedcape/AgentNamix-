
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { generate3DCode } from '../services/modeler';

interface Modeler3DProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Modeler3D: React.FC<Modeler3DProps> = ({ isOpen, onClose }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ThreeJS Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);
  const frameIdRef = useRef<number>(0);
  const zoomIntervalRef = useRef<number | null>(null);

  // --- CORE LOGIC: NORMALIZE & CENTER ---
  const normalizeAndCenter = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;

      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center object
      object.position.sub(center);

      // Scale to ~5 units
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
          const scaleFactor = 5 / maxDim;
          object.scale.multiplyScalar(scaleFactor);
      }
      
      // Lift to floor
      object.updateMatrixWorld(true);
      const newBox = new THREE.Box3().setFromObject(object);
      object.position.y += -newBox.min.y;
  };

  const resetCamera = () => {
      if (!cameraRef.current || !controlsRef.current) return;
      
      // Isometric-ish Hero View
      cameraRef.current.position.set(6, 4, 6);
      cameraRef.current.lookAt(0, 2, 0);
      
      controlsRef.current.target.set(0, 2, 0);
      controlsRef.current.update();
  };

  // --- CAMERA CONTROLS (CONTINUOUS ZOOM) ---
  const startZoom = (direction: number) => {
      if (zoomIntervalRef.current) return; // Already zooming
      
      const zoomSpeed = 0.2; // Units per tick
      
      const tick = () => {
          if (cameraRef.current) {
              const vec = new THREE.Vector3();
              cameraRef.current.getWorldDirection(vec);
              // Move camera along its look vector
              cameraRef.current.position.addScaledVector(vec, direction * zoomSpeed);
          }
          zoomIntervalRef.current = requestAnimationFrame(tick);
      };
      
      zoomIntervalRef.current = requestAnimationFrame(tick);
  };

  const stopZoom = () => {
      if (zoomIntervalRef.current) {
          cancelAnimationFrame(zoomIntervalRef.current);
          zoomIntervalRef.current = null;
      }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    // Clean DOM
    while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    // Transparent background to let CSS "Medical Grid" show through
    scene.background = null; 
    scene.fog = new THREE.FogExp2(0x02040a, 0.02);
    sceneRef.current = scene;

    // 2. Content Group
    const contentGroup = new THREE.Group();
    contentGroup.name = "CONTENT_ROOT";
    scene.add(contentGroup);
    contentGroupRef.current = contentGroup;

    // 3. Helpers (Subtle Polar Grid)
    const grid = new THREE.PolarGridHelper(30, 16, 8, 64, 0x06b6d4, 0x111827);
    grid.position.y = -0.05;
    scene.add(grid);

    // 4. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 5. Renderer
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true, // Crucial for glassmorphism background
        preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Retina support
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 6. Lighting Setup (Studio "No-Dark" Config)
    
    // Hemi: Sky White / Ground Dark Blue (0.7 intensity)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x0f172a, 0.7);
    scene.add(hemiLight);

    // Ambient: Soft base (0.6)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Key Light: Main Shadow Caster (Top Right)
    const keyLight = new THREE.SpotLight(0xfffaf0, 1.5);
    keyLight.position.set(10, 15, 10);
    keyLight.castShadow = true;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    // Rim Light: Neon Cyan Backlight (Back Left)
    const rimLight = new THREE.SpotLight(0x22d3ee, 2.0);
    rimLight.position.set(-5, 5, -10);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // Fill Light: Warm Amber (Front Low)
    const fillLight = new THREE.PointLight(0xffb000, 0.5);
    fillLight.position.set(0, 2, 5);
    scene.add(fillLight);

    // Back Light: Spine illumination
    const backLight = new THREE.PointLight(0xffffff, 0.4);
    backLight.position.set(0, 5, -5);
    scene.add(backLight);

    // 7. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Initial View
    resetCamera();

    // 8. Animation Loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler with Observer
    const handleResize = () => {
        if (!mountRef.current || !camera || !renderer) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);

    return () => {
        resizeObserver.disconnect();
        cancelAnimationFrame(frameIdRef.current);
        renderer.dispose();
        stopZoom(); // Cleanup any active zoom
    };
  }, [isOpen]);

  // --- HANDLERS ---

  const handleGenerate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || !sceneRef.current || !contentGroupRef.current) return;

      setIsGenerating(true);
      setError(null);

      try {
          const code = await generate3DCode(prompt);
          
          contentGroupRef.current.clear();

          // Sandbox execution
          const func = new Function('scene', 'THREE', 'root', `
            const proxy = {
                ...scene,
                add: (obj) => root.add(obj),
                position: scene.position,
                rotation: scene.rotation
            };
            ${code}
          `);
          
          func(sceneRef.current, THREE, contentGroupRef.current);

          normalizeAndCenter(contentGroupRef.current);
          resetCamera();

      } catch (err: any) {
          console.error(err);
          setError("Error en generación. Intenta reformular.");
      } finally {
          setIsGenerating(false);
          setPrompt('');
      }
  };

  const handleExport = () => {
      if (!contentGroupRef.current) return;
      const exporter = new GLTFExporter();
      exporter.parse(
          contentGroupRef.current,
          (gltf) => {
              const blob = new Blob([JSON.stringify(gltf)], { type: 'application/octet-stream' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `modelo_agentnamix_${Date.now()}.glb`;
              link.click();
          },
          (err) => console.error("Export error", err),
          { binary: true }
      );
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !contentGroupRef.current) return;

      const loader = new GLTFLoader();
      const url = URL.createObjectURL(file);
      
      loader.load(url, (gltf) => {
          contentGroupRef.current?.clear();
          contentGroupRef.current?.add(gltf.scene);
          normalizeAndCenter(contentGroupRef.current!);
          resetCamera();
      }, undefined, (err) => console.error(err));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in-up">
      <div className="w-[95vw] h-[90vh] bg-slate-950 border border-cyan-900/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="h-16 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 backdrop-blur-md z-20">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-900/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                </div>
                <div>
                    <h2 className="text-xl font-display font-bold text-white tracking-widest flex items-center gap-2">
                        HOLO-STUDIO <span className="text-cyan-500 text-xs px-1.5 py-0.5 border border-cyan-500 rounded">v4.0</span>
                    </h2>
                    <p className="text-[10px] text-gray-400 font-mono uppercase tracking-[0.2em]">Dashboard Profesional 3D</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-red-900/30 rounded-full transition-colors text-gray-500 hover:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
            
            {/* Left Sidebar (Controls) */}
            <div className="w-80 bg-gray-900/90 border-r border-gray-800 p-6 flex flex-col gap-6 backdrop-blur-md z-10 shrink-0 overflow-y-auto custom-scrollbar">
                
                {/* Generation Block */}
                <div className="space-y-4">
                    <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_5px_cyan]"></span>
                        Prompt Generativo
                    </label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: Un droide de combate con detalles neón..."
                        className="w-full h-40 bg-black/60 border border-gray-700 rounded-lg p-4 text-sm text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none font-mono transition-all"
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-bold text-white shadow-lg shadow-cyan-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase tracking-wider text-xs"
                    >
                        {isGenerating ? 'PROCESANDO...' : 'GENERAR MODELO'}
                    </button>
                    {error && <div className="text-red-400 text-xs">{error}</div>}
                </div>

                <div className="h-px bg-gray-800"></div>

                {/* File Ops */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Gestión</label>
                    <div className="relative group">
                        <input type="file" accept=".glb,.gltf" onChange={handleUpload} className="hidden" id="upload3d" />
                        <label htmlFor="upload3d" className="flex items-center justify-center gap-3 w-full py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-gray-500 text-gray-300 cursor-pointer transition-all text-xs font-bold shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            IMPORTAR .GLB
                        </label>
                    </div>
                    <button onClick={handleExport} className="w-full py-3 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:border-gray-500 text-gray-300 transition-all text-xs font-bold flex items-center justify-center gap-3 shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        EXPORTAR .GLB
                    </button>
                </div>
            </div>

            {/* Viewport Area */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden group">
                {/* Tech Grid Background (CSS) */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                
                {/* 3D Canvas */}
                <div ref={mountRef} className="w-full h-full cursor-crosshair z-10 relative outline-none"></div>
                
                {/* HUD: Camera Toolbar (Right Side) */}
                <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-30 flex flex-col gap-4 bg-slate-950/80 backdrop-blur-xl border border-cyan-900/50 p-2 rounded-xl shadow-2xl">
                    
                    {/* Zoom In */}
                    <button 
                        onPointerDown={() => startZoom(1)} 
                        onPointerUp={stopZoom} 
                        onPointerLeave={stopZoom}
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-900/20 border border-transparent hover:border-cyan-500/50 transition-all active:scale-95 group relative"
                        title="Acercar (Mantener)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        <div className="absolute right-full mr-2 bg-black/90 text-cyan-400 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-cyan-900">ACERCAR</div>
                    </button>
                    
                    {/* Zoom Out */}
                    <button 
                        onPointerDown={() => startZoom(-1)} 
                        onPointerUp={stopZoom} 
                        onPointerLeave={stopZoom}
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-900/20 border border-transparent hover:border-cyan-500/50 transition-all active:scale-95 group relative"
                        title="Alejar (Mantener)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        <div className="absolute right-full mr-2 bg-black/90 text-cyan-400 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-cyan-900">ALEJAR</div>
                    </button>

                    <div className="h-px bg-gray-800 w-full"></div>

                    {/* Reset */}
                    <button 
                        onClick={resetCamera}
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-900/20 border border-transparent hover:border-cyan-500/50 transition-all active:scale-95 group relative"
                        title="Resetear Vista"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <div className="absolute right-full mr-2 bg-black/90 text-cyan-400 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-cyan-900">RESET VISTA</div>
                    </button>
                </div>

                {/* Bottom Info Overlay */}
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur rounded px-3 py-1 text-[10px] text-gray-500 font-mono border border-white/5 pointer-events-none">
                    LIGHTING: STUDIO 4-POINT | GRID: POLAR | RENDER: WEBGL
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
