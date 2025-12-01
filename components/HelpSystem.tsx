
import React, { useState, useRef, useEffect } from 'react';
import { queryHelpAssistant } from '../services/gemini';
import { marked } from 'marked';

interface ChatMessage {
    role: 'user' | 'bot';
    text: string;
}

export const HelpSystem: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'manual' | 'chat'>('manual');
    
    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'bot', text: '¡Hola! Soy el Soporte IA de AGENTNAMIX. ¿En qué puedo ayudarte hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, activeTab]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        
        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setIsLoading(true);

        const response = await queryHelpAssistant(userMsg);
        
        setMessages(prev => [...prev, { role: 'bot', text: response }]);
        setIsLoading(false);
    };

    const toolsInfo = [
        { 
            id: 'web_search', label: 'Enlace Web', icon: '🔍', 
            desc: 'Conecta al agente con Google Search para obtener información actualizada en tiempo real con fuentes verificadas.'
        },
        { 
            id: 'browser_interaction', label: 'Interacción DOM', icon: '🌐', 
            desc: 'Permite al agente navegar realmente por la web. Puede hacer clic en enlaces, leer contenido de páginas y simular búsquedas.'
        },
        {
            id: 'image_analyzer', label: 'Image Analyzer', icon: '👁️',
            desc: 'Otorga visión a la IA. Sube imágenes para que el agente las analice, lea texto (OCR) o identifique objetos dentro de la misión.'
        },
        { 
            id: 'software_architect', label: 'Arquitecto SW', icon: '🏗️', 
            desc: 'Genera proyectos de código completos. Crea estructuras de archivos, escribe código en múltiples lenguajes y ofrece VISTA PREVIA de webs.'
        },
        { 
            id: 'google_calendar', label: 'Google Calendar', icon: '📅', 
            desc: 'Genera "Intent Links". El agente prepara el evento (título, hora, color) y te da un botón para guardarlo en tu calendario con un clic.'
        },
        { 
            id: 'memory_system', label: 'Memoria L.P.', icon: '🧠', 
            desc: 'Base de datos persistente. Permite al agente recordar hechos o preferencias entre diferentes sesiones.'
        },
        { 
            id: 'google_drive', label: 'Drive', icon: '📂', 
            desc: 'Genera enlaces rápidos para buscar archivos en tu Drive o crear nuevos documentos, hojas de cálculo y presentaciones.'
        }
    ];

    const quickQuestions = [
        "¿Cómo funciona el Arquitecto?",
        "¿Cómo uso el análisis de imágenes?",
        "¿Qué es la Interacción DOM?",
        "¿Cómo exporto el reporte a PDF?"
    ];

    return (
        <>
            {/* Floating Button */}
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-600 hover:bg-cyan-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center text-white z-50 transition-all hover:scale-110 animate-pulse-fast border border-cyan-400"
                title="Ayuda y Soporte IA"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>

            {/* Modal Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
                    <div className="w-full max-w-4xl h-[80vh] bg-[#0f1115] border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded bg-cyan-900/30 flex items-center justify-center border border-cyan-500/50">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-xl font-display font-bold text-white tracking-wide">PROTOCOLO DE AYUDA</h2>
                                    <p className="text-xs text-cyan-400 uppercase tracking-widest font-mono">SISTEMA DE SOPORTE INTEGRADO v2.5</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-800 bg-black/40">
                            <button 
                                onClick={() => setActiveTab('manual')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'manual' ? 'border-cyan-500 text-cyan-400 bg-cyan-900/10' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                📚 Manual Operativo
                            </button>
                            <button 
                                onClick={() => setActiveTab('chat')}
                                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'chat' ? 'border-violet-500 text-violet-400 bg-violet-900/10' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                🤖 Soporte IA (Chat)
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden relative bg-black/20">
                            
                            {/* MANUAL TAB */}
                            {activeTab === 'manual' && (
                                <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                                    <div className="prose prose-invert max-w-none">
                                        <h3 className="text-cyan-400 font-display mb-4">Bienvenido a AGENTNAMIX</h3>
                                        <p className="text-gray-300 mb-6">
                                            Una plataforma de inteligencia autónoma diseñada para ejecutar tareas complejas en el navegador. 
                                            Define un objetivo, selecciona tus herramientas y observa cómo la IA planifica y ejecuta.
                                        </p>

                                        <h4 className="text-white font-bold border-b border-gray-700 pb-2 mb-4">🛠️ Arsenal de Herramientas</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {toolsInfo.map(tool => (
                                                <div key={tool.id} className="bg-gray-900/50 border border-gray-800 p-4 rounded-lg hover:border-cyan-500/30 transition-colors">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-2xl">{tool.icon}</span>
                                                        <span className="font-bold text-cyan-200">{tool.label}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 leading-relaxed">{tool.desc}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <h4 className="text-white font-bold border-b border-gray-700 pb-2 mt-8 mb-4">🎙️ Control por Voz y Audio</h4>
                                        <ul className="text-sm text-gray-300 space-y-2">
                                            <li><strong>Dictado:</strong> Pulsa el icono de micrófono en la barra de búsqueda para hablar con el agente.</li>
                                            <li><strong>Lectura (TTS):</strong> En cada tarjeta de resultado, usa el icono de altavoz para que el agente lea la respuesta en voz alta.</li>
                                        </ul>

                                        <h4 className="text-white font-bold border-b border-gray-700 pb-2 mt-8 mb-4">📄 Exportación y Reportes</h4>
                                        <p className="text-sm text-gray-300 mb-4">
                                            Al finalizar una misión, aparecerá el botón <strong>"EXPORTAR PDF"</strong> en la cabecera. Esto generará un documento profesional con todo el historial de la sesión.
                                        </p>

                                        <h4 className="text-white font-bold border-b border-gray-700 pb-2 mt-8 mb-4">❓ Preguntas Frecuentes</h4>
                                        <div className="space-y-4">
                                            <details className="bg-gray-900 rounded border border-gray-800">
                                                <summary className="p-3 font-bold cursor-pointer text-gray-300 hover:text-white">¿Cómo funciona la navegación?</summary>
                                                <div className="p-3 pt-0 text-sm text-gray-400">
                                                    Usamos un proxy seguro (Jina) que lee el sitio web y lo convierte a texto para que la IA lo entienda. La IA decide cuándo hacer clic o buscar.
                                                </div>
                                            </details>
                                            <details className="bg-gray-900 rounded border border-gray-800">
                                                <summary className="p-3 font-bold cursor-pointer text-gray-300 hover:text-white">¿Dónde se guardan mis datos?</summary>
                                                <div className="p-3 pt-0 text-sm text-gray-400">
                                                    Todo se ejecuta en tu navegador (LocalStorage). AGENTNAMIX no tiene base de datos en la nube. Tus agentes y memorias son privados.
                                                </div>
                                            </details>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CHAT TAB */}
                            {activeTab === 'chat' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                                        {messages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                                                    msg.role === 'user' 
                                                    ? 'bg-cyan-900/30 border border-cyan-800 text-cyan-100' 
                                                    : 'bg-gray-800 border border-gray-700 text-gray-300'
                                                }`}>
                                                    <div dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }} />
                                                </div>
                                            </div>
                                        ))}
                                        {isLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center gap-2">
                                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Chips */}
                                    <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar border-t border-gray-800 bg-gray-900/30">
                                        {quickQuestions.map((q, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => { setInput(q); handleSend(); }}
                                                className="whitespace-nowrap px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-400 hover:text-white hover:border-cyan-500 transition-colors"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Input Area */}
                                    <div className="p-4 bg-gray-900 border-t border-gray-800 flex gap-2">
                                        <input 
                                            type="text" 
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                            placeholder="Pregunta sobre el uso del programa..."
                                            className="flex-1 bg-black border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-violet-500 outline-none"
                                        />
                                        <button 
                                            onClick={handleSend}
                                            disabled={!input.trim() || isLoading}
                                            className="bg-violet-600 hover:bg-violet-500 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
