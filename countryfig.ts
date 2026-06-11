import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Area
} from 'recharts';
import { StockData } from '../utils/stockEngine';

interface HistoryChartProps {
  historicalData: StockData[];
  ma50: number[];
  ma200: number[];
  currency: string;
  companyName: string;
}

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a0a2e] border border-purple-700 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-purple-300 font-bold mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          entry.value != null && (
            <p key={i} style={{ color: entry.color }} className="font-semibold">
              {entry.name}: {currency}{typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            </p>
          )
        ))}
      </div>
    );
  }
  return null;
};

const HistoryChart: React.FC<HistoryChartProps> = ({
  historicalData, ma50, ma200, currency, companyName
}) => {
  const chartData = useMemo(() => {
    return historicalData.map((d, i) => ({
      date: d.date.slice(2, 10),
      price: +d.close.toFixed(2),
      ma50: isNaN(ma50[i]) ? null : +ma50[i].toFixed(2),
      ma200: isNaN(ma200[i]) ? null : +ma200[i].toFixed(2),
    })).filter((_, i) => i % 2 === 0); // thin for performance
  }, [historicalData, ma50, ma200]);

  return (
    <div className="w-full">
      <h3 className="text-sm font-bold text-purple-200 mb-3">
        Complete Price History with Moving Averages — {companyName}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9D4EDD" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#9D4EDD" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d1a4d" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#a78bfa', fontSize: 10 }}
            tickLine={false}
            interval={Math.floor(chartData.length / 6)}
            stroke="#4a2d7a"
          />
          <YAxis
            tick={{ fill: '#a78bfa', fontSize: 10 }}
            tickLine={false}
            tickFormatter={v => `${currency}${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
            stroke="#4a2d7a"
            width={65}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#c4b5fd' }} iconType="line" />

          <Area
            type="monotone"
            dataKey="price"
            stroke="#9D4EDD"
            strokeWidth={2}
            fill="url(#priceGrad)"
            name="Historical Price"
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="ma50"
            stroke="#FFA500"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            name="50-Day MA"
            connectNulls={true}
          />
          <Line
            type="monotone"
            dataKey="ma200"
            stroke="#00CED1"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            name="200-Day MA"
            connectNulls={true}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistoryChart;
