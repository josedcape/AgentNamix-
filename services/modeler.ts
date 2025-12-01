
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const generate3DCode = async (instruction: string): Promise<string> => {
    const ai = getAiClient();
    
    const prompt = `
    Eres un experto en Three.js y gráficos 3D.
    Tu tarea es generar SOLO el código JavaScript necesario para agregar objetos a una escena Three.js existente.
    
    CONTEXTO DE EJECUCIÓN:
    - Ya existen las variables: 'scene', 'THREE'.
    - NO crees la escena, cámara ni renderizador. Ya están inicializados.
    - NO añadidas OrbitControls ni luces básicas (ya hay una luz ambiental y direccional).
    - Tu código se ejecutará dentro de una función.
    
    INSTRUCCIÓN DEL USUARIO: "${instruction}"
    
    REQUISITOS:
    1. Usa geometrías y materiales estándar de Three.js (MeshStandardMaterial, BoxGeometry, SphereGeometry, etc).
    2. Si necesitas animaciones, puedes definir una función 'animate()' pero NO un loop requestAnimationFrame (el sistema lo maneja).
    3. Asegúrate de que los objetos se añadan a 'scene' (ej: scene.add(mesh)).
    4. Devuelve SOLO el código JS, sin bloques de markdown (\`\`\`) ni explicaciones.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2,
                safetySettings: safetySettings
            }
        });
        
        let code = response.text || "";
        // Clean markdown
        code = code.replace(/```javascript/g, '').replace(/```js/g, '').replace(/```/g, '').trim();
        return code;
    } catch (e) {
        console.error("Error generating 3D code", e);
        return "// Error generando código 3D";
    }
};
