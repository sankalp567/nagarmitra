import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ArrowRight, Filter, RefreshCw, X } from 'lucide-react';
import { CivicReport, CATEGORIES, GANDHINAGAR_WARDS } from '../types';
import { getProxiedImageUrl } from '../utils/imageUtils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface CivicMapProps {
  reports: CivicReport[];
  onSelectReport: (reportId: string) => void;
}

const WARD_CENTERS: { [key: string]: [number, number] } = {
  'ward_01': [23.2280, 72.6270],
  'ward_02': [23.2100, 72.6450],
  'ward_03': [23.2000, 72.6300],
  'ward_04': [23.1850, 72.6200],
  'ward_05': [23.2350, 72.6600],
  'ward_06': [23.2050, 72.6650],
  'ward_07': [23.2500, 72.6100],
  'ward_08': [23.1950, 72.6500],
  'ward_09': [23.2600, 72.6400],
};

const getWardCivicHealthScore = (wardId: string, allReports: CivicReport[]) => {
  const wardReports = allReports.filter(r => r.geo.ward === wardId);
  const openCount = wardReports.filter(r => r.status !== 'resolved' && r.status !== 'confirmed-resolved').length;
  const resolvedCount = wardReports.filter(r => r.status === 'resolved' || r.status === 'confirmed-resolved').length;
  const escalatedCount = wardReports.filter(r => (r.escalationTier ?? 0) > 0).length;
  
  let score = 100;
  score -= openCount * 10;
  score -= escalatedCount * 5;
  score += resolvedCount * 15;
  return Math.max(0, Math.min(100, score));
};

export default function CivicMap({ reports, onSelectReport }: CivicMapProps) {
  // Interactive filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Filtered reports
  const filteredReports = reports.filter(r => {
    const catMatch = selectedCategory === 'all' || r.category === selectedCategory;
    const wardMatch = selectedWard === 'all' || r.geo.ward === selectedWard;
    const statusMatch = selectedStatus === 'all' || r.status === selectedStatus;
    return catMatch && wardMatch && statusMatch;
  });

  const getSeverityBadge = (severity: number) => {
    if (severity <= 2) return 'bg-[#f0f9f0] text-[#3a5a40] border-[#d5edd5]';
    if (severity === 3) return 'bg-[#fffbf0] text-[#b37d14] border-[#ffe8b3]';
    return 'bg-[#fff5f5] text-[#c25953] border-[#ffd5d5]';
  };

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const wardsLayerRef = useRef<L.LayerGroup | null>(null);

  // Register the global view ticket handler
  useEffect(() => {
    (window as any).onViewTicket = (id: string) => {
      onSelectReport(id);
    };
    return () => {
      delete (window as any).onViewTicket;
    };
  }, [onSelectReport]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([23.2156, 72.6369], 12);

    // Set up OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <span class="font-sans">OpenStreetMap contributors</span>',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Create Layer Groups
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    const wardsLayer = L.layerGroup().addTo(map);
    wardsLayerRef.current = wardsLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      wardsLayerRef.current = null;
    };
  }, []);

  // Update Layers (Markers & Wards) when reports or filteredReports change
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    const wardsLayer = wardsLayerRef.current;
    if (!markersLayer || !wardsLayer) return;

    // Clear existing features
    markersLayer.clearLayers();
    wardsLayer.clearLayers();

    // Draw approximate ward circle-polygons with 2km radius
    GANDHINAGAR_WARDS.forEach(ward => {
      const center = WARD_CENTERS[ward.id];
      if (!center) return;

      const score = getWardCivicHealthScore(ward.id, reports);

      let fillColor = '#22c55e';
      let fillOpacity = 0.10;
      if (score <= 40) {
        fillColor = '#ef4444';
        fillOpacity = 0.15;
      } else if (score <= 70) {
        fillColor = '#f97316';
        fillOpacity = 0.12;
      }

      const wardCircle = L.circle(center, {
        radius: 2000,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        color: fillColor,
        weight: 1.5,
        opacity: 0.35
      });

      wardCircle.bindTooltip(`
        <div class="font-sans p-1">
          <div class="font-bold text-xs text-[#1a2e1d]">${ward.name}</div>
          <div class="text-[10px] text-[#5a5a40] mt-0.5">Civic Health Score: <span class="font-bold">${score}/100</span></div>
        </div>
      `, { sticky: true, opacity: 0.95 });

      wardsLayer.addLayer(wardCircle);
    });

    // Draw circle markers for filtered reports
    filteredReports.forEach(report => {
      let color = '#ef4444';
      let radius = 12;

      if (report.severity <= 2) {
        color = '#22c55e';
        radius = 8;
      } else if (report.severity === 3) {
        color = '#f97316';
        radius = 10;
      }

      const marker = L.circleMarker([report.geo.lat, report.geo.lng], {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        fillOpacity: 0.9
      });

      let severityBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';
      if (report.severity === 3) {
        severityBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-100';
      } else if (report.severity >= 4) {
        severityBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-100';
      }

      const popupHtml = `
        <div class="p-1 font-sans text-[#1a2e1d]" style="min-width: 160px;">
          <div class="font-bold text-xs mb-1">${report.category}</div>
          <div class="text-[10px] text-[#5a5a40] mb-2">${report.geo.wardName}</div>
          <div class="flex items-center gap-1.5 mb-3">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${severityBadgeStyle}">
              Lvl ${report.severity}
            </span>
            <span class="text-[9px] font-bold text-[#8a8a7a] uppercase font-mono bg-[#fafaf5] border px-1.5 py-0.5 rounded">
              ${report.status}
            </span>
          </div>
          <button 
            onclick="window.onViewTicket('${report.id}')" 
            class="w-full bg-[#3a5a40] text-white text-[10px] font-bold py-1.5 px-2.5 rounded-lg text-center hover:bg-[#2d4632] transition cursor-pointer"
            style="display: block; border: none; outline: none; width: 100%; box-sizing: border-box;"
          >
            View Ticket →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: true
      });

      markersLayer.addLayer(marker);
    });
  }, [reports, filteredReports]);

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
        <div className="lg:col-span-8 bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl relative overflow-hidden h-[500px] flex flex-col justify-between shadow-xs">
          
          {/* Leaflet Map Div */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Fixed Legend Bottom-Left overlay */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur shadow-md px-4 py-2.5 rounded-2xl border border-[#e2e2d5] flex flex-col gap-1.5 text-[10px] font-bold text-[#5a5a40] pointer-events-auto">
            <div className="flex items-center gap-3.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                <span>Low (1-2)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                <span>Medium (3)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span>High (4-5)</span>
              </div>
            </div>
            <div className="text-[9px] text-[#8a8a7a] font-medium italic border-t border-[#e2e2d5]/60 pt-1 font-sans">
              Ward fill = Civic Health Score
            </div>
          </div>
        </div>

        {/* Right Side: High level scannable matching reports list */}
        <div className="lg:col-span-4 bg-white border border-[#e2e2d5] rounded-3xl p-4 shadow-sm h-[500px] flex flex-col">
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
                  src={getProxiedImageUrl(report.photoUrl)}
                  alt={report.category}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#e2e2d5]"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100%' height='100%' fill='%23e2e2d5'/></svg>";
                  }}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-xs text-[#1a2e1d] truncate">{report.category}</h4>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getSeverityBadge(report.severity)}`}>
                      Lvl {report.severity}
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-[#5a5a40] line-clamp-1 mt-0.5">{report.aiAnalysis?.description || ''}</p>
                  
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
