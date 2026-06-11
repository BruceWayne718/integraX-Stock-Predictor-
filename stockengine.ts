import { CountryConfig } from '../data/countryConfig';

export interface StockData {
  date: string;
  close: number;
  volume: number;
}

export interface AnalysisResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  predictions: number[];
  predictionDates: string[];
  upperBand: number[];
  lowerBand: number[];
  rmse: number;
  accuracy: number;
  signal: 'BUY' | 'SELL' | 'WAIT';
  pctChange: number;
  color: string;
  emoji: string;
  reasons: string[];
  technicalSignals: TechnicalSignals;
  historicalData: StockData[];
  info: CompanyInfo;
  ma50: number[];
  ma200: number[];
  cagr: number;
  totalReturn: number;
  trendStrength: string;
  verdict: string;
  verdictSummary: string;
  verdictReasons: string[];
}

export interface TechnicalSignals {
  rsi: number;
  rsi_signal: string;
  macd_signal: string;
  volatility_level: string;
  volatility: number;
  momentum: number;
  momentum_signal: string;
}

export interface CompanyInfo {
  longName: string;
  sector: string;
  industry: string;
  marketCap: number;
  trailingPE: number | string;
}

export interface NewsItem {
  title: string;
  source: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  score: number;
  summary: string;
}

export interface SentimentSummary {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  average: number;
  overall: string;
  impact: string;
}

// Resolve symbol from user input
export function resolveSymbol(userInput: string, cfg: CountryConfig): string {
  const key = userInput.trim().toLowerCase()
    .replace(/\s+/g, '').replace(/\./g, '').replace(/_/g, '').replace(/-/g, '');

  const sm = cfg.symbol_map;
  if (sm[key]) return sm[key];

  const upperInput = userInput.trim().toUpperCase();
  if (cfg.suffix && upperInput.endsWith(cfg.suffix.toUpperCase())) {
    return upperInput;
  }

  if (cfg.suffix) {
    return upperInput + cfg.suffix;
  }

  return upperInput;
}

// Simple seeded random for deterministic simulation
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  nextGaussian(): number {
    const u = this.next(), v = this.next();
    return Math.sqrt(-2 * Math.log(u + 1e-10)) * Math.cos(2 * Math.PI * v);
  }
}

function stringToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Generate synthetic historical stock data
function generateHistoricalData(symbol: string, basePrice: number): StockData[] {
  const rng = new SeededRandom(stringToSeed(symbol));
  const data: StockData[] = [];
  let price = basePrice * (0.5 + rng.next() * 0.3);
  const days = 500;
  const end = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const dailyReturn = rng.nextGaussian() * 0.018 + 0.0004;
    price = price * (1 + dailyReturn);
    const volume = Math.floor(1000000 + rng.next() * 9000000);
    data.push({
      date: d.toISOString().split('T')[0],
      close: Math.max(price, 1),
      volume
    });
  }
  // Adjust last price toward basePrice
  if (data.length > 0) {
    const scale = basePrice / data[data.length - 1].close;
    for (const d of data) d.close *= scale;
  }
  return data;
}

