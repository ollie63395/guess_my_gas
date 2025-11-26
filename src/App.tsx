import React, { useState, useMemo, useEffect } from 'react';
import { 
  Fuel, Zap, Droplet, Circle, Calendar as CalendarIcon, 
  Clock, MapPin, Navigation, Check, DollarSign, 
  TrendingUp, TrendingDown, Award, AlertCircle,
  Target, CheckCircle2, XCircle, Bell, BellOff
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceDot 
} from 'recharts';
import { format, addDays, subDays, isSameDay, setHours } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface FuelType {
  id: string;
  name: string;
  octane: string;
  icon: React.ElementType;
  theme: 'emerald' | 'amber' | 'slate' | 'sky';
  basePrice: number;
  variance: number;
}

interface Store {
  id: string;
  name: string;
  address: string;
  distance: string;
  coordinates: { lat: number; lng: number };
}

interface PredictionData {
  date: Date;
  displayDate: string;
  fullDate: string;
  price: number;
  isTarget: boolean;
}

// --- Australian Constants (Melbourne) ---

const FUEL_TYPES: FuelType[] = [
  {
    id: 'u91',
    name: 'Unleaded 91',
    octane: '91 RON',
    icon: Fuel,
    theme: 'emerald',
    basePrice: 1.95,
    variance: 0.15
  },
  {
    id: 'p98',
    name: 'Premium 98',
    octane: '98 RON',
    icon: Zap,
    theme: 'amber',
    basePrice: 2.25,
    variance: 0.18
  },
  {
    id: 'diesel',
    name: 'Special Diesel',
    octane: 'CN 50+',
    icon: Droplet,
    theme: 'slate',
    basePrice: 2.10,
    variance: 0.20
  },
  {
    id: 'e10',
    name: 'E10 Unleaded',
    octane: '94 RON (10% Ethanol)',
    icon: Circle,
    theme: 'sky',
    basePrice: 1.91,
    variance: 0.12
  }
];

const STORES: Store[] = [
  {
    id: 'store-001',
    name: '7-Eleven QV Melbourne',
    address: '185 Swanston St, Melbourne VIC 3000',
    distance: '1.2 km',
    coordinates: { lat: -37.8106, lng: 144.9654 }
  },
  {
    id: 'store-002',
    name: '7-Eleven South Yarra',
    address: '163 Toorak Rd, South Yarra VIC 3141',
    distance: '3.8 km',
    coordinates: { lat: -37.8390, lng: 144.9930 }
  },
  {
    id: 'store-003',
    name: '7-Eleven St Kilda',
    address: '115 Fitzroy St, St Kilda VIC 3182',
    distance: '6.5 km',
    coordinates: { lat: -37.8596, lng: 144.9793 }
  },
  {
    id: 'store-004',
    name: '7-Eleven Clayton',
    address: '1378 Centre Rd, Clayton South VIC 3169',
    distance: '19.2 km',
    coordinates: { lat: -37.9300, lng: 145.1200 }
  }
];

// --- Mock Data Generators ---

const generatePrice = (base: number, variance: number, seedDate: Date): number => {
  const day = seedDate.getDate();
  const month = seedDate.getMonth();
  // Pseudo-random based on date
  const randomOffset = Math.sin(day * month * 0.5) * variance; 
  const trendOffset = (day % 10) * 0.002; 
  return Number((base + randomOffset + trendOffset).toFixed(3));
};

const generateHistoricalData = (selectedDate: Date, fuelTypeId: string): PredictionData[] => {
  const fuel = FUEL_TYPES.find(f => f.id === fuelTypeId) || FUEL_TYPES[0];
  const data: PredictionData[] = [];
  
  for (let i = -7; i <= 7; i++) {
    const date = addDays(selectedDate, i);
    const price = generatePrice(fuel.basePrice, fuel.variance, date);
    data.push({
      date: date,
      displayDate: format(date, 'MMM dd'),
      fullDate: format(date, 'MMM dd, yyyy'),
      price: price,
      isTarget: i === 0
    });
  }
  return data;
};

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ComponentProps<'button'>>(
  ({ className, ...props }, ref) => (
    <button 
      ref={ref} 
      {...props} 
      className={cn("inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none", className)} 
    />
  )
);
Button.displayName = "Button";

