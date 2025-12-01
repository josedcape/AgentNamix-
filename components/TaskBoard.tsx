import React, { useEffect, useRef, useState } from 'react';
import { Task, AgentConfiguration } from '../types';
import { marked } from 'marked';
import { speakText, stopSpeaking } from '../services/speech';
import { generateMissionReport } from '../services/report';

// --- INTERNAL COMPONENT: Browser Visualizer ---
interface BrowserOverlayProps {
  action: { action: string, target?: string, value?: string };
}
const BrowserOverlay: React.FC<BrowserOverlayProps> = ({ action }) => {
    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in-up">
            <div className="w-3/4 max-w-2xl bg-gray-900 border border-cyan-500/50 rounded-xl shadow-2xl overflow-hidden relative">
                {/* Browser Toolbar */}
                <div className="bg-gray-800 p-3 flex items-center gap-3 border-b border-gray-700">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 bg-black/50 rounded px-3 py-1 text-xs font-mono text-cyan-400 truncate border border-gray-700 flex items-center justify-between">
                         <span>{action.value || 'about:blank'}</span>
                         <span className="animate-pulse">● LIVE</span>
                    </div>
                </div>
                
                {/* Browser Content */}
                <div className="h-64 bg-[#0d1117] relative p-8 flex flex-col items-center justify-center">
                     
                     {/* Action Animation */}
                     <div className="text-center relative z-10">
                         {action.action === 'NAVIGATE' && (
                             <div className="flex flex-col items-center gap-4">
                                 <svg className="w-16 h-16 text-cyan-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                                 <span className="font-display text-cyan-400 text-lg tracking-widest animate-pulse">NAVEGANDO...</span>
                             </div>
                         )}

                         {action.action === 'CLICK' && (
                             <div className="flex flex-col items-center gap-4">
                                 <div className="relative">
                                     <div className="absolute -inset-4 bg-cyan-500/30 rounded-full animate-ping"></div>
                                     <svg className="w-12 h-12 text-cyan-400 relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74z"/><path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74z" opacity=".3"/><path d="M16.05 13.34l-1.08-3.73c-.24-.83-1.42-1.42-1.42-1.42s-1.18.59-1.42 1.42l-1.08 3.73c-.15.52-.63.89-1.17.89H8.5c-.83 0-1.5.67-1.5 1.5v4c0 .83.67 1.5 1.5 1.5h8c.83 0 1.5-.67 1.5-1.5v-4c0-.83-.67-1.5-1.5-1.5h-1.38c-.54 0-1.02-.37-1.17-.89z"/></svg>
                                 </div>
                                 <div className="bg-gray-800 border border-cyan-500 rounded px-4 py-2 mt-4 text-sm text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                                     CLICK >> <span className="font-bold text-white">"{action.target}"</span>
                                 </div>
                             </div>
                         )}

                         {action.action === 'TYPE' && (
                             <div className="flex flex-col items-center gap-4">
                                 <div className="w-16 h-10 border-2 border-gray-600 border-t-0 border-l-0 border-r-0 flex items-end justify-center pb-2">
                                     <span className="w-0.5 h-6 bg-cyan-400 animate-pulse"></span>
                                 </div>
                                 <div className="font-mono text-xl text-white typing-effect">
                                     {action.value}
                                 </div>
                                 <span className="text-xs text-gray-500 uppercase tracking-widest">INGRESANDO DATOS</span>
                             </div>
                         )}
                     </div>

                     {/* Grid Background */}
                     <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

interface TaskBoardProps {
  tasks: Task[];
  activeBrowserAction?: { action: string, target?: string, value?: string };
  agentConfig?: AgentConfiguration;
  goal?: string;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, activeBrowserAction, agentConfig, goal }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Auto-scroll to bottom when new tasks/results appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [tasks]);

  const handleCopy = (text: string, taskId: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(taskId);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportPDF = async () => {
      if (!agentConfig || !goal) return;
      setIsExporting(true);
      await generateMissionReport(tasks, agentConfig, goal);
      setIsExporting(false);
  };

  const hasCompletedTasks = tasks.some(t => t.status === 'completed' && t.result);

  return (
    <div className="glass-panel rounded-xl h-full flex flex-col shadow-2xl relative overflow-hidden border border-cyan-900/30">
      
      {/* Overlay for Browser Actions */}
      {activeBrowserAction && <BrowserOverlay action={activeBrowserAction} />}

      {/* Header / Title Bar */}
      <div className="px-6 py-4 border-b border-gray-800 bg-black/40 flex justify-between items-center backdrop-blur-sm">
        <h2 className="text-lg font-display font-bold text-cyan-400 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
          </span>
          LIENZO DE MISIÓN
        </h2>
        <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-widest hidden md:block">
            {tasks.filter(t => t.status === 'completed').length} / {tasks.length} FASES COMPLETADAS
            </div>
            
            {hasCompletedTasks && (
                <button 
                    onClick={handleExportPDF} 
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-600 transition-colors"
                >
                    {isExporting ? (
                         <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                    EXPORTAR PDF
                </button>
            )}
        </div>
      </div>
      
      {/* Scrollable Canvas Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-50">
            <div className="w-24 h-24 border border-dashed border-gray-700 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="font-mono text-sm tracking-wider">ESPERANDO DIRECTIVAS...</span>
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl mx-auto">
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                className={`
                  relative transition-all duration-500 animate-fade-in-up
                  ${task.status === 'pending' ? 'opacity-40 grayscale blur-[1px]' : 'opacity-100'}
                `}
              >
                {/* Connecting Line */}
                {index !== tasks.length - 1 && (
                  <div className="absolute left-6 top-10 bottom-[-32px] w-0.5 bg-gray-800 -z-10"></div>
                )}

                {/* Status Indicator & Title */}
                <div className="flex items-center gap-4 mb-4 group/header">
                   <div className={`
                     flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold font-display shadow-lg shrink-0 border
                     ${task.status === 'completed' ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 
                       task.status === 'processing' ? 'bg-violet-900/20 border-violet-500 text-violet-300 animate-pulse' :
                       task.status === 'failed' ? 'bg-red-900/20 border-red-500 text-red-500' :
                       'bg-gray-800 border-gray-700 text-gray-500'}
                   `}>
                     {index + 1}
                   </div>
                   
                   <div className="flex-1">
                     <h3 className={`text-lg font-bold font-display tracking-wide ${
                       task.status === 'processing' ? 'text-violet-300' : 'text-gray-200'
                     }`}>
                       {task.description}
                     </h3>
                     <div className="flex gap-2 mt-1 items-center">
                        {task.status === 'processing' && <span className="text-xs font-mono text-violet-400 animate-pulse">>> PROCESANDO DATOS...</span>}
                        {task.status === 'completed' && <span className="text-xs font-mono text-cyan-500">>> DATOS ADQUIRIDOS</span>}
                        {task.status === 'pending' && <span className="text-xs font-mono text-gray-600">>> EN COLA</span>}
                        
                        {/* ACTIONS BUTTONS */}
                        {task.result && task.status === 'completed' && (
                            <div className="flex items-center gap-1 ml-4 border-l border-gray-700 pl-4">
                                {/* Copy Button */}
                                <button 
                                    onClick={() => handleCopy(task.result!, task.id)}
                                    className="text-gray-500 hover:text-green-400 transition-colors p-1.5 rounded hover:bg-gray-800"
                                    title="Copiar texto"
                                >
                                    {copiedId === task.id ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                    )}
                                </button>
                                
                                {/* Speak Button */}
                                <button 
                                    onClick={() => speakText(task.result!)}
                                    className="text-gray-500 hover:text-cyan-400 transition-colors p-1.5 rounded hover:bg-gray-800"
                                    title="Leer en voz alta"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                     </div>
                   </div>
                </div>
                
                {/* Result Canvas */}
                {task.result && (
                  <div className={`
                    ml-6 md:ml-16 rounded-xl overflow-hidden border
                    ${task.status === 'completed' ? 'border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'border-red-500/30'}
                  `}>
                    <div className="bg-gray-900/80 backdrop-blur-md p-6 md:p-8 relative">
                      {/* Decorative corner accents */}
                      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500"></div>
                      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500"></div>
                      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500"></div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500"></div>

                      <div 
                        className="prose prose-invert prose-lg max-w-none"
                        dangerouslySetInnerHTML={{ __html: marked.parse(task.result) as string }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};