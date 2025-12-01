
export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'ai' | 'system';
}

export type ToolType = 'web_search' | 'code_execution' | 'deep_analysis' | 'browser_interaction' | 'web_scrape' | 'google_calendar' | 'google_drive' | 'software_architect' | 'memory_system' | 'image_analyzer' | 'aura_ssh' | 'model_3d';

export interface AgentImage {
    name: string;
    mimeType: string;
    data: string; // Base64 string without header
}

export interface SSHConfiguration {
    mode: 'simulated' | 'real';
    host: string;
    port: string;
    username: string;
    password?: string;
    privateKey?: string;
    proxyUrl?: string; // WebSocket Bridge URL (e.g., wss://my-ssh-bridge.com)
}

export interface AgentConfiguration {
  name: string;
  description: string;
  tools: ToolType[];
  model: string;
  documents?: { name: string; content: string }[];
  images?: AgentImage[];
  sshConfig?: SSHConfiguration;
}

export interface AgentState {
  goal: string;
  isRunning: boolean;
  tasks: Task[];
  logs: LogEntry[];
  currentTaskId: string | null;
}

export enum AgentStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}