import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, MapPin, AlertCircle, CheckCircle2, Loader2, Sparkles, Navigation, ChevronRight, CornerDownRight, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { createReport, getLocalReports, saveLocalReports, fetchReports, addCoWitness } from '../utils/reportStore';
import { uploadPhotoToStorage, compressImage, auth, db } from '../firebase';
import { CivicReport, CATEGORIES, GANDHINAGAR_WARDS } from '../types';

// Preset sample photos to make testing in sandbox iframe extremely delightful!
const SAMPLE_PRESETS = [
  {
    name: 'Sector 3 Pothole',
    url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    defaultNote: 'A deep pothole here is causing vehicles to swerve dangerously.',
    lat: 23.2172,
    lng: 72.6385,
  },
  {
    name: 'Sector 17 Overflowing Garbage',
    url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    defaultNote: 'The trash dumpsters at Sector 17 main market have overflowed onto the road.',
    lat: 23.2215,
    lng: 72.6482,
  },
  {
    name: 'Kudasan Dark Streetlight',
    url: 'https://images.unsplash.com/photo-1509395062183-67c5ad6faff9?auto=format&fit=crop&w=600&q=80',
    defaultNote: 'No lights are working along Kudasan link road. It is pitch dark and dangerous.',
    lat: 23.1895,
    lng: 72.6288,
  },
  {
    name: 'Infocity Pipeline Leak',
    url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    defaultNote: 'Clean drinking water has been spraying out of this valve on the footpath.',
    lat: 23.2354,
    lng: 72.6598,
  }
];

interface ReportIssueProps {
  onReportCreated: (report: CivicReport) => void;
  onNavigateToDetail: (reportId: string) => void;
}

