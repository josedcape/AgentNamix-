import { Task, AgentConfiguration } from '../types';
import { marked } from 'marked';

// @ts-ignore
const html2pdf = window.html2pdf;

export const generateMissionReport = async (
  tasks: Task[], 
  agentConfig: AgentConfiguration,
  goal: string
) => {
  if (!html2pdf) {
    console.error("html2pdf library not found");
    alert("La librería de PDF no se ha cargado correctamente.");
    return;
  }

  const completedTasks = tasks.filter(t => t.status === 'completed' && t.result);
  
  if (completedTasks.length === 0) {
    alert("No hay tareas completadas para exportar.");
    return;
  }

  // Create a temporary container for the report
  const reportContainer = document.createElement('div');
  reportContainer.className = 'pdf-report-container';
  
  // Styles strictly for the PDF output to ensure cleanliness (White background, black text)
  const styles = `
    <style>
      .pdf-report-container {
        font-family: 'Helvetica', 'Arial', sans-serif;
        padding: 40px;
        background: white;
        color: #111;
        line-height: 1.6;
      }
      .pdf-header {
        border-bottom: 2px solid #22d3ee;
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      .pdf-title {
        font-size: 24px;
        font-weight: bold;
        color: #111;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .pdf-meta {
        font-size: 12px;
        color: #555;
        margin-top: 10px;
      }
      .pdf-task {
        margin-bottom: 30px;
        page-break-inside: avoid;
        border: 1px solid #eee;
        border-radius: 8px;
        overflow: hidden;
      }
      .pdf-task-header {
        background: #f3f4f6;
        padding: 10px 15px;
        font-weight: bold;
        color: #374151;
        font-size: 14px;
        border-bottom: 1px solid #ddd;
      }
      .pdf-task-content {
        padding: 15px;
        font-size: 12px;
      }
      /* Markdown Conversion Styles */
      .pdf-task-content h1, .pdf-task-content h2, .pdf-task-content h3 { color: #0891b2; margin-top: 1em; }
      .pdf-task-content p { margin-bottom: 10px; }
      .pdf-task-content ul { padding-left: 20px; }
      .pdf-task-content li { margin-bottom: 5px; list-style-type: disc; }
      .pdf-task-content code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
      .pdf-task-content pre { background: #1f2937; color: #fff; padding: 10px; border-radius: 5px; overflow-x: hidden; white-space: pre-wrap; }
      .pdf-task-content img { max-width: 100%; height: auto; border-radius: 5px; margin: 10px 0; }
      .pdf-task-content a { color: #2563eb; text-decoration: underline; }
      /* Hide interactive widgets in PDF */
      .pdf-task-content button, .pdf-task-content input { display: none; }
    </style>
  `;

  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  let htmlContent = `
    ${styles}
    <div class="pdf-header">
      <div class="pdf-title">REPORTE DE MISIÓN: AGENTNAMIX</div>
      <div class="pdf-meta">
        <strong>Agente:</strong> ${agentConfig.name} (${agentConfig.model})<br>
        <strong>Objetivo:</strong> ${goal}<br>
        <strong>Fecha:</strong> ${dateStr}
      </div>
    </div>
  `;

  completedTasks.forEach((task, index) => {
    // Parse Markdown to HTML
    const rawHtml = marked.parse(task.result || '');
    
    htmlContent += `
      <div class="pdf-task">
        <div class="pdf-task-header">FASE ${index + 1}: ${task.description}</div>
        <div class="pdf-task-content">${rawHtml}</div>
      </div>
    `;
  });

  reportContainer.innerHTML = htmlContent;

  const opt = {
    margin:       10,
    filename:     `Reporte_Mision_${Date.now()}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true }, // High res, allow remote images
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
      await html2pdf().set(opt).from(reportContainer).save();
  } catch (e) {
      console.error("PDF Generation failed", e);
      alert("Hubo un error generando el PDF. Revisa la consola.");
  }
};