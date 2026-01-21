import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
} from '@xyflow/react';
import { listen } from '@tauri-apps/api/event'; // Tauri's event listener
import '@xyflow/react/dist/style.css';

const initialNodes: any[] = [];
const initialEdges: Edge[] = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 1. Function to create a node when a file is dropped
  const addFileNode = (filePath: string, x: number, y: number) => {
    const fileName = filePath.split('/').pop(); // Get 'data.csv' from the full path
    
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'default',
      position: { x, y },
      data: { label: `📄 ${fileName}` },
      style: { 
        background: '#1e293b', 
        color: '#fff', 
        border: '1px solid #64748b', 
        padding: '10px',
        borderRadius: '8px' 
      },
    };

    setNodes((nds) => nds.concat(newNode));
  };

  // 2. Listen for Native macOS File Drops
  useEffect(() => {
    // This listens to the "tauri://drag-drop" event emitted by the OS
    const unlisten = listen<{ paths: string[], x: number, y: number }>('tauri://drag-drop', (event) => {
      const { paths, x, y } = event.payload;
      
      paths.forEach((path) => {
        // Only accept data files for now
        if (path.endsWith('.csv') || path.endsWith('.parquet') || path.endsWith('.json')) {
          addFileNode(path, x, y);
          console.log("File dropped at path:", path);
        }
      });
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Background gap={20} color="#b7cded" />
      </ReactFlow>
      
      <div className="absolute bottom-4 left-4 p-2 bg-blue-600 text-white rounded text-xs font-mono">
        Status: Listening for CSV drops...
      </div>
    </div>
  );
}
