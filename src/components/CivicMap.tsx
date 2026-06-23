import React, { useState } from 'react';
import { MapPin, Info, ArrowRight, Settings, Filter, RefreshCw, X, Sparkles } from 'lucide-react';
import { CivicReport, CATEGORIES, GANDHINAGAR_WARDS } from '../types';

interface CivicMapProps {
  reports: CivicReport[];
  onSelectReport: (reportId: string) => void;
}

// Gandhinagar bounds for mapping gps coordinate to absolute percentage on fallback 2D chart
const LAT_MIN = 23.1700;
const LAT_MAX = 23.2550;
const LNG_MIN = 72.6000;
const LNG_MAX = 72.6800;

export default function CivicMap({ reports, onSelectReport }: CivicMapProps) {
  // Check if real Google Maps API key is available
  const rawApiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  const hasValidKey = rawApiKey !== '' && !rawApiKey.includes('DummyKey');

  // Interactive filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [hoveredReport, setHoveredReport] = useState<CivicReport | null>(null);

  // Filtered reports
  const filteredReports = reports.filter(r => {
    const catMatch = selectedCategory === 'all' || r.category === selectedCategory;
    const wardMatch = selectedWard === 'all' || r.geo.ward === selectedWard;
    const statusMatch = selectedStatus === 'all' || r.status === selectedStatus;
    return catMatch && wardMatch && statusMatch;
  });

  // Calculate latitude/longitude to 2D percentages
  const getCoordsPercentage = (lat: number, lng: number) => {
    // Latitude decreases going down on screens (Y axis)
    const top = 100 - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100;
    const left = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 105; // safe expand factor
    return {
      top: Math.max(5, Math.min(95, top)),
      left: Math.max(5, Math.min(95, left))
    };
  };

  // Severe warning color mappings (Natural Tones)
  const getSeverityColor = (severity: number) => {
    if (severity <= 2) return 'bg-[#5a7a5a] ring-[#8da88d] text-white border-[#5a7a5a]'; // Leafy green
    if (severity === 3) return 'bg-[#d19c4c] ring-[#ecd3ad] text-white border-[#d19c4c]'; // Ochre/amber
    return 'bg-[#c25953] ring-[#f2c7c4] text-white border-[#c25953]'; // Terracotta red
  };

  const getSeverityBadge = (severity: number) => {
    if (severity <= 2) return 'bg-[#f0f9f0] text-[#3a5a40] border-[#d5edd5]';
    if (severity === 3) return 'bg-[#fffbf0] text-[#b37d14] border-[#ffe8b3]';
    return 'bg-[#fff5f5] text-[#c25953] border-[#ffd5d5]';
  };

  return (
    <div id="civic-map-view" className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Top Map Intro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1a2e1d] font-sans">
            Civic Issues Map
          </h1>
          <p className="text-sm text-[#8a8a7a] mt-1 max-w-lg">
            Spatially exploring reported breakdowns in Gandhinagar sector grids. Color coded by severity and filtered in real-time.
          </p>
        </div>

        {/* API key informational prompt card */}
        {!hasValidKey && (
          <div className="bg-[#fafaf5] border border-[#e2e2d5] rounded-2xl p-4 max-w-md text-xs text-[#5a5a40] flex gap-2.5 shadow-2xs">
            <Info className="w-4 h-4 text-[#3a5a40] mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold text-[#1a2e1d]">Interactive Sector Map Active.</span> Enter valid Google Maps credentials secrets to unlock live high-density satellite overlays.
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono text-[9px] bg-[#e2e2d5] px-1.5 py-0.5 rounded text-[#2d332d]">LOCAL_GEOGRID_SYSTEM</span>
                <span className="text-[#3a5a40] font-semibold">• Running local fallback map</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Control Bar */}
      <div id="filter-bar" className="bg-white border border-[#e2e2d5] rounded-2xl p-4 mb-6 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category Selector */}
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-[#8a8a7a] mb-1.5 flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#5a7a5a]" />
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-[#fafaf5] border border-[#e2e2d5] rounded-xl py-1.5 px-3 text-xs text-[#2d332d] font-semibold outline-none"
          >
            <option value="all">All Categories ({reports.length})</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Ward Selector */}
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-[#8a8a7a] mb-1.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#5a7a5a]" />
            Administrative Ward
          </label>
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="w-full bg-[#fafaf5] border border-[#e2e2d5] rounded-xl py-1.5 px-3 text-xs text-[#2d332d] font-semibold outline-none"
          >
            <option value="all">All Wards - Gandhinagar</option>
            {GANDHINAGAR_WARDS.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Status Selector */}
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-[#8a8a7a] mb-1.5 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-[#5a7a5a]" />
            Action Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-[#fafaf5] border border-[#e2e2d5] rounded-xl py-1.5 px-3 text-xs text-[#2d332d] font-semibold outline-none"
          >
            <option value="all">Any Status</option>
            <option value="open">Open (Unresolved)</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Map Interactive Container */}
        <div className="lg:col-span-8 bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl relative overflow-hidden min-h-[480px] flex flex-col justify-between shadow-xs">
          {/* Legend indicator badges overlay */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur shadow-sm px-3.5 py-2 rounded-xl border border-[#e2e2d5] flex gap-4 text-[9px] font-bold uppercase tracking-wider text-[#5a5a40]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5a7a5a]" />
              <span>Low (1-2)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#d19c4c]" />
              <span>Medium (3)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c25953]" />
              <span>High (4-5)</span>
            </div>
          </div>

          {/* Interactive city display vector map */}
          <div className="relative w-full h-[460px] bg-[#f0f0e8]">
            {/* Overlay Grid lines for architectural Gandhinagar sectors */}
            <div className="absolute inset-0 opacity-20 grid grid-cols-6 grid-rows-6 gap-0 border border-[#d1d1c1] pointer-events-none" />
            
            {/* Visual reference of Ahmedabad-Gandhinagar expressway & prominent landmarks */}
            <div className="absolute left-[30%] top-0 bottom-0 w-2 bg-[#d1d1c1]/40 -rotate-12 pointer-events-none" title="SG Highway" />
            <div className="absolute left-[70%] top-0 bottom-0.5 w-3 bg-[#e2e2d5]/60 rotate-15 pointer-events-none" title="Narmada Canal Outlet" />
            
            {/* Mock central hub representing CH-Road or Akshardham */}
            <div className="absolute left-[45%] top-[40%] text-[#5a5a40]/60 font-mono text-[9px] pointer-events-none text-center select-none leading-tight border border-[#5a5a40]/25 px-2.5 py-1 rounded bg-white/50">
              GMC CENTRAL SECTORS<br />(Akshardham Zone)
            </div>
            <div className="absolute left-[15%] top-[80%] text-[#5a5a40]/60 font-mono text-[9px] pointer-events-none select-none">
              Kudasan Sector Complex
            </div>
            <div className="absolute left-[65%] top-[15%] text-[#5a5a40]/60 font-mono text-[9px] pointer-events-none select-none">
              Infocity Tech District
            </div>

            {/* Plotted Pins */}
            {filteredReports.map((report) => {
              const { top, left } = getCoordsPercentage(report.geo.lat, report.geo.lng);
              const colorClass = getSeverityColor(report.severity);
              
              return (
                <div
                  key={report.id}
                  style={{ top: `${top}%`, left: `${left}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
                >
                  {/* Pin Circle element with ripple effect */}
                  <button
                    onClick={() => onSelectReport(report.id)}
                    onMouseEnter={() => setHoveredReport(report)}
                    onMouseLeave={() => setHoveredReport(null)}
                    className={`w-6 h-6 rounded-full border-2 ${colorClass} text-[10px] font-bold font-mono tracking-tight flex items-center justify-center cursor-pointer shadow-md transform hover:scale-125 transition duration-150 relative`}
                  >
                    <MapPin className="w-3.5 h-3.5 text-white" />

                    {/* Severity colored pulsing ripple radar ring */}
                    <span className={`absolute -inset-1.5 rounded-full border border-current opacity-30 animate-pulse pointer-events-none`} />
                  </button>

                  {/* Hover mini-card card overlay */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white border border-[#e2e2d5] text-[#2d332d] rounded-2xl p-3.5 w-56 opacity-0 pointer-events-none group-hover:opacity-100 transition duration-150 shadow-md z-30">
                    <div className="flex items-center justify-between gap-2 border-b border-[#e2e2d5] pb-1.5 mb-2">
                      <span className="font-extrabold text-[9px] uppercase tracking-wider text-[#5a7a5a]">{report.category}</span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#fafaf5] text-[#2d332d] border border-[#e2e2d5]">★ {report.severity}/5</span>
                    </div>
                    <p className="text-[10px] text-[#2d332d] line-clamp-2 leading-relaxed">{report.aiAnalysis.description}</p>
                    <p className="text-[9px] text-[#8a8a7a] font-mono mt-2 flex items-center gap-1 border-t border-[#e2e2d5]/60 pt-1.5 font-semibold">
                      <MapPin className="w-3 h-3 text-[#3a5a40]" />
                      <span className="truncate">{report.geo.wardName}</span>
                    </p>
                    <div className="text-[9px] text-[#3a5a40] font-bold mt-2.5 flex items-center justify-between border-t border-[#e2e2d5]/60 pt-1.5 uppercase tracking-wider">
                      <span>Click to inspect</span>
                      <ArrowRight className="w-3 h-3 text-[#3a5a40]" />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Zero reports matching filters state */}
            {filteredReports.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#fafaf5]/90 z-10 animate-fadeIn">
                <MapPin className="w-8 h-8 text-[#8a8a7a] animate-bounce mb-2" />
                <h4 className="text-sm font-bold text-[#1a2e1d] uppercase tracking-wider">Sector Map Empty</h4>
                <p className="text-xs text-[#8a8a7a] mt-1 max-w-sm">No active grievances fit your customized Search parameters. Modify the filter checkboxes above.</p>
              </div>
            )}
          </div>

          {/* Quick interactive note */}
          <div className="bg-[#fafaf5] border-t border-[#e2e2d5] p-3 px-4 text-[9px] font-bold uppercase tracking-wider text-[#8a8a7a] flex items-center justify-between">
            <span>Gandhinagar Bounds: 23°10'N - 72°38'E</span>
            <span>Plotted: {filteredReports.length} Active Records</span>
          </div>
        </div>

        {/* Right Side: High level scannable matching reports list */}
        <div className="lg:col-span-4 bg-white border border-[#e2e2d5] rounded-3xl p-4 shadow-sm h-[480px] flex flex-col">
          <div className="border-b border-[#e2e2d5] pb-3 mb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider">Filtered Grievances ({filteredReports.length})</h3>
            <span className="text-[10px] bg-[#fafaf5] border border-[#e2e2d5] font-bold px-2.5 py-0.5 rounded-lg text-[#5a5a40] font-mono tracking-wide">ACTIVE</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => onSelectReport(report.id)}
                className="group border border-[#e2e2d5] hover:border-[#5a7a5a] bg-[#fafaf5]/40 hover:bg-white p-3 rounded-2xl cursor-pointer transition duration-150 shadow-2xs flex gap-3"
              >
                {/* Micro thumbnail */}
                <img
                  src={report.photoUrl}
                  alt={report.category}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#e2e2d5]"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-[#1a2e1d] truncate">{report.category}</h4>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getSeverityBadge(report.severity)}`}>
                      Lvl {report.severity}
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-[#5a5a40] line-clamp-1 mt-0.5">{report.aiAnalysis.description}</p>
                  
                  <div className="flex items-center justify-between mt-2.5 text-[9px] font-bold uppercase tracking-wider">
                    <span className="text-[#8a8a7a] font-mono">{report.geo.wardName}</span>
                    <span className="text-[#3a5a40] group-hover:underline flex items-center gap-0.5">
                      Verify Ticket
                      <ArrowRight className="w-2.5 h-2.5 text-[#3a5a40]" />
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filteredReports.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-[#fafaf5] rounded-2xl border border-[#e2e2d5]">
                <X className="w-6 h-6 text-[#8a8a7a] mb-2" />
                <span className="text-xs text-[#8a8a7a] font-bold uppercase tracking-wider">No Matches Found</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
