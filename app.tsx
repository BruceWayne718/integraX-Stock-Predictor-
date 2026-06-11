import React, { useState, useRef } from 'react';
import { COUNTRY_CONFIG, CountryConfig } from './data/countryConfig';
import {
  resolveSymbol, analyzeStock, generateNewsSentiment,
  formatMarketCap, AnalysisResult
} from './utils/stockEngine';
import ForecastChart from './components/ForecastChart';
import HistoryChart from './components/HistoryChart';

// ─── Ticker tape data ────────────────────────────────────────────────────────
const TICKER_ITEMS = [
  { sym: 'TCS', price: '₹3,847.20', change: '+1.23%', up: true },
  { sym: 'RELIANCE', price: '₹2,915.60', change: '-0.45%', up: false },
  { sym: 'INFY', price: '₹1,567.80', change: '+0.89%', up: true },
  { sym: 'AAPL', price: '$192.35', change: '+0.74%', up: true },
  { sym: 'MSFT', price: '$415.22', change: '+1.05%', up: true },
  { sym: 'NVDA', price: '$875.40', change: '+2.31%', up: true },
  { sym: 'TSLA', price: '$245.80', change: '-1.12%', up: false },
  { sym: 'GOOGL', price: '$174.92', change: '+0.63%', up: true },
  { sym: 'HSBA', price: '£6.34', change: '-0.28%', up: false },
  { sym: 'SAP', price: '€178.42', change: '+1.47%', up: true },
  { sym: 'BABA', price: '$78.65', change: '-0.91%', up: false },
  { sym: 'MARUTI', price: '₹12,647.95', change: '+2.89%', up: true },
  { sym: 'WIPRO', price: '₹302.50', change: '-0.64%', up: false },
  { sym: 'META', price: '$512.30', change: '+1.82%', up: true },
  { sym: 'AMZN', price: '$185.47', change: '+0.55%', up: true },
  { sym: 'BTC-USD', price: '$67,450', change: '+3.12%', up: true },
];

// ─── Utility ─────────────────────────────────────────────────────────────────
function cx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="w-1 h-6 bg-purple-500 rounded-full" />
    <h2 className="text-base font-bold text-white">{icon} {title}</h2>
  </div>
);

const MetricCard: React.FC<{
  label: string; value: string; sub?: string;
  valueColor?: string; className?: string;
}> = ({ label, value, sub, valueColor = 'text-white', className = '' }) => (
  <div className={cx('bg-[#1a0a2e] border border-purple-900/60 rounded-xl p-4', className)}>
    <p className="text-purple-400 text-xs mb-1">{label}</p>
    <p className={cx('text-lg font-bold', valueColor)}>{value}</p>
    {sub && <p className="text-purple-500 text-xs mt-0.5">{sub}</p>}
  </div>
);

const Badge: React.FC<{ text: string; color: 'green' | 'red' | 'yellow' | 'purple' | 'blue' }> = ({ text, color }) => {
  const map = {
    green: 'bg-green-900/50 text-green-300 border-green-700',
    red: 'bg-red-900/50 text-red-300 border-red-700',
    yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    purple: 'bg-purple-900/50 text-purple-300 border-purple-700',
    blue: 'bg-blue-900/50 text-blue-300 border-blue-700',
  };
  return (
    <span className={cx('px-2 py-0.5 rounded-full text-xs font-semibold border', map[color])}>
      {text}
    </span>
  );
};

