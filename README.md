
# 🧠 AGENTNAMIX
### Unidad de Inteligencia Autónoma & Motor de Ejecución de Tareas

![Version](https://img.shields.io/badge/VERSION-2.5-cyan?style=for-the-badge)
![AI Engine](https://img.shields.io/badge/ENGINE-GEMINI%202.5%20%2F%203.0-violet?style=for-the-badge)
![Status](https://img.shields.io/badge/ESTADO-OPERATIVO-green?style=for-the-badge)

**AGENTNAMIX** (BOTIDINAMIX AI 2025) es una plataforma de agente autónomo de última generación que se ejecuta completamente en el navegador. Utiliza los modelos más avanzados de **Google Gemini** para planificar, razonar y ejecutar tareas complejas de forma multimodal.

---

## 🚀 Características Principales

### 1. 👁️ Visión Multimodal (Image Analyzer)
El agente ahora tiene ojos.
*   **Análisis Visual**: Sube imágenes (JPG, PNG, WEBP) y el agente las analizará junto con tu objetivo.
*   **Capacidades**: Identificación de objetos, lectura de texto (OCR) en documentos escaneados, análisis de gráficos y UI.

### 2. 🎙️ Interacción por Voz (Voice Mode)
Habla con tu agente y escucha sus respuestas.
*   **Dictado (STT)**: Usa el micrófono para dictar misiones complejas sin escribir.
*   **Síntesis (TTS)**: El agente puede leer en voz alta sus hallazgos con una voz natural en español.

### 3. 🌐 Navegación Web "Real" (Browser Interaction)
A diferencia de otros agentes que solo buscan texto, AGENTNAMIX posee un **Motor de Navegación**.
*   **Lee la Web en vivo**: Utiliza un proxy avanzado (Jina AI) para leer el DOM de cualquier URL pública.
*   **Acciones Humanas**: Puede decidir hacer **CLIC** en enlaces, **ESCRIBIR** en barras de búsqueda y **NAVEGAR** a través de múltiples páginas.

### 4. 📄 Gestión Documental & Reportes
*   **RAG Local**: Carga PDF, DOCX, XLSX y TXT para que el agente los use como base de conocimiento.
*   **Exportación PDF**: Genera reportes profesionales de toda la misión con un solo clic, incluyendo tablas y formato limpio.

### 5. 🏗️ Arquitecto de Software
*   **Generación de Proyectos**: Diseña aplicaciones completas con múltiples archivos.
*   **Vista Previa en Vivo**: Renderiza y ejecuta el código HTML/JS/CSS generado directamente en un entorno seguro (Sandbox) dentro del chat.

---

## 🛠️ Arsenal de Herramientas (Tools)

El agente decide dinámicamente qué herramienta usar para completar la misión:

| Herramienta | Icono | Descripción |
| :--- | :---: | :--- |
| **Web Search** | 🔍 | Búsqueda en Google con *grounding* (fuentes verificadas). |
| **Browser Interaction** | 🌐 | Navegación autónoma real (Clic, Escribir, Leer). |
| **Image Analyzer** | 👁️ | Análisis de imágenes y visión por computadora. |
| **Software Architect** | 🏗️ | Generación de código estructurado y preview de apps. |
| **Google Calendar** | 📅 | Genera enlaces para agendar eventos automáticamente. |
| **Google Drive** | 📂 | Crea/Busca documentos y hojas de cálculo en Drive. |
| **Memory System** | 🧠 | Base de datos persistente para recordar hechos. |
| **Web Scrape** | 🕷️ | Extracción masiva de texto de una URL. |

---

## 💻 Selección de Motores (Modelos)

*   ⚡ **Gemini 2.5 Flash**: Velocidad extrema. Ideal para visión y respuestas rápidas.
*   🧠 **Gemini 3 Pro**: Máximo razonamiento. Ideal para codificación y análisis profundo.

---

## 📦 Instalación y Uso

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/AutoAgent.git
    ```
2.  **Configurar API Key**:
    Obtén tu clave en Google AI Studio y configúrala en el entorno.

3.  **Ejecutar**:
    ```bash
    npm install
    npm start
    ```

---

## 🛡️ Privacidad

*   **Local-First**: Todo se ejecuta en tu navegador.
*   **Persistencia**: Tus agentes y memorias se guardan en `LocalStorage` (AlaSQL).

---

Hecho con 💜 y ☕ por **Equipo BOTIDINAMIX**
