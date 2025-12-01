
import { AgentConfiguration } from '../types';

// @ts-ignore
const alasql = window.alasql;

export interface SavedAgent extends AgentConfiguration {
  id: string;
  isDefault?: boolean;
}

export interface Memory {
  id: string;
  content: string;
  type: 'fact' | 'preference' | 'summary' | 'note';
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

const DB_NAME = 'agent_storage';
const TABLE_NAME = 'agents';
const MEMORY_TABLE = 'memories';

class DatabaseService {
  constructor() {
    // Initialize DB on instantiation
    if (typeof alasql !== 'undefined') {
        this.init();
    } else {
        console.warn('AlaSQL not loaded yet');
        // Retry init if script is loading
        window.addEventListener('load', () => this.init());
    }
  }

  init() {
    try {
        alasql(`CREATE LOCALSTORAGE DATABASE IF NOT EXISTS ${DB_NAME}`);
        alasql(`ATTACH LOCALSTORAGE DATABASE ${DB_NAME}`);
        alasql(`USE ${DB_NAME}`);
        
        // Agents Table
        alasql(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (id STRING, name STRING, description STRING, tools JSON, model STRING, isDefault BOOLEAN)`);
        
        // Memory Table
        alasql(`CREATE TABLE IF NOT EXISTS ${MEMORY_TABLE} (id STRING, content STRING, type STRING, priority STRING, timestamp NUMBER)`);

        // Seed defaults if empty
        const count = alasql(`SELECT VALUE COUNT(*) FROM ${TABLE_NAME}`);
        if (count === 0) {
          this.seedDefaults();
        }
    } catch (e) {
        console.error("Error initializing database", e);
    }
  }

  seedDefaults() {
    const defaults: SavedAgent[] = [
      {
        id: 'default-researcher',
        name: 'Investigador',
        description: 'Experto en búsqueda web y síntesis de información. Prioriza fuentes fiables y datos recientes.',
        tools: ['web_search', 'deep_analysis'],
        model: 'gemini-2.5-flash',
        isDefault: true,
        documents: []
      },
      {
        id: 'default-coder',
        name: 'Ingeniero de Software',
        description: 'Especialista en generar código limpio, seguro y bien documentado.',
        tools: ['code_execution', 'software_architect'],
        model: 'gemini-2.5-flash',
        isDefault: true,
        documents: []
      },
      {
        id: 'default-analyst',
        name: 'Analista de Datos',
        description: 'Capaz de procesar información compleja y encontrar patrones.',
        tools: ['deep_analysis', 'memory_system'],
        model: 'gemini-3-pro',
        isDefault: true,
        documents: []
      }
    ];

    defaults.forEach(agent => {
      this.saveAgent(agent);
    });
  }

  // --- AGENT OPERATIONS ---

  getAgents(): SavedAgent[] {
    try {
        return alasql(`SELECT * FROM ${TABLE_NAME}`);
    } catch(e) {
        return [];
    }
  }

  saveAgent(agent: SavedAgent) {
    try {
        // Check if exists
        const exists = alasql(`SELECT * FROM ${TABLE_NAME} WHERE id = "${agent.id}"`);
        if (exists.length > 0) {
        alasql(`UPDATE ${TABLE_NAME} SET name = "${agent.name}", description = "${agent.description}", tools = ?, model = "${agent.model}" WHERE id = "${agent.id}"`, [agent.tools]);
        } else {
        alasql(`INSERT INTO ${TABLE_NAME} VALUES ("${agent.id}", "${agent.name}", "${agent.description}", ?, "${agent.model}", ${agent.isDefault || false})`, [agent.tools]);
        }
    } catch (e) {
        console.error("Error saving agent", e);
    }
  }

  deleteAgent(id: string) {
    try {
        alasql(`DELETE FROM ${TABLE_NAME} WHERE id = "${id}"`);
    } catch (e) {
        console.error("Error deleting agent", e);
    }
  }

  // --- MEMORY OPERATIONS ---

  addMemory(content: string, type: string = 'note', priority: string = 'medium') {
      try {
          const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          alasql(`INSERT INTO ${MEMORY_TABLE} VALUES ("${id}", "${content}", "${type}", "${priority}", ${Date.now()})`);
          return id;
      } catch (e) {
          console.error("Error adding memory", e);
          return null;
      }
  }

  searchMemories(query: string): Memory[] {
      try {
          // Basic keyword matching (LIKE)
          const lowerQuery = query.toLowerCase();
          return alasql(`SELECT * FROM ${MEMORY_TABLE} WHERE LOWER(content) LIKE "%${lowerQuery}%" ORDER BY timestamp DESC LIMIT 5`);
      } catch (e) {
          console.error("Error searching memories", e);
          return [];
      }
  }

  getHighPriorityMemories(): Memory[] {
      try {
          return alasql(`SELECT * FROM ${MEMORY_TABLE} WHERE priority = "high" ORDER BY timestamp DESC LIMIT 10`);
      } catch (e) {
          return [];
      }
  }
  
  forgetMemory(id: string) {
      try {
          alasql(`DELETE FROM ${MEMORY_TABLE} WHERE id = "${id}"`);
      } catch (e) {
          console.error("Error deleting memory", e);
      }
  }
  
  clearMemories() {
      try {
          alasql(`DELETE FROM ${MEMORY_TABLE}`);
      } catch(e) { console.error(e); }
  }
}

export const db = new DatabaseService();