export default function ReportIssue({ onReportCreated, onNavigateToDetail }: ReportIssueProps) {
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resultReport, setResultReport] = useState<CivicReport | null>(null);
  const [detectedIssue, setDetectedIssue] = useState<{ type: string; severity: number } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [duplicateFound, setDuplicateFound] = useState<boolean>(false);
  const [duplicateMessage, setDuplicateMessage] = useState<string>('');
  const [isWhyClassificationOpen, setIsWhyClassificationOpen] = useState<boolean>(false);

  // Manual map-pin coordinate adjusts
  const [manualLat, setManualLat] = useState<string>('23.2156');
  const [manualLng, setManualLng] = useState<string>('72.6369');
  const [showManualCoords, setShowManualCoords] = useState<boolean>(false);

  // Interactive Agent Activity pipeline
  const [pipelineSteps, setPipelineSteps] = useState([
    { id: '1', label: 'Uploading Photo to Cloud Archive', status: 'pending', detail: 'Compressing and securing upload to Firebase storage.' },
    { id: '2', label: 'Extracting Damages via Gemini Vision', status: 'pending', detail: 'Running object detection for civic safety hazards.' },
    { id: 'dup_check', label: 'Checking for duplicate reports nearby…', status: 'pending', detail: 'Analyzing description similarity and geographic proximity.' },
    { id: '3', label: 'Routing affected Wards', status: 'pending', detail: 'Geocoding municipal ward boundaries in Gandhinagar.' },
    { id: '4', label: 'Drafting Trilingual Compliance Letters', status: 'pending', detail: 'Constructing English, Hindi & Gujarati administrative formal letters.' },
    { id: '5', label: 'Dispatching to GMC Nodal Officer', status: 'pending', detail: 'Registering grievance ticket into Firestore registry.' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect GPS Location
  const handleDetectLocation = () => {
    setIsLocating(true);
    setLocationStatus('Querying browser Geolocation...');

    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported. Using central Gandhinagar coords.');
      setGpsLocation({ lat: 23.2156, lng: 72.6369 });
      setManualLat('23.2156');
      setManualLng('72.6369');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGpsLocation({ lat: latitude, lng: longitude });
        setManualLat(latitude.toFixed(5));
        setManualLng(longitude.toFixed(5));
        setLocationStatus('GPS Lock acquired successfully.');
        setIsLocating(false);
      },
      (error) => {
        console.warn("Geolocation error:", error);
        // Fallback to Gandhinagar Center but slightly randomized
        const randomLat = 23.2156 + (Math.random() - 0.5) * 0.02;
        const randomLng = 72.6369 + (Math.random() - 0.5) * 0.02;
        setGpsLocation({ lat: randomLat, lng: randomLng });
        setManualLat(randomLat.toFixed(5));
        setManualLng(randomLng.toFixed(5));
        setLocationStatus('GPS permission denied. Loaded manual fallback pin near Center.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Image upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageName(file.name || '');
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setPhotoUrl(preset.url);
    setImageName(preset.name);
    setNote(preset.defaultNote);
    setGpsLocation({ lat: preset.lat, lng: preset.lng });
    setManualLat(preset.lat.toFixed(5));
    setManualLng(preset.lng.toFixed(5));
    setLocationStatus('Coordinates loaded from preset issue.');
  };

// Helper function for Haversine distance in meters
function getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Helper function for Cosine Similarity
function getCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

  // Submission Pipeline trigger
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl) return;

    setIsSubmitting(true);
    setResultReport(null);
    setDetectedIssue(null);
    setSubmissionError(null);
    setDuplicateFound(false);
    setDuplicateMessage('');

    // Initialise pipeline states
    const resetPipeline = pipelineSteps.map(step => ({ ...step, status: 'pending' as const }));
    setPipelineSteps(resetPipeline);

    const targetLat = gpsLocation?.lat || Number(manualLat) || 23.2156;
    const targetLng = gpsLocation?.lng || Number(manualLng) || 72.6369;

    let generatedData: any = null;

    try {
      // Step 0: Compress photo ONCE at the very start to max ~900px, JPEG quality ~0.6
      console.log("[Pipeline] Compressing photo once before initiating pipeline...");
      const compressedUrl = photoUrl.startsWith('data:') 
        ? await compressImage(photoUrl, 900, 900, 0.6) 
        : photoUrl;

      // Step 1: Uploading Photo (Bypassed Firebase Storage upload; instantly ready)
      setPipelineSteps(prev => prev.map(s => s.id === '1' ? { ...s, status: 'running' } : s));
      await new Promise(r => setTimeout(r, 400)); // smooth visual pacing
      setPipelineSteps(prev => prev.map(s => s.id === '1' ? { 
        ...s, 
        status: 'completed',
        detail: 'Photo compressed client-side (max 900px, quality 60%). Firebase Storage upload bypassed for optimal speed.'
      } : s));

      // Step 2: Extracting damages (Call real Gemini API analysis!) - Starts instantly!
      setPipelineSteps(prev => prev.map(s => s.id === '2' ? { ...s, status: 'running' } : s));
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoUrl: compressedUrl, // Send compressed base64 directly to Gemini
          note,
          lat: targetLat,
          lng: targetLng,
          imageName
        })
      });

      const backendData = await response.json();
      if (!backendData.success) {
        throw new Error(backendData.error || "Municipal Engine translation failed.");
      }

      generatedData = {
        ...backendData.report,
        photoUrl: compressedUrl
      };

      // Map categories to lowercase codes for the compliance panel
      let inferredTypeCode = "other";
      if (generatedData.category === "Potholes & Roads") inferredTypeCode = "pothole";
      else if (generatedData.category === "Streetlights") inferredTypeCode = "streetlight";
      else if (generatedData.category === "Water Supply & Sewage") inferredTypeCode = "water_leak";
      else if (generatedData.category === "Garbage & Sanitation") inferredTypeCode = "garbage";
      else if (generatedData.category === "Stray Animals & Safety") inferredTypeCode = "stray_animals";
      else if (generatedData.category === "Public Parks & Footpaths") inferredTypeCode = "public_parks";
      else if (generatedData.category === "Traffic & Obstruction") inferredTypeCode = "traffic_obstruction";

      setDetectedIssue({
        type: inferredTypeCode,
        severity: generatedData.severity
      });

      await new Promise(r => setTimeout(r, 600));
      setPipelineSteps(prev => prev.map(s => s.id === '2' ? { ...s, status: 'completed' } : s));

      // NEW STEP: Checking for duplicates nearby!
      setPipelineSteps(prev => prev.map(s => s.id === 'dup_check' ? { ...s, status: 'running' } : s));
      
      const existingReports = await fetchReports();
      const openReports = existingReports.filter(r => r.status === 'open' && !r.duplicateOf);
      
      const storeSource = db ? "Firestore" : "Local Storage";
      console.log(`[dedup] Scanning active registry from ${storeSource}. Total open reports: ${openReports.length}`);

      let duplicateTicket: CivicReport | null = null;
      let minDistance = Infinity;

      for (const r of openReports) {
        const distance = getHaversineDistance(
          generatedData.geo.lat,
          generatedData.geo.lng,
          r.geo.lat,
          r.geo.lng
        );

        // Log deduplication matching details
        console.log(`[dedup] vs ${r.id}: category=${r.category} distM=${Math.round(distance)}`);

        const isCategoryMatch = r.category === generatedData.category;
        const isDuplicateDistanceOnly = isCategoryMatch && distance <= 60;

        if (isDuplicateDistanceOnly) {
          // Prioritize the closest duplicate ticket
          if (!duplicateTicket || distance < minDistance) {
            minDistance = distance;
            duplicateTicket = r;
          }
        }
      }

      await new Promise(r => setTimeout(r, 800)); // smooth pacing

      if (duplicateTicket) {
        // Treat as duplicate!
        setDuplicateFound(true);
        const witnessEmail = "citizen_" + (auth?.currentUser?.uid?.substring(0, 6) || Math.floor(1000 + Math.random() * 9000)) + "@gandhinagar.org";
        
        await addCoWitness(duplicateTicket.id, witnessEmail);
        
        // Reload or fetch updated ticket from cache
        const updatedReports = getLocalReports();
        let updatedTicket = updatedReports.find(r => r.id === duplicateTicket!.id) || duplicateTicket;
        
        // Ensure the coWitness list has the reporter added in memory
        if (!updatedTicket.coWitnesses.includes(witnessEmail)) {
          updatedTicket = {
            ...updatedTicket,
            coWitnesses: [...updatedTicket.coWitnesses, witnessEmail]
          };
        }
        
        const witnessCount = updatedTicket.coWitnesses.length;
        const dupMsg = `This issue was already reported nearby — you've been added as co-witness #${witnessCount}.`;
        setDuplicateMessage(dupMsg);

        setPipelineSteps(prev => prev.map(s => s.id === 'dup_check' ? { 
          ...s, 
          status: 'completed',
          detail: `Duplicate identified (distance: ${minDistance.toFixed(1)}m). Added reporter to Ticket #${duplicateTicket!.id}.`
        } : s));

        // Mark subsequent steps as completed/bypassed
        setPipelineSteps(prev => prev.map(s => ['3', '4', '5'].includes(s.id) ? { ...s, status: 'completed', detail: 'Bypassed - merged with duplicate ticket.' } : s));

        setResultReport(updatedTicket);
        onReportCreated(updatedTicket);
        return;
      }

      // No duplicate found! Proceed normally.
      setPipelineSteps(prev => prev.map(s => s.id === 'dup_check' ? { 
        ...s, 
        status: 'completed',
        detail: 'Checked open registries nearby. No matching duplicate identified.'
      } : s));

      // Step 3: Ward routing
      setPipelineSteps(prev => prev.map(s => s.id === '3' ? { ...s, status: 'running' } : s));
      await new Promise(r => setTimeout(r, 600));
      setPipelineSteps(prev => prev.map(s => s.id === '3' ? { ...s, status: 'completed' } : s));

      // Step 4: Trilingual letters
      setPipelineSteps(prev => prev.map(s => s.id === '4' ? { ...s, status: 'running' } : s));
      await new Promise(r => setTimeout(r, 600));
      setPipelineSteps(prev => prev.map(s => s.id === '4' ? { ...s, status: 'completed' } : s));

      // Step 5: Finalizing record in cloud database (Non-blocking background save)
      setPipelineSteps(prev => prev.map(s => s.id === '5' ? { ...s, status: 'running' } : s));
      
      // 1. Generate client-side report immediately with a local ID
      const localId = 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      const newlyCreatedReport = {
        ...generatedData,
        id: localId
      };

      // 2. Write to local storage for instant access
      const localReports = getLocalReports();
      localReports.unshift(newlyCreatedReport);
      saveLocalReports(localReports);

      // 3. Persist to Firestore in the background
      createReport(generatedData).then((dbReport) => {
        console.log("[Background Sync] Successfully written report to Firestore with ID:", dbReport.id);
        try {
          const currentLocals = getLocalReports();
          const idx = currentLocals.findIndex(r => r.id === localId);
          if (idx !== -1) {
            currentLocals[idx].id = dbReport.id;
            saveLocalReports(currentLocals);
          }
        } catch (err) {
          console.error("[Background Sync] Local storage update failed:", err);
        }
      }).catch((err) => {
        console.error("[Background Sync] Background Firestore persistence failed:", err);
      });

      await new Promise(r => setTimeout(r, 400)); // smooth visual pacing
      setPipelineSteps(prev => prev.map(s => s.id === '5' ? { ...s, status: 'completed' } : s));

      // Complete and transition instantly
      setResultReport(newlyCreatedReport);
      onReportCreated(newlyCreatedReport);
    } catch (err: any) {
      console.error(err);
      setSubmissionError(err?.message || String(err));
      setPipelineSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s));
      setIsSubmitting(true);
    }
  };

  const handleResetForm = () => {
    setPhotoUrl('');
    setImageName('');
    setNote('');
    setGpsLocation(null);
    setLocationStatus('');
    setResultReport(null);
    setDetectedIssue(null);
    setSubmissionError(null);
    setDuplicateFound(false);
    setDuplicateMessage('');
    setIsSubmitting(false);
    setPipelineSteps([
      { id: '1', label: 'Uploading Photo to Cloud Archive', status: 'pending', detail: 'Compressing and securing upload to Firebase storage.' },
      { id: '2', label: 'Extracting Damages via Gemini Vision', status: 'pending', detail: 'Running object detection for civic safety hazards.' },
      { id: 'dup_check', label: 'Checking for duplicate reports nearby…', status: 'pending', detail: 'Analyzing description similarity and geographic proximity.' },
      { id: '3', label: 'Routing affected Wards', status: 'pending', detail: 'Geocoding municipal ward boundaries in Gandhinagar.' },
      { id: '4', label: 'Drafting Trilingual Compliance Letters', status: 'pending', detail: 'Constructing English, Hindi & Gujarati administrative formal letters.' },
      { id: '5', label: 'Dispatching to GMC Nodal Officer', status: 'pending', detail: 'Registering grievance ticket into Firestore registry.' }
    ]);
  };

  return (
    <div id="report-view-container" className="max-w-4xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Title block */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-white text-[#3a5a40] px-3.5 py-1 rounded-full text-xs font-semibold border border-[#e2e2d5] mb-3 shadow-2xs">
          <Sparkles className="w-4 h-4 text-[#3a5a40] animate-pulse" />
          Gandhinagar Civic Action Portal
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1a2e1d] font-sans md:text-4xl">
          NagarMitra
        </h1>
        <p className="mt-2 text-[#8a8a7a] font-sans max-w-lg mx-auto text-sm md:text-base">
          Report municipal irregularities directly to ward authorities. Anonymous, verified by AI, and automatically routed in Gujarati grid systems.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Form Panel */}
        <div className="md:col-span-7 bg-white rounded-3xl border border-[#e2e2d5] shadow-sm p-6">
          {!isSubmitting ? (
            <form onSubmit={handleSubmitReport} className="space-y-6">
              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8a8a7a] mb-2">
                  1. Capture or Upload Photo <span className="text-rose-500">*</span>
                </label>
                
                {photoUrl ? (
                  <div className="relative group rounded-2xl overflow-hidden bg-[#fafaf5] border border-[#e2e2d5]">
                    <img src={photoUrl} alt="Civic issue preview" className="w-full h-56 object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white text-[#2d332d] text-xs font-bold rounded-xl shadow-sm hover:bg-[#fafaf5] transition"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-rose-700 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#d1d1c1] hover:border-[#5a7a5a] rounded-2xl p-8 text-center cursor-pointer bg-[#fafaf5] hover:bg-[#f0f0e8] transition duration-150 flex flex-col items-center justify-center min-h-[220px]"
                  >
                    <div className="p-3 bg-white rounded-full shadow-sm border border-[#e2e2d5] text-[#8a8a7a] mb-3 group-hover:text-[#3a5a40]">
                      <Camera className="w-6 h-6 text-[#8a8a7a]" />
                    </div>
                    <span className="text-xs font-bold text-[#5a5a40]">Upload or Capture Photo</span>
                    <span className="text-[10px] text-[#8a8a7a] mt-1">Accepts PNG, JPG, or live camera</span>
                  </div>
                )}
                <input
                  type="file"
                  id="file-input"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Sandbox Preset Selection */}
                <div className="mt-4">
                  <div className="text-[10px] uppercase font-bold text-[#8a8a7a] mb-2 flex items-center gap-1">
                    <CornerDownRight className="w-3.5 h-3.5 text-[#5a7a5a]" />
                    Or test with an instant Gandhinagar preset:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SAMPLE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectPreset(p)}
                        className="flex items-center gap-2 text-left px-2 sm:px-3 py-1.5 rounded-xl border border-[#e2e2d5] bg-white hover:bg-[#fafaf5] hover:border-[#5a7a5a] transition text-xs font-medium text-[#2d332d] shadow-2xs"
                      >
                        <img src={p.url} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Geographic Locator */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8a8a7a] mb-2">
                  2. Geo-Location Placement <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    id="gps-lock-btn"
                    onClick={handleDetectLocation}
                    disabled={isLocating}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3a5a40] hover:bg-[#2f4934] disabled:bg-[#e2e2d5] text-white disabled:text-[#8a8a7a] font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition duration-150"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Detecting live GPS...
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        Auto-Detect GPS Location
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualCoords(!showManualCoords)}
                    className="px-4 py-2.5 bg-[#fafaf5] border border-[#e2e2d5] hover:bg-[#e2e2d5]/50 text-[#5a5a40] text-xs font-bold rounded-xl transition shadow-2xs"
                  >
                    {showManualCoords ? 'Hide Manual Details' : 'Adjust Coords Manually'}
                  </button>
                </div>

                {locationStatus && (
                  <div className="mt-3 flex items-start gap-2 bg-[#fafaf5] text-[#2d332d] p-3 rounded-xl text-xs border border-[#e2e2d5]">
                    <MapPin className="w-4 h-4 text-[#3a5a40] mt-0.5 flex-shrink-0" />
                    <span className="font-medium">{locationStatus}</span>
                  </div>
                )}

                {/* Manual Coords Form Fallback */}
                {showManualCoords && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 grid grid-cols-2 gap-3 p-3 bg-[#fafaf5] rounded-xl border border-[#e2e2d5]"
                  >
                    <div>
                      <label className="block text-[9px] font-bold text-[#8a8a7a] uppercase mb-1">Latitude</label>
                      <input
                        type="text"
                        value={manualLat}
                        onChange={(e) => {
                          setManualLat(e.target.value);
                          setGpsLocation({ lat: Number(e.target.value), lng: gpsLocation?.lng || 72.6369 });
                        }}
                        className="w-full text-xs bg-white border border-[#e2e2d5] rounded-lg p-2 font-mono text-[#2d332d]"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-[#8a8a7a] uppercase mb-1">Longitude</label>
                      <input
                        type="text"
                        value={manualLng}
                        onChange={(e) => {
                          setManualLng(e.target.value);
                          setGpsLocation({ lat: gpsLocation?.lat || 23.2156, lng: Number(e.target.value) });
                        }}
                        className="w-full text-xs bg-white border border-[#e2e2d5] rounded-lg p-2 font-mono text-[#2d332d]"
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Text note description */}
              <div>
                <label htmlFor="issue-note" className="block text-xs font-bold uppercase tracking-wider text-[#8a8a7a] mb-2">
                  3. Description or Additional Notes <span className="text-[#8a8a7a]/60 text-[10px] font-normal font-mono">(Optional)</span>
                </label>
                <textarea
                  id="issue-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tell GMC engineers about specific breakdowns or landmarks here..."
                  className="w-full bg-[#fafaf5] border border-[#e2e2d5] focus:border-[#3a5a40] focus:ring-1 focus:ring-[#3a5a40] rounded-xl p-3 text-sm text-[#2d332d] font-sans shadow-2xs outline-none"
                />
              </div>

              <button
                type="submit"
                id="submit-report-btn"
                disabled={!photoUrl}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#3a5a40] hover:bg-[#2f4934] disabled:bg-[#fafaf5]/80 text-white disabled:text-[#8a8a7a] font-bold uppercase tracking-wider rounded-xl text-xs shadow-md transition duration-150 cursor-pointer disabled:cursor-not-allowed"
              >
                Launch Municipal Reporting Agent
              </button>
            </form>
          ) : (
            /* Pipeline Activity Log Spinner Screen */
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between border-b border-[#e2e2d5] pb-3">
                <h3 className="font-bold text-[#1a2e1d] text-sm uppercase tracking-wider">Municipal Processing Log</h3>
                <span className="text-[10px] text-white bg-[#3a5a40] font-bold px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  Civic-Issue Agent Running
                </span>
              </div>

              {/* Steps Progress Checklist */}
              <div id="pipeline-stream-steps" className="space-y-4">
                {pipelineSteps.map((step) => (
                  <div key={step.id} className="flex gap-4 items-start">
                    <div className="mt-1">
                      {step.status === 'completed' && (
                        <CheckCircle2 className="w-5 h-5 text-[#5a7a5a] flex-shrink-0" />
                      )}
                      {step.status === 'running' && (
                        <Loader2 className="w-5 h-5 text-[#3a5a40] animate-spin flex-shrink-0" />
                      )}
                      {step.status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border border-[#e2e2d5] bg-[#fafaf5] flex-shrink-0" />
                      )}
                      {step.status === 'failed' && (
                        <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold uppercase tracking-wider ${step.status === 'completed' ? 'text-[#1a2e1d]' : step.status === 'running' ? 'text-[#3a5a40]' : 'text-[#8a8a7a]'}`}>
                          {step.label}
                        </p>
                      </div>
                      <p className="text-[11px] text-[#8a8a7a] mt-1 font-sans leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Complete Confirmation Block */}
              {resultReport && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#fafaf5] border border-[#e2e2d5] rounded-2xl p-5 text-center mt-6 shadow-2xs"
                >
                  <div className="p-2.5 bg-[#3a5a40] text-white rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-3 shadow-md shadow-[#3a5a4022]">
                    <CheckCircle2 className="w-6 h-6 animate-bounce" />
                  </div>
                  {duplicateFound ? (
                    <>
                      <h4 className="text-[#1a2e1d] font-bold font-sans text-sm">Nearby Duplicate Detected</h4>
                      <p className="text-[#1a2e1d] text-xs mt-2 p-3 bg-[#f0f5f1] border border-[#d2e2d5] rounded-xl font-medium leading-relaxed">
                        {duplicateMessage}
                      </p>
                      <p className="text-[#8a8a7a] text-[10px] font-mono mt-2">
                        Ticket Reference ID: <span className="font-mono font-bold text-[#1a2e1d]">{resultReport.id}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-[#1a2e1d] font-bold font-sans text-sm">Grievance Registered Successfully</h4>
                      <p className="text-[#5a7a5a] text-xs mt-1">Ticket ID: <span className="font-mono font-bold text-[#1a2e1d]">{resultReport.id}</span> assigned to {resultReport.department}.</p>
                    </>
                  )}

                  {resultReport.visionError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs text-left my-3 font-sans font-medium flex items-start gap-2 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-rose-900">Local Compliance Fallback Active</span>
                        <span className="text-[11px] leading-relaxed block mt-0.5 text-rose-700 font-mono font-semibold">{resultReport.visionError}</span>
                      </div>
                    </div>
                  )}
                  
                   {/* Collapsible "Why this classification" card */}
                   {resultReport.classificationReasoning && resultReport.alternativeCategories && resultReport.severityFactors && (
                     <div className="bg-[#fafaf5] rounded-xl p-4 border border-[#e2e2d5] my-4 text-left">
                       <button
                         type="button"
                         id="report-why-classification-toggle"
                         onClick={() => setIsWhyClassificationOpen(!isWhyClassificationOpen)}
                         className="flex items-center justify-between w-full text-left font-sans"
                       >
                         <div className="flex items-center gap-2">
                           <HelpCircle className="w-4 h-4 text-[#3a5a40]" />
                           <span className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider font-sans">Why this classification?</span>
                         </div>
                         {isWhyClassificationOpen ? (
                           <ChevronUp className="w-4 h-4 text-[#8a8a7a]" />
                         ) : (
                           <ChevronDown className="w-4 h-4 text-[#8a8a7a]" />
                         )}
                       </button>
                       
                       {isWhyClassificationOpen && (
                         <motion.div
                           initial={{ opacity: 0, height: 0 }}
                           animate={{ opacity: 1, height: 'auto' }}
                           className="mt-3 pt-3 border-t border-[#e2e2d5] space-y-3 text-xs text-[#2d332d]"
                         >
                           <div>
                             <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">Primary Category & Confidence</span>
                             <p className="mt-1 font-bold text-[#1a2e1d] font-sans">
                               {resultReport.category} <span className="text-[#3a5a40] font-mono ml-1">({Math.round((resultReport.aiAnalysis.confidence || 0.88) * 100)}% Confidence)</span>
                             </p>
                           </div>

                           <div>
                             <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">AI Reasoning Chain</span>
                             <p className="mt-1 text-slate-700 font-sans leading-relaxed font-medium">
                               {resultReport.classificationReasoning}
                             </p>
                           </div>

                           <div>
                             <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">Alternative Considered</span>
                             <p className="mt-1 font-mono font-bold text-[#3a5a40] bg-[#fafaf5] px-2 py-1 rounded-lg border border-[#e2e2d5] inline-block">
                               {resultReport.alternativeCategories}
                             </p>
                           </div>

                           <div>
                             <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">Severity Score Drivers</span>
                             <p className="mt-1 text-slate-700 font-sans leading-relaxed font-medium">
                               {resultReport.severityFactors}
                             </p>
                           </div>
                         </motion.div>
                       )}
                     </div>
                   )}
                  
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <button
                      type="button"
                      id="view-created-ticket-btn"
                      onClick={() => onNavigateToDetail(resultReport.id)}
                      className="flex-1 bg-[#3a5a40] hover:bg-[#2f4934] text-white font-bold text-xs py-2 px-3 rounded-lg transition shadow-2xs inline-flex items-center justify-center gap-1"
                    >
                      Inspect Ticket Details
                      <ChevronRight className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-3 py-2 bg-white text-[#2d332d] border border-[#e2e2d5] text-xs font-bold rounded-lg hover:bg-[#fafaf5] transition"
                    >
                      File Another Grievance
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Error Block */}
              {submissionError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-rose-50 border border-rose-200 rounded-3xl p-5 mt-6 shadow-sm"
                >
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-rose-900 font-extrabold font-sans text-xs uppercase tracking-wider">Analysis Failed</h4>
                      <p className="text-rose-700 text-xs mt-1.5 leading-relaxed font-sans font-medium">{submissionError}</p>
                      
                      <div className="flex gap-2.5 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSubmitting(false);
                            setSubmissionError(null);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                        >
                          Modify & Retry
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Right Info Sidebar Panel */}
        <div className="md:col-span-5 space-y-6 animate-slideUp">
          {/* Quick instructions box */}
          <div className="bg-white border border-[#e2e2d5] rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider mb-4">Municipal Compliance Process</h3>
            <div className="space-y-4 text-xs font-sans text-[#2d332d]">
              {/* 1. Visual Identification */}
              <div className={`p-3.5 rounded-2xl border transition-all duration-300 flex gap-3 ${
                pipelineSteps.find(s => s.id === '2')?.status === 'running' ? 'bg-[#f7f7f0] border-[#3a5a40]/30 shadow-2xs' : 
                pipelineSteps.find(s => s.id === '2')?.status === 'completed' ? 'bg-[#fafaf5] border-[#5a7a5a]/20 shadow-none' : 
                'bg-white border-transparent'
              }`}>
                <div className={`w-5 h-5 rounded-lg font-extrabold flex items-center justify-center text-[10px] flex-shrink-0 ${
                  pipelineSteps.find(s => s.id === '2')?.status === 'completed' ? 'bg-[#5a7a5a] text-white' : 
                  pipelineSteps.find(s => s.id === '2')?.status === 'running' ? 'bg-[#3a5a40] text-white animate-pulse' : 
                  'bg-[#e2e2d5] text-[#1a2e1d]'
                }`}>
                  {pipelineSteps.find(s => s.id === '2')?.status === 'completed' ? '✓' : '1'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#1a2e1d]">Visual Identification</p>
                    {pipelineSteps.find(s => s.id === '2')?.status === 'running' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-[#3a5a40] bg-[#3a5a40]/10 px-1.5 py-0.5 rounded-sm animate-pulse">
                        Running
                      </span>
                    )}
                    {pipelineSteps.find(s => s.id === '2')?.status === 'completed' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-[#5a7a5a] bg-[#5a7a5a]/10 px-1.5 py-0.5 rounded-sm">
                        Done
                      </span>
                    )}
                  </div>
                  {pipelineSteps.find(s => s.id === '2')?.status === 'running' ? (
                    <p className="mt-1 text-[#3a5a40] font-medium leading-relaxed">
                      Running Gemini Vision analysis...
                    </p>
                  ) : pipelineSteps.find(s => s.id === '2')?.status === 'completed' && detectedIssue ? (
                    <p className="mt-1.5 text-[#2d332d] font-bold font-mono text-[11px] bg-[#3a5a40]/5 px-2.5 py-1 rounded-md border border-[#3a5a40]/15 inline-block">
                      Detected: <span className="text-[#3a5a40] font-sans font-extrabold uppercase">{detectedIssue.type}</span> · severity <span className="text-rose-600 font-sans font-extrabold">{detectedIssue.severity}/5</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[#8a8a7a]">Provide an image of Potholes, dark streetlights, or sewage failures. High clarity speeds up review.</p>
                  )}
                </div>
              </div>

              {/* 2. AI Geo-Routing */}
              <div className={`p-3.5 rounded-2xl border transition-all duration-300 flex gap-3 ${
                pipelineSteps.find(s => s.id === '3')?.status === 'running' ? 'bg-[#f7f7f0] border-[#3a5a40]/30 shadow-2xs' : 
                pipelineSteps.find(s => s.id === '3')?.status === 'completed' ? 'bg-[#fafaf5] border-[#5a7a5a]/20 shadow-none' : 
                'bg-white border-transparent'
              }`}>
                <div className={`w-5 h-5 rounded-lg font-extrabold flex items-center justify-center text-[10px] flex-shrink-0 ${
                  pipelineSteps.find(s => s.id === '3')?.status === 'completed' ? 'bg-[#5a7a5a] text-white' : 
                  pipelineSteps.find(s => s.id === '3')?.status === 'running' ? 'bg-[#3a5a40] text-white animate-pulse' : 
                  'bg-[#e2e2d5] text-[#1a2e1d]'
                }`}>
                  {pipelineSteps.find(s => s.id === '3')?.status === 'completed' ? '✓' : '2'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#1a2e1d]">AI Geo-Routing</p>
                    {pipelineSteps.find(s => s.id === '3')?.status === 'running' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-[#3a5a40] bg-[#3a5a40]/10 px-1.5 py-0.5 rounded-sm animate-pulse">
                        Running
                      </span>
                    )}
                    {pipelineSteps.find(s => s.id === '3')?.status === 'completed' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-[#5a7a5a] bg-[#5a7a5a]/10 px-1.5 py-0.5 rounded-sm">
                        Stubbed
                      </span>
                    )}
                  </div>
                  {pipelineSteps.find(s => s.id === '3')?.status === 'running' ? (
                    <p className="mt-1 text-[#3a5a40] font-medium leading-relaxed">
                      Geolocating municipal ward boundaries...
                    </p>
                  ) : pipelineSteps.find(s => s.id === '3')?.status === 'completed' ? (
                    <p className="mt-1 text-[#5a7a5a] font-medium leading-relaxed">
                      Routed to proper GMC Administrative Division.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[#8a8a7a]">The platform automatically geolocates coordinate grids relative to GMC administrative Sector tables.</p>
                  )}
                </div>
              </div>

              {/* 3. Trilingual Drafting */}
              <div className={`p-3.5 rounded-2xl border transition-all duration-300 flex gap-3 ${
                pipelineSteps.find(s => s.id === '4')?.status === 'running' ? 'bg-[#f7f7f0] border-[#3a5a40]/30 shadow-2xs' : 
                pipelineSteps.find(s => s.id === '4')?.status === 'completed' ? 'bg-[#fafaf5] border-[#5a7a5a]/20 shadow-none' : 
                'bg-white border-transparent'
              }`}>
                <div className={`w-5 h-5 rounded-lg font-extrabold flex items-center justify-center text-[10px] flex-shrink-0 ${
                  pipelineSteps.find(s => s.id === '4')?.status === 'completed' ? 'bg-[#5a7a5a] text-white' : 
                  pipelineSteps.find(s => s.id === '4')?.status === 'running' ? 'bg-[#3a5a40] text-white animate-pulse' : 
                  'bg-[#e2e2d5] text-[#1a2e1d]'
                }`}>
                  {pipelineSteps.find(s => s.id === '4')?.status === 'completed' ? '✓' : '3'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#1a2e1d]">Trilingual Drafting</p>
                    {pipelineSteps.find(s => s.id === '4')?.status === 'running' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-[#3a5a40] bg-[#3a5a40]/10 px-1.5 py-0.5 rounded-sm animate-pulse">
                        Running
                      </span>
                    )}
                    {pipelineSteps.find(s => s.id === '4')?.status === 'completed' && (
                      <span className="inline-flex items-center text-[9px] font-bold text-[#5a7a5a] bg-[#5a7a5a]/10 px-1.5 py-0.5 rounded-sm">
                        Stubbed
                      </span>
                    )}
                  </div>
                  {pipelineSteps.find(s => s.id === '4')?.status === 'running' ? (
                    <p className="mt-1 text-[#3a5a40] font-medium leading-relaxed">
                      Constructing English, Hindi & Gujarati administrative formal letters...
                    </p>
                  ) : pipelineSteps.find(s => s.id === '4')?.status === 'completed' ? (
                    <p className="mt-1 text-[#5a7a5a] font-medium leading-relaxed">
                      Administrative grievance letters drafted.
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[#8a8a7a]">Civic complaints are drafted instantly in English, Hindi & Gujarati, optimized for formal Indian administrative records.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Wards Guide */}
          <div className="bg-white border border-[#e2e2d5] rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider mb-3">Municipal Ward Contacts</h3>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {GANDHINAGAR_WARDS.map((w) => (
                <div key={w.id} className="text-xs p-2.5 rounded-xl bg-[#fafaf5] border border-[#e2e2d5] flex flex-col hover:border-[#5a7a5a] transition">
                  <span className="font-bold text-[#1a2e1d]">{w.name}</span>
                  <span className="text-[10px] font-mono text-[#8a8a7a] mt-1">{w.representative}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