// ─── Ticker Tape ─────────────────────────────────────────────────────────────
const TickerTape: React.FC = () => {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="w-full overflow-hidden bg-[#0d0620] border-b border-purple-900/50 py-2">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 mr-8 text-xs font-mono">
            <span className="text-purple-300 font-bold">{item.sym}</span>
            <span className="text-white">{item.price}</span>
            <span className={item.up ? 'text-green-400' : 'text-red-400'}>
              {item.up ? '▲' : '▼'} {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Loading spinner ──────────────────────────────────────────────────────────
const Loader: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full border-4 border-purple-900" />
      <div className="absolute inset-0 rounded-full border-4 border-t-purple-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
    </div>
    <p className="text-purple-300 text-sm font-medium animate-pulse">{message}</p>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [selectedCountry, setSelectedCountry] = useState<string>('1');
  const [companyInput, setCompanyInput] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<3 | 7 | 30 | 'info'>(7);
  const [companyInfo, setCompanyInfo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'forecast' | 'company' | 'news'>('forecast');
  const outputRef = useRef<HTMLDivElement>(null);

  const cfg: CountryConfig = COUNTRY_CONFIG[selectedCountry];
  const sampleKeys = Object.keys(cfg.symbol_map).slice(0, 8);

  const handleAnalyze = async () => {
    if (!companyInput.trim()) {
      setError('Please enter a company name or ticker symbol.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const symbol = resolveSymbol(companyInput, cfg);
      const days = companyInfo ? 30 : (selectedDays as number);
      const res = await analyzeStock(symbol, companyInput, days, cfg);
      setResult(res);
      setActiveTab(companyInfo ? 'company' : 'forecast');
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e: any) {
      setError('Analysis failed. Please check the company name and try again.');
    } finally {
      setLoading(false);
    }
  };

  const newsData = result ? generateNewsSentiment(result.companyName, result.signal) : null;

  const signalBgMap = { BUY: 'bg-green-900/30 border-green-600', SELL: 'bg-red-900/30 border-red-600', WAIT: 'bg-yellow-900/30 border-yellow-600' };
  const signalTextMap = { BUY: 'text-green-400', SELL: 'text-red-400', WAIT: 'text-yellow-400' };
  const riskColorMap: Record<string, 'green' | 'yellow' | 'red'> = { Low: 'green', Moderate: 'yellow', High: 'red' };

  return (
    <div className="min-h-screen bg-[#07030f] text-white font-sans">
      {/* Ticker */}
      <TickerTape />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d0620]/95 backdrop-blur border-b border-purple-900/50 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">IX</span>
            </div>
            <div>
              <span className="text-white font-black text-lg tracking-tight">Integra</span>
              <span className="text-purple-400 font-black text-lg tracking-tight">X</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-purple-400 text-xs hidden sm:block">AI-Powered Investment Intelligence</span>
            <div className="px-3 py-1 rounded-full bg-purple-900/50 border border-purple-700 text-purple-300 text-xs font-semibold">
              LIVE
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 leading-tight">
          Global Stock{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-300">
            AI Platform
          </span>
        </h1>
        <p className="text-purple-400 text-sm max-w-xl mx-auto">
          Professional Edition — AI-Powered Investment Intelligence System
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs text-purple-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            RandomForest + GradientBoosting Ensemble
          </span>
          <span>|</span>
          <span>Technical Indicators</span>
          <span>|</span>
          <span>Sentiment Analysis</span>
          <span>|</span>
          <span>10 Global Markets</span>
        </div>
      </section>

      {/* Input Panel */}
      <section className="max-w-6xl mx-auto px-4 pb-8">
        <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-6 shadow-2xl shadow-purple-950/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Country */}
            <div>
              <label className="block text-purple-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                Select Country / Market
              </label>
              <select
                value={selectedCountry}
                onChange={e => {
                  setSelectedCountry(e.target.value);
                  setCompanyInput('');
                  setResult(null);
                }}
                className="w-full bg-[#1a0a2e] border border-purple-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all cursor-pointer"
              >
                {Object.entries(COUNTRY_CONFIG).map(([key, c]) => (
                  <option key={key} value={key} className="bg-[#1a0a2e]">
                    {c.flag} {c.name} — {c.exchange}
                  </option>
                ))}
              </select>
              <p className="text-purple-600 text-xs mt-1.5">
                Exchange: {cfg.exchange} | Currency: {cfg.currency} {cfg.currency_code}
              </p>
            </div>

            {/* Company */}
            <div>
              <label className="block text-purple-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                Company Name / Ticker
              </label>
              <input
                type="text"
                value={companyInput}
                onChange={e => setCompanyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder={`e.g. ${sampleKeys[0]?.toUpperCase() || 'TCS'}, ${sampleKeys[1]?.toUpperCase() || 'RELIANCE'}...`}
                className="w-full bg-[#1a0a2e] border border-purple-800 rounded-xl px-4 py-3 text-white text-sm placeholder-purple-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
              <p className="text-purple-600 text-xs mt-1.5 truncate">
                Examples: {sampleKeys.map(k => k.toUpperCase()).join(', ')}...
              </p>
            </div>

            {/* Forecast Period */}
            <div>
              <label className="block text-purple-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                Forecast Period
              </label>
              <div className="flex gap-2">
                {([3, 7, 30] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => { setSelectedDays(d); setCompanyInfo(false); }}
                    className={cx(
                      'flex-1 py-3 rounded-xl text-sm font-bold border transition-all',
                      !companyInfo && selectedDays === d
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50'
                        : 'bg-[#1a0a2e] border-purple-800 text-purple-400 hover:border-purple-600 hover:text-purple-300'
                    )}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Company Info toggle */}
            <div>
              <label className="block text-purple-300 text-xs font-semibold mb-2 uppercase tracking-wider">
                Analysis Mode
              </label>
              <button
                onClick={() => { setCompanyInfo(v => !v); if (!companyInfo) setSelectedDays(30); }}
                className={cx(
                  'w-full py-3 rounded-xl text-sm font-bold border transition-all',
                  companyInfo
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/50'
                    : 'bg-[#1a0a2e] border-purple-800 text-purple-400 hover:border-purple-600 hover:text-purple-300'
                )}
              >
                {companyInfo ? '✓ ' : ''}Company Info + Full Analysis
              </button>
              <p className="text-purple-600 text-xs mt-1.5">
                Includes fundamentals, CAGR, trend intelligence
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Analyze Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className={cx(
                'px-12 py-4 rounded-2xl font-black text-base tracking-wide transition-all',
                loading
                  ? 'bg-purple-900 text-purple-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white shadow-xl shadow-purple-900/60 hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        </div>
      </section>

      {/* Output */}
      {loading && (
        <section className="max-w-6xl mx-auto px-4 pb-8">
          <div className="bg-[#110828] border border-purple-900/60 rounded-2xl">
            <Loader message="Training advanced hybrid AI model... RandomForest + GradientBoosting Ensemble" />
          </div>
        </section>
      )}

      {result && !loading && (
        <section ref={outputRef} className="max-w-6xl mx-auto px-4 pb-12">
          {/* ─── Live Price Banner ──────────────────────────────── */}
          <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-purple-400 text-xs">Resolved Symbol</p>
              <p className="text-white font-black text-lg">{result.symbol}</p>
            </div>
            <div className="h-8 w-px bg-purple-900 hidden sm:block" />
            <div>
              <p className="text-purple-400 text-xs">Current Live Price</p>
              <p className="text-white font-black text-xl">{cfg.currency}{result.currentPrice.toFixed(2)}</p>
            </div>
            <div className="h-8 w-px bg-purple-900 hidden sm:block" />
            <div>
              <p className="text-purple-400 text-xs">Historical Data</p>
              <p className="text-white font-bold">{result.historicalData.length} days loaded</p>
            </div>
            <div className="h-8 w-px bg-purple-900 hidden sm:block" />
            <div>
              <p className="text-purple-400 text-xs">Model Accuracy</p>
              <p className="text-green-400 font-bold">{result.accuracy.toFixed(2)}%</p>
            </div>
            <div className="h-8 w-px bg-purple-900 hidden sm:block" />
            <div>
              <p className="text-purple-400 text-xs">Model RMSE</p>
              <p className="text-yellow-400 font-bold">{cfg.currency}{result.rmse.toFixed(2)}</p>
            </div>
          </div>

          {/* ─── Tab Nav ────────────────────────────────────────── */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {(['forecast', 'company', 'news'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cx(
                  'px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border',
                  activeTab === tab
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-[#110828] border-purple-900/60 text-purple-400 hover:border-purple-700'
                )}
              >
                {tab === 'forecast' && 'AI Forecast'}
                {tab === 'company' && 'Company Analysis'}
                {tab === 'news' && 'News Sentiment'}
              </button>
            ))}
          </div>

          {/* ─── FORECAST TAB ───────────────────────────────────── */}
          {activeTab === 'forecast' && (
            <div className="space-y-4">
              {/* Chart */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <ForecastChart
                  historicalData={result.historicalData}
                  predictions={result.predictions}
                  predictionDates={result.predictionDates}
                  upperBand={result.upperBand}
                  lowerBand={result.lowerBand}
                  currentPrice={result.currentPrice}
                  signal={result.signal}
                  pctChange={result.pctChange}
                  currency={cfg.currency}
                  days={result.predictions.length}
                />
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Expected Change"
                  value={`${result.pctChange > 0 ? '+' : ''}${result.pctChange.toFixed(2)}%`}
                  valueColor={result.pctChange >= 0 ? 'text-green-400' : 'text-red-400'}
                />
                <MetricCard
                  label="Expected Error"
                  value={`±${cfg.currency}${result.rmse.toFixed(2)}`}
                  valueColor="text-yellow-400"
                />
                <MetricCard
                  label="Confidence"
                  value={`${result.accuracy.toFixed(1)}%`}
                  valueColor="text-blue-400"
                />
                <MetricCard
                  label="Action"
                  value={result.signal}
                  valueColor={signalTextMap[result.signal]}
                />
              </div>

              {/* Signal banner */}
              <div className={cx(
                'rounded-2xl border p-4 flex items-center gap-3',
                signalBgMap[result.signal]
              )}>
                <div className={cx('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  result.signal === 'BUY' ? 'border-green-400' : result.signal === 'SELL' ? 'border-red-400' : 'border-yellow-400'
                )}>
                  <div className={cx('w-2 h-2 rounded-full',
                    result.signal === 'BUY' ? 'bg-green-400' : result.signal === 'SELL' ? 'bg-red-400' : 'bg-yellow-400'
                  )} />
                </div>
                <span className={cx('font-black text-base', signalTextMap[result.signal])}>
                  {result.signal} —{' '}
                  {result.signal === 'BUY' ? 'Strong Upside' : result.signal === 'SELL' ? 'Consider Exit' : 'Wait for Clarity'}
                </span>
              </div>

              {/* ─── CONFIDENCE SYSTEM ─────────────────────────────── */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="📊" title="CONFIDENCE SYSTEM - MODEL PERFORMANCE METRICS" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">🎯 Confidence Score</span>
                    <span className={cx('font-bold',
                      result.accuracy > 85 ? 'text-green-400' : result.accuracy > 70 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {result.accuracy.toFixed(2)}%{' '}
                      {result.accuracy > 85 ? '🟢' : result.accuracy > 70 ? '🟡' : '🔴'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📈 Backtest Accuracy (Last 30 Days)</span>
                    <span className="text-white font-bold">{result.accuracy.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📉 Root Mean Square Error (RMSE)</span>
                    <span className="text-white font-bold">{cfg.currency}{result.rmse.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📊 Prediction Error Rate</span>
                    <span className="text-white font-bold">{((result.rmse / result.currentPrice) * 100).toFixed(2)}% of current price</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-purple-300">⚡ Confidence Level</span>
                    <span className={cx('font-bold',
                      result.accuracy > 85 ? 'text-green-400' : result.accuracy > 70 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {result.accuracy > 85 ? 'HIGH - Strong predictive reliability' :
                        result.accuracy > 70 ? 'MODERATE - Decent predictive reliability' :
                          'LOW - Limited predictive reliability'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── RISK ASSESSMENT ───────────────────────────────── */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="⚠️" title="RISK ASSESSMENT" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📊 Volatility Level</span>
                    <span className="text-white font-bold flex items-center gap-2">
                      {result.technicalSignals.volatility_level}
                      (σ = {cfg.currency}{result.technicalSignals.volatility.toFixed(2)})
                      <Badge
                        text={result.technicalSignals.volatility_level}
                        color={riskColorMap[result.technicalSignals.volatility_level] || 'yellow'}
                      />
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">⚡ Risk Classification</span>
                    <span className={cx('font-bold',
                      result.technicalSignals.volatility_level === 'Low' ? 'text-green-400' :
                        result.technicalSignals.volatility_level === 'High' ? 'text-red-400' : 'text-yellow-400'
                    )}>
                      {result.technicalSignals.volatility_level === 'Low' ? 'LOW RISK 🟢' :
                        result.technicalSignals.volatility_level === 'High' ? 'HIGH RISK 🔴' : 'MODERATE RISK 🟡'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between py-2 border-b border-purple-900/40 gap-4">
                    <span className="text-purple-300 flex-shrink-0">💡 Risk Interpretation</span>
                    <span className="text-white text-right">
                      {result.technicalSignals.volatility_level === 'Low'
                        ? 'Stable price movement expected - suitable for conservative investors'
                        : result.technicalSignals.volatility_level === 'High'
                          ? 'Significant price swings expected - suitable only for experienced traders'
                          : 'Normal market fluctuations expected - balanced risk-reward'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📈 Maximum Potential Gain</span>
                    <span className="text-green-400 font-bold">
                      {cfg.currency}{(Math.max(...result.predictions) - result.currentPrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📉 Maximum Potential Loss</span>
                    <span className="text-red-400 font-bold">
                      {cfg.currency}{(result.currentPrice - Math.min(...result.predictions)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-purple-300">🎯 Risk-Reward Ratio</span>
                    <span className="text-white font-bold">
                      {(() => {
                        const gain = Math.max(...result.predictions) - result.currentPrice;
                        const loss = result.currentPrice - Math.min(...result.predictions);
                        return loss > 0 ? (gain / loss).toFixed(2) : '0.00';
                      })()}:1
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── SMART DECISION ────────────────────────────────── */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="🧠" title="SMART DECISION - EXPLAINABLE AI RECOMMENDATION" />
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-purple-300 font-semibold">🎯 RECOMMENDED ACTION:</span>
                  <span className={cx('text-2xl font-black', signalTextMap[result.signal])}>
                    {result.signal} {result.emoji}
                  </span>
                </div>
                <p className="text-purple-400 text-sm font-semibold mb-3">
                  📋 WHY THIS RECOMMENDATION? (Top 5 Factors)
                </p>
                <ol className="space-y-2">
                  {result.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-purple-500 font-bold flex-shrink-0 w-5">{i + 1}.</span>
                      <span className={cx(
                        reason.startsWith('✓') ? 'text-green-300' :
                          reason.startsWith('✗') ? 'text-red-300' :
                            reason.startsWith('⚠') ? 'text-yellow-300' : 'text-purple-300'
                      )}>
                        {reason}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* ─── EXPECTED RETURNS ──────────────────────────────── */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="💰" title="EXPECTED RETURNS ANALYSIS" />
                <div className="space-y-2 text-sm">
                  {[
                    ['📈 Expected Return', `${result.pctChange > 0 ? '+' : ''}${result.pctChange.toFixed(2)}%`, result.pctChange >= 0 ? 'text-green-400' : 'text-red-400'],
                    ['💵 Expected Profit per Share', `${cfg.currency}${(result.predictions[result.predictions.length - 1] - result.currentPrice).toFixed(2)}`, result.predictions[result.predictions.length - 1] >= result.currentPrice ? 'text-green-400' : 'text-red-400'],
                    ['🎯 Best Case Profit (95% confidence)', `${cfg.currency}${(result.upperBand[result.upperBand.length - 1] - result.currentPrice).toFixed(2)}`, 'text-green-400'],
                    ['⚠️ Worst Case Profit (95% confidence)', `${cfg.currency}${(result.lowerBand[result.lowerBand.length - 1] - result.currentPrice).toFixed(2)}`, 'text-red-400'],
                    ['📊 95% Confidence Price Range', `${cfg.currency}${result.lowerBand[result.lowerBand.length - 1].toFixed(2)} - ${cfg.currency}${result.upperBand[result.upperBand.length - 1].toFixed(2)}`, 'text-white'],
                  ].map(([label, value, color], i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-purple-900/40 last:border-0">
                      <span className="text-purple-300">{label}</span>
                      <span className={cx('font-bold', color as string)}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── PREDICTION TABLE ──────────────────────────────── */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="📅" title={`${result.predictions.length}-Day Price Prediction Table`} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-purple-800">
                        <th className="text-left py-3 px-2 text-purple-400 font-bold">#</th>
                        <th className="text-left py-3 px-2 text-purple-400 font-bold">Date</th>
                        <th className="text-right py-3 px-2 text-purple-400 font-bold">Predicted Price</th>
                        <th className="text-right py-3 px-2 text-purple-400 font-bold">Expected Return</th>
                        <th className="text-right py-3 px-2 text-purple-400 font-bold hidden md:table-cell">95% Confidence Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.predictions.map((price, i) => {
                        const ret = ((price - result.currentPrice) / result.currentPrice) * 100;
                        const date = new Date(result.predictionDates[i]);
                        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
                        return (
                          <tr key={i} className="border-b border-purple-900/30 hover:bg-purple-900/10 transition-colors">
                            <td className="py-3 px-2 text-purple-600 font-mono">{i + 1}</td>
                            <td className="py-3 px-2 text-purple-200 font-mono">{dateStr}</td>
                            <td className="py-3 px-2 text-right text-white font-mono font-bold">
                              {cfg.currency}{price.toFixed(2)}
                            </td>
                            <td className={cx('py-3 px-2 text-right font-mono font-bold', ret >= 0 ? 'text-green-400' : 'text-red-400')}>
                              {ret > 0 ? '+' : ''}{ret.toFixed(2)}%
                            </td>
                            <td className="py-3 px-2 text-right text-purple-400 font-mono text-xs hidden md:table-cell">
                              {cfg.currency}{result.lowerBand[i].toFixed(2)} - {cfg.currency}{result.upperBand[i].toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── COMPANY ANALYSIS TAB ───────────────────────────── */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              {/* History Chart */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <HistoryChart
                  historicalData={result.historicalData}
                  ma50={result.ma50}
                  ma200={result.ma200}
                  currency={cfg.currency}
                  companyName={result.companyName}
                />
              </div>

              {/* Company Overview */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="🏢" title="COMPLETE COMPANY ANALYSIS" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-purple-500 text-xs">Full Name</p>
                    <p className="text-white font-bold">{result.info.longName}</p>
                  </div>
                  <div>
                    <p className="text-purple-500 text-xs">Sector</p>
                    <p className="text-white font-bold">{result.info.sector}</p>
                  </div>
                  <div>
                    <p className="text-purple-500 text-xs">Industry</p>
                    <p className="text-white font-bold">{result.info.industry}</p>
                  </div>
                  <div>
                    <p className="text-purple-500 text-xs">Market Cap</p>
                    <p className="text-white font-bold">{formatMarketCap(result.info.marketCap, cfg.currency)}</p>
                  </div>
                  <div>
                    <p className="text-purple-500 text-xs">P/E Ratio</p>
                    <p className="text-white font-bold">
                      {typeof result.info.trailingPE === 'number' ? result.info.trailingPE.toFixed(2) : 'N/A'}x
                    </p>
                  </div>
                  <div>
                    <p className="text-purple-500 text-xs">Risk Level</p>
                    <Badge
                      text={result.technicalSignals.volatility_level}
                      color={riskColorMap[result.technicalSignals.volatility_level] || 'yellow'}
                    />
                  </div>
                </div>
              </div>

              {/* Growth Intelligence */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="📈" title="LONG-TERM GROWTH INTELLIGENCE" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">📊 CAGR (Compound Annual Growth Rate)</span>
                    <span className={cx('font-bold', result.cagr >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {result.cagr > 0 ? '+' : ''}{result.cagr.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">💹 Total Historical Return</span>
                    <span className={cx('font-bold', result.totalReturn >= 0 ? 'text-green-400' : 'text-red-400')}>
                      {result.totalReturn > 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-purple-300">🎯 Current Trend</span>
                    <span className={cx('font-bold',
                      result.trendStrength === 'Strong Uptrend' ? 'text-green-400' :
                        result.trendStrength === 'Strong Downtrend' ? 'text-red-400' : 'text-yellow-400'
                    )}>
                      {result.trendStrength}{' '}
                      {result.trendStrength === 'Strong Uptrend' ? '📈 🟢' :
                        result.trendStrength === 'Strong Downtrend' ? '📉 🔴' : '↔️ 🟡'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Investment Verdict */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="🎯" title="FINAL INVESTMENT VERDICT" />
                <div className="flex items-start gap-4 mb-4">
                  <div>
                    <p className="text-purple-400 text-xs mb-1">💡 Decision</p>
                    <p className="text-white font-black text-xl">{result.verdict}</p>
                  </div>
                </div>
                <p className="text-purple-300 text-sm mb-3">📝 Summary: <span className="text-white">{result.verdictSummary}</span></p>
                <p className="text-purple-400 text-xs font-semibold mb-2">📋 Key Factors:</p>
                <ul className="space-y-1.5">
                  {result.verdictReasons.map((r, i) => (
                    <li key={i} className={cx('text-sm flex items-start gap-2',
                      r.startsWith('✓') ? 'text-green-300' :
                        r.startsWith('✗') ? 'text-red-300' : 'text-yellow-300'
                    )}>
                      <span className="mt-0.5">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Insights */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="" title="AI Insights" />
                <div className="space-y-3">
                  {[
                    {
                      label: 'Technical Momentum',
                      color: 'text-green-400',
                      content: `${result.companyName} is trading ${result.currentPrice > result.ma50[result.ma50.length - 1] ? 'above' : 'below'} its 50-day moving average. RSI at ${result.technicalSignals.rsi.toFixed(0)} suggests ${result.technicalSignals.rsi_signal === 'Overbought' ? 'overbought — potential correction' : result.technicalSignals.rsi_signal === 'Oversold' ? 'oversold — potential bounce' : 'bullish continuation'}.`
                    },
                    {
                      label: 'Institutional Activity',
                      color: 'text-purple-400',
                      content: `${result.technicalSignals.macd_signal === 'Bullish' ? `Positive MACD crossover detected. Momentum indicators suggest strong institutional buying interest in ${result.companyName}.` : `MACD showing bearish crossover. Institutional positioning appears cautious for ${result.companyName}.`}`
                    },
                    {
                      label: 'Earnings & Valuation',
                      color: 'text-yellow-400',
                      content: `Current P/E of ${typeof result.info.trailingPE === 'number' ? result.info.trailingPE.toFixed(1) : 'N/A'}x ${typeof result.info.trailingPE === 'number' && result.info.trailingPE < 25 ? 'is at a reasonable valuation relative to sector average, suggesting potential upside.' : 'is at a premium to sector average. Monitor earnings carefully.'}`
                    },
                  ].map((insight, i) => (
                    <div key={i} className="bg-[#0d0620] border border-purple-900/40 rounded-xl p-4">
                      <p className={cx('text-sm font-bold mb-1', insight.color)}>{insight.label}</p>
                      <p className="text-purple-200 text-sm leading-relaxed">{insight.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── NEWS SENTIMENT TAB ─────────────────────────────── */}
          {activeTab === 'news' && newsData && (
            <div className="space-y-4">
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="📰" title="LATEST NEWS SENTIMENT ANALYSIS" />
                <div className="space-y-4">
                  {newsData.news.map((item, i) => (
                    <div key={i} className="bg-[#0d0620] border border-purple-900/40 rounded-xl p-4">
                      <p className="text-purple-400 text-xs font-bold mb-1">📌 News {i + 1}</p>
                      <p className="text-white text-sm font-semibold mb-1.5 leading-snug">{item.title}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-purple-500">Source: <span className="text-purple-300">{item.source}</span></span>
                        <span className="flex items-center gap-1">
                          Sentiment:
                          <Badge
                            text={item.sentiment}
                            color={item.sentiment === 'Positive' ? 'green' : item.sentiment === 'Negative' ? 'red' : 'yellow'}
                          />
                        </span>
                        <span className="text-purple-500">(Score: {item.score.toFixed(3)})</span>
                      </div>
                      <p className="text-purple-400 text-xs mt-2 leading-relaxed">Summary: {item.summary}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sentiment Summary */}
              <div className="bg-[#110828] border border-purple-900/60 rounded-2xl p-5">
                <SectionHeader icon="📊" title="OVERALL NEWS SENTIMENT SUMMARY" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">Total News Analyzed</span>
                    <span className="text-white font-bold">{newsData.summary.total}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">Positive News</span>
                    <span className="text-green-400 font-bold">{newsData.summary.positive} 🟢</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">Negative News</span>
                    <span className="text-red-400 font-bold">{newsData.summary.negative} 🔴</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">Neutral News</span>
                    <span className="text-yellow-400 font-bold">{newsData.summary.neutral} 🟡</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">Average Sentiment Score</span>
                    <span className="text-white font-bold">{newsData.summary.average.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-purple-900/40">
                    <span className="text-purple-300">Overall Market Sentiment</span>
                    <span className="text-white font-bold">{newsData.summary.overall}</span>
                  </div>
                  <div className="flex items-start justify-between py-2 gap-4">
                    <span className="text-purple-300 flex-shrink-0">Potential Impact</span>
                    <span className="text-white text-right">{newsData.summary.impact}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── DISCLAIMER ─────────────────────────────────────── */}
          <div className="mt-6 bg-[#0d0620] border border-purple-900/30 rounded-2xl p-5">
            <p className="text-purple-500 text-xs font-semibold mb-1">⚠️ DISCLAIMER</p>
            <p className="text-purple-600 text-xs leading-relaxed">
              This is an AI-based decision support tool for educational purposes. Past performance does not guarantee future results.
              Always conduct your own research and consult a financial advisor. Invest at your own risk.
            </p>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-purple-900/30 py-6 text-center text-purple-700 text-xs">
        <p>IntegraX — Global Stock AI Platform | Professional Edition</p>
        <p className="mt-1">AI-Powered by RandomForest + GradientBoosting Ensemble | 10 Global Markets</p>
      </footer>
    </div>
  );
};

export default App;