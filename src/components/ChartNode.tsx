import { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter';

interface ChartNodeData {
  queryResults?: {
    columns: string[];
    rows: any[][];
    row_count: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ChartNode({ data }: { data: ChartNodeData }) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xColumn, setXColumn] = useState<string>('');
  const [yColumn, setYColumn] = useState<string>('');

  const { queryResults } = data;
  const columns = queryResults?.columns || [];

  // Auto-select columns when data arrives
  useEffect(() => {
    if (columns.length > 0 && !xColumn) {
      setXColumn(columns[0]);
      if (columns.length > 1) {
        setYColumn(columns[1]);
      }
    }
  }, [columns, xColumn]);

  // Transform row data to recharts format
  const chartData = queryResults?.rows.map((row) => {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  }) || [];

  const hasData = chartData.length > 0 && xColumn && yColumn;

  const renderChart = () => {
    if (!hasData) {
      return (
        <div className="flex items-center justify-center h-full text-slate-400 text-[11px]">
          {!queryResults ? 'Connect a SQL node with results' : 'Select X and Y columns'}
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 },
    };

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xColumn} tick={{ fontSize: 9 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ fontSize: 10 }} />
              <Bar dataKey={yColumn} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xColumn} tick={{ fontSize: 9 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey={yColumn} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xColumn} tick={{ fontSize: 9 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey={yColumn} stroke="#3b82f6" fill="#93c5fd" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey={yColumn}
                nameKey={xColumn}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name }) => name}
                labelLine={{ stroke: '#94a3b8' }}
                fontSize={9}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={xColumn} tick={{ fontSize: 9 }} stroke="#94a3b8" name={xColumn} />
              <YAxis dataKey={yColumn} tick={{ fontSize: 9 }} stroke="#94a3b8" name={yColumn} />
              <Tooltip contentStyle={{ fontSize: 10 }} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Data" data={chartData} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white border-2 border-slate-300 rounded-lg shadow-xl w-[450px] h-[350px] flex flex-col overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />

      {/* Header */}
      <div className="bg-slate-50 px-3 py-2 flex justify-between items-center border-b border-slate-200">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Chart</span>
        <div className="flex gap-1">
          {(['bar', 'line', 'area', 'pie', 'scatter'] as ChartType[]).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${
                chartType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Column selectors */}
      {columns.length > 0 && (
        <div className="px-3 py-2 flex gap-3 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-slate-500 font-medium">X:</label>
            <select
              value={xColumn}
              onChange={(e) => setXColumn(e.target.value)}
              className="text-[10px] px-1.5 py-0.5 border border-slate-300 rounded bg-white"
            >
              {columns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-slate-500 font-medium">Y:</label>
            <select
              value={yColumn}
              onChange={(e) => setYColumn(e.target.value)}
              className="text-[10px] px-1.5 py-0.5 border border-slate-300 rounded bg-white"
            >
              {columns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="flex-grow p-2">
        {renderChart()}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
    </div>
  );
}
