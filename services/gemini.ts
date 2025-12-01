import { GoogleGenAI, Type, FunctionDeclaration, Content, Part, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Task, AgentConfiguration } from '../types';
import { performBrowserAction, BrowserAction } from './browser';
import { createCalendarActionResponse, CalendarEvent } from './calendar';
import { createDriveActionResponse, DriveAction } from './drive';
import { createArchitectWidget, ProjectStructure } from './architect';
import { db } from './db';
import { createMemoryWidget, MemoryAction } from './memory';
import { executeSSHCommand, createSSHWidget, SSHCommand, connectToProxy } from './ssh';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper for delaying execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper wrapper to handle Rate Limits (429)
const generateContentWithRetry = async (model: any, params: any) => {
  let retries = 5;
  let delay = 4000; // Start with 4 seconds

  while (retries > 0) {
    try {
      return await model.generateContent(params);
    } catch (error: any) {
      const msg = error.message || JSON.stringify(error);
      const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');

      if (isRateLimit && retries > 1) {
        console.warn(`[Gemini] Límite de cuota alcanzado (429). Reintentando en ${delay/1000}s...`);
        await sleep(delay);
        delay *= 2; // Exponential backoff: 4s -> 8s -> 16s -> 32s
        retries--;
      } else {
        throw error;
      }
    }
  }
};

// Helper to map UI model names to actual SDK model names
const resolveModel = (modelId: string): string => {
  switch (modelId) {
    case 'gpt-5mini':
      return 'gemini-2.5-flash';
    case 'glm-4-6':
      return 'gemini-3-pro-preview';
    case 'gemini-3-pro':
      return 'gemini-3-pro-preview';
    case 'gemini-2.5-flash':
    default:
      return 'gemini-2.5-flash';
  }
};

const formatDocuments = (documents?: { name: string; content: string }[]) => {
    if (!documents || documents.length === 0) return "";
    return `
    ====== BASE DE CONOCIMIENTO (DOCUMENTOS CARGADOS) ======
    ${documents.map(d => `--- INICIO DE DOCUMENTO: ${d.name} ---\n${d.content}\n--- FIN DE DOCUMENTO ---`).join('\n\n')}
    ========================================================
    `;
};

// --- NEW FUNCTION: ENHANCE PROMPT ---
export const enhanceAgentDescription = async (currentDescription: string): Promise<string> => {
    const ai = getAiClient();
    
    const prompt = `
    Eres un experto Ingeniero de Prompts (Prompt Engineer) para sistemas de Inteligencia Artificial.
    
    TU TAREA:
    Mejora, expande y profesionaliza la siguiente descripción/instrucción de sistema para un Agente de IA.
    
    ENTRADA ACTUAL:
    "${currentDescription}"
    
    REQUISITOS:
    1. Mantén la intención original del usuario.
    2. Usa un tono imperativo, claro y profesional.
    3. Estructura el prompt mejorado para maximizar el rendimiento del modelo (rol, contexto, restricciones, estilo de respuesta).
    4. Devuelve SOLO el texto mejorado, sin introducciones ni explicaciones.
    5. El idioma de salida debe ser ESPAÑOL.
    `;

    try {
        const response = await generateContentWithRetry(ai.models, {
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.7, // Slightly creative to expand capabilities
                safetySettings: safetySettings
            }
        });
        
        return response.text?.trim() || currentDescription;
    } catch (e) {
        console.error("Error enhancing description", e);
        return currentDescription; // Fallback to original
    }
};

// --- NATIVE TOOL DECLARATIONS ---

const browserToolDeclaration: FunctionDeclaration = {
  name: 'browser_action',
  description: 'Realiza una acción en el navegador web simulado. Útil para navegar, hacer clic en enlaces visibles o buscar información interactivamente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ['NAVIGATE', 'CLICK', 'TYPE', 'SCROLL'],
        description: 'El tipo de acción a realizar.'
      },
      target: {
        type: Type.STRING,
        description: 'Para CLICK: El texto exacto del enlace. Para TYPE: irrelevante.'
      },
      value: {
        type: Type.STRING,
        description: 'Para NAVIGATE: La URL completa. Para TYPE: El texto a buscar.'
      }
    },
    required: ['action']
  }
};

