import { FuelRecord } from '../types';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell, ComposedChart 
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface Props {
  records: FuelRecord[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1e2a] border border-white/10 p-2 rounded shadow-lg">
        <p className="text-xs text-[#6b7a99] mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function TrendTab({ records }: Props) {
  if (records.length === 0) return <div className="p-4">无数据</div>;

  const validFuel = records.filter(r => r.actualFuelPer100 !== null);
  const avgFuel = validFuel.length > 0 
    ? validFuel.reduce((sum, r) => sum + r.actualFuelPer100!, 0) / validFuel.length 
    : 0;
  
  const minFuelRecord = validFuel.length > 0 
    ? validFuel.reduce((min, r) => r.actualFuelPer100! < min.actualFuelPer100! ? r : min) 
    : null;
    
  const maxFuelRecord = validFuel.length > 0 
    ? validFuel.reduce((max, r) => r.actualFuelPer100! > max.actualFuelPer100! ? r : max) 
    : null;

  const validCost = records.filter(r => r.costPerKm !== null);
  const avgCostPerKm = validCost.length > 0
    ? validCost.reduce((sum, r) => sum + r.costPerKm!, 0) / validCost.length
    : 0;

  const chartData = records.map(r => ({
    ...r,
    shortDate: format(parseISO(r.date), 'MM-dd')
  }));

  const chartDataWithKm = chartData.filter(r => r.drivenKm !== null);

  const getBarColor = (cost: number) => {
    if (cost < 250) return '#4fc3f7'; 
    if (cost < 300) return '#f5a623';
    return '#ff4757';
  };

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 overflow-x-hidden">
      
      {/* 1. 油耗趋势折线图 */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#e8ecf4] mb-4 flex items-center">
          <span className="w-1 h-3 bg-[#4fc3f7] rounded mr-2"></span>
          油耗趋势 (L/100km)
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="actualFuelPer100" name="实际油耗" stroke="#4fc3f7" strokeWidth={2} dot={{r: 3, fill: '#4fc3f7'}} connectNulls={false} />
              <Line type="monotone" dataKey="dashboardFuelPer100" name="表显油耗" stroke="#f5a623" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={true} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. 油价趋势 */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#e8ecf4] mb-4 flex items-center">
          <span className="w-1 h-3 bg-[#f5a623] rounded mr-2"></span>
          油价趋势 (元/L)
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5a623" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f5a623" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pricePerLiter" name="单价" stroke="#f5a623" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. 花费柱状图 */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#e8ecf4] mb-4 flex items-center">
          <span className="w-1 h-3 bg-[#ff4757] rounded mr-2"></span>
          每次花费 (元)
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar dataKey="totalCost" name="总金额" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.totalCost)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* 4. 里程 vs 加油量 */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#e8ecf4] mb-4 flex items-center">
          <span className="w-1 h-3 bg-[#e8ecf4] rounded mr-2"></span>
          行驶里程 vs 加油量
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartDataWithKm} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#6b7a99" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#f5a623" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
              <Bar yAxisId="left" dataKey="drivenKm" name="里程(km)" fill="rgba(79, 195, 247, 0.5)" radius={[2, 2, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="fuelLiters" name="油量(L)" stroke="#f5a623" strokeWidth={2} dot={{r: 3}} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 文字统计 */}
      <div className="bg-[#1a1e2a] card-glow rounded-xl p-4 flex flex-col gap-3">
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-[#6b7a99] text-sm">全周期平均实际油耗</span>
          <span className="text-[#e8ecf4] font-medium font-display">{avgFuel.toFixed(2)} L/100km</span>
        </div>
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-[#6b7a99] text-sm">每公里平均花费</span>
          <span className="text-[#e8ecf4] font-medium font-display">{avgCostPerKm.toFixed(2)} 元/km</span>
        </div>
        <div className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-[#6b7a99] text-sm">最省油一次</span>
          <span className="text-green-400 font-medium text-sm flex gap-2">
            <span>{minFuelRecord?.date || '-'}</span>
            <span className="font-display">{minFuelRecord ? minFuelRecord.actualFuelPer100?.toFixed(2) : '-'}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7a99] text-sm">最费油一次</span>
          <span className="text-[#ff4757] font-medium text-sm flex gap-2">
            <span>{maxFuelRecord?.date || '-'}</span>
            <span className="font-display">{maxFuelRecord ? maxFuelRecord.actualFuelPer100?.toFixed(2) : '-'}</span>
          </span>
        </div>
      </div>
      
    </div>
  );
}
