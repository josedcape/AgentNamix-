
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgentControl } from './components/AgentControl';
import { TaskBoard } from './components/TaskBoard';
import { LogTerminal } from './components/LogTerminal';
import { HelpSystem } from './components/HelpSystem';
import { CodeEditor } from './components/CodeEditor';
import { Modeler3D } from './components/Modeler3D';
import { Task, LogEntry, AgentStatus, AgentConfiguration } from './types';
import { createPlan, executeTask } from './services/gemini';
import { ProcessedDocument } from './services/fileProcessor';
import { ProjectStructure } from './services/architect';

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
    model: 'gemini-2.5-flash',
    documents: []
  });

  const [projectStructure, setProjectStructure] = useState<ProjectStructure | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
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
      audio.volume = 0.4;
      audio.play().catch(err => console.warn(err));
    } catch (e) {
      console.error(e);
    }
  };

  const handleStart = async (newGoal: string, config: AgentConfiguration) => {
    playStartupSound();
    setGoal(newGoal);
    setAgentConfig(config);
    setTasks([]);
    setLogs([]);
    setProjectStructure(null);
    setStatus(AgentStatus.PLANNING);
    addLog(`Sistema Inicializado: "${config.name}"`, 'system');
    
    try {
      addLog("Construyendo Plan Táctico...", 'ai');
      const planSteps = await createPlan(newGoal, config);
      const newTasks: Task[] = planSteps.map((step, index) => ({
        id: `task-${index}`,
        description: step,
        status: 'pending'
      }));
      setTasks(newTasks);
      addLog(`Plan Autorizado: ${newTasks.length} fases.`, 'success');
      setStatus(AgentStatus.EXECUTING);
    } catch (error: any) {
      addLog(`Fallo Crítico: ${error.message}`, 'error');
      setStatus(AgentStatus.ERROR);
    }
  };

  const handleStop = () => { setStatus(AgentStatus.IDLE); addLog("Secuencia Abortada.", 'system'); };
  const handleReset = () => { setStatus(AgentStatus.IDLE); setTasks([]); setLogs([]); setGoal(''); setProjectStructure(null); };

  const handleAddDocument = (doc: ProcessedDocument) => {
      setAgentConfig(prev => ({
          ...prev,
          documents: [...(prev.documents || []), { name: doc.name, content: doc.content }]
      }));
      addLog(`Archivo "${doc.name}" agregado.`, 'success');
  };

  const handleEditorAIRequest = async (instruction: string, currentFile?: string) => {
      const newTask: Task = {
          id: `edit-${Date.now()}`,
          description: `SOLICITUD EDITOR: ${instruction} ${currentFile ? `en ${currentFile}` : ''}.`,
          status: 'pending'
      };
      setTasks(prev => {
          const newQueue = [...prev];
          const activeIndex = prev.findIndex(t => t.status === 'processing');
          newQueue.splice(activeIndex + 1, 0, newTask);
          return newQueue;
      });
      if (status === AgentStatus.IDLE) setStatus(AgentStatus.EXECUTING);
      addLog(`Solicitud Editor: "${instruction}"`, 'ai');
  };

  // --- NEW HANDLER FOR FOLLOW UP QUESTIONS ---
  const handleFollowUp = (input: string) => {
      const newTask: Task = {
          id: `followup-${Date.now()}`,
          description: input, // The user question becomes the task description
          status: 'pending'
      };
      
      setTasks(prev => [...prev, newTask]);
      
      // If the agent was finished or idle, restart execution to process the new task
      if (status === AgentStatus.IDLE || status === AgentStatus.FINISHED) {
          setStatus(AgentStatus.EXECUTING);
      }
      
      addLog(`Nueva Directiva de Seguimiento: "${input}"`, 'system');
  };

  useEffect(() => {
    const executeNextStep = async () => {
      if (statusRef.current !== AgentStatus.EXECUTING) return;
      const currentTasks = tasksRef.current;
      const nextTaskIndex = currentTasks.findIndex(t => t.status === 'pending');

      if (nextTaskIndex === -1) {
        setStatus(AgentStatus.FINISHED);
        addLog("Misión Cumplida.", 'success');
        return;
      }

      const taskToRun = currentTasks[nextTaskIndex];
      setTasks(prev => prev.map(t => t.id === taskToRun.id ? { ...t, status: 'processing' } : t));
      addLog(`Ejecutando: ${taskToRun.description}`, 'info');

      try {
        const context = currentTasks
          .filter(t => t.status === 'completed' && t.result)
          .map(t => `Tarea: ${t.description}\nResultado: ${t.result}`)
          .join('\n\n');

        const projectContext = agentConfigRef.current.tools.includes('software_architect') && projectStructure
            ? `\n\n[PROYECTO ACTUAL]: ${projectStructure.files.map(f => f.path).join(', ')}` : "";

        const result = await executeTask(
            taskToRun, 
            context + projectContext, 
            goalRef.current, 
            agentConfigRef.current,
            (action) => { setActiveBrowserAction(action); setTimeout(() => setActiveBrowserAction(null), 3000); },
            (newProject) => {
                setProjectStructure(newProject);
                if (!isEditorOpen) setIsEditorOpen(true); 
                addLog(`Proyecto Actualizado.`, 'success');
            }
        );

        setTasks(prev => prev.map(t => t.id === taskToRun.id ? { ...t, status: 'completed', result } : t));
        addLog(`Fase Completa.`, 'success');
      } catch (error: any) {
        setTasks(prev => prev.map(t => t.id === taskToRun.id ? { ...t, status: 'failed', result: error.message } : t));
        addLog(`Fallo: ${error.message}`, 'error');
        setStatus(AgentStatus.ERROR); 
      }
    };

    if (status === AgentStatus.EXECUTING) executeNextStep();
  }, [status, tasks, projectStructure, isEditorOpen]);

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
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* OVERLAYS */}
      <HelpSystem />
      <CodeEditor isOpen={isEditorOpen} onClose={() => setIsEditorOpen(false)} project={projectStructure} onAIRequest={handleEditorAIRequest} />
      <Modeler3D isOpen={isModelerOpen} onClose={() => setIsModelerOpen(false)} />

      <div className="max-w-[1600px] mx-auto h-[calc(100vh-3rem)] flex flex-col relative z-10">
        
        {/* Header */}
        <header className="mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 glass-panel p-4 rounded-xl border-t border-cyan-500/30">
          
          {/* LOGO */}
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
              <p className="text-cyan-200/60 text-xs uppercase tracking-[0.2em] font-mono mt-1">Agentes Especializados con Inteligencia Autónoma</p>
            </div>
          </div>
          
          {/* TOOLBAR & STATUS */}
          <div className="flex flex-wrap items-center gap-4 justify-end">
             
             {/* Studio Tools Buttons */}
             <div className="flex bg-gray-900/50 rounded-lg p-1 border border-gray-700/50">
                <button 
                    onClick={() => setIsEditorOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-gray-300 hover:bg-gray-800 hover:text-white transition-colors border-r border-gray-700/50 pr-4 mr-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Editor IDE
                </button>
                <button 
                    onClick={() => setIsModelerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                    Estudio 3D
                </button>
             </div>

             <div className="flex flex-col items-end pl-4 border-l border-gray-700/50">
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
                onAddDocument={handleAddDocument}
                onFollowUp={handleFollowUp}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