const scrapeToolDeclaration: FunctionDeclaration = {
  name: 'web_scrape',
  description: 'Extrae el contenido de texto completo de una URL específica. Úsalo cuando necesites leer datos masivos de una página sin navegar interactivamente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: 'La URL completa de la página a analizar.'
      }
    },
    required: ['url']
  }
};

const calendarToolDeclaration: FunctionDeclaration = {
  name: 'google_calendar',
  description: 'Programa un evento en el Google Calendar. Genera un enlace directo para que el usuario guarde el evento.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Título del evento' },
      description: { type: Type.STRING, description: 'Descripción detallada del evento' },
      startTime: { type: Type.STRING, description: 'Fecha y hora de inicio (ISO 8601 o YYYY-MM-DD HH:MM)' },
      endTime: { type: Type.STRING, description: 'Fecha y hora de fin (ISO 8601 o YYYY-MM-DD HH:MM)' },
      location: { type: Type.STRING, description: 'Ubicación (opcional)' },
      color: { type: Type.STRING, description: 'Color del evento (Rojo, Azul, Verde, Amarillo, etc)' }
    },
    required: ['title', 'startTime', 'endTime']
  }
};

const driveToolDeclaration: FunctionDeclaration = {
  name: 'google_drive',
  description: 'Interactúa con Google Drive. Permite generar enlaces para buscar archivos o crear nuevos documentos (Docs, Sheets, Slides).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ['SEARCH', 'CREATE'], description: 'Buscar o Crear archivo' },
      query: { type: Type.STRING, description: 'Términos de búsqueda (solo si action es SEARCH)' },
      fileType: { type: Type.STRING, enum: ['document', 'spreadsheet', 'presentation'], description: 'Tipo de archivo a crear (solo si action es CREATE)' }
    },
    required: ['action']
  }
};

const architectToolDeclaration: FunctionDeclaration = {
  name: 'software_architect',
  description: 'Genera una estructura de proyecto de software completa con múltiples archivos y código. Úsalo cuando te pidan diseñar una app, script o arquitectura.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectName: { type: Type.STRING, description: 'Nombre del proyecto' },
      description: { type: Type.STRING, description: 'Descripción breve de la arquitectura' },
      files: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
             path: { type: Type.STRING, description: 'Ruta relativa del archivo (ej: src/utils/api.ts, index.html, css/style.css)' },
             language: { type: Type.STRING, description: 'Lenguaje de programación (ts, js, py, html, css, json)' },
             content: { type: Type.STRING, description: 'Código fuente completo del archivo' }
          },
          required: ['path', 'language', 'content']
        }
      }
    },
    required: ['projectName', 'files']
  }
};

const memoryToolDeclaration: FunctionDeclaration = {
    name: 'memory_system',
    description: 'Sistema de Memoria Persistente. Úsalo para recordar información importante para el futuro o recuperar información de sesiones pasadas.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING, enum: ['STORE', 'RETRIEVE', 'FORGET'], description: 'Guardar, Recuperar o Olvidar' },
            content: { type: Type.STRING, description: 'Lo que se debe recordar (solo para STORE)' },
            query: { type: Type.STRING, description: 'Término de búsqueda (solo para RETRIEVE)' },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high'], description: 'Importancia del recuerdo (solo para STORE)' },
            memoryId: { type: Type.STRING, description: 'ID del recuerdo a borrar (solo para FORGET)' }
        },
        required: ['action']
    }
};

const sshToolDeclaration: FunctionDeclaration = {
    name: 'aura_ssh_command',
    description: 'Ejecuta un comando de terminal Linux en el servidor remoto configurado. Úsalo para gestión de archivos, directorios, instalación de paquetes y tareas de SysAdmin.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            command: { type: Type.STRING, description: 'El comando de shell a ejecutar (ej: ls -la, mkdir test, git clone ...)' },
            reasoning: { type: Type.STRING, description: 'Breve explicación de por qué ejecutas este comando.' }
        },
        required: ['command', 'reasoning']
    }
};

