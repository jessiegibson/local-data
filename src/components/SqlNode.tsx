import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import Editor from '@monaco-editor/react';
import { invoke } from '@tauri-apps/api/core';

interface QueryResult {
  columns: string[];
  column_types: string[];
  rows: any[][];
  row_count: number;
}

interface SqlNodeData {
  inputPath?: string;
  tableName?: string;
  updateNodeData?: (nodeId: string, data: Record<string, any>) => void;
}

export default function SqlNode({ data, id }: { data: SqlNodeData; id: string }) {
  const [code, setCode] = useState("SELECT * FROM input LIMIT 10");
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    if (!data.inputPath || !data.tableName) {
      setError("Connect a data file to this node first");
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      // Replace "input" in query with the actual table name
      const processedQuery = code.replace(/\binput\b/gi, data.tableName);

      const result = await invoke<QueryResult>('execute_sql', {
        query: processedQuery,
        filePath: data.inputPath,
        tableName: data.tableName,
      });

      setResults(result);

      // Update node data so results can flow to connected chart nodes
      if (data.updateNodeData) {
        data.updateNodeData(id, { queryResults: result });
      }
    } catch (err) {
      setError(err as string);
      setResults(null);
    } finally {
      setIsRunning(false);
    }
  };

  const hasResults = results && results.rows.length > 0;
  const nodeHeight = hasResults ? 'h-[500px]' : 'h-[300px]';

  return (
    <div className={`bg-white border-2 border-slate-300 rounded-lg shadow-xl w-[500px] ${nodeHeight} flex flex-col overflow-hidden`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />

      <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase">SQL Transform</span>
          {data.tableName && (
            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {data.tableName}
            </span>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className={`text-white text-[10px] px-2 py-1 rounded ${
            isRunning ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isRunning ? 'Running...' : 'RUN'}
        </button>
      </div>

      <div className="h-[150px] w-full relative border-b border-slate-200">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="light"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineNumbers: 'off',
          }}
        />
      </div>

      {/* Results / Error area */}
      <div className="flex-grow overflow-auto bg-slate-50">
        {error && (
          <div className="p-2 text-red-600 text-[11px] bg-red-50 border-b border-red-200">
            {error}
          </div>
        )}

        {hasResults && (
          <div className="overflow-auto h-full">
            <table className="w-full text-[10px] border-collapse">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  {results.columns.map((col, i) => (
                    <th key={i} className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-100">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-2 py-1 border-b border-slate-100 text-slate-700">
                        {cell === null ? <span className="text-slate-400 italic">null</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-1 text-[9px] text-slate-400 text-right bg-slate-100 border-t border-slate-200">
              {results.row_count} row{results.row_count !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {!error && !hasResults && !isRunning && (
          <div className="p-4 text-center text-slate-400 text-[11px]">
            {data.inputPath ? 'Click RUN to execute query' : 'Connect a data file to get started'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
    </div>
  );
}
