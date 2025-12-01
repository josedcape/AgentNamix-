
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgentControl } from './components/AgentControl';
import { TaskBoard } from './components/TaskBoard';
import { LogTerminal } from './components/LogTerminal';
import { HelpSystem } from './components/HelpSystem';
import { Modeler3D } from './components/Modeler3D';
import { Task, LogEntry, AgentStatus, AgentConfiguration } from './types';
import { createPlan, executeTask } from './services/gemini';

// Sonido de inicio (Futuristic Interface Start)
const STARTUP_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3";

const App: React.FC = () => {
  const [status, setStatus] = useState<AgentStatus>(AgentStatus.IDLE);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [goal, setGoal] = useState<string>('');
  const [agentConfig, setAgentConfig] = useState<AgentConfiguration>({
    name: 'AutoAgent',
    description: '',
    tools: [],
    model: 'gemini-2.5-flash', // Default model
    documents: []
  });
  const [isModelerOpen, setIsModelerOpen] = useState(false);
  
  const statusRef = useRef<AgentStatus>(AgentStatus.IDLE);
  const tasksRef = useRef<Task[]>([]);
  const goalRef = useRef<string>('');
  const agentConfigRef = useRef<AgentConfiguration>(agentConfig);
  const [activeBrowserAction, setActiveBrowserAction] = useState<any>(null);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { goalRef.current = goal; }, [goal]);
  useEffect(() => { agentConfigRef.current = agentConfig; }, [agentConfig]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      message,
      type
    };
    setLogs(prev => [...prev, newLog]);
  }, []);

  const playStartupSound = () => {
    try {
      const audio = new Audio(STARTUP_SOUND_URL);
      audio.volume = 0.4; // Volumen moderado
      audio.play().catch(err => console.warn("No se pudo reproducir audio (interacción requerida):", err));
    } catch (e) {
      console.error("Error inicializando audio", e);
    }
  };

  const handleStart = async (newGoal: string, config: AgentConfiguration) => {
    playStartupSound(); // Trigger sound effect
    
    setGoal(newGoal);
    setAgentConfig(config);
    setTasks([]);
    setLogs([]);
    setStatus(AgentStatus.PLANNING);
    
    addLog(`Sistema Inicializado. Identidad del Agente: "${config.name}"`, 'system');
    addLog(`Objetivo: "${newGoal}"`, 'system');
    addLog(`Motor de IA Seleccionado: ${config.model}`, 'system');
    
    if (config.documents && config.documents.length > 0) {
      addLog(`Base de Conocimiento: ${config.documents.length} archivos cargados`, 'system');
    }

    if (config.tools.length > 0) {
      addLog(`Módulos Cargados: ${config.tools.join(', ')}`, 'system');
    }
    
    try {
      addLog("Construyendo Plan Táctico...", 'ai');
      const planSteps = await createPlan(newGoal, config);
      
      if (planSteps.length === 0) {
        throw new Error("La IA no pudo generar un plan.");
      }

      const newTasks: Task[] = planSteps.map((step, index) => ({
        id: `task-${index}`,
        description: step,
        status: 'pending'
      }));

      setTasks(newTasks);
      addLog(`Plan Autorizado: ${newTasks.length} fases en cola.`, 'success');
      setStatus(AgentStatus.EXECUTING);
    } catch (error: any) {
      addLog(`Fallo Crítico de Planificación: ${error.message || 'Error desconocido'}`, 'error');
      setStatus(AgentStatus.ERROR);
    }
  };

  const handleStop = () => {
    setStatus(AgentStatus.IDLE);
    addLog("Secuencia Abortada por el Usuario.", 'system');
  };

  const handleReset = () => {
    setStatus(AgentStatus.IDLE);
    setTasks([]);
    setLogs([]);
    setGoal('');
  };

  useEffect(() => {
    const executeNextStep = async () => {
      if (statusRef.current !== AgentStatus.EXECUTING) return;

      const currentTasks = tasksRef.current;
      const nextTaskIndex = currentTasks.findIndex(t => t.status === 'pending');

      if (nextTaskIndex === -1) {
        setStatus(AgentStatus.FINISHED);
        addLog("Misión Cumplida. Todas las tareas verificadas.", 'success');
        return;
      }

      const taskToRun = currentTasks[nextTaskIndex];

      setTasks(prev => prev.map(t => 
        t.id === taskToRun.id ? { ...t, status: 'processing' } : t
      ));
      addLog(`Ejecutando Fase ${nextTaskIndex + 1}: ${taskToRun.description}`, 'info');

      try {
        const context = currentTasks
          .filter(t => t.status === 'completed' && t.result)
          .map(t => `Tarea: ${t.description}\nResultado: ${t.result}`)
          .join('\n\n');

        // Pass the callback to visualize browser actions
        const result = await executeTask(
            taskToRun, 
            context, 
            goalRef.current, 
            agentConfigRef.current,
            (action) => {
                // When agent signals an action, update UI state for the overlay
                setActiveBrowserAction(action);
                // Clear the overlay after a delay to simulate action completion visually
                setTimeout(() => setActiveBrowserAction(null), 3000);
            }
        );

        setTasks(prev => prev.map(t => 
          t.id === taskToRun.id ? { ...t, status: 'completed', result } : t
        ));
        addLog(`Fase ${nextTaskIndex + 1} Completa.`, 'success');
        
        setTimeout(() => {}, 1000);

      } catch (error: any) {
        console.error(error);
        setTasks(prev => prev.map(t => 
          t.id === taskToRun.id ? { ...t, status: 'failed', result: error.message } : t
        ));
        addLog(`Fallo de Fase: ${error.message}`, 'error');
        setStatus(AgentStatus.ERROR); 
      }
    };

    if (status === AgentStatus.EXECUTING) {
      executeNextStep();
    }
  }, [status, tasks]);

  // Translate Status for Display
  const getStatusLabel = (s: AgentStatus) => {
    switch(s) {
      case AgentStatus.IDLE: return 'INACTIVO';
      case AgentStatus.PLANNING: return 'PLANIFICANDO';
      case AgentStatus.EXECUTING: return 'EJECUTANDO';
      case AgentStatus.FINISHED: return 'FINALIZADO';
      case AgentStatus.ERROR: return 'ERROR';
      default: return s;
    }
  };

  return (
    <div className="min-h-screen text-gray-100 p-4 md:p-6 font-sans overflow-hidden">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Help System Overlay */}
      <HelpSystem />
      
      {/* 3D Modeler Modal */}
      <Modeler3D isOpen={isModelerOpen} onClose={() => setIsModelerOpen(false)} />

      {/* Floating 3D Modeler Button (NEW) */}
      {agentConfig.tools.includes('model_3d') && (
          <button 
            onClick={() => setIsModelerOpen(true)}
            className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full shadow-[0_0_20px_rgba(192,132,252,0.5)] flex items-center justify-center text-white z-50 transition-all hover:scale-110 border border-purple-400 group"
            title="Abrir Estudio 3D"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            <span className="absolute right-16 bg-purple-900 text-purple-100 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-purple-700 font-bold">
                MODELO 3D
            </span>
          </button>
      )}

      <div className="max-w-[1600px] mx-auto h-[calc(100vh-3rem)] flex flex-col relative z-10">
        
        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-4 rounded-xl border-t border-cyan-500/30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse"></div>
            </div>
            <div>
              <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
                  <h1 className="text-3xl md:text-4xl font-display font-bold tracking-wide agent-title-laser" data-text="AGENTNAMIX">
                    AGENTNAMIX
                  </h1>
                  <div className="px-3 py-1 rounded border border-emerald-500/30 bg-emerald-900/10 flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.2)] backdrop-blur-md transform translate-y-[-2px]">
                     <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_5px_#34d399]"></div>
                     <span className="text-[10px] md:text-xs font-mono font-bold text-emerald-300 tracking-[0.15em] uppercase" style={{ textShadow: '0 0 5px rgba(52, 211, 153, 0.5)' }}>
                        BOTIDINAMIX AI 2025
                     </span>
                  </div>
              </div>
              <p className="text-cyan-200/60 text-xs uppercase tracking-[0.2em] font-mono mt-1">Unidad de Inteligencia Autónoma</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
               <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Estado del Sistema</span>
               <div className={`px-4 py-1 rounded-sm text-xs font-mono font-bold border-l-2 uppercase tracking-widest transition-all duration-300 ${
                 status === AgentStatus.IDLE ? 'border-gray-500 text-gray-400 bg-gray-800/50' :
                 status === AgentStatus.EXECUTING ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]' :
                 status === AgentStatus.PLANNING ? 'border-yellow-500 text-yellow-400 bg-yellow-900/30 animate-pulse' :
                 status === AgentStatus.FINISHED ? 'border-green-500 text-green-400 bg-green-900/30' :
                 'border-red-500 text-red-400 bg-red-900/30'
               }`}>
                 {getStatusLabel(status)}
               </div>
             </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Left Column: Control Deck */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full min-h-0 overflow-y-auto no-scrollbar">
            <AgentControl 
              onStart={handleStart} 
              onStop={handleStop}
              onReset={handleReset}
              status={status}
              hasKey={!!process.env.API_KEY}
            />
            <div className="flex-1 min-h-[300px] glass-panel rounded-xl overflow-hidden border border-gray-800 flex flex-col">
               <LogTerminal logs={logs} />
            </div>
          </div>

          {/* Right Column: The "Canvas" */}
          <div className="lg:col-span-8 h-full min-h-0">
            <TaskBoard 
                tasks={tasks} 
                activeBrowserAction={activeBrowserAction}
                agentConfig={agentConfig}
                goal={goal}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
