import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogTerminalProps {
  logs: LogEntry[];
}

export const LogTerminal: React.FC<LogTerminalProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_2px,3px_100%]"></div>
      
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-800 z-20">
        <h2 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          /SIS/REGS/FLUJO
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar relative z-0">
        {logs.length === 0 ? (
          <div className="text-gray-700 italic">... Esperando entrada del sistema ...</div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 animate-fade-in-up">
                <span className="text-gray-600 shrink-0 select-none opacity-60">
                  [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}]
                </span>
                <div className={`break-words font-medium ${
                  log.type === 'error' ? 'text-red-500 text-shadow-red' :
                  log.type === 'success' ? 'text-green-400 text-shadow-green' :
                  log.type === 'ai' ? 'text-cyan-400' :
                  log.type === 'system' ? 'text-yellow-500' :
                  'text-gray-400'
                }`}>
                  <span className="mr-2 select-none opacity-80">
                     {log.type === 'ai' && '>>'}
                     {log.type === 'success' && 'OK'}
                     {log.type === 'error' && 'ERR'}
                     {log.type === 'system' && 'SIS'}
                     {log.type === 'info' && 'INF'}
                  </span>
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};