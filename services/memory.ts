
import { Memory } from './db';

export interface MemoryAction {
  action: 'STORE' | 'RETRIEVE' | 'FORGET';
  content?: string; // For STORE
  query?: string;   // For RETRIEVE
  priority?: 'low' | 'medium' | 'high'; // For STORE
  memoryId?: string; // For FORGET
}

export const createMemoryWidget = (action: string, data: any): string => {
    let title = '';
    let colorClass = '';
    let body = '';
    let icon = '';

    if (action === 'STORE') {
        const mem = data as Memory;
        const priorityColor = mem.priority === 'high' ? 'text-red-400' : mem.priority === 'medium' ? 'text-yellow-400' : 'text-gray-400';
        
        title = '🧠 Memoria Guardada';
        colorClass = 'border-purple-500 bg-purple-900/20';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>`;
        
        body = `
            <div class="flex items-start gap-2 mt-2">
                <span class="text-[10px] uppercase font-bold border border-gray-600 rounded px-1.5 py-0.5 ${priorityColor}">${mem.priority}</span>
                <span class="text-xs text-gray-400 font-mono">${new Date(mem.timestamp).toLocaleString()}</span>
            </div>
            <p class="mt-2 text-gray-200 italic">"${mem.content}"</p>
        `;
    } 
    else if (action === 'RETRIEVE') {
        const memories = data as Memory[];
        title = `🔍 Recuperación de Memoria (${memories.length} resultados)`;
        colorClass = 'border-cyan-500 bg-cyan-900/20';
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`;

        if (memories.length === 0) {
            body = `<p class="text-gray-500 italic mt-2">No se encontraron recuerdos coincidentes.</p>`;
        } else {
            body = `<ul class="mt-2 space-y-2">
                ${memories.map(m => `
                    <li class="bg-black/30 p-2 rounded border border-gray-700">
                        <div class="flex justify-between items-center mb-1">
                             <span class="text-[9px] text-gray-500 uppercase">${m.type}</span>
                             ${m.priority === 'high' ? '<span class="text-[9px] text-red-400 font-bold">★ IMPORTANTE</span>' : ''}
                        </div>
                        <p class="text-gray-300 text-sm">${m.content}</p>
                    </li>
                `).join('')}
            </ul>`;
        }
    }

    return `
<div class="my-4 rounded-lg border-l-4 ${colorClass} p-4 shadow-lg backdrop-blur-sm">
    <div class="flex items-center gap-2 mb-1">
        ${icon}
        <h4 class="font-bold text-gray-100">${title}</h4>
    </div>
    ${body}
</div>
    `;
};
