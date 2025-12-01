
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
  const frameIdRef = useRef<number>(0);

  // Initialize ThreeJS Scene
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    // Cleanup previous if any
    if (rendererRef.current) {
        try {
            mountRef.current.innerHTML = '';
        } catch(e) {}
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 10, 50);
    sceneRef.current = scene;

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Animation Loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
        if (!mountRef.current || !camera || !renderer) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(frameIdRef.current);
        renderer.dispose();
    };
  }, [isOpen]);

  const handleGenerate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || !sceneRef.current) return;

      setIsGenerating(true);
      setError(null);

      try {
          const code = await generate3DCode(prompt);
          
          // Clear previous meshes to keep it clean (keeping helpers/lights)
          sceneRef.current.children = sceneRef.current.children.filter(obj => 
              obj.type === 'GridHelper' || obj.type === 'AmbientLight' || obj.type === 'DirectionalLight' || obj.type === 'Fog'
          );

          // Execute Code safely
          // We expose 'scene' and 'THREE' to the evaluated code
          const func = new Function('scene', 'THREE', code);
          func(sceneRef.current, THREE);

      } catch (err: any) {
          console.error(err);
          setError("Error al generar el modelo. Intenta otra instrucción.");
      } finally {
          setIsGenerating(false);
          setPrompt('');
      }
  };

  const handleExport = () => {
      if (!sceneRef.current) return;
      
      const exporter = new GLTFExporter();
      exporter.parse(
          sceneRef.current,
          (gltf) => {
              const blob = new Blob([JSON.stringify(gltf)], { type: 'application/octet-stream' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `modelo_agentnamix_${Date.now()}.glb`;
              link.click();
          },
          (err) => console.error("Export failed", err),
          { binary: true }
      );
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !sceneRef.current) return;

      const loader = new GLTFLoader();
      const url = URL.createObjectURL(file);
      
      loader.load(url, (gltf) => {
          sceneRef.current?.add(gltf.scene);
          // Auto center
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);
      }, undefined, (err) => console.error(err));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in-up">
      <div className="w-[90vw] h-[85vh] bg-[#090c10] border border-cyan-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                </div>
                <div>
                    <h2 className="text-lg font-display font-bold text-white tracking-wider">ESTUDIO HOLO-3D</h2>
                    <p className="text-[10px] text-cyan-400 font-mono uppercase tracking-widest">Motor de Modelado Generativo</p>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Left Control Panel */}
            <div className="w-80 bg-gray-900/80 border-r border-gray-800 p-6 flex flex-col gap-6 backdrop-blur-sm z-10">
                
                {/* Generation Form */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest">Instrucción Generativa</label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ej: Crea una esfera roja brillante flotando sobre un plano metálico..."
                        className="w-full h-32 bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-cyan-500 outline-none resize-none font-mono"
                    />
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg font-bold text-white shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                                CONSTRUYENDO...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                GENERAR MODELO
                            </>
                        )}
                    </button>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>

                <div className="h-px bg-gray-800"></div>

                {/* Actions */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Acciones</label>
                    
                    <div className="relative group">
                        <input type="file" accept=".glb,.gltf" onChange={handleUpload} className="hidden" id="upload3d" />
                        <label htmlFor="upload3d" className="flex items-center justify-center gap-2 w-full py-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-gray-300 cursor-pointer transition-colors text-sm font-bold">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            CARGAR .GLB
                        </label>
                    </div>

                    <button 
                        onClick={handleExport}
                        className="w-full py-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-gray-300 transition-colors text-sm font-bold flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        EXPORTAR .GLB
                    </button>
                </div>

                <div className="mt-auto text-[10px] text-gray-600 font-mono text-center">
                    Powered by Three.js & Gemini 2.5
                </div>
            </div>

            {/* 3D Viewport */}
            <div className="flex-1 relative bg-black">
                <div ref={mountRef} className="w-full h-full cursor-move"></div>
                
                {/* Overlay UI in Viewport */}
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur rounded px-3 py-1 text-xs text-gray-400 font-mono pointer-events-none">
                    CLICK IZQ: ROTAR | CLICK DER: PAN | RUEDA: ZOOM
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