const Card = ({ className, children }: { className?: string, children: React.ReactNode }) => (
  <div className={cn("rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm", className)}>
    {children}
  </div>
);

// --- Main Application ---

export default function GuessMyGas() {
  const [selectedFuel, setSelectedFuel] = useState<FuelType>(FUEL_TYPES[0]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<number>(6); // Hour 0-23
  const [selectedStore, setSelectedStore] = useState<Store>(STORES[0]);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  
  // Modal States
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertPrice, setAlertPrice] = useState(1.85);
  const [alertMethod, setAlertMethod] = useState<'email' | 'sms'>('email');

  const handlePredict = () => {
    const history = generateHistoricalData(selectedDate, selectedFuel.id);
    const targetDay = history.find(h => h.isTarget);
    const prevDay = history.find(h => isSameDay(h.date, subDays(selectedDate, 1)));
    const nextDay = history.find(h => isSameDay(h.date, addDays(selectedDate, 1)));

    const comparisons = FUEL_TYPES.map(f => ({
      ...f,
      price: generatePrice(f.basePrice, f.variance, selectedDate)
    })).sort((a, b) => a.price - b.price);

    setPredictionResult({
      history,
      current: targetDay,
      prev: prevDay,
      next: nextDay,
      fuelComparisons: comparisons,
      timestamp: Date.now()
    });
    
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const getThemeColors = (theme: string, isSelected: boolean) => {
    const themes: Record<string, { bg: string; text: string; }> = {
      emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
      amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
      slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
      sky: { bg: 'bg-sky-100', text: 'text-sky-600' },
    };
    return themes[theme];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-16 font-sans text-slate-900">
      
      {/* 1. Header Section */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">GuessMyGas</h1>
            <p className="text-sm font-medium text-slate-600">Accurate fuel price predictions powered by data</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
            <span className="text-sm font-semibold text-slate-600">7-Eleven</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        
        {/* 2. Main Configuration Panel */}
        <Card className="mb-8 p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-slate-900">Configure Your Prediction</h2>

          {/* Fuel Type Selection */}
          <div className="mb-8">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Select Fuel Type</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FUEL_TYPES.map((fuel) => {
                const isSelected = selectedFuel.id === fuel.id;
                const theme = getThemeColors(fuel.theme, isSelected);
                const Icon = fuel.icon;
                
                return (
                  <div
                    key={fuel.id}
                    onClick={() => setSelectedFuel(fuel)}
                    className={cn(
                      "group relative cursor-pointer rounded-xl border-2 p-6 transition-all",
                      isSelected 
                        ? "border-slate-900 bg-slate-50 shadow-md" 
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    
                    <div className={cn(
                      "mb-4 inline-flex rounded-lg p-3 transition-colors",
                      isSelected ? "bg-slate-900 text-white" : `${theme.bg} ${theme.text}`
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="font-bold text-slate-900 mb-1">{fuel.name}</div>
                    <div className="text-sm text-slate-600">{fuel.octane}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Date & Time Selection */}
          <div className="mb-8">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Choose Date & Time</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-500">Date</span>
                  <input 
                    type="date" 
                    className="bg-transparent font-medium text-slate-900 focus:outline-none"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>

              <div className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex flex-col w-full">
                  <span className="text-xs font-medium text-slate-500">Time</span>
                  <select 
                    className="w-full bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>{format(setHours(new Date(), i), 'h:00 a')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Store Selection */}
          <div className="mb-8">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Select Store</h3>
            <div className="flex flex-col gap-3">
              {STORES.map((store) => {
                const isSelected = selectedStore.id === store.id;
                return (
                  <div
                    key={store.id}
                    onClick={() => setSelectedStore(store)}
                    className={cn(
                      "flex w-full cursor-pointer items-start justify-between rounded-xl border-2 p-4 transition-all",
                      isSelected 
                        ? "border-slate-900 bg-slate-50 shadow-md" 
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <MapPin className={cn("mt-1 h-4 w-4", isSelected ? "text-slate-900" : "text-slate-600")} />
                      <div>
                        <div className="font-bold text-slate-900">{store.name}</div>
                        <div className="mb-2 text-sm text-slate-600">{store.address}</div>
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-600">
                          <Navigation className="h-3 w-3" />
                          <span>{store.distance} away</span>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button 
            onClick={handlePredict}
            className="w-full rounded-xl bg-slate-900 py-4 text-lg text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            Get Price Prediction
          </Button>
        </Card>

        {/* 3. Prediction Results Section */}
        {predictionResult && (
          <div id="results-section" className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Main Prediction Card */}
            <Card className="mb-8 overflow-hidden border-slate-200 p-8 shadow-sm">
              <div className="mb-6 flex flex-col justify-between sm:flex-row sm:items-start">
                <div>
                  <h2 className="mb-2 text-2xl font-bold text-slate-900">Price Prediction</h2>
                  <p className="text-slate-600">
                    {format(selectedDate, 'MMMM dd, yyyy')} at {format(setHours(new Date(), selectedTime), 'h:00 a')}
                  </p>
                </div>
                <div className="mt-4 flex flex-col items-end sm:mt-0">
                  <div className="flex items-start gap-1">
                    <DollarSign className="mt-2 h-5 w-5 text-slate-900" />
                    <span className="text-5xl font-bold tracking-tight text-slate-900">
                      {predictionResult.current.price.toFixed(3)}
                    </span>
                    <span className="mt-6 text-sm text-slate-600">/litre</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-sm font-medium">
                    {predictionResult.current.price > predictionResult.prev.price ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-red-600" />
                        <span className="text-red-600">
                          +{(predictionResult.current.price - predictionResult.prev.price).toFixed(3)} (0.8%)
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-600">
                          {(predictionResult.current.price - predictionResult.prev.price).toFixed(3)} (-0.5%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Interactive Graph */}
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={predictionResult.history}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="displayDate" 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                      stroke="#64748b" 
                      fontSize={12} 
                      tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                              <p className="mb-1 font-bold text-slate-900">{data.fullDate}</p>
                              <p className="text-slate-700">${data.price.toFixed(3)}/litre</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#0f172a" 
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#0f172a", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#0f172a", stroke: "#fff", strokeWidth: 3 }}
                    />
                    {/* Highlight selected date */}
                    <ReferenceDot 
                      x={predictionResult.current.displayDate} 
                      y={predictionResult.current.price} 
                      r={8} 
                      fill="#0f172a" 
                      stroke="#fff" 
                      strokeWidth={3} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-700">
                    Prediction confidence: <span className="font-bold text-slate-900">87%</span>
                  </span>
                </div>
              </div>
            </Card>

            {/* Secondary Insights Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              
              {/* Neighboring Days */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-bold text-slate-900">Neighboring Days</h3>
                <div className="space-y-3">
                  {/* Previous */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <div className="text-xs font-medium text-slate-600">Previous Day</div>
                      <div className="font-bold text-slate-900">{format(subDays(selectedDate, 1), 'MMM dd, yyyy')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">${predictionResult.prev.price.toFixed(3)}</div>
                      <div className={cn("text-xs flex items-center justify-end gap-1", 
                        predictionResult.prev.price < predictionResult.current.price ? "text-emerald-600" : "text-red-600"
                      )}>
                        {predictionResult.prev.price < predictionResult.current.price ? (
                          <>Cheaper <TrendingDown className="h-3 w-3" /></>
                        ) : (
                          <>Higher <TrendingUp className="h-3 w-3" /></>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selected */}
                  <div className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-slate-50 p-4">
                    <div>
                      <div className="text-xs font-medium text-slate-600">Selected Date</div>
                      <div className="font-bold text-slate-900">{format(selectedDate, 'MMM dd, yyyy')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">${predictionResult.current.price.toFixed(3)}</div>
                    </div>
                  </div>

                  {/* Next */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    <div>
                      <div className="text-xs font-medium text-slate-600">Next Day</div>
                      <div className="font-bold text-slate-900">{format(addDays(selectedDate, 1), 'MMM dd, yyyy')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">${predictionResult.next.price.toFixed(3)}</div>
                      <div className={cn("text-xs flex items-center justify-end gap-1", 
                        predictionResult.next.price < predictionResult.current.price ? "text-emerald-600" : "text-red-600"
                      )}>
                        {predictionResult.next.price < predictionResult.current.price ? (
                          <>Cheaper <TrendingDown className="h-3 w-3" /></>
                        ) : (
                          <>Higher <TrendingUp className="h-3 w-3" /></>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Fuel Comparison */}
              <Card className="p-6">
                <h3 className="mb-4 text-lg font-bold text-slate-900">Fuel Type Comparison</h3>
                
                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="mb-2 flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <Award className="h-4 w-4" /> Cheapest
                    </div>
                    <div className="mb-1 text-sm font-semibold text-slate-900">
                      {predictionResult.fuelComparisons[0].name}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      ${predictionResult.fuelComparisons[0].price.toFixed(3)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="mb-2 flex items-center gap-1 text-xs font-bold text-red-700">
                      <AlertCircle className="h-4 w-4" /> Most Expensive
                    </div>
                    <div className="mb-1 text-sm font-semibold text-slate-900">
                      {predictionResult.fuelComparisons[predictionResult.fuelComparisons.length - 1].name}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      ${predictionResult.fuelComparisons[predictionResult.fuelComparisons.length - 1].price.toFixed(3)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="mb-3 text-xs font-medium text-slate-600">All Fuel Types on {format(selectedDate, 'MMM dd')}</div>
                  {predictionResult.fuelComparisons.map((fuel: any, index: number) => (
                    <div 
                      key={fuel.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3",
                        fuel.id === selectedFuel.id ? "border-2 border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", 
                          fuel.id === selectedFuel.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                        )}>
                          {index + 1}
                        </div>
                        <span className="font-medium text-slate-900">{fuel.name}</span>
                      </div>
                      <span className="font-bold text-slate-900">${fuel.price.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Historical Accuracy */}
              <Card className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="mb-1 text-lg font-bold text-slate-900">Historical Accuracy</h3>
                    <p className="text-xs text-slate-600">Past 7 days prediction performance</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-emerald-900">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold">87% accurate</span>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="mb-1 text-xs font-medium text-slate-600">Accurate Predictions</div>
                    <div className="text-2xl font-bold text-slate-900">7/7</div>
                    <div className="mt-1 text-[10px] text-slate-600">Within ±5c</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="mb-1 text-xs font-medium text-slate-600">Avg. Difference</div>
                    <div className="text-2xl font-bold text-slate-900">±0.017c</div>
                    <div className="mt-1 text-[10px] text-slate-600">Per prediction</div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-xs font-semibold text-slate-700">Recent Predictions</h4>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => {
                      const date = subDays(new Date(), i);
                      const isAccurate = i !== 4; // Mock one inaccurate
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-3">
                            {isAccurate ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-amber-600" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-slate-900">{format(date, 'MMM dd, yyyy')}</div>
                              <div className="text-[10px] text-slate-500">
                                Predicted: ${isAccurate ? '2.145' : '2.145'} • Actual: ${isAccurate ? '2.148' : '2.180'}
                              </div>
                            </div>
                          </div>
                          <div className={cn("text-xs font-medium", isAccurate ? "text-emerald-600" : "text-amber-600")}>
                            {isAccurate ? "Accurate" : "±3.5c"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                  <TrendingUp className="mt-0.5 h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="mb-1 text-sm font-bold text-blue-900">Building Trust Through Transparency</h4>
                    <p className="text-xs text-blue-700">
                      Our predictions are based on historical data, market trends, and machine learning models. We continuously improve our accuracy by learning from past predictions.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Price Alerts & Optimization */}
              <div className="flex flex-col gap-6">
                {/* Price Alerts Card */}
                <Card className="flex-1 p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="mb-1 text-lg font-bold text-slate-900">Price Alerts</h3>
                      <p className="text-xs text-slate-600">Get notified when prices drop</p>
                    </div>
                    <Button 
                      onClick={() => setIsAlertModalOpen(!isAlertModalOpen)}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white hover:bg-slate-800"
                    >
                      <Bell className="h-4 w-4" /> Configure Alerts
                    </Button>
                  </div>

                  {/* Inline Alert Configuration */}
                  {isAlertModalOpen && (
                    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 animate-in slide-in-from-top-2">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">Enable Alerts</span>
                          <p className="text-xs text-slate-600">Receive notifications when price drops</p>
                        </div>
                        <div 
                          className={cn("h-6 w-11 cursor-pointer rounded-full p-1 transition-colors", alertsEnabled ? "bg-slate-900" : "bg-slate-200")}
                          onClick={() => setAlertsEnabled(!alertsEnabled)}
                        >
                          <div className={cn("h-4 w-4 rounded-full bg-white transition-transform", alertsEnabled ? "translate-x-5" : "translate-x-0")} />
                        </div>
                      </div>

                      {alertsEnabled && (
                        <div className="animate-in fade-in">
                          <div className="mb-4">
                            <label className="mb-3 block text-sm font-medium text-slate-900">Alert me when price drops below</label>
                            <div className="mb-3 text-center">
                              <span className="text-3xl font-bold text-slate-900">${alertPrice.toFixed(2)}</span>
                              <span className="text-slate-600">/litre</span>
                            </div>
                            <input 
                              type="range" 
                              min="1.50" 
                              max="2.50" 
                              step="0.01" 
                              value={alertPrice}
                              onChange={(e) => setAlertPrice(Number(e.target.value))}
                              className="w-full accent-slate-900"
                            />
                            <div className="mt-2 flex justify-between text-xs text-slate-500">
                              <span>$1.50</span>
                              <span>$2.50</span>
                            </div>
                          </div>

                          <div className="mb-4">
                            <label className="mb-3 block text-sm font-medium text-slate-900">Notification Method</label>
                            <div className="grid grid-cols-2 gap-3">
                              {['email', 'sms'].map((method) => (
                                <button
                                  key={method}
                                  onClick={() => setAlertMethod(method as 'email' | 'sms')}
                                  className={cn("rounded-lg border-2 p-3 text-sm font-medium uppercase transition-all", 
                                    alertMethod === method ? "border-slate-900 bg-slate-50 text-slate-900" : "border-slate-200 bg-white text-slate-500"
                                  )}
                                >
                                  {method}
                                </button>
                              ))}
                            </div>
                          </div>

                          <Button onClick={() => setIsAlertModalOpen(false)} className="w-full gap-2 bg-slate-900 text-white hover:bg-slate-800">
                            <Check className="h-4 w-4" /> Save Preferences
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={cn("flex items-start gap-3 rounded-xl p-4", alertsEnabled ? "bg-emerald-50" : "bg-slate-50")}>
                    {alertsEnabled ? (
                      <Bell className="mt-0.5 h-5 w-5 text-emerald-600" />
                    ) : (
                      <BellOff className="mt-0.5 h-5 w-5 text-slate-600" />
                    )}
                    <div>
                      <h4 className={cn("mb-1 text-sm font-bold", alertsEnabled ? "text-emerald-900" : "text-slate-900")}>
                        {alertsEnabled ? "Alerts Active" : "Alerts Disabled"}
                      </h4>
                      <p className={cn("text-xs", alertsEnabled ? "text-emerald-700" : "text-slate-600")}>
                        {alertsEnabled 
                          ? `You'll be notified via ${alertMethod} when price drops below $${alertPrice.toFixed(2)}/litre`
                          : "Configure alerts to get notified when prices drop"
                        }
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Optimal Fill-Up Time */}
                <div className="flex-1">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Optimal Fill-Up Time</h3>
                  <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-emerald-600" />
                        <span className="font-bold text-emerald-900">Best Time to Fill Up</span>
                      </div>
                      <div className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
                        Save $4.50
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="text-xl font-bold text-emerald-900">
                        {format(addDays(selectedDate, 2), 'EEEE, MMM dd')}
                      </div>
                      <div className="text-sm font-medium text-emerald-700">Around 6:00 AM</div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <TrendingDown className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-900">Predicted price:</span>
                      <span className="text-lg font-bold text-emerald-900">
                        ${(predictionResult.current.price - 0.08).toFixed(3)}/litre
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-emerald-700">
                      Based on historical patterns, prices are typically lowest on this day and time. Savings based on a 50L tank.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-slate-600">
          <p>Predictions are estimates based on historical data and trends. Actual prices may vary.</p>
          <p className="mt-2 text-xs text-slate-400">© 2025 GuessMyGas Australia. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}