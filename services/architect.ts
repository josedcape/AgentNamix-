
/**
 * Service to handle Software Architecture visualization.
 * Renders structured code projects as interactive HTML widgets with Live Preview.
 */

export interface FileBlueprint {
  path: string;
  language: string;
  content: string;
}

export interface ProjectStructure {
  projectName: string;
  description?: string;
  files: FileBlueprint[];
}

const escapeHtml = (unsafe: string) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

/**
 * Assembles the files into a single HTML string for previewing in an iframe.
 * Injects CSS and JS into the main HTML file.
 */
const assemblePreview = (files: FileBlueprint[]): string | null => {
    // 1. Find Entry Point
    const indexHtml = files.find(f => f.path.endsWith('index.html') || f.language === 'html');
    if (!indexHtml) return null;

    let combinedHtml = indexHtml.content;

    // 2. Inject CSS
    const cssFiles = files.filter(f => f.language === 'css');
    let cssBlock = '';
    cssFiles.forEach(f => {
        cssBlock += `\n/* ${f.path} */\n${f.content}\n`;
    });
    
    if (cssBlock) {
        if (combinedHtml.includes('</head>')) {
            combinedHtml = combinedHtml.replace('</head>', `<style>${cssBlock}</style></head>`);
        } else {
            combinedHtml += `<style>${cssBlock}</style>`;
        }
    }

    // 3. Inject JS
    const jsFiles = files.filter(f => f.language === 'javascript' || f.language === 'js');
    let jsBlock = '';
    jsFiles.forEach(f => {
        jsBlock += `\n// ${f.path}\n${f.content}\n`;
    });

    if (jsBlock) {
        if (combinedHtml.includes('</body>')) {
            combinedHtml = combinedHtml.replace('</body>', `<script>${jsBlock}</script></body>`);
        } else {
            combinedHtml += `<script>${jsBlock}</script>`;
        }
    }

    return combinedHtml;
};

export const createArchitectWidget = (project: ProjectStructure): string => {
    // Generate File Tree HTML
    const sortedFiles = [...project.files].sort((a, b) => a.path.localeCompare(b.path));

    const filesHtml = sortedFiles.map((f, index) => {
        const escapedCode = escapeHtml(f.content);
        const uniqueId = `file-${index}-${Date.now()}`;
        
        // Detect nesting level for indentation visual
        const depth = f.path.split('/').length - 1;
        const indent = depth * 12;

        return `
      <details class="group border-b border-gray-800 last:border-0 bg-[#0d1117] overflow-hidden">
        <summary class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition-colors select-none" style="padding-left: ${12 + indent}px">
          <div class="flex items-center gap-2 text-sm text-gray-300 font-mono truncate">
            <span class="text-gray-500 opacity-50">/</span>
            <span class="text-blue-400 group-open:text-cyan-400 transition-colors">${f.path}</span>
          </div>
          <span class="text-[9px] text-gray-500 font-bold bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 uppercase">${f.language}</span>
        </summary>
        <div class="border-t border-gray-800 bg-[#0d1117] relative">
          <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onclick="navigator.clipboard.writeText(document.getElementById('${uniqueId}').innerText)" class="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded hover:text-white border border-gray-700">COPIAR</button>
          </div>
          <pre class="m-0 p-4 overflow-x-auto custom-scrollbar text-xs font-mono leading-relaxed" id="${uniqueId}"><code class="language-${f.language} text-gray-300">${escapedCode}</code></pre>
        </div>
      </details>
        `;
    }).join('');

    // Generate Preview HTML (Iframe)
    const previewSource = assemblePreview(project.files);
    const hasPreview = !!previewSource;
    const previewId = `preview-${Date.now()}`;
    const codeId = `code-${Date.now()}`;

    // Base64 encode for srcdoc safety in template string
    const srcDocAttr = hasPreview ? escapeHtml(previewSource!) : '';

    return `
<div class="my-8 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.15)] border border-cyan-900/50 bg-[#0d1117]">
  
  <!-- Header -->
  <div class="bg-gray-900/90 backdrop-blur border-b border-gray-800 p-4 flex flex-wrap items-center justify-between gap-4">
    <div>
        <h3 class="text-cyan-400 font-display font-bold text-lg flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
             <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
           </svg>
           ARQUITECTURA: ${project.projectName}
        </h3>
        ${project.description ? `<p class="text-gray-400 text-xs mt-1 font-mono max-w-lg">${project.description}</p>` : ''}
    </div>
    
    <!-- Tabs Controller -->
    <div class="flex bg-black rounded-lg p-1 border border-gray-800">
        <label class="cursor-pointer">
            <input type="radio" name="tab-${previewId}" class="peer sr-only" checked onclick="document.getElementById('${codeId}').style.display='block'; document.getElementById('${previewId}').style.display='none';">
            <span class="px-3 py-1.5 text-xs font-bold rounded-md text-gray-400 peer-checked:bg-gray-800 peer-checked:text-cyan-400 transition-all flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
               CÓDIGO
            </span>
        </label>
        ${hasPreview ? `
        <label class="cursor-pointer">
            <input type="radio" name="tab-${previewId}" class="peer sr-only" onclick="document.getElementById('${codeId}').style.display='none'; document.getElementById('${previewId}').style.display='block';">
            <span class="px-3 py-1.5 text-xs font-bold rounded-md text-gray-400 peer-checked:bg-cyan-900/50 peer-checked:text-cyan-400 transition-all flex items-center gap-2">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
               VISTA PREVIA
            </span>
        </label>
        ` : ''}
    </div>
  </div>

  <!-- Content Area -->
  <div class="relative min-h-[300px]">
    
    <!-- Code View -->
    <div id="${codeId}">
       <div class="flex items-center px-4 py-2 bg-[#0d1117] border-b border-gray-800 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
         Explorador de Archivos
       </div>
       <div class="max-h-[500px] overflow-y-auto custom-scrollbar">
         ${filesHtml}
       </div>
    </div>

    <!-- Preview View (Hidden by default) -->
    ${hasPreview ? `
    <div id="${previewId}" style="display:none;" class="h-[500px] bg-white w-full">
       <iframe 
         srcdoc="${srcDocAttr}" 
         class="w-full h-full border-0" 
         sandbox="allow-scripts"
         title="App Preview"
       ></iframe>
    </div>
    ` : ''}

  </div>
</div>
    `;
};
