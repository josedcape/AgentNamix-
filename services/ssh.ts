
import { SSHConfiguration } from '../types';

/**
 * Service to handle AURA SSH interactions.
 * Supports two modes:
 * 1. SIMULATED: Virtual file system for testing/demos.
 * 2. REAL: Connects via WebSocket to a SSH Bridge (MCP/Gateway).
 *    Browser (WebSocket) -> Proxy Bridge -> SSH (TCP) -> Remote Server
 */

export interface SSHCommand {
    command: string;
    reasoning: string;
}

// --- VIRTUAL SIMULATOR STATE ---
let currentDir = "/home/user";
const fileSystem: Record<string, string[]> = {
    "/home/user": ["documents", "projects", "readme.txt"],
    "/var/www/html": ["index.html", "style.css"],
    "/etc/nginx": ["nginx.conf"]
};

// --- REAL CONNECTION STATE ---
let socket: WebSocket | null = null;
let isConnected = false;
let connectionOutputBuffer = "";

export const connectToProxy = (config: SSHConfiguration): Promise<boolean> => {
    if (config.mode !== 'real' || !config.proxyUrl) return Promise.resolve(true);

    return new Promise((resolve) => {
        try {
            console.log(`[AURA SSH] Connecting to Bridge: ${config.proxyUrl}`);
            socket = new WebSocket(config.proxyUrl);

            socket.onopen = () => {
                console.log("[AURA SSH] Bridge Connected");
                // Handshake protocol depends on the specific Bridge/MCP server used.
                // Sending auth packet...
                socket?.send(JSON.stringify({
                    type: 'AUTH',
                    host: config.host,
                    port: parseInt(config.port),
                    username: config.username,
                    password: config.password
                }));
                isConnected = true;
                resolve(true);
            };

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'OUTPUT') {
                    connectionOutputBuffer += data.content;
                }
            };

            socket.onerror = (err) => {
                console.error("[AURA SSH] Connection Error", err);
                resolve(false);
            };
        } catch (e) {
            console.error(e);
            resolve(false);
        }
    });
};

const executeRealCommand = async (cmd: string): Promise<string> => {
    if (!socket || !isConnected) {
        return "ERROR: No hay conexión activa con el puente SSH (WebSocket). Verifica la configuración.";
    }

    connectionOutputBuffer = ""; // Clear buffer
    socket.send(JSON.stringify({ type: 'EXEC', command: cmd }));

    // Wait for response (Simple polling for demo purposes)
    // In a production app, this would be event-driven/async iterator
    let attempts = 0;
    while (attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        if (connectionOutputBuffer) {
            const output = connectionOutputBuffer;
            return output; // Return what we got so far
        }
        attempts++;
    }
    
    return "[TIMEOUT] El servidor tardó demasiado en responder o no hubo salida.";
};

const executeSimulatedCommand = async (cmd: string): Promise<string> => {
    // Simulate latency
    await new Promise(r => setTimeout(r, 800));

    const command = cmd.trim();
    
    if (command.startsWith("ls")) {
        const content = fileSystem[currentDir] || [];
        return content.length > 0 ? content.join("\n") : "(empty directory)";
    }
    
    if (command.startsWith("cd ")) {
        const target = command.split(" ")[1];
        if (target === "..") {
            const parts = currentDir.split("/");
            parts.pop();
            currentDir = parts.join("/") || "/";
        } else if (target.startsWith("/")) {
            currentDir = target;
        } else {
            currentDir = `${currentDir}/${target}`.replace("//", "/");
        }
        return "";
    }
    
    if (command.startsWith("pwd")) {
        return currentDir;
    }

    if (command.startsWith("mkdir ")) {
        const dirName = command.split(" ")[1];
        if (!fileSystem[currentDir]) fileSystem[currentDir] = [];
        fileSystem[currentDir].push(dirName);
        return "";
    }

    if (command.startsWith("touch ") || command.startsWith("nano ") || command.startsWith("vim ")) {
        const fileName = command.split(" ")[1];
        if (!fileSystem[currentDir]) fileSystem[currentDir] = [];
        if (!fileSystem[currentDir].includes(fileName)) fileSystem[currentDir].push(fileName);
        return "";
    }
    
    if (command.startsWith("cat ")) {
        return "Contenido del archivo simulado:\n# Config File\nuser=admin\nport=8080";
    }

    if (command.includes("apt") || command.includes("yum") || command.includes("npm")) {
        return `
[PROGRESS] 20%...
[PROGRESS] 50%...
[PROGRESS] 80%...
[SUCCESS] Paquetes instalados/actualizados correctamente.
        `.trim();
    }
    
    if (command.includes("systemctl") || command.includes("service")) {
        return "[SYSTEM] Servicio reiniciado correctamente. Estado: Active (Running)";
    }
    
    if (command.includes("whoami")) return "root";
    if (command.includes("uptime")) return " 14:32:01 up 45 days, 10:22,  1 user,  load average: 0.05, 0.03, 0.01";

    return `[AURA EXEC] Comando simulado ejecutado: ${command}`;
};

export const executeSSHCommand = async (cmd: string, config?: SSHConfiguration): Promise<string> => {
    if (config?.mode === 'real') {
        return executeRealCommand(cmd);
    } else {
        return executeSimulatedCommand(cmd);
    }
};

export const createSSHWidget = (input: SSHCommand, output: string, host: string, isReal: boolean): string => {
    
    const statusDot = isReal 
        ? '<span class="animate-pulse w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_red]"></span> <span class="text-red-500 font-bold">LIVE CONNECTION</span>'
        : '<span class="w-2 h-2 rounded-full bg-blue-500"></span> <span class="text-blue-500">SIMULATION MODE</span>';

    return `
<div class="my-6 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)] border border-emerald-900/50 bg-[#0c0c0c] font-mono text-sm">
  <!-- Terminal Header -->
  <div class="bg-[#1a1a1a] p-2 flex items-center justify-between border-b border-[#333]">
      <div class="flex gap-1.5 ml-2">
          <div class="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
          <div class="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
          <div class="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
      </div>
      <div class="text-[#666] text-[10px] flex items-center gap-2 uppercase tracking-widest">
          ${statusDot} | root@${host}
      </div>
      <div class="w-10"></div>
  </div>

  <!-- Terminal Body -->
  <div class="p-4 text-emerald-500/90 leading-relaxed min-h-[120px]">
      <div class="mb-2 text-gray-500 italic text-xs border-l-2 border-emerald-900 pl-2">
         // Razón: ${input.reasoning}
      </div>
      
      <div class="flex gap-2 text-white font-bold">
          <span class="text-emerald-400">➜</span>
          <span class="text-blue-400">~${currentDir}</span>
          <span class="typing-effect">${input.command}</span>
      </div>

      <div class="mt-2 text-gray-400 whitespace-pre-wrap font-mono text-xs">${output}</div>
      
      <div class="mt-2 animate-pulse">_</div>
  </div>
</div>
    `;
};
