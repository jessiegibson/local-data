import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import Editor from '@monaco-editor/react';

export default function SqlNode({ data, id }: any) {
  const [code, setCode] = useState("SELECT * FROM input LIMIT 10");

  return (
  /* Added h-[300px] to give the node a rigid size so React Flow can calculate its position */
  <div className="bg-white border-2 border-slate-300 rounded-lg shadow-xl w-[400px] h-[300px] flex flex-col overflow-hidden">
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
    
    <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-200">
      <span className="text-[10px] font-bold text-slate-500 uppercase">SQL Transform</span>
      <button className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded">RUN</button>
    </div>

    {/* flex-grow ensures the editor fills the 300px height */}
    <div className="flex-grow w-full relative">
      <Editor
        height="100%"
        defaultLanguage="sql"
        theme="light"
        value={code}
        options={{
          minimap: { enabled: false },
          automaticLayout: true, // This is key to stopping the squishing
          scrollBeyondLastLine: false,
        }}
      />
    </div>

    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
  </div>
	);
};
