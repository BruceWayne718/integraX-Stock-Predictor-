import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import { StockData } from '../utils/stockEngine';

interface ForecastChartProps {
  historicalData: StockData[];
  predictions: number[];
  predictionDates: string[];
  upperBand: number[];
  lowerBand: number[];
  currentPrice: number;
  signal: 'BUY' | 'SELL' | 'WAIT';
  pctChange: number;
  currency: string;
  days: number;
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

const ForecastChart: React.FC<ForecastChartProps> = ({
  historicalData, predictions, predictionDates,
  upperBand, lowerBand, currentPrice, signal, pctChange, currency, days
}) => {
  const predColor = predictions[predictions.length - 1] > currentPrice ? '#00ff88' : '#ff4466';

  const chartData = useMemo(() => {
    // Last 90 historical days
    const histWindow = historicalData.slice(-90);
    const histPoints = histWindow.map(d => ({
      date: d.date.slice(5),  // MM-DD
      fullDate: d.date,
      historical: +d.close.toFixed(2),
      prediction: null as number | null,
      upper: null as number | null,
      lower: null as number | null,
      band: null as [number, number] | null,
    }));

    // Bridge point
    const lastHist = histWindow[histWindow.length - 1];
    const bridgePoint = {
      date: lastHist.date.slice(5),
      fullDate: lastHist.date,
      historical: +lastHist.close.toFixed(2),
      prediction: +lastHist.close.toFixed(2),
      upper: null as number | null,
      lower: null as number | null,
      band: null as [number, number] | null,
    };

    const predPoints = predictionDates.map((date, i) => ({
      date: date.slice(5),
      fullDate: date,
      historical: null as number | null,
      prediction: +predictions[i].toFixed(2),
      upper: +upperBand[i].toFixed(2),
      lower: +lowerBand[i].toFixed(2),
      band: [+lowerBand[i].toFixed(2), +(upperBand[i] - lowerBand[i]).toFixed(2)] as [number, number],
    }));

    return [...histPoints, bridgePoint, ...predPoints];
  }, [historicalData, predictions, predictionDates, upperBand, lowerBand]);

  const signalColors = { BUY: '#00ff88', SELL: '#ff4466', WAIT: '#ffd700' };
  const sc = signalColors[signal];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-purple-200">
          {days}-Day AI Stock Forecast with Confidence Bands
        </h3>
        <div
          className="px-3 py-1 rounded-full text-xs font-bold border"
          style={{ color: sc, borderColor: sc, backgroundColor: sc + '22' }}>
          {signal} {pctChange > 0 ? '+' : ''}{pctChange.toFixed(2)}%
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9D4EDD" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#9D4EDD" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d1a4d" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#a78bfa', fontSize: 10 }}
            tickLine={false}
            interval={Math.floor(chartData.length / 8)}
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
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#c4b5fd' }}
            iconType="line"
    />

          {/* Confidence band as area */}
          <Area
            dataKey="lower"
            stroke="transparent"
            fill="transparent"
            name="Lower Bound"
            dot={false}
            activeDot={false}
            legendType="none"
          />
          <Area
            dataKey="upper"
            stroke="rgba(150,100,220,0.3)"
            strokeWidth={1}
            strokeDasharray="3 3"
            fill="rgba(100,60,180,0.12)"
            name="95% Confidence Band"
            dot={false}
            activeDot={false}
            baseLine={0}
          />

          {/* Historical */}
          <Line
            type="monotone"
            dataKey="historical"
            stroke="#9D4EDD"
            strokeWidth={2.5}
            dot={false}
            name="Historical Price"
            connectNulls={false}
          />

          {/* Prediction */}
          <Line
            type="monotone"
            dataKey="prediction"
            stroke={predColor}
            strokeWidth={2.5}
            dot={false}
            name="AI Prediction"
            connectNulls={true}
            strokeDasharray={predictions[predictions.length - 1] > currentPrice ? undefined : '5 3'}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    );
};

export default ForecastChart;