const modelerToolDeclaration: FunctionDeclaration = {
    name: 'generate_3d_model',
    description: 'Genera código para crear un modelo 3D en la escena actual. Úsalo cuando el usuario pida visualizar o crear objetos 3D.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: 'Descripción detallada del objeto a crear' }
        },
        required: ['description']
    }
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- HELP SYSTEM LOGIC ---

export const queryHelpAssistant = async (question: string): Promise<string> => {
    const ai = getAiClient();
    const systemInstruction = `
    Eres el Asistente de Soporte Técnico de AGENTNAMIX (v2.0).
    
    INFORMACIÓN DEL SISTEMA:
    AGENTNAMIX es un agente autónomo de IA que vive en el navegador. No usa servidor backend.
    
    HERRAMIENTAS DISPONIBLES:
    1. Web Search (Google): Búsqueda tradicional con fuentes.
    2. Interacción DOM (Browser Interaction): Navega, hace clic y lee webs reales usando un proxy (Jina).
    3. Web Scraping: Extrae texto masivo de una URL sin navegar.
    4. Arquitecto SW: Genera proyectos de código con múltiples archivos y vista previa.
    5. Google Calendar: Crea enlaces para agendar eventos.
    6. Google Drive: Crea enlaces para docs/sheets o buscar archivos.
    7. Memoria L.P.: Base de datos local para recordar hechos entre sesiones.
    8. Image Analyzer: Visión multimodal para analizar imágenes subidas por el usuario.
    9. Deep Analysis: Razonamiento lógico puro.
    10. Modelo 3D: Generación de modelos 3D con Three.js.
    
    TU OBJETIVO:
    Responder dudas del usuario sobre CÓMO usar la aplicación.
    Sé conciso, amigable y usa un tono "Tech Support / Futurista".
    Usa emojis.
    Si te preguntan sobre cosas fuera del uso de la app, diles amablemente que solo das soporte sobre AGENTNAMIX.
    `;

    try {
        const response = await generateContentWithRetry(ai.models, {
            model: 'gemini-2.5-flash',
            contents: question,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.3,
                safetySettings: safetySettings
            }
        });
        return response.text || "Lo siento, hubo un error de comunicación.";
    } catch (e: any) {
        return `Error del sistema: ${e.message}`;
    }
};

// --- CORE AGENT LOGIC ---

