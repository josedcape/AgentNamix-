// @ts-ignore
const pdfjsLib = window.pdfjsLib;
// @ts-ignore
const mammoth = window.mammoth;
// @ts-ignore
const XLSX = window.XLSX;

export interface ProcessedDocument {
  name: string;
  type: string;
  content: string;
}

export const processFile = async (file: File): Promise<ProcessedDocument> => {
  let content = "";

  try {
    if (file.type === "application/pdf") {
      content = await readPdf(file);
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      content = await readDocx(file);
    } else if (
      file.type.includes("sheet") || 
      file.type.includes("excel") ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    ) {
      content = await readExcel(file);
    } else if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
      content = await readText(file);
    } else {
      throw new Error(`Formato de archivo no soportado: ${file.type}`);
    }

    // Limit content length per file to prevent hitting instant context limits on upload
    // Although Gemini 1.5/2.5 has huge context, let's keep it sane for browser memory
    const MAX_CHARS = 500000; 
    if (content.length > MAX_CHARS) {
        content = content.substring(0, MAX_CHARS) + "\n...[CONTENIDO TRUNCADO POR TAMAÑO]...";
    }

    return {
      name: file.name,
      type: file.type,
      content: content.trim(),
    };
  } catch (error) {
    console.error("Error processing file:", error);
    throw new Error(`Error leyendo ${file.name}: ${error}`);
  }
};

const readText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const readPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += `\n--- PÁGINA ${i} ---\n${pageText}`;
  }
  return fullText;
};

const readDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

const readExcel = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = "";

    workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        fullText += `\n--- HOJA: ${sheetName} ---\n${csv}`;
    });
    return fullText;
};
