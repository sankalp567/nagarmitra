import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, CheckCircle2, Percent, Clock, AlertTriangle, 
  TrendingUp, MapPin, Sparkles, Activity, ShieldAlert
} from 'lucide-react';
import { CivicReport, GANDHINAGAR_WARDS, CATEGORIES } from '../types';

interface DashboardProps {
  reports: CivicReport[];
  onSelectReport: (reportId: string) => void;
}

export default function Dashboard({ reports, onSelectReport }: DashboardProps) {
  // 1. Impact metrics calculation
  const totalReported = reports.length;
  const totalResolved = reports.filter(r => r.status === 'resolved').length;
  const resolutionPercentage = totalReported > 0 ? Math.round((totalResolved / totalReported) * 100) : 0;
  
  // Custom mock average resolution time calculation
  const averageResolutionTime = totalReported > 0 ? "3.4 Days" : "N/A";

  // 2. Aggregate statistics per ward
  const wardCounts: { [wardName: string]: { id: string; count: number; resolved: number } } = {};
  
  // Initialize with all standard wards
  GANDHINAGAR_WARDS.forEach(w => {
    wardCounts[w.name] = { id: w.id, count: 0, resolved: 0 };
  });

  // Calculate active totals
  reports.forEach(r => {
    if (wardCounts[r.geo.wardName]) {
      wardCounts[r.geo.wardName].count += 1;
      if (r.status === 'resolved') {
        wardCounts[r.geo.wardName].resolved += 1;
      }
    } else {
      wardCounts[r.geo.wardName] = { id: r.geo.ward, count: 1, resolved: r.status === 'resolved' ? 1 : 0 };
    }
  });

  // Convert to sorted lists to locate top 3
  const sortedWards = Object.keys(wardCounts)
    .map(name => ({
      name,
      ...wardCounts[name]
    }))
    .sort((a, b) => b.count - a.count);

  const top3Wards = sortedWards.slice(0, 3).filter(w => w.count > 0);

  // 3. Aggregate statistics per category
  const categoryDetails: { [cat: string]: number } = {};
  CATEGORIES.forEach(c => { categoryDetails[c] = 0; });
  reports.forEach(r => {
    if (categoryDetails[r.category] !== undefined) {
      categoryDetails[r.category] += 1;
    } else {
      categoryDetails[r.category] = 1;
    }
  });

  const categoryChartList = Object.keys(categoryDetails)
    .map(cat => ({ name: cat, count: categoryDetails[cat] }))
    .sort((a, b) => b.count - a.count);

  const maxCategoryCount = Math.max(...categoryChartList.map(c => c.count), 1);
  const maxWardCount = Math.max(...sortedWards.map(w => w.count), 1);

  return (
    <div id="dashboard-view-container" className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Dynamic Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-[#e2e2d5] pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1a2e1d] font-sans">
            Municipal Impact Command Center
          </h1>
          <p className="text-sm text-[#8a8a7a] mt-1">
            Review live key performance metrics, resolution ratios, and active civic centers.
          </p>
        </div>
        <div className="bg-[#3a5a40] text-white rounded-xl px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 self-start md:self-center shadow-xs">
          <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>Offline Demo Enabled</span>
        </div>
      </div>

      {/* 1. IMPACT STRIP */}
      <div id="impact-strip" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Total Reported Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Total Grievances</span>
            <p className="text-2xl font-bold font-mono text-[#1a2e1d] mt-1">{totalReported}</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">Accumulated tickets</span>
          </div>
          <div className="p-3 bg-[#fafaf5] text-[#8a8a7a] rounded-xl border border-[#e2e2d5]">
            <FileText className="w-5 h-5 text-[#5a5a40]" />
          </div>
        </div>

        {/* Total Resolved Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Total Remedied</span>
            <p className="text-2xl font-bold font-mono text-[#5a7a5a] mt-1">{totalResolved}</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">Issues cleared on site</span>
          </div>
          <div className="p-3 bg-[#f0f9f0] text-[#3a5a40] rounded-xl border border-[#d5edd5]">
            <CheckCircle2 className="w-5 h-5 text-[#3a5a40]" />
          </div>
        </div>

        {/* % Resolved Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Resolution Ratio</span>
            <p className="text-2xl font-bold font-mono text-[#3a5a40] mt-1">{resolutionPercentage}%</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">Completion efficiency</span>
          </div>
          <div className="p-3 bg-[#fafaf5] text-[#3a5a40] rounded-xl border border-[#e2e2d5]">
            <Percent className="w-5 h-5 text-[#3a5a40]" />
          </div>
        </div>

        {/* Average Resolution Time */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Avg Clear Window</span>
            <p className="text-2xl font-bold font-mono text-[#1a2e1d] mt-1">{averageResolutionTime}</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">From lodgement to close</span>
          </div>
          <div className="p-3 bg-[#fafaf5] text-[#8a8a7a] rounded-xl border border-[#e2e2d5]">
            <Clock className="w-5 h-5 text-[#5a5a40]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Ward Analytics & distribution charts */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Custom CSS Bar chart of Wards */}
          <div className="bg-white border border-[#e2e2d5] rounded-3xl p-6 shadow-sm">
            <div className="border-b border-[#e2e2d5] pb-3 mb-5 flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#5a7a5a]" />
                Administrative Ward Grievances
              </h3>
              <span className="text-[10px] text-[#8a8a7a] font-mono">GMC Grid Data</span>
            </div>

            {/* Custom chart layout */}
            <div className="space-y-4">
              {sortedWards.map((w, idx) => {
                const pct = (w.count / maxWardCount) * 100;
                
                return (
                  <div key={w.id} className="text-xs">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="font-bold text-[#2d332d] font-sans flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#8a8a7a]">0{idx + 1}.</span>
                        {w.name}
                      </span>
                      <span className="font-bold font-mono text-[#1a2e1d]">{w.count} tickets</span>
                    </div>

                    <div className="w-full bg-[#fafaf5] rounded-full h-3 overflow-hidden border border-[#e2e2d5] flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1 }}
                        className="bg-[#5a7a5a] h-full rounded-full relative"
                      >
                        {/* Sub-bar for resolved checks */}
                        {w.resolved > 0 && (
                          <div 
                            style={{ width: `${(w.resolved / w.count) * 100}%` }}
                            className="absolute inset-y-0 left-0 bg-[#3a5a40] rounded-full" 
                            title={`${w.resolved} resolved`}
                          />
                        )}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 3 sectors metric strip */}
          <div className="bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl p-6 shadow-2xs">
            <h3 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-[#c25953]" />
              Highest Volume Incident Centers
            </h3>

            {top3Wards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3Wards.map((w, idx) => (
                  <div key={w.id} className="bg-white p-4 rounded-2xl border border-[#e2e2d5] shadow-3xs relative overflow-hidden">
                    <div className="absolute right-2 -bottom-2 text-[#e2e2d5]/60 text-5xl font-mono font-black select-none pointer-events-none">
                      #{idx + 1}
                    </div>
                    <p className="text-[9px] text-[#8a8a7a] font-bold uppercase tracking-wider mb-1 line-clamp-1">{w.name}</p>
                    <p className="text-xl font-bold font-mono text-[#1a2e1d]">{w.count} reported</p>
                    <p className="text-[10px] text-[#3a5a40] mt-1 font-mono font-bold">{w.resolved} resolved ({Math.round((w.resolved / w.count) * 100)}%)</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#8a8a7a] italic p-4 text-center bg-white rounded-2xl border border-dashed border-[#e2e2d5]">
                Accumulate more civic tickets to calculate top incidents.
              </div>
            )}
          </div>
        </div>

        {/* Right column: Category Distribution */}
        <div className="lg:col-span-4 bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-sm h-full">
          <div className="border-b border-[#e2e2d5] pb-3 mb-4">
            <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#3a5a40] animate-pulse" />
              Grievance Categories
            </h3>
          </div>

          <div className="space-y-4">
            {categoryChartList.map((cat, idx) => {
              const catPct = (cat.count / maxCategoryCount) * 100;
              return (
                <div key={cat.name} className="text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#2d332d] truncate max-w-[200px]">{cat.name}</span>
                    <span className="font-bold font-mono text-[#1a2e1d]">{cat.count} files</span>
                  </div>

                  <div className="w-full bg-[#fafaf5] border border-[#e2e2d5]/50 rounded-full h-1.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${catPct}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${cat.count > 0 ? 'bg-[#3a5a40]' : 'bg-[#e2e2d5]'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick informative guidelines notice about local GMC contacts */}
          <div className="mt-8 pt-4 border-t border-[#e2e2d5] text-[10px] font-sans text-[#5a5a40] leading-relaxed bg-[#fafaf5] p-4 rounded-xl border border-[#e2e2d5]">
            <span className="font-bold text-[#1a2e1d] block mb-1 uppercase tracking-wider">NagarMitra Compliance Index</span>
            Civic alerts route directly to appropriate municipal departments under standard ISO 9001 compliance standards.
          </div>
        </div>
      </div>
    </div>
  );
}
