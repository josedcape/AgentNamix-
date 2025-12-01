
import React, { useState, useEffect } from 'react';
import { ProjectStructure, FileBlueprint } from '../services/architect';

interface CodeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectStructure | null;
  onAIRequest: (instruction: string, currentFile?: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  content?: string;
  language?: string;
}

const buildFileTree = (files: FileBlueprint[]): TreeNode[] => {
  const root: TreeNode[] = [];

  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const existingPath = currentLevel.find(node => node.name === part);

      if (existingPath) {
        if (!isFile) currentLevel = existingPath.children!;
      } else {
        const newNode: TreeNode = {
          name: part,
          path: file.path,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          content: isFile ? file.content : undefined,
          language: isFile ? file.language : undefined
        };
        currentLevel.push(newNode);
        if (!isFile) currentLevel = newNode.children!;
      }
    });
  });

  return root;
};

export const CodeEditor: React.FC<CodeEditorProps> = ({ isOpen, onClose, project, onAIRequest }) => {
  const [activeFile, setActiveFile] = useState<FileBlueprint | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [aiPrompt, setAiPrompt] = useState('');
  
  useEffect(() => {
    if (project && project.files.length > 0) {
      const tree = buildFileTree(project.files);
      setFileTree(tree);
      if (!activeFile) {
          const firstFile = project.files.find(f => f.path.endsWith('index.html')) || project.files[0];
          setActiveFile(firstFile);
      }
    }
  }, [project]);

  const toggleFolder = (path: string) => {
    const newSet = new Set(expandedFolders);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setExpandedFolders(newSet);
  };

  const handleAiSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiPrompt.trim()) return;
      onAIRequest(aiPrompt, activeFile?.path);
      setAiPrompt('');
  };

  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.path + node.name}>
        <div 
          className={`flex items-center gap-2 py-1 px-2 cursor-pointer text-sm select-none transition-colors ${
            activeFile?.path === node.path ? 'bg-cyan-900/30 text-cyan-400 border-l-2 border-cyan-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') toggleFolder(node.path);
            else setActiveFile({ path: node.path, content: node.content || '', language: node.language || 'text' });
          }}
        >
          <span className="opacity-70">
            {node.type === 'folder' ? (expandedFolders.has(node.path) ? '📂' : '📁') : '📄'}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.type === 'folder' && expandedFolders.has(node.path) && node.children && (
          <div>{renderTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in-up">
      <div className="w-[95vw] h-[90vh] bg-[#0d1117] border border-cyan-500/30 rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-[0_0_10px_rgba(37,99,235,0.5)]">IDE</div>
                <div className="flex flex-col">
                    <span className="text-sm font-display font-bold text-gray-200 tracking-wide">{project?.projectName || 'Sin Proyecto'}</span>
                    <span className="text-[10px] text-gray-500 font-mono">AGENTNAMIX CODE ENGINE</span>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        <div className="flex-1 flex overflow-hidden">
            <div className="w-64 bg-[#090c10] border-r border-gray-800 flex flex-col">
                <div className="p-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">Explorador</div>
                <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                    {fileTree.length > 0 ? renderTree(fileTree) : <div className="p-4 text-xs text-gray-600 italic text-center">Sin archivos.</div>}
                </div>
            </div>
            <div className="flex-1 flex flex-col bg-[#0d1117] relative">
                {activeFile ? (
                    <div className="flex-1 relative overflow-auto custom-scrollbar">
                        <div className="absolute top-0 left-0 min-w-full min-h-full flex font-mono text-sm leading-6">
                            <div className="bg-[#090c10] text-gray-600 text-right pr-3 pl-2 select-none border-r border-gray-800 py-4 min-h-full">
                                {activeFile.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                            </div>
                            <textarea className="flex-1 bg-transparent text-gray-300 p-4 outline-none resize-none whitespace-pre tab-4" value={activeFile.content} readOnly spellCheck={false} />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50"><p className="text-sm font-mono">Selecciona un archivo</p></div>
                )}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-3/4 max-w-2xl">
                    <form onSubmit={handleAiSubmit} className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                        <div className="relative bg-gray-900 border border-gray-700 rounded-lg flex items-center p-1 shadow-2xl">
                            <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder={activeFile ? `Editar ${activeFile.path}...` : "Instrucciones..."} className="flex-1 bg-transparent text-white px-4 py-2 focus:outline-none text-sm font-sans" />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded uppercase">GENERAR</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
