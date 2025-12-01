
/**
 * Service to handle Google Drive interactions via direct link generation.
 */

export interface DriveAction {
  action: 'SEARCH' | 'CREATE';
  query?: string; // For search
  fileType?: 'document' | 'spreadsheet' | 'presentation' | 'folder'; // For create
  title?: string; // Optional title reference (cannot actually set title via URL, but good for UI)
}

export const generateDriveLink = (cmd: DriveAction): string => {
  if (cmd.action === 'SEARCH') {
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(cmd.query || '')}`;
  }
  
  if (cmd.action === 'CREATE') {
    switch (cmd.fileType) {
        case 'document': return 'https://docs.google.com/document/create';
        case 'spreadsheet': return 'https://docs.google.com/spreadsheets/create';
        case 'presentation': return 'https://docs.google.com/presentation/create';
        default: return 'https://drive.google.com/drive/my-drive';
    }
  }
  
  return 'https://drive.google.com/drive/my-drive';
};

export const createDriveActionResponse = (cmd: DriveAction): string => {
    const link = generateDriveLink(cmd);
    
    let icon = '';
    let colorClass = '';
    let title = '';
    let desc = '';

    if (cmd.action === 'SEARCH') {
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`;
        colorClass = 'border-blue-500 text-blue-400';
        title = '🔍 Búsqueda en Drive';
        desc = `Consulta: "${cmd.query}"`;
    } else {
        icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>`;
        if (cmd.fileType === 'spreadsheet') {
             colorClass = 'border-green-600 text-green-400';
             title = '📊 Nueva Hoja de Cálculo';
        } else if (cmd.fileType === 'presentation') {
             colorClass = 'border-yellow-500 text-yellow-400';
             title = '📽️ Nueva Presentación';
        } else {
             colorClass = 'border-blue-600 text-blue-400';
             title = '📝 Nuevo Documento';
        }
        desc = "Crear archivo vacío en Google Drive";
    }

    return `
<div class="bg-gray-800 border-l-4 ${colorClass} p-4 rounded my-4 shadow-lg">
  <div class="flex justify-between items-center">
    <div>
        <h4 class="font-bold text-lg flex items-center gap-2 text-white">
           ${title}
        </h4>
        <p class="text-gray-400 text-sm mt-1">${desc}</p>
    </div>
    <a href="${link}" target="_blank" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded shadow flex items-center gap-2 text-sm transition-transform hover:scale-105 border border-gray-600">
      <span>Abrir Drive</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  </div>
</div>
    `;
};
