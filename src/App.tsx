import { useCallback, useEffect, useMemo } from 'react';
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
import ChartNode from './components/ChartNode';

const nodeTypes = {
  sqlNode: SqlNode,
  chartNode: ChartNode,
};

const initialNodes: any[] = [];
const initialEdges: Edge[] = [];

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Callback for SQL nodes to update their results in the node data
  const updateNodeData = useCallback((nodeId: string, newData: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const addSqlNode = () => {
    const newNode = {
      id: `sql-${Date.now()}`,
      type: 'sqlNode',
      position: { x: 500, y: 300 },
      data: { label: 'SQL Query', updateNodeData },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const addChartNode = () => {
    const newNode = {
      id: `chart-${Date.now()}`,
      type: 'chartNode',
      position: { x: 800, y: 300 },
      data: {},
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

  // Propagate query results from SQL nodes to connected chart nodes
  useEffect(() => {
    const chartNodes = nodes.filter((n) => n.type === 'chartNode' && n.data.sourceNodeId);

    chartNodes.forEach((chartNode) => {
      const sourceNode = nodes.find((n) => n.id === chartNode.data.sourceNodeId);
      if (sourceNode && sourceNode.data.queryResults) {
        // Only update if results have changed
        if (JSON.stringify(chartNode.data.queryResults) !== JSON.stringify(sourceNode.data.queryResults)) {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === chartNode.id) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    queryResults: sourceNode.data.queryResults,
                  },
                };
              }
              return node;
            })
          );
        }
      }
    });
  }, [nodes, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      // File -> SQL Node connection
      if (sourceNode && targetNode && targetNode.type === 'sqlNode' && sourceNode.data.path) {
        const filePath = sourceNode.data.path;
        const fileName = filePath.split('/').pop().replace(/\.[^/.]+$/, "");

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

      // SQL Node -> Chart Node connection
      if (sourceNode && targetNode && sourceNode.type === 'sqlNode' && targetNode.type === 'chartNode') {
        // Pass query results from SQL node to Chart node
        const queryResults = sourceNode.data.queryResults;
        if (queryResults) {
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === params.target) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    queryResults,
                    sourceNodeId: params.source,
                  },
                };
              }
              return node;
            })
          );
        }
        // Store the connection so we can update chart when SQL results change
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === params.target) {
              return {
                ...node,
                data: {
                  ...node.data,
                  sourceNodeId: params.source,
                },
              };
            }
            return node;
          })
        );
        console.log(`Linked SQL Node ${params.source} to Chart Node ${params.target}`);
      }
    },
    [nodes, setNodes, setEdges]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={addSqlNode}
          className="bg-slate-800 text-white px-4 py-2 rounded-md border border-slate-600 hover:bg-slate-700"
        >
          + SQL Node
        </button>
        <button
          onClick={addChartNode}
          className="bg-blue-600 text-white px-4 py-2 rounded-md border border-blue-500 hover:bg-blue-700"
        >
          + Chart Node
        </button>
      </div>
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
      
      <StatusBar nodes={nodes} />
    </div>
  );
}

function StatusBar({ nodes }: { nodes: any[] }) {
  const status = useMemo(() => {
    const fileNodes = nodes.filter((n) => n.type === 'default');
    const sqlNodes = nodes.filter((n) => n.type === 'sqlNode');
    const chartNodes = nodes.filter((n) => n.type === 'chartNode');
    const sqlWithResults = sqlNodes.filter((n) => n.data.queryResults);

    if (nodes.length === 0) {
      return { text: 'Drop a CSV file to get started', color: 'bg-slate-600' };
    }

    if (fileNodes.length > 0 && sqlNodes.length === 0) {
      return { text: `${fileNodes.length} file(s) loaded - Add a SQL node to query`, color: 'bg-blue-600' };
    }

    if (sqlNodes.length > 0 && sqlWithResults.length === 0) {
      return { text: `${sqlNodes.length} SQL node(s) - Connect a file and run a query`, color: 'bg-amber-600' };
    }

    const parts: string[] = [];
    if (fileNodes.length > 0) parts.push(`${fileNodes.length} file(s)`);
    if (sqlWithResults.length > 0) parts.push(`${sqlWithResults.length} query result(s)`);
    if (chartNodes.length > 0) parts.push(`${chartNodes.length} chart(s)`);

    return { text: parts.join(' | '), color: 'bg-green-600' };
  }, [nodes]);

  return (
    <div className={`absolute bottom-4 left-4 px-3 py-2 ${status.color} text-white rounded text-xs font-mono flex items-center gap-2`}>
      <span className="w-2 h-2 bg-white/50 rounded-full animate-pulse" />
      {status.text}
    </div>
  );
}
