import React, { useState, useEffect, useRef } from 'react';
import { AgentStatus, AgentConfiguration, ToolType, AgentImage, SSHConfiguration } from '../types';
import { processFile, ProcessedDocument } from '../services/fileProcessor';
import { processImageFile, isValidImageType } from '../services/imageUtils';
import { db, SavedAgent } from '../services/db';
import { startListening, stopListening, isSpeechRecognitionSupported } from '../services/speech';
import { enhanceAgentDescription } from '../services/gemini'; // Import new function

interface AgentControlProps {
  onStart: (goal: string, config: AgentConfiguration) => void;
  onStop: () => void;
  onReset: () => void;
  status: AgentStatus;
  hasKey: boolean;
}

export const AgentControl: React.FC<AgentControlProps> = ({ onStart, onStop, onReset, status, hasKey }) => {
  const [goal, setGoal] = useState('');
  const [agentName, setAgentName] = useState('Agente Nexus');
  const [description, setDescription] = useState('Eres una unidad de IA avanzada capaz de razonamiento complejo.');
  const [selectedTools, setSelectedTools] = useState<ToolType[]>(['web_search']);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [showConfig, setShowConfig] = useState(false);
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  
  // Voice State
  const [isListening, setIsListening] = useState(false);
  // Enhance State
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Document State
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image State
  const [images, setImages] = useState<AgentImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // SSH State
  const [showSSHModal, setShowSSHModal] = useState(false);
  const [sshConfig, setSshConfig] = useState<SSHConfiguration>({
      mode: 'simulated',
      host: '', 
      port: '22', 
      username: 'root', 
      password: '',
      proxyUrl: 'ws://localhost:8080'
  });

  useEffect(() => {
    // Delay slightly to ensure DB is init
    setTimeout(() => {
        setSavedAgents(db.getAgents());
    }, 500);
  }, []);

  const handleMicClick = () => {
      if (isListening) {
          stopListening();
          setIsListening(false);
      } else {
          setIsListening(true);
          startListening(
              (text, isFinal) => {
                  if (isFinal) {
                    setGoal(prev => prev ? `${prev} ${text}` : text);
                    setIsListening(false);
                  }
              },
              () => setIsListening(false),
              (err) => {
                  console.error(err);
                  setIsListening(false);
                  alert(err);
              }
          );
      }
  };

  const handleEnhanceDescription = async () => {
      if (!description.trim() || isEnhancing) return;
      setIsEnhancing(true);
      try {
          const enhanced = await enhanceAgentDescription(description);
          setDescription(enhanced);
      } catch (e) {
          console.error(e);
      } finally {
          setIsEnhancing(false);
      }
  };

  const saveAgentToLibrary = () => {
    if (!agentName.trim()) return;
    const newAgent: SavedAgent = {
      id: `custom-${Date.now()}`,
      name: agentName,
      description,
      tools: selectedTools,
      model: selectedModel,
      isDefault: false,
      documents: [] 
    };
    
    db.saveAgent(newAgent);
    setSavedAgents(db.getAgents());
    setSelectedAgentId(newAgent.id);
  };

  const deleteAgentFromLibrary = () => {
    if (!selectedAgentId) return;
    db.deleteAgent(selectedAgentId);
    const updated = db.getAgents();
    setSavedAgents(updated);
    
    if (updated.length > 0) {
      loadAgent(updated[0].id);
    } else {
      setSelectedAgentId('');
    }
  };

  const loadAgent = (id: string) => {
    setSelectedAgentId(id);
    if (!id) return;
    const agent = savedAgents.find(a => a.id === id);
    if (agent) {
      setAgentName(agent.name);
      setDescription(agent.description);
      setSelectedTools(agent.tools);
      setSelectedModel(agent.model || 'gemini-2.5-flash');
    }
  };

  // --- FILE HANDLERS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessingFile(true);
      const files: File[] = Array.from(e.target.files);
      const newDocs: ProcessedDocument[] = [];
      
      for (const file of files) {
        try {
          const doc = await processFile(file);
          newDocs.push(doc);
        } catch (error) {
          console.error("Error parsing file", file.name, error);
          alert(`Error leyendo ${file.name}`);
        }
      }
      
      setDocuments(prev => [...prev, ...newDocs]);
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const clearDocuments = () => {
    setDocuments([]);
  };

  // --- IMAGE HANDLERS ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files: File[] = Array.from(e.target.files);
          const newImages: AgentImage[] = [];

          for (const file of files) {
              if (isValidImageType(file)) {
                  try {
                      const img = await processImageFile(file);
                      newImages.push(img);
                  } catch (err) {
                      console.error("Error processing image", err);
                  }
              } else {
                  alert(`Tipo de archivo no válido: ${file.name}`);
              }
          }
          setImages(prev => [...prev, ...newImages]);
          if (imageInputRef.current) imageInputRef.current.value = '';
      }
  };

  const removeImage = (index: number) => {
      setImages(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.includes('pdf')) return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    );
    if (type.includes('sheet') || type.includes('excel') || name.endsWith('xls') || name.endsWith('xlsx')) return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    );
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      onStart(goal, {
        name: agentName,
        description: description,
        tools: selectedTools,
        model: selectedModel,
        documents: documents.map(d => ({ name: d.name, content: d.content })),
        images: images,
        sshConfig: selectedTools.includes('aura_ssh') ? sshConfig : undefined
      });
    }
  };

  const toggleTool = (tool: ToolType) => {
    if (tool === 'aura_ssh' && !selectedTools.includes('aura_ssh')) {
        setShowSSHModal(true);
    }
    setSelectedTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
  };

  const isBusy = status === AgentStatus.PLANNING || status === AgentStatus.EXECUTING;

  return (
    <div className="glass-panel p-6 rounded-xl shadow-lg border-t border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-display font-bold text-gray-400 uppercase tracking-widest">
          PANEL DE CONTROL
        </h2>
        {!hasKey && (
           <span className="text-red-400 text-xs font-mono animate-pulse">⚠ SIN CLAVE API</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* Main Input */}
        <div>
          <label className="block text-sm font-display font-bold text-cyan-400 mb-2">
            PARÁMETROS DE MISIÓN
          </label>
          <div className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
             <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={isBusy || isListening}
              placeholder={isListening ? "Escuchando... (Hable ahora)" : "Ingresa tu objetivo aquí..."}
              className={`relative w-full bg-black border border-gray-800 rounded-lg pl-4 pr-12 py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 text-lg font-light ${isListening ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}`}
            />
            {isSpeechRecognitionSupported && (
                <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={isBusy}
                    className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse-fast' : 'text-gray-500 hover:text-cyan-400 hover:bg-gray-800'}`}
                    title="Dictar Misión (Voz)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                </button>
            )}
          </div>
        </div>

        {/* Visual Input Zone (Only if Tool Selected) */}
        {selectedTools.includes('image_analyzer') && (
            <div className="animate-fade-in-up">
                <label className="block text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 flex justify-between">
                  <span>ENTRADA VISUAL (IMÁGENES)</span>
                  <span className="text-gray-500">{images.length} Cargadas</span>
                </label>
                
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {/* Upload Button */}
                    <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="w-16 h-16 shrink-0 border border-dashed border-violet-500/50 rounded-lg flex items-center justify-center cursor-pointer hover:bg-violet-900/20 hover:border-violet-400 transition-colors bg-gray-900/30"
                        title="Subir Imagen"
                    >
                        <input type="file" ref={imageInputRef} multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>

                    {/* Image Previews */}
                    {images.map((img, idx) => (
                        <div key={idx} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-700 group">
                            <img src={`data:${img.mimeType};base64,${img.data}`} alt="preview" className="w-full h-full object-cover" />
                            <button 
                                onClick={() => removeImage(idx)}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="flex gap-3 mt-1">
          {status === AgentStatus.IDLE || status === AgentStatus.FINISHED || status === AgentStatus.ERROR ? (
            <button
              type="submit"
              disabled={!goal.trim() || !hasKey}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-black font-bold py-3 px-6 rounded transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-display flex items-center justify-center gap-2"
            >
              Inicializar Secuencia
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStop}
              className="flex-1 bg-red-900/80 hover:bg-red-800 border border-red-500 text-red-100 font-bold py-3 px-6 rounded transition-colors shadow-[0_0_15px_rgba(239,68,68,0.4)] uppercase tracking-wider font-display"
            >
              Abortar Misión
            </button>
          )}
          
          {(status === AgentStatus.FINISHED || status === AgentStatus.ERROR) && (
             <button
             type="button"
             onClick={() => { setGoal(''); onReset(); setDocuments([]); setImages([]); }}
             className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors border border-gray-600 uppercase font-bold tracking-wider"
           >
             Reiniciar
           </button>
          )}
        </div>

        {/* Dropdown Configuration */}
        <div className="bg-gray-900/50 rounded-lg p-1 border border-gray-800">
          <button 
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border border-gray-700">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
               </div>
               <div className="flex flex-col items-start text-left">
                 <span className="text-xs text-gray-500 uppercase tracking-wide">CONFIGURACIÓN DE NUCLEO</span>
                 <span className="font-display text-cyan-100">{agentName} <span className="text-gray-500 text-xs font-sans">({selectedModel})</span></span>
               </div>
            </div>
            <div className="flex items-center gap-2">
               {documents.length > 0 && <span className="text-[10px] bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800">{documents.length} DOCS</span>}
               <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${showConfig ? 'rotate-180 text-cyan-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          
          {showConfig && (
            <div className="p-4 border-t border-gray-800 animate-fade-in-up space-y-5 bg-black/40">
              
              {/* File Upload Zone */}
              <div>
                <label className="block text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-2 flex justify-between">
                  <span>BASE DE CONOCIMIENTO (PDF, DOCX, XLSX, TXT)</span>
                  {documents.length > 0 && <span className="text-gray-400">{documents.length} Archivos</span>}
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${isProcessingFile ? 'bg-cyan-900/20 border-cyan-500' : 'bg-gray-900/30 border-gray-700 hover:border-gray-500 hover:bg-gray-800'}`}
                >
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept=".pdf,.docx,.txt,.xlsx,.xls" 
                  />
                  
                  {isProcessingFile ? (
                    <div className="flex items-center gap-2 text-cyan-400 text-xs animate-pulse">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        PROCESANDO BINARIOS...
                    </div>
                  ) : (
                      <div className="flex gap-2 items-center text-gray-400 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Click o Arrastrar para Cargar Documentos</span>
                      </div>
                  )}
                </div>

                {documents.length > 0 && (
                  <div className="mt-3">
                     <div className="flex justify-between items-center mb-1 px-1">
                        <span className="text-[10px] font-mono text-gray-500 tracking-wider">BANCO DE DATOS</span>
                        <button type="button" onClick={clearDocuments} className="text-[10px] text-red-500 hover:text-red-300 hover:underline">
                          ELIMINAR TODO
                        </button>
                     </div>
                     <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {documents.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded p-2 text-xs group hover:border-gray-600 transition-colors">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <span className="text-cyan-500 shrink-0">
                                {getFileIcon(doc.type, doc.name)}
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate text-gray-300 font-medium">{doc.name}</span>
                                <span className="text-[10px] text-gray-600 font-mono">{(doc.content.length / 1000).toFixed(1)} KB (Texto)</span>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => removeDocument(idx)} 
                              className="text-gray-600 hover:text-red-400 p-1.5 hover:bg-red-900/20 rounded transition-colors"
                              title="Remover archivo"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                     </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-800"></div>

              {/* Load Preset */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Cargar Plantilla</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedAgentId} 
                    onChange={(e) => loadAgent(e.target.value)}
                    disabled={isBusy}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 focus:border-cyan-500 outline-none"
                  >
                    <option value="">-- Agente Personalizado --</option>
                    <optgroup label="Plantillas del Sistema">
                      {savedAgents.filter(a => a.isDefault).map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Biblioteca de Usuario">
                      {savedAgents.filter(a => !a.isDefault).map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <button type="button" onClick={saveAgentToLibrary} disabled={!agentName} className="px-3 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-cyan-400">Guardar</button>
                  <button 
                    type="button" 
                    onClick={deleteAgentFromLibrary} 
                    disabled={!selectedAgentId || savedAgents.find(a => a.id === selectedAgentId)?.isDefault} 
                    className="px-3 bg-gray-900/80 border border-red-900 rounded hover:bg-red-900/30 text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Model Selector */}
              <div>
                <label className="block text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-2">MODELO DE IA (MOTOR CENTRAL)</label>
                <select 
                  value={selectedModel} 
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isBusy}
                  className="w-full bg-gray-950 border border-cyan-900/50 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                >
                  <optgroup label="Modelos Google Gemini (Nativo)">
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Velocidad)</option>
                    <option value="gemini-3-pro">Gemini 3 Pro (Razonamiento)</option>
                  </optgroup>
                  <optgroup label="Modelos Experimentales / Compatibilidad">
                    <option value="gpt-5mini">GPT-5 Mini (Simulación Ultra-Rápida)</option>
                    <option value="glm-4-6">GLM 4-6 (Lógica Profunda)</option>
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Nombre Clave</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Módulos</label>
                   <div className="flex gap-2 flex-wrap">
                      {[
                        { id: 'web_search', label: 'Enlace Web' },
                        { id: 'code_execution', label: 'Motor de Código' },
                        { id: 'deep_analysis', label: 'Lógica Profunda' },
                        { id: 'browser_interaction', label: 'Interacción DOM' },
                        { id: 'web_scrape', label: 'Web Scraping' },
                        { id: 'google_calendar', label: 'Google Calendar' },
                        { id: 'google_drive', label: 'Drive' },
                        { id: 'software_architect', label: 'Arquitecto SW' },
                        { id: 'memory_system', label: 'Memoria L.P.' },
                        { id: 'image_analyzer', label: 'Image Analyzer' },
                        { id: 'aura_ssh', label: 'AURA SSH' },
                        { id: 'model_3d', label: 'Modelo 3D' }
                      ].map(tool => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => toggleTool(tool.id as ToolType)}
                          className={`px-2 py-1 text-[10px] uppercase font-bold rounded border transition-all ${selectedTools.includes(tool.id as ToolType) ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'}`}
                        >
                          {tool.label}
                        </button>
                      ))}
                   </div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Directivas (Prompt del Sistema)</label>
                    <button 
                        type="button" 
                        onClick={handleEnhanceDescription} 
                        disabled={isEnhancing || !description.trim()}
                        className="text-[10px] flex items-center gap-1 bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50 hover:text-white px-2 py-1 rounded border border-cyan-800 transition-colors disabled:opacity-50"
                        title="Mejorar prompt con IA"
                    >
                        {isEnhancing ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                        )}
                        OPTIMIZAR PROMPT
                    </button>
                </div>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-300 focus:border-cyan-500 outline-none font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {/* SSH MODAL */}
      {showSSHModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up">
              <div className="w-full max-w-md bg-[#0c0c0c] border border-emerald-500/50 rounded-lg shadow-2xl overflow-hidden">
                  <div className="bg-[#1a1a1a] p-3 border-b border-emerald-900 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                          </svg>
                          AURA SSH PROTOCOL
                      </div>
                      <button onClick={() => setShowSSHModal(false)} className="text-gray-500 hover:text-white">✕</button>
                  </div>
                  <div className="p-6 space-y-4">
                      
                      {/* Mode Toggle */}
                      <div className="flex bg-black rounded p-1 border border-gray-800 mb-4">
                          <button 
                            type="button" 
                            onClick={() => setSshConfig({...sshConfig, mode: 'simulated'})}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${sshConfig.mode === 'simulated' ? 'bg-emerald-900/30 text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            MODO SIMULADOR
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setSshConfig({...sshConfig, mode: 'real'})}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${sshConfig.mode === 'real' ? 'bg-red-900/30 text-red-400 animate-pulse' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                            CONEXIÓN REAL
                          </button>
                      </div>

                      {sshConfig.mode === 'real' && (
                          <div className="bg-red-900/10 border border-red-900/50 p-2 rounded mb-2">
                             <p className="text-[10px] text-red-300 leading-tight">
                                ⚠ <strong>REQUIERE BRIDGE:</strong> Los navegadores no soportan TCP directo. 
                                Necesitas un <strong>Websocket Proxy</strong> (ej: wssh, guacamole) corriendo.
                             </p>
                          </div>
                      )}

                      {sshConfig.mode === 'real' && (
                          <div>
                            <label className="block text-xs font-bold text-red-500 mb-1">WEBSOCKET BRIDGE URL</label>
                            <input type="text" value={sshConfig.proxyUrl} onChange={e => setSshConfig({...sshConfig, proxyUrl: e.target.value})} className="w-full bg-gray-900 border border-red-900/30 rounded p-2 text-sm text-white focus:border-red-500 outline-none font-mono" placeholder="wss://my-ssh-bridge.com" />
                          </div>
                      )}

                      <p className="text-xs text-gray-400 mb-2">Credenciales del Servidor Destino:</p>
                      <div>
                          <label className="block text-xs font-bold text-emerald-600 mb-1">HOST IP / DOMAIN</label>
                          <input type="text" value={sshConfig.host} onChange={e => setSshConfig({...sshConfig, host: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono" placeholder="192.168.1.100" />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-emerald-600 mb-1">PORT</label>
                              <input type="text" value={sshConfig.port} onChange={e => setSshConfig({...sshConfig, port: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono" placeholder="22" />
                          </div>
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-emerald-600 mb-1">USERNAME</label>
                              <input type="text" value={sshConfig.username} onChange={e => setSshConfig({...sshConfig, username: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono" placeholder="root" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-emerald-600 mb-1">PASSWORD / KEY</label>
                          <input type="password" value={sshConfig.password} onChange={e => setSshConfig({...sshConfig, password: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono" placeholder="••••••••" />
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => setShowSSHModal(false)}
                        className={`w-full py-2 font-bold rounded shadow-[0_0_15px_rgba(16,185,129,0.3)] mt-2 border ${sshConfig.mode === 'real' ? 'bg-red-900/50 border-red-500 text-red-100 hover:bg-red-800' : 'bg-emerald-900/50 border-emerald-500 text-emerald-100 hover:bg-emerald-800'}`}
                      >
                          {sshConfig.mode === 'real' ? 'INICIAR TÚNEL WEBSOCKET' : 'ESTABLECER ENLACE SIMULADO'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};