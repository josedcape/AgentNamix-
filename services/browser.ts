

export interface BrowserAction {
  action: 'CLICK' | 'TYPE' | 'SCROLL' | 'NAVIGATE';
  target?: string;
  value?: string;
}

export interface BrowserResult {
  success: boolean;
  data?: string;
  message?: string;
  currentUrl?: string;
}

const JINA_PROXY = 'https://r.jina.ai/';

/**
 * Helper to safely resolve relative URLs against the current page URL.
 */
const resolveUrl = (relative: string, base: string): string => {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return relative; // Return original if parsing fails (might be a magnet link or javascript:)
  }
};

const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Extracts the best matching link from Markdown content.
 */
const findLinkInMarkdown = (markdown: string, selector: string): string | null => {
  if (!selector) return null;
  
  // 1. Direct URL match
  if (selector.startsWith('http') || selector.startsWith('www')) return selector;

  // 2. Exact Text Match: [Selector](url)
  const exactRegex = new RegExp(`\\[\\s*${escapeRegExp(selector)}\\s*\\]\\((.*?)\\)`, 'i');
  const exactMatch = markdown.match(exactRegex);
  if (exactMatch && exactMatch[1]) return exactMatch[1];

  // 3. Partial Text Match: [...Selector...](url)
  const partialRegex = new RegExp(`\\[.*${escapeRegExp(selector)}.*\\]\\((.*?)\\)`, 'i');
  const partialMatch = markdown.match(partialRegex);
  if (partialMatch && partialMatch[1]) return partialMatch[1];

  return null;
};

/**
 * Performs the actual HTTP fetch via the Proxy with timeout and error handling.
 */
const fetchPage = async (url: string): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`${JINA_PROXY}${url}`, {
        headers: {
            'X-Target-Selector': 'body', 
            'Accept': 'text/plain' 
        },
        signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
             throw new Error("Acceso Denegado (403). El sitio bloquea bots.");
        }
        if (response.status === 404) {
             throw new Error("Página no encontrada (404).");
        }
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    if (!text || text.length < 50) {
        throw new Error("Contenido vacío o ilegible recibido del proxy.");
    }
    
    return text;
  } catch (error: any) {
    if (error.name === 'AbortError') {
        throw new Error("Tiempo de espera agotado al conectar con el sitio.");
    }
    throw error;
  }
};

export const performBrowserAction = async (
  cmd: BrowserAction, 
  currentUrl: string, 
  currentContent: string
): Promise<BrowserResult> => {
  console.log(`[Browser Engine] Ejecutando: ${cmd.action} target="${cmd.target}" value="${cmd.value}"`);

  try {
    switch (cmd.action) {
      case 'NAVIGATE':
        if (!cmd.value) throw new Error("URL requerida para navegación.");
        
        let targetUrl = cmd.value;
        if (!targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;

        try {
            const navContent = await fetchPage(targetUrl);
            return {
              success: true,
              data: navContent,
              currentUrl: targetUrl,
              message: `Navegación exitosa a ${targetUrl}`
            };
        } catch (e: any) {
             return {
                 success: false,
                 message: `Fallo al navegar: ${e.message}. SUGERENCIA: Usa la acción 'TYPE' para buscar este sitio en Google en su lugar.`
             };
        }

      case 'CLICK':
        if (!cmd.target) throw new Error("Objetivo (target) requerido para clic.");
        
        // Find the link
        const linkHref = findLinkInMarkdown(currentContent, cmd.target);
        
        if (!linkHref) {
            // Failure: Scan for available links to help the agent
            const links: string[] = [];
            const linkRegex = /\[(.*?)\]\((.*?)\)/g;
            let match;
            while ((match = linkRegex.exec(currentContent)) !== null) {
                if (match[1] && match[1].length > 3 && links.length < 8) {
                    links.push(`"${match[1]}"`);
                }
            }
            
            return {
                success: false,
                message: `No se encontró el enlace "${cmd.target}".\nSUGERENCIA: Intenta con uno de estos enlaces visibles: ${links.join(', ')}.\nO usa 'TYPE' para buscar.`
            };
        }

        // Robust URL resolution
        const absoluteUrl = resolveUrl(linkHref, currentUrl);

        try {
            const clickContent = await fetchPage(absoluteUrl);
            return {
                success: true,
                data: clickContent,
                currentUrl: absoluteUrl,
                message: `Clic en "${cmd.target}" exitoso. Página cargada: ${absoluteUrl}`
            };
        } catch (e: any) {
            return {
                success: false,
                message: `El enlace fue encontrado pero falló la carga: ${e.message}. Intenta buscar la información en otra fuente.`
            };
        }

      case 'TYPE':
        if (!cmd.value) throw new Error("Valor (value) requerido para escribir.");
        
        // Construct smart search URL
        let searchUrl = "";
        const encodedQuery = encodeURIComponent(cmd.value);

        if (currentUrl.includes('google')) {
            searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
        } else if (currentUrl.includes('amazon')) {
            searchUrl = `https://www.amazon.com/s?k=${encodedQuery}`;
        } else if (currentUrl.includes('youtube')) {
            searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
        } else if (currentUrl.includes('wikipedia')) {
            searchUrl = `https://es.wikipedia.org/w/index.php?search=${encodedQuery}`;
        } else {
            // Fallback: Site search via Google
            try {
                const domain = new URL(currentUrl).hostname;
                searchUrl = `https://www.google.com/search?q=site:${domain}+${encodedQuery}`;
            } catch {
                searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
            }
        }

        try {
            const typeContent = await fetchPage(searchUrl);
            return {
                success: true,
                data: typeContent,
                currentUrl: searchUrl,
                message: `Búsqueda "${cmd.value}" realizada con éxito en ${new URL(searchUrl).hostname}.`
            };
        } catch (e: any) {
             return {
                 success: false,
                 message: `Error al realizar la búsqueda: ${e.message}. Intenta navegar directamente a Google.com.`
             };
        }

      case 'SCROLL':
        return {
            success: true,
            message: "Scroll simulado. Continúa analizando el contenido actual."
        };

      default:
        // @ts-ignore
        throw new Error(`Acción desconocida: ${cmd.action}`);
    }
  } catch (error: any) {
    return {
        success: false,
        message: `Error Crítico del Navegador: ${error.message}`
    };
  }
};
