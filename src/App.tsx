import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant,
  Controls,
} from '@xyflow/react';
import { listen } from '@tauri-apps/api/event';
import '@xyflow/react/dist/style.css';
import { invoke } from '@tauri-apps/api/core';
import SqlNode from './components/SqlNode';

// 1. Fix: Ensure keys match the component names correctly
const nodeTypes = {
  sqlNode: SqlNode,
};

const initialNodes: any[] = [];
const initialEdges: Edge[] = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const addSqlNode = () => {
    const newNode = {
      // Fix: Use backticks for template literals
      id: `sql-${Date.now()}`,
      type: 'sqlNode',
      position: { x: 500, y: 300 },
      data: { label: 'SQL Query' },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addFileNode = async (filePath: string, x: number, y: number) => {
    try {
      const schema = await invoke<{ columns: string[], column_types: string[] }>(
        'get_csv_schema', 
        { path: filePath }
      );

      const fileName = filePath.split('/').pop();
      
      const newNode = {
        id: `node-${Date.now()}`,
        type: 'default',
        position: { x, y },
        data: { 
	path: filePath,
          label: (
            <div className="text-left">
              <div className="font-bold border-b border-slate-500 mb-2 pb-1">📄 {fileName}</div>
              <div className="text-[10px] opacity-70">
                {schema.columns.map((col, i) => (
                  <div key={col} className="flex justify-between gap-4">
                    <span>{col}</span>
                    <span className="italic text-blue-400">{schema.column_types[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          ) 
        },
        style: { 
          background: '#fff', 
          color: '#1e293b', 
          border: '1px solid #cbd5e1', 
          padding: '12px',
          borderRadius: '8px',
          width: 250,
	  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" // Soft Shadow
        },
      };

      setNodes((nds) => nds.concat(newNode));
    } catch (err) {
      console.error("Failed to read CSV schema:", err);
    }
  };

  useEffect(() => {
    const listenToDrops = async () => {
      const unlisten = await listen<{ paths: string[], x: number, y: number }>('tauri://drag-drop', (event) => {
        const { paths, x, y } = event.payload;
        paths.forEach((path) => {
          if (path.endsWith('.csv') || path.endsWith('.parquet') || path.endsWith('.json')) {
            addFileNode(path, x, y);
          }
        });
      });
      return unlisten;
    };

    const unlistenPromise = listenToDrops();

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, []);

  const onConnect = useCallback(
	  (params: Connection) => {
		setEdges((eds) => addEdge(params, eds));
	  
	  const sourceNode = nodes.find((n) => n.id === params.source);
	  const targetNode = nodes.find((n) => n.id === params.target);

	  // if we are connecting a File -> SQL Node
	  if (sourceNode && targetNode && targetNode.type === 'SqlNode') {
		  const filePath = sourceNode.data.path; 	// We need to make sure path is stored here
		  const fileName = filePath.split('/').pop().replace(/\.[^/.]+$/, ""); // Clean Name

		  // Update the SQL Node's internal data
		setNodes((nds) => 
			nds.map((node) => {
			if (node.id === params.target) {
				return {
					...node,
					data: {
					...node.data,
					inputPath: filePath,
					tableName: fileName,
					},
				};
			}
			return node;
			})
		);
		console.log(`Linked ${fileName} to SQL Node ${params.target}`);
	  }
	  },
	  [nodes, setNodes, setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <button
        onClick={addSqlNode} 
        className="absolute top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700"
      >
        + SQL Node
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="light"
        fitView
      >
        <Background 
		variant={BackgroundVariant.Dots} 
		gap={20} 
		color="#cbd5e1"
		size={1.5}
	/>
	<Controls />
      </ReactFlow>
      
      <div className="absolute bottom-4 left-4 p-2 bg-blue-600 text-white rounded text-xs font-mono">
        Status: Listening for CSV drops...
      </div>
    </div>
  );
}