export const createPlan = async (goal: string, config: AgentConfiguration): Promise<string[]> => {
  const ai = getAiClient();
  const targetModel = resolveModel(config.model);
  
  const toolDescriptions = config.tools.join(', ');
  const docContext = formatDocuments(config.documents);
  const imageContext = config.images && config.images.length > 0 ? `\n[ENTRADA VISUAL]: Se han adjuntado ${config.images.length} imágenes para análisis.` : '';
  
  const prompt = `
    IDENTIDAD DEL AGENTE: ${config.name}
    DESCRIPCIÓN DEL AGENTE: ${config.description}
    HERRAMIENTAS DISPONIBLES: ${toolDescriptions}

    ${docContext}
    ${imageContext}

    Eres un agente autónomo de planificación de tareas.
    Objetivo: "${goal}".
    
    Desglosa este objetivo en una secuencia lógica de 3 a 6 pasos ejecutables.
    Cada paso debe ser una instrucción clara y concisa en ESPAÑOL.
    Devuelve SOLO la lista de pasos en formato JSON.
  `;

  try {
    const response = await generateContentWithRetry(ai.models, {
      model: targetModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        temperature: 0.2,
        safetySettings: safetySettings
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Error creating plan:", error);
    throw error;
  }
};

/**
 * Main Execution Function using Native Function Calling
 */
export const executeTask = async (
  task: Task, 
  context: string, 
  goal: string, 
  config: AgentConfiguration,
  onBrowserAction?: (action: BrowserAction) => void,
  onProjectUpdate?: (project: ProjectStructure) => void
): Promise<string> => {
  const ai = getAiClient();
  const targetModel = resolveModel(config.model);

  const hasWebSearch = config.tools.includes('web_search');
  const hasBrowser = config.tools.includes('browser_interaction');
  const hasScrape = config.tools.includes('web_scrape');
  const hasCalendar = config.tools.includes('google_calendar');
  const hasDrive = config.tools.includes('google_drive');
  const hasArchitect = config.tools.includes('software_architect');
  const hasMemory = config.tools.includes('memory_system');
  const hasVision = config.tools.includes('image_analyzer') && config.images && config.images.length > 0;
  const hasSSH = config.tools.includes('aura_ssh');
  const hasModel3D = config.tools.includes('model_3d');
  
  // Configure Tools
  const tools: any[] = [];
  const functionDeclarations: FunctionDeclaration[] = [];

  if (hasWebSearch) tools.push({ googleSearch: {} });
  if (hasBrowser) functionDeclarations.push(browserToolDeclaration);
  if (hasScrape) functionDeclarations.push(scrapeToolDeclaration);
  if (hasCalendar) functionDeclarations.push(calendarToolDeclaration);
  if (hasDrive) functionDeclarations.push(driveToolDeclaration);
  if (hasArchitect) functionDeclarations.push(architectToolDeclaration);
  if (hasMemory) functionDeclarations.push(memoryToolDeclaration);
  if (hasSSH) functionDeclarations.push(sshToolDeclaration);
  if (hasModel3D) functionDeclarations.push(modelerToolDeclaration);

  if (functionDeclarations.length > 0) {
      tools.push({ functionDeclarations });
  }

  // Initial State
  let currentUrl = "https://www.google.com";
  let currentWebContent = "";
  
  // Connect to SSH Proxy if needed (First time)
  if (hasSSH && config.sshConfig?.mode === 'real') {
      await connectToProxy(config.sshConfig);
  }

  // Construct History (Context)
  const docContext = formatDocuments(config.documents);
  
  let systemInstruction = `Eres ${config.name}. ${config.description}
  REGLAS:
  1. IDIOMA: Responde SIEMPRE en ESPAÑOL.
  2. FORMATO: Markdown profesional con emojis.
  `;

  if (hasScrape) systemInstruction += `\n- Usa 'web_scrape' para obtener datos masivos de una URL conocida sin navegar paso a paso.`;
  if (hasCalendar) systemInstruction += `\n- Usa 'google_calendar' cuando necesites agendar una reunión o evento.`;
  if (hasDrive) systemInstruction += `\n- Usa 'google_drive' para buscar archivos existentes o crear nuevos documentos/hojas de cálculo.`;
  if (hasArchitect) systemInstruction += `\n- Usa 'software_architect' para diseñar aplicaciones. SIEMPRE incluye 'index.html' si es una aplicación web para que el usuario pueda ver la VISTA PREVIA. Genera código completo, no omitas partes.`;
  if (hasVision) systemInstruction += `\n- Tienes CAPACIDAD VISUAL. Se te han proporcionado imágenes. Analízalas detalladamente para responder a la tarea. Describe objetos, lee textos (OCR) y detecta patrones visuales si es necesario.`;
  if (hasSSH) {
      const mode = config.sshConfig?.mode === 'real' ? 'REAL (PRODUCCIÓN)' : 'SIMULADO';
      systemInstruction += `\n- Tienes ACCESO SSH (${mode}) al servidor ${config.sshConfig?.host || 'remoto'}. Usa 'aura_ssh_command' para ejecutar comandos. Eres un SysAdmin experto.`;
  }
  if (hasModel3D) systemInstruction += `\n- Tienes acceso a un ESTUDIO 3D. Si el usuario pide crear objetos 3D, figuras o escenas, invítalo a usar el botón flotante 'MODELO 3D' o usa la herramienta 'generate_3d_model'.`;
  
  if (hasMemory) {
      const importantMemories = db.getHighPriorityMemories();
      const memoryContext = importantMemories.length > 0 
        ? `\n\n[MEMORIA A LARGO PLAZO - DATOS CRÍTICOS]:\n${importantMemories.map(m => `- [${m.type.toUpperCase()}] ${m.content}`).join('\n')}`
        : "";
      
      systemInstruction += `\n- Usa 'memory_system' para guardar preferencias del usuario, hechos importantes o resultados clave que deban persistir. Antes de responder, verifica si hay información relevante en la memoria.\n${memoryContext}`;
  }

  // Build the Initial Prompt (User Turn)
  // If we have images, the parts array changes from simple text to multimodal objects
  const promptText = `
    OBJETIVO GLOBAL: ${goal}
    ${docContext}
    CONTEXTO PREVIO: ${context}
    TAREA ACTUAL: ${task.description}
    ${hasBrowser ? `URL INICIAL: ${currentUrl}` : ''}
    
    Ejecuta la tarea utilizando las herramientas disponibles.
  `;

  const userParts: Part[] = [{ text: promptText }];

  // Inject Images if available
  if (hasVision && config.images) {
      config.images.forEach(img => {
          userParts.push({
              inlineData: {
                  mimeType: img.mimeType,
                  data: img.data
              }
          });
      });
  }

  // History for Multi-turn conversation
  let contents: Content[] = [
    { role: 'user', parts: userParts }
  ];

  let loopCount = 0;
  const MAX_LOOPS = 6; 
  let finalResponseText = "";

  while (loopCount < MAX_LOOPS) {
    console.log(`[Gemini Loop ${loopCount}] Sending request...`);
    
    try {
      // Use Retry Wrapper
      const response = await generateContentWithRetry(ai.models, {
        model: targetModel,
        contents: contents,
        config: {
          tools: tools,
          systemInstruction: systemInstruction,
          temperature: 0.5,
          safetySettings: safetySettings
        }
      });

      // Append model response to history
      const responseContent = response.candidates?.[0]?.content;
      if (!responseContent) throw new Error(`No content from model. FinishReason: ${response.candidates?.[0]?.finishReason}`);
      
      contents.push(responseContent);

      // 1. Check for Function Calls (Native Tools)
      const functionCalls = responseContent.parts?.filter(part => part.functionCall);
      
      if (functionCalls && functionCalls.length > 0) {
        const partsForNextTurn: Part[] = [];

        for (const callPart of functionCalls) {
          const call = callPart.functionCall!;
          console.log("[Gemini Tool Call]", call.name, call.args);

          let resultText = "";
          let resultData: any = {};

          // --- HANDLE BROWSER INTERACTION ---
          if (call.name === 'browser_action') {
            const args = call.args as unknown as BrowserAction;
            if (onBrowserAction) onBrowserAction(args);
            const result = await performBrowserAction(args, currentUrl, currentWebContent);
            
            if (result.success && result.data) {
                currentWebContent = result.data;
                currentUrl = result.currentUrl || currentUrl;
            }
            resultData = {
                success: result.success,
                message: result.message,
                current_url: currentUrl,
                page_content_snippet: result.data ? result.data.slice(0, 10000) : "No data"
            };
          }
          
          // --- HANDLE WEB SCRAPE ---
          else if (call.name === 'web_scrape') {
             const url = call.args['url'] as string;
             // Reuse browser engine logic just for fetching
             const result = await performBrowserAction({ action: 'NAVIGATE', value: url }, currentUrl, "");
             resultData = {
                 success: result.success,
                 content: result.data ? result.data.slice(0, 15000) : "Failed to scrape"
             };
          }

          // --- HANDLE GOOGLE CALENDAR ---
          else if (call.name === 'google_calendar') {
             const event = call.args as unknown as CalendarEvent;
             const htmlWidget = createCalendarActionResponse(event);
             resultData = { success: true, message: "Evento creado. Widget generado." };
             finalResponseText += `\n\n${htmlWidget}`;
          }

          // --- HANDLE GOOGLE DRIVE ---
          else if (call.name === 'google_drive') {
             const cmd = call.args as unknown as DriveAction;
             const htmlWidget = createDriveActionResponse(cmd);
             resultData = { success: true, message: "Enlace de Drive generado." };
             finalResponseText += `\n\n${htmlWidget}`;
          }

          // --- HANDLE SOFTWARE ARCHITECT ---
          else if (call.name === 'software_architect') {
             const project = call.args as unknown as ProjectStructure;
             if (onProjectUpdate) onProjectUpdate(project);
             const htmlWidget = createArchitectWidget(project);
             resultData = { success: true, message: "Arquitectura generada y renderizada con vista previa." };
             finalResponseText += `\n\n${htmlWidget}`;
          }

          // --- HANDLE MEMORY SYSTEM ---
          else if (call.name === 'memory_system') {
              const memAction = call.args as unknown as MemoryAction;
              
              if (memAction.action === 'STORE') {
                  const id = db.addMemory(memAction.content || '', 'fact', memAction.priority || 'medium');
                  const htmlWidget = createMemoryWidget('STORE', { ...memAction, id, timestamp: Date.now() });
                  resultData = { success: true, message: `Memoria guardada con ID ${id}` };
                  finalResponseText += `\n\n${htmlWidget}`;
              } 
              else if (memAction.action === 'RETRIEVE') {
                  const results = db.searchMemories(memAction.query || '');
                  const htmlWidget = createMemoryWidget('RETRIEVE', results);
                  resultData = { success: true, count: results.length, results: results };
                  finalResponseText += `\n\n${htmlWidget}`;
              }
              else if (memAction.action === 'FORGET') {
                  if (memAction.memoryId) {
                      db.forgetMemory(memAction.memoryId);
                      resultData = { success: true, message: "Memoria eliminada" };
                  } else {
                      resultData = { success: false, message: "ID requerido para borrar" };
                  }
              }
          }

          // --- HANDLE AURA SSH ---
          else if (call.name === 'aura_ssh_command') {
             const sshCmd = call.args as unknown as SSHCommand;
             const output = await executeSSHCommand(sshCmd.command, config.sshConfig);
             const htmlWidget = createSSHWidget(sshCmd, output, config.sshConfig?.host || 'remote-server', config.sshConfig?.mode === 'real');
             
             resultData = { success: true, output: output };
             finalResponseText += `\n\n${htmlWidget}`;
          }

          // --- HANDLE 3D MODELER ---
          else if (call.name === 'generate_3d_model') {
             resultData = { success: true, message: "Por favor abre el panel 'MODELO 3D' para visualizar la generación." };
             finalResponseText += `\n\n🧩 **Solicitud 3D Recibida**: Para visualizar "${call.args['description']}", por favor abre el panel **MODELO 3D** en la esquina inferior derecha.`;
          }

          // Create Function Response Part
          partsForNextTurn.push({
            functionResponse: {
              name: call.name,
              id: call.id,
              response: { result: resultData }
            }
          });
        }

        // Send function results back to model in next loop
        contents.push({ role: 'user', parts: partsForNextTurn });
        loopCount++;
        continue; // LOOP AGAIN
      }

      // 2. No Function Calls -> Final Answer
      // Check for Google Search Grounding
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      let text = response.text || "";

      if (groundingChunks && hasWebSearch) {
         const sources = groundingChunks
           .map((c: any) => c.web?.uri && c.web?.title ? `- [${c.web.title}](${c.web.uri})` : null)
           .filter(Boolean)
           .join('\n');
         
         if (sources) text += `\n\n---\n### 📚 Fuentes\n${sources}`;

         const imageUrls = groundingChunks
          .map((c: any) => c.web?.uri)
          .filter(Boolean)
          .slice(0, 3);

         if (imageUrls.length > 0) {
             text += `\n\n---\n### 📸 Capturas\n`;
             imageUrls.forEach((url: string) => {
                 text += `\n[![Vista](${`https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=600&h=400`})](${url})`;
             });
         }
      }

      // If we accumulated extra HTML (like calendar/drive widgets), append it
      if (finalResponseText.includes("div class=")) {
          text += finalResponseText; 
      }
      finalResponseText = text;
      break; // Exit loop

    } catch (error) {
      console.error("Error in execution loop:", error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  return finalResponseText || "No se pudo generar una respuesta final.";
};