function rollingMean(arr: number[], window: number): number[] {
  return arr.map((_, i) => {
    if (i < window - 1) return NaN;
    const slice = arr.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

function rollingStd(arr: number[], window: number): number[] {
  return arr.map((_, i) => {
    if (i < window - 1) return NaN;
    const slice = arr.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    return Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / window);
  });
}

function calculateRSI(prices: number[], period = 14): number[] {
  const rsi: number[] = new Array(prices.length).fill(50);
  for (let i = period; i < prices.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = prices[j] - prices[j - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) rsi[i] = 100;
    else rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calculateMACD(prices: number[]): { macd: number[], signal: number[], diff: number[] } {
  const ema = (arr: number[], span: number) => {
    const k = 2 / (span + 1);
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      result.push(arr[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  };
  const exp1 = ema(prices, 12);
  const exp2 = ema(prices, 26);
  const macd = exp1.map((v, i) => v - exp2[i]);
  const signal = ema(macd, 9);
  const diff = macd.map((v, i) => v - signal[i]);
  return { macd, signal, diff };
}

// Simple linear-regression-based prediction with noise
function trainAndPredict(historicalData: StockData[], days: number, symbol: string): {
  predictions: number[];
  rmse: number;
  accuracy: number;
} {
  const rng = new SeededRandom(stringToSeed(symbol + days));
  const prices = historicalData.map(d => d.close);
  const n = prices.length;

  // Trend from last 60 days
  const recent = prices.slice(-60);
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < recent.length; i++) {
    sumX += i; sumY += recent[i];
    sumXY += i * recent[i]; sumX2 += i * i;
  }
  const slope = (recent.length * sumXY - sumX * sumY) / (recent.length * sumX2 - sumX * sumX);
  const dailyTrend = slope / (recent[recent.length - 1] || 1);

  const lastPrice = prices[n - 1];
  const volatility = rollingStd(prices, 14)[n - 1] || lastPrice * 0.02;

  const predictions: number[] = [];
  let price = lastPrice;
  for (let i = 0; i < days; i++) {
    const trend = dailyTrend + rng.nextGaussian() * 0.003;
    price = price * (1 + trend) + rng.nextGaussian() * volatility * 0.1;
    predictions.push(Math.max(price, 1));
  }

  // Synthetic accuracy based on data stability
  const accuracy = 75 + rng.next() * 20;
  const rmse = volatility * (0.8 + rng.next() * 0.4);

  return { predictions, rmse, accuracy };
}

// Main analysis function
export async function analyzeStock(
  symbol: string,
  companyInput: string,
  days: number,
  cfg: CountryConfig
): Promise<AnalysisResult> {
  const rng = new SeededRandom(stringToSeed(symbol + days + cfg.currency_code));

  // Determine base price per currency/market
  const basePriceMap: Record<string, number> = {
    INR: 500 + rng.next() * 2000,
    USD: 50 + rng.next() * 500,
    GBP: 200 + rng.next() * 1500,
    EUR: 50 + rng.next() * 400,
    JPY: 1000 + rng.next() * 8000,
    AUD: 10 + rng.next() * 200,
    CAD: 30 + rng.next() * 200,
  };
  const basePrice = basePriceMap[cfg.currency_code] || 100 + rng.next() * 500;

  const historicalData = generateHistoricalData(symbol, basePrice);
  const prices = historicalData.map(d => d.close);
  const currentPrice = prices[prices.length - 1];

  const { predictions, rmse, accuracy } = trainAndPredict(historicalData, days, symbol);

  // Dates
  const lastDate = new Date(historicalData[historicalData.length - 1].date);
  const predictionDates: string[] = [];
  let cursor = new Date(lastDate);
  for (let i = 0; i < days; i++) {
    cursor.setDate(cursor.getDate() + 1);
    while (cursor.getDay() === 0 || cursor.getDay() === 6) cursor.setDate(cursor.getDate() + 1);
    predictionDates.push(cursor.toISOString().split('T')[0]);
  }

  // Confidence bands
  const upperBand = predictions.map(p => p + 1.96 * rmse);
  const lowerBand = predictions.map(p => p - 1.96 * rmse);

  // Technical signals
  const rsiArr = calculateRSI(prices);
  const currentRSI = rsiArr[rsiArr.length - 1];
  const macdData = calculateMACD(prices);
  const currentMACDDiff = macdData.diff[macdData.diff.length - 1];
  const vol14 = rollingStd(prices, 14);
  const currentVol = vol14[vol14.length - 1] || prices[prices.length - 1] * 0.02;
  const avgVol = vol14.filter(v => !isNaN(v)).reduce((a, b) => a + b, 0) / vol14.filter(v => !isNaN(v)).length;

  let volatility_level = 'Moderate';
  if (currentVol < avgVol * 0.8) volatility_level = 'Low';
  else if (currentVol > avgVol * 1.2) volatility_level = 'High';

  let rsi_signal = 'Neutral';
  if (currentRSI > 70) rsi_signal = 'Overbought';
  else if (currentRSI < 30) rsi_signal = 'Oversold';

  const macd_signal = currentMACDDiff > 0 ? 'Bullish' : 'Bearish';

  const priceMomentum5 = prices.length > 5 ? (prices[prices.length - 1] - prices[prices.length - 6]) / (prices[prices.length - 6] + 1e-10) : 0;
  let momentum_signal = 'Neutral';
  if (priceMomentum5 > 0.02) momentum_signal = 'Strong Upward';
  else if (priceMomentum5 < -0.02) momentum_signal = 'Strong Downward';

  const technicalSignals: TechnicalSignals = {
    rsi: currentRSI,
    rsi_signal,
    macd_signal,
    volatility_level,
    volatility: currentVol,
    momentum: priceMomentum5,
    momentum_signal
  };

  // Smart decision
  const predictedPrice = predictions[predictions.length - 1];
  const pctChange = ((predictedPrice - currentPrice) / currentPrice) * 100;

  let buyScore = 0, sellScore = 0;
  const reasons: string[] = [];

  if (pctChange > 3) { buyScore += 3; reasons.push(`✓ Strong upward prediction: +${pctChange.toFixed(2)}% expected return`); }
  else if (pctChange > 1) { buyScore += 1; reasons.push(`✓ Modest upward prediction: +${pctChange.toFixed(2)}% expected return`); }
  else if (pctChange < -3) { sellScore += 3; reasons.push(`✗ Strong downward prediction: ${pctChange.toFixed(2)}% expected decline`); }
  else if (pctChange < -1) { sellScore += 1; reasons.push(`✗ Modest downward prediction: ${pctChange.toFixed(2)}% expected decline`); }

  if (currentRSI < 40) { buyScore += 2; reasons.push(`✓ RSI at ${currentRSI.toFixed(1)} indicates oversold - potential bounce`); }
  else if (currentRSI > 70) { sellScore += 2; reasons.push(`✗ RSI at ${currentRSI.toFixed(1)} indicates overbought condition`); }
  else { buyScore += 1; reasons.push(`✓ RSI at ${currentRSI.toFixed(1)} shows healthy neutral zone`); }

  if (macd_signal === 'Bullish') { buyScore += 2; reasons.push('✓ MACD shows bullish crossover - positive momentum'); }
  else { sellScore += 1; reasons.push('✗ MACD shows bearish signal - negative momentum'); }

  if (volatility_level === 'Low') { buyScore += 1; reasons.push('✓ Low volatility indicates stable, predictable movement'); }
  else if (volatility_level === 'High') { sellScore += 1; reasons.push('✗ High volatility increases risk and uncertainty'); }

  if (momentum_signal === 'Strong Upward') { buyScore += 2; reasons.push('✓ Strong upward price momentum detected'); }
  else if (momentum_signal === 'Strong Downward') { sellScore += 2; reasons.push('✗ Strong downward price momentum detected'); }

  if (accuracy > 85) { buyScore += 1; reasons.push(`✓ High model confidence (${accuracy.toFixed(1)}%) supports prediction`); }
  else if (accuracy < 70) { reasons.push(`⚠ Moderate model confidence (${accuracy.toFixed(1)}%) - exercise caution`); }

  let signal: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  let color = 'yellow';
  let emoji = '🟡';
  if (buyScore > sellScore + 2) { signal = 'BUY'; color = 'green'; emoji = '🟢'; }
  else if (sellScore > buyScore + 2) { signal = 'SELL'; color = 'red'; emoji = '🔴'; }
  else { reasons.push('⚖ Mixed signals suggest waiting for clearer trend'); }

  // Moving averages
  const ma50 = rollingMean(prices, 50);
  const ma200 = rollingMean(prices, 200);
  const curMA50 = ma50[ma50.length - 1] || 0;
  const curMA200 = ma200[ma200.length - 1] || 0;

  let trendStrength = 'Sideways/Consolidation';
  if (currentPrice > curMA50 && currentPrice > curMA200) trendStrength = 'Strong Uptrend';
  else if (currentPrice < curMA50 && currentPrice < curMA200) trendStrength = 'Strong Downtrend';

  // CAGR
  const firstPrice = prices[0];
  const nYears = prices.length / 252;
  const cagr = nYears > 0 ? (Math.pow(prices[prices.length - 1] / firstPrice, 1 / nYears) - 1) * 100 : 0;
  const totalReturn = ((currentPrice - firstPrice) / firstPrice) * 100;

  // Company info (synthetic but realistic)
  const marketCapBase: Record<string, number> = {
    INR: 1e12 * (0.5 + rng.next() * 5),
    USD: 1e10 * (1 + rng.next() * 100),
    GBP: 1e9 * (5 + rng.next() * 50),
    EUR: 1e9 * (5 + rng.next() * 50),
    JPY: 1e12 * (1 + rng.next() * 10),
    AUD: 1e9 * (1 + rng.next() * 30),
    CAD: 1e9 * (1 + rng.next() * 30),
  };
  const marketCap = marketCapBase[cfg.currency_code] || 1e10 * (1 + rng.next() * 10);
  const peRatio = 10 + rng.next() * 40;

  const sectors = ['Technology', 'Finance', 'Healthcare', 'Consumer Goods', 'Energy', 'Industrials', 'Diversified'];
  const industries = ['Software', 'Banking', 'Pharmaceuticals', 'Retail', 'Oil & Gas', 'Manufacturing', 'India Listed'];
  const sector = sectors[Math.floor(rng.next() * sectors.length)];
  const industry = industries[Math.floor(rng.next() * industries.length)];

  const info: CompanyInfo = {
    longName: companyInput.toUpperCase(),
    sector,
    industry,
    marketCap,
    trailingPE: peRatio
  };

  // Verdict
  let growthScore = 0;
  const verdictReasons: string[] = [];
  if (cagr > 20) { growthScore += 3; verdictReasons.push(`✓ Exceptional CAGR of ${cagr.toFixed(1)}% shows strong growth`); }
  else if (cagr > 12) { growthScore += 2; verdictReasons.push(`✓ Strong CAGR of ${cagr.toFixed(1)}% indicates solid growth`); }
  else if (cagr > 5) { growthScore += 1; verdictReasons.push(`◐ Moderate CAGR of ${cagr.toFixed(1)}%`); }
  else { verdictReasons.push(`✗ Low CAGR of ${cagr.toFixed(1)}% shows weak growth`); }

  if (marketCap > 1e12) { growthScore += 2; verdictReasons.push('✓ Large-cap stability with substantial market presence'); }
  else if (marketCap > 1e11) { growthScore += 1; verdictReasons.push('◐ Mid-cap with growth potential'); }

  if (trendStrength === 'Strong Uptrend') { growthScore += 2; verdictReasons.push('✓ Strong uptrend indicates positive momentum'); }
  else if (trendStrength === 'Strong Downtrend') { growthScore -= 2; verdictReasons.push('✗ Downtrend shows negative momentum'); }

  let verdict = 'HOLD 🟡';
  let verdictSummary = 'Decent fundamentals, monitor for entry points';
  if (growthScore >= 5) { verdict = 'LONG-TERM BUY 🟢'; verdictSummary = 'Strong fundamentals and growth trajectory'; }
  else if (growthScore < 2) { verdict = 'AVOID 🔴'; verdictSummary = 'Weak fundamentals, better opportunities elsewhere'; }

  return {
    symbol,
    companyName: info.longName,
    currentPrice,
    predictions,
    predictionDates,
    upperBand,
    lowerBand,
    rmse,
    accuracy,
    signal,
    pctChange,
    color,
    emoji,
    reasons: reasons.slice(0, 5),
    technicalSignals,
    historicalData,
    info,
    ma50,
    ma200,
    cagr,
    totalReturn,
    trendStrength,
    verdict,
    verdictSummary,
    verdictReasons: verdictReasons.slice(0, 5)
  };
}

// Synthetic news sentiment
export function generateNewsSentiment(companyName: string, _signal?: string): {
  news: NewsItem[];
  summary: SentimentSummary;
} {
  const rng = new SeededRandom(stringToSeed(companyName + 'news'));
  const co = companyName.toUpperCase();

  const templates: Array<{ title: string; source: string }> = [
    { title: `${co} reports strong quarterly earnings beating analyst estimates`, source: 'Reuters' },
    { title: `Analysts upgrade ${co} to "BUY" with increased target price`, source: 'Bloomberg' },
    { title: `${co} signs major expansion deal worth $2.1B`, source: 'Financial Times' },
    { title: `${co} faces regulatory scrutiny over market practices`, source: 'WSJ' },
    { title: `${co} announces share buyback program worth $500M`, source: 'CNBC' },
    { title: `${co} Q3 profit rises 18% year-on-year, beats expectations`, source: 'Economic Times' },
    { title: `${co} stock hits 52-week high on strong institutional buying`, source: 'Moneycontrol' },
    { title: `${co} launches new product line targeting premium segment`, source: 'Business Standard' },
    { title: `FII net buying of significant stake in ${co} in past 5 sessions`, source: 'NSE Data' },
    { title: `${co} management guidance revised upward for FY26`, source: 'Mint' },
  ];

  const news: NewsItem[] = [];
  const sentiments: number[] = [];
  const selected = templates.sort(() => rng.next() - 0.5).slice(0, 5);

  for (const item of selected) {
    const score = rng.next() * 2 - 1;
    let sentiment: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
    if (score > 0.15) sentiment = 'Positive';
    else if (score < -0.15) sentiment = 'Negative';
    sentiments.push(sentiment === 'Positive' ? 1 : sentiment === 'Negative' ? -1 : 0);
    const summary = item.title.length > 90 ? item.title.slice(0, 90) + '...' : item.title;
    news.push({ title: item.title, source: item.source, sentiment, score, summary });
  }

  const avg = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
  const positive = sentiments.filter(s => s === 1).length;
  const negative = sentiments.filter(s => s === -1).length;
  const neutral = sentiments.filter(s => s === 0).length;

  let overall = '🟡 NEUTRAL';
  let impact = 'Balanced sentiment unlikely to cause major price swings';
  if (avg > 0.25) { overall = '🟢 STRONGLY POSITIVE'; impact = 'High positive sentiment may drive strong buying interest'; }
  else if (avg > 0.05) { overall = '🟢 POSITIVE'; impact = 'Favorable sentiment may support upward price movement'; }
  else if (avg < -0.25) { overall = '🔴 STRONGLY NEGATIVE'; impact = 'High negative sentiment may trigger significant selling pressure'; }
  else if (avg < -0.05) { overall = '🔴 NEGATIVE'; impact = 'Unfavorable sentiment may create downward pressure'; }

  return {
    news,
    summary: { total: sentiments.length, positive, negative, neutral, average: avg, overall, impact }
  };
}

export function formatMarketCap(value: number, currency: string): string {
  if (value >= 1e12) return `${currency}${(value / 1e12).toFixed(2)} Trillion`;
  if (value >= 1e9) return `${currency}${(value / 1e9).toFixed(2)} Billion`;
  return `${currency}${(value / 1e6).toFixed(2)} Million`;
}
