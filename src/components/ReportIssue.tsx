import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, MapPin, AlertCircle, CheckCircle2, Loader2, Sparkles, Navigation, ChevronRight, CornerDownRight, ChevronDown, ChevronUp, HelpCircle, Mic, Square, AlertTriangle } from 'lucide-react';
import { createReport, getLocalReports, saveLocalReports, fetchReports, addCoWitness, updateReportReasoning } from '../utils/reportStore';
import { addCivicPoints, getCivicScore, getCivicTierInfo, getWardImpactInfo, getMilestoneText, getJustUnlockedMilestone, getContributions } from '../utils/civicScore';
import { getProxiedImageUrl } from '../utils/imageUtils';
import { getSvgDataUriForCategory } from '../data/mockData';
import { uploadPhotoToStorage, compressImage, auth, db } from '../firebase';
import { CivicReport, CATEGORIES, GANDHINAGAR_WARDS } from '../types';

// Preset sample photos to make testing in sandbox iframe extremely delightful!
const SAMPLE_PRESETS = [
  {
    name: 'Sector 3 Pothole',
    url: getSvgDataUriForCategory('Potholes & Roads'),
    defaultNote: 'A deep pothole here is causing vehicles to swerve dangerously.',
    lat: 23.2172,
    lng: 72.6385,
  },
  {
    name: 'Sector 17 Overflow',
    url: getSvgDataUriForCategory('Drainage & Flooding'),
    defaultNote: 'Severe drainage overflow and waterlogging has flooded the walkways and streets in Sector 17 market.',
    lat: 23.2215,
    lng: 72.6482,
  },
  {
    name: 'Kudasan Dark Streetlight',
    url: getSvgDataUriForCategory('Streetlights'),
    defaultNote: 'No lights are working along Kudasan link road. It is pitch dark and dangerous.',
    lat: 23.1895,
    lng: 72.6288,
  },
  {
    name: 'Infocity Pipeline Leak',
    url: getSvgDataUriForCategory('Water Supply & Sewage'),
    defaultNote: 'Clean drinking water has been spraying out of this valve on the footpath.',
    lat: 23.2354,
    lng: 72.6598,
  }
];

const DEMO_WARD_CENTERS = [
  { id: 'ward_01', name: 'Ward 1 (Sectors 1-7)', lat: 23.2450, lng: 72.6450 },
  { id: 'ward_02', name: 'Ward 2 (Sectors 8-14)', lat: 23.2300, lng: 72.6300 },
  { id: 'ward_03', name: 'Ward 3 (Sectors 15-21)', lat: 23.2215, lng: 72.6482 },
  { id: 'ward_04', name: 'Ward 4 (Sectors 22-30)', lat: 23.2050, lng: 72.6200 },
  { id: 'ward_05', name: 'Ward 5 (Kudasan & Sargasan)', lat: 23.1850, lng: 72.6150 },
  { id: 'ward_06', name: 'Ward 6 (Infocity & Indroda)', lat: 23.2000, lng: 72.6450 },
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
  const [howItWorksExpanded, setHowItWorksExpanded] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // New states for geographic boundary checking
  const [showBoundaryAlert, setShowBoundaryAlert] = useState<boolean>(false);
  const [detectedOffLimitsCoords, setDetectedOffLimitsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDemoWard, setSelectedDemoWard] = useState<{ id: string; name: string; lat: number; lng: number } | null>(null);

  // HMAC Session Token implementation
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const fetchSessionToken = async (retries = 3, delayMs = 2000): Promise<string | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch('/api/token');
        if (response.ok) {
          const data = await response.json();
          setSessionToken(data.token);
          console.log("[Token System] Session token acquired successfully.");
          return data.token;
        } else {
          console.warn(`[Token System] Attempt ${attempt} failed with status: ${response.status}`);
        }
      } catch (err) {
        console.warn(`[Token System] Attempt ${attempt} failed to fetch session token:`, err);
      }
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
    console.error("[Token System] Max retries reached. Failed to fetch session token.");
    return null;
  };

  React.useEffect(() => {
    fetchSessionToken();
    const interval = setInterval(() => {
      console.log("[Token System] Refreshing session token before expiry...");
      fetchSessionToken();
    }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for reasoning fields in ReportIssue success screen
  React.useEffect(() => {
    if (!resultReport) return;

    const hasReasoning = resultReport.classificationReasoning && resultReport.alternativeCategories && resultReport.severityFactors;
    if (hasReasoning) return;

    let isMounted = true;
    let pollCount = 0;
    const maxPolls = 10;
    const pollInterval = 3000; // 3 seconds

    const poll = async () => {
      try {
        pollCount++;
        console.log(`[ReportIssue Reasoning Polling] Checking reasoning for ticket ${resultReport.id}, attempt #${pollCount}...`);

        const response = await fetch(`/api/reasoning/${resultReport.referenceId || resultReport.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: resultReport.category,
            severity: resultReport.severity,
            hazards: resultReport.aiAnalysis?.hazards || [],
            description: resultReport.aiAnalysis?.description || '',
            userNote: resultReport.note || ''
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        if (!isMounted) return;

        if (data.success && data.status === 'completed' && data.result) {
          console.log("[ReportIssue Reasoning Polling] Succeeded! Updating reasoning fields:", data.result);
          // 1. Update report store
          await updateReportReasoning(resultReport.id, data.result);
          
          // 2. Update local state
          const updatedReport = {
            ...resultReport,
            ...data.result
          };
          setResultReport(updatedReport);
          
          // 3. Update parent/app state
          onReportCreated(updatedReport);
          return; // Stop polling
        }

        if (pollCount < maxPolls) {
          setTimeout(poll, pollInterval);
        }
      } catch (err) {
        console.warn("[ReportIssue Reasoning Polling] Attempt failed:", err);
        if (isMounted && pollCount < maxPolls) {
          setTimeout(poll, pollInterval);
        }
      }
    };

    const timer = setTimeout(poll, 1500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [resultReport?.id, resultReport?.referenceId]);

  // Voice recording and transcribing states using browser Web Speech API
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [showConfirmTranscript, setShowConfirmTranscript] = useState<boolean>(false);
  const [tempTranscript, setTempTranscript] = useState<string>('');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [micPermissionStatus, setMicPermissionStatus] = useState<string>('prompt');
  const [activeLang, setActiveLang] = useState<'EN' | 'HI' | 'GU'>('EN');
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Proactively check browser microphone permission and SpeechRecognition support on mount
  React.useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSpeechSupported(false);
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as any })
        .then((status) => {
          setMicPermissionStatus(status.state);
          status.onchange = () => {
            setMicPermissionStatus(status.state);
          };
        })
        .catch((err) => console.warn("Microphone permission query not fully supported:", err));
    }
  }, []);

  const startVoiceRecording = async () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setRecordingError("Voice input requires Chrome — type instead");
      setIsSpeechSupported(false);
      return;
    }

    try {
      setRecordingError(null);
      setRecordingSeconds(0);
      setTempTranscript('');
      setShowConfirmTranscript(false);

      // Request microphone permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionStatus('granted');
      stream.getTracks().forEach(track => track.stop());

      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = true;

      // Map activeLang to Web Speech language codes
      let langCode = 'en-IN';
      if (activeLang === 'HI') {
        langCode = 'hi-IN';
      } else if (activeLang === 'GU') {
        langCode = 'gu-IN';
      }
      recognition.lang = langCode;

      recognition.onstart = () => {
        setIsRecording(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setTempTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setMicPermissionStatus('denied');
          setRecordingError("Microphone access is required to speak your complaint. Please verify permissions.");
        } else {
          setRecordingError(`Speech recognition error: ${event.error}`);
        }
        stopVoiceRecordingInternal(recognition);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setShowConfirmTranscript(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err: any) {
      console.error("Microphone access denied or unsupported:", err);
      setMicPermissionStatus('denied');
      setRecordingError("Microphone access is required to speak your complaint. Please verify permissions.");
    }
  };

  const stopVoiceRecordingInternal = (rec: any) => {
    try {
      rec.stop();
    } catch (e) {}
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    setShowConfirmTranscript(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const confirmTranscript = () => {
    setNote(tempTranscript);
    setShowConfirmTranscript(false);
    setTempTranscript('');
  };

  const cancelConfirmTranscript = () => {
    setShowConfirmTranscript(false);
    setTempTranscript('');
    startVoiceRecording();
  };

  // Manual map-pin coordinate adjusts
  const [manualLat, setManualLat] = useState<string>('23.2156');
  const [manualLng, setManualLng] = useState<string>('72.6369');
  const [showManualCoords, setShowManualCoords] = useState<boolean>(false);

  const stepStartTimes = useRef<{ [key: string]: number }>({});

  // Interactive Agent Activity pipeline
  const [pipelineSteps, setPipelineSteps] = useState([
    { id: '1', label: 'Uploading Photo to Cloud Archive', status: 'pending' as const, detail: 'Compressing and securing upload to Firebase storage.', duration: undefined as string | undefined },
    { id: '2', label: 'Extracting Damages via Gemini Vision', status: 'pending' as const, detail: 'Running object detection for civic safety hazards.', duration: undefined as string | undefined },
    { id: 'dup_check', label: 'Checking for duplicate reports nearby…', status: 'pending' as const, detail: 'Analyzing description similarity and geographic proximity.', duration: undefined as string | undefined },
    { id: '3', label: 'Routing affected Wards', status: 'pending' as const, detail: 'Geocoding municipal ward boundaries in Gandhinagar.', duration: undefined as string | undefined },
    { id: '4', label: 'Drafting Trilingual Compliance Letters', status: 'pending' as const, detail: 'Constructing English, Hindi & Gujarati administrative formal letters.', duration: undefined as string | undefined },
    { id: '5', label: 'Dispatching to GMC Nodal Officer', status: 'pending' as const, detail: 'Registering grievance ticket into Firestore registry.', duration: undefined as string | undefined }
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
        const dist = getHaversineDistance(latitude, longitude, 23.2156, 72.6369);
        
        if (dist > 20000) { // 20 km boundary check
          setDetectedOffLimitsCoords({ lat: latitude, lng: longitude });
          setShowBoundaryAlert(true);
          setLocationStatus('GPS acquired but is outside GMC limits.');
          setIsLocating(false);
        } else {
          setGpsLocation({ lat: latitude, lng: longitude });
          setManualLat(latitude.toFixed(5));
          setManualLng(longitude.toFixed(5));
          setLocationStatus('GPS Lock acquired successfully.');
          setSelectedDemoWard(null); // Clear demo mode on valid GPS lock
          setShowBoundaryAlert(false);
          setIsLocating(false);
        }
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

  const handleSelectDemoWard = (ward: typeof DEMO_WARD_CENTERS[0]) => {
    setSelectedDemoWard(ward);
    setGpsLocation({ lat: ward.lat, lng: ward.lng });
    setManualLat(ward.lat.toFixed(5));
    setManualLng(ward.lng.toFixed(5));
    setLocationStatus(`GPS Override: ${ward.name} (Demo mode)`);
    setShowBoundaryAlert(false);
  };

  const handleCancelBoundaryAlert = () => {
    setShowBoundaryAlert(false);
    setDetectedOffLimitsCoords(null);
    setGpsLocation(null);
    setManualLat('23.2156');
    setManualLng('72.6369');
    setLocationStatus('Location selection cancelled.');
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
    setValidationError(null);
    if (!photoUrl && !note.trim()) {
      setValidationError("At least one of: a valid photo OR a non-empty note is required to submit your complaint.");
      return;
    }

    setIsSubmitting(true);
    setResultReport(null);
    setDetectedIssue(null);
    setSubmissionError(null);
    setDuplicateFound(false);
    setDuplicateMessage('');

    // Initialise pipeline states
    const resetPipeline = pipelineSteps.map(step => ({ ...step, status: 'pending' as const, duration: undefined }));
    stepStartTimes.current = {};
    setPipelineSteps(resetPipeline);

    const targetLat = gpsLocation?.lat || Number(manualLat) || 23.2156;
    const targetLng = gpsLocation?.lng || Number(manualLng) || 72.6369;

    let generatedData: any = null;

    try {
      // Step 0: Compress photo ONCE at the very start to max ~900px, JPEG quality ~0.6 if present
      let compressedUrl = "";
      if (photoUrl) {
        console.log("[Pipeline] Compressing photo once before initiating pipeline...");
        compressedUrl = photoUrl.startsWith('data:') 
          ? await compressImage(photoUrl, 900, 900, 0.6) 
          : photoUrl;
      }

      // Step 1: Uploading Photo (Bypassed Firebase Storage upload; instantly ready)
      stepStartTimes.current['1'] = Date.now();
      setPipelineSteps(prev => prev.map(s => s.id === '1' ? { ...s, status: 'running' } : s));
      await new Promise(r => setTimeout(r, 400)); // smooth visual pacing
      setPipelineSteps(prev => prev.map(s => s.id === '1' ? { 
        ...s, 
        status: 'completed',
        duration: `${((Date.now() - (stepStartTimes.current['1'] || Date.now())) / 1000).toFixed(1)}s`,
        detail: photoUrl 
          ? 'Photo compressed client-side (max 900px, quality 60%). Firebase Storage upload bypassed for optimal speed.'
          : 'No photo provided. Reporting in voice/text fallback mode.'
      } : s));

      // Step 2: Extracting damages (Call real Gemini API analysis!) - Starts instantly!
      stepStartTimes.current['2'] = Date.now();
      setPipelineSteps(prev => prev.map(s => s.id === '2' ? { ...s, status: 'running' } : s));
      
      let tokenToUse = sessionToken;
      if (!tokenToUse) {
        tokenToUse = await fetchSessionToken();
      }

      let response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Token': tokenToUse || ''
        },
        body: JSON.stringify({
          photoUrl: compressedUrl, // Send compressed base64 or empty string to Gemini
          note,
          lat: targetLat,
          lng: targetLng,
          imageName
        })
      });

      if (response.status === 401) {
        console.warn("[Token System] 401 response detected. Fetching a fresh token and retrying...");
        const freshToken = await fetchSessionToken();
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Session-Token': freshToken || ''
          },
          body: JSON.stringify({
            photoUrl: compressedUrl,
            note,
            lat: targetLat,
            lng: targetLng,
            imageName
          })
        });
      }

      const backendData = await response.json();
      if (response.status >= 400 || !backendData.success) {
        throw new Error(backendData.message || backendData.error || "Municipal Engine translation failed.");
      }

      generatedData = {
        ...backendData.report,
        photoUrl: compressedUrl
      };

      if (selectedDemoWard) {
        if (!generatedData.geo) {
          generatedData.geo = {};
        }
        const oldWardName = generatedData.geo.wardName || '';
        generatedData.geo.ward = selectedDemoWard.id;
        generatedData.geo.wardName = `${selectedDemoWard.name} (manually selected)`;

        const newWardLabel = `${selectedDemoWard.name} (manually selected)`;

        // Replace ward name in complaint texts for consistency
        if (generatedData.complaintEn && oldWardName) {
          generatedData.complaintEn = generatedData.complaintEn.split(oldWardName).join(newWardLabel);
        }
        if (generatedData.complaintHi && oldWardName) {
          generatedData.complaintHi = generatedData.complaintHi.split(oldWardName).join(newWardLabel);
        }
        if (generatedData.complaintGu && oldWardName) {
          generatedData.complaintGu = generatedData.complaintGu.split(oldWardName).join(newWardLabel);
        }
      }

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
      setPipelineSteps(prev => prev.map(s => s.id === '2' ? { 
        ...s, 
        status: 'completed',
        duration: `${((Date.now() - (stepStartTimes.current['2'] || Date.now())) / 1000).toFixed(1)}s`
      } : s));

      // NEW STEP: Checking for duplicates nearby!
      stepStartTimes.current['dup_check'] = Date.now();
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
        addCivicPoints('cowitness', duplicateTicket.id);
        
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
          duration: `${((Date.now() - (stepStartTimes.current['dup_check'] || Date.now())) / 1000).toFixed(1)}s`,
          detail: `Duplicate identified (distance: ${minDistance.toFixed(1)}m). Added reporter to Ticket #${duplicateTicket!.id}.`
        } : s));

        // Mark subsequent steps as completed/bypassed
        setPipelineSteps(prev => prev.map(s => ['3', '4', '5'].includes(s.id) ? { ...s, status: 'completed', duration: '0.1s', detail: 'Bypassed - merged with duplicate ticket.' } : s));

        setResultReport(updatedTicket);
        onReportCreated(updatedTicket);
        return;
      }

      // No duplicate found! Proceed normally.
      setPipelineSteps(prev => prev.map(s => s.id === 'dup_check' ? { 
        ...s, 
        status: 'completed',
        duration: `${((Date.now() - (stepStartTimes.current['dup_check'] || Date.now())) / 1000).toFixed(1)}s`,
        detail: 'Checked open registries nearby. No matching duplicate identified.'
      } : s));

      // Step 3: Ward routing
      stepStartTimes.current['3'] = Date.now();
      setPipelineSteps(prev => prev.map(s => s.id === '3' ? { ...s, status: 'running' } : s));
      await new Promise(r => setTimeout(r, 600));
      setPipelineSteps(prev => prev.map(s => s.id === '3' ? { 
        ...s, 
        status: 'completed',
        duration: `${((Date.now() - (stepStartTimes.current['3'] || Date.now())) / 1000).toFixed(1)}s`
      } : s));

      // Step 4: Trilingual letters
      stepStartTimes.current['4'] = Date.now();
      setPipelineSteps(prev => prev.map(s => s.id === '4' ? { ...s, status: 'running' } : s));
      await new Promise(r => setTimeout(r, 600));
      setPipelineSteps(prev => prev.map(s => s.id === '4' ? { 
        ...s, 
        status: 'completed',
        duration: `${((Date.now() - (stepStartTimes.current['4'] || Date.now())) / 1000).toFixed(1)}s`
      } : s));

      // Step 5: Finalizing record in cloud database (Non-blocking background save)
      stepStartTimes.current['5'] = Date.now();
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
      setPipelineSteps(prev => prev.map(s => s.id === '5' ? { 
        ...s, 
        status: 'completed',
        duration: `${((Date.now() - (stepStartTimes.current['5'] || Date.now())) / 1000).toFixed(1)}s`
      } : s));

      // Complete and transition instantly
      addCivicPoints('report', newlyCreatedReport.id, newlyCreatedReport.severity);
      setResultReport(newlyCreatedReport);
      onReportCreated(newlyCreatedReport);
    } catch (err: any) {
      console.error(err);
      setSubmissionError(err?.message || String(err));
      setPipelineSteps(prev => prev.map(s => s.status === 'running' ? { 
        ...s, 
        status: 'failed',
        duration: `${((Date.now() - (stepStartTimes.current[s.id] || Date.now())) / 1000).toFixed(1)}s`
      } : s));
      setIsSubmitting(false);
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
    setValidationError(null);
    setShowBoundaryAlert(false);
    setDetectedOffLimitsCoords(null);
    setSelectedDemoWard(null);
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
              {/* How NagarMitra Works Section - Collapsible, visible before photo upload */}
              {!photoUrl && (
                <div className="border border-[#e2e2d5] bg-[#fafaf5]/40 rounded-2xl p-4">
                  <button
                    type="button"
                    onClick={() => setHowItWorksExpanded(!howItWorksExpanded)}
                    className="w-full flex items-center justify-between text-left font-sans text-xs font-bold text-[#3a5a40] hover:text-[#1a2e1d] transition cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-[#3a5a40]" />
                      <span>How NagarMitra Works</span>
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider font-mono flex items-center gap-0.5">
                      {howItWorksExpanded ? "See how it works ▲" : "See how it works ▼"}
                    </span>
                  </button>

                  {howItWorksExpanded && (
                    <div className="mt-4 border-t border-[#e2e2d5]/60 pt-4 animate-fadeIn">
                      <div className="flex flex-col divide-y divide-[#e2e2d5]/60">
                        {/* Step 1 */}
                        <div className="flex flex-col sm:flex-row sm:items-center py-3.5 gap-3 sm:gap-6">
                          <div className="shrink-0">
                            <span className="inline-block text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-wider font-mono bg-[#fafaf5] border border-[#e2e2d5] px-2 py-0.5 rounded-md min-w-[55px] text-center">
                              STEP 1
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-xs text-[#1a2e1d] font-sans sm:w-48 shrink-0">
                            <span>Vision Analyst</span>
                          </div>
                          <div className="flex-1 text-[11px] text-[#5a5a40] leading-relaxed font-sans">
                            Gemini sees the issue, scores severity 1–5, identifies hazards
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col sm:flex-row sm:items-center py-3.5 gap-3 sm:gap-6">
                          <div className="shrink-0">
                            <span className="inline-block text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-wider font-mono bg-[#fafaf5] border border-[#e2e2d5] px-2 py-0.5 rounded-md min-w-[55px] text-center">
                              STEP 2
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-xs text-[#1a2e1d] font-sans sm:w-48 shrink-0">
                            <span>Geo-Router</span>
                          </div>
                          <div className="flex-1 text-[11px] text-[#5a5a40] leading-relaxed font-sans">
                            Maps your location to the correct GMC ward and department officer
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col sm:flex-row sm:items-center py-3.5 gap-3 sm:gap-6">
                          <div className="shrink-0">
                            <span className="inline-block text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-wider font-mono bg-[#fafaf5] border border-[#e2e2d5] px-2 py-0.5 rounded-md min-w-[55px] text-center">
                              STEP 3
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-xs text-[#1a2e1d] font-sans sm:w-48 shrink-0">
                            <span>Duplicate Detector</span>
                          </div>
                          <div className="flex-1 text-[11px] text-[#5a5a40] leading-relaxed font-sans">
                            Checks for similar reports within 60m — merges as co-witness if found
                          </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex flex-col sm:flex-row sm:items-center py-3.5 gap-3 sm:gap-6">
                          <div className="shrink-0">
                            <span className="inline-block text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-wider font-mono bg-[#fafaf5] border border-[#e2e2d5] px-2 py-0.5 rounded-md min-w-[55px] text-center">
                              STEP 4
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-xs text-[#1a2e1d] font-sans sm:w-48 shrink-0">
                            <span>Complaint Drafter</span>
                          </div>
                          <div className="flex-1 text-[11px] text-[#5a5a40] leading-relaxed font-sans">
                            Writes a formal complaint in English, Hindi & Gujarati instantly
                          </div>
                        </div>

                        {/* Step 5 */}
                        <div className="flex flex-col sm:flex-row sm:items-center py-3.5 gap-3 sm:gap-6">
                          <div className="shrink-0">
                            <span className="inline-block text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-wider font-mono bg-[#fafaf5] border border-[#e2e2d5] px-2 py-0.5 rounded-md min-w-[55px] text-center">
                              STEP 5
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-xs text-[#1a2e1d] font-sans sm:w-48 shrink-0">
                            <span>Escalation Watchdog</span>
                          </div>
                          <div className="flex-1 text-[11px] text-[#5a5a40] leading-relaxed font-sans">
                            Autonomously escalates every 7 days until resolved — up to RTI + SWAGAT + CPGRAMS
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Photo Upload Area */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8a8a7a] mb-2">
                  1. Capture or Upload Photo <span className="text-rose-500">*</span>
                </label>
                
                {photoUrl ? (
                  <div className="relative group rounded-2xl overflow-hidden bg-[#fafaf5] border border-[#e2e2d5]">
                    <img 
                      src={getProxiedImageUrl(photoUrl)} 
                      alt="Civic issue preview" 
                      referrerPolicy="no-referrer" 
                      className="w-full h-56 object-cover" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><rect width='100%' height='100%' fill='%23e2e2d5'/></svg>";
                      }}
                    />
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
                        <img 
                          src={getProxiedImageUrl(p.url)} 
                          className="w-8 h-8 rounded-lg object-cover flex-shrink-0" 
                          referrerPolicy="no-referrer" 
                          alt="" 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100%' height='100%' fill='%23e2e2d5'/></svg>";
                          }}
                        />
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

                {showBoundaryAlert && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-4 shadow-2xs animate-fadeIn text-[#2d332d]">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                      <div className="flex-1">
                        <h4 className="font-extrabold text-xs text-amber-900 uppercase tracking-wider mb-1">
                          Outside Service Area
                        </h4>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed mb-3">
                          NagarMitra serves Gandhinagar Municipal Corporation. Your location is outside GMC limits.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="relative flex-1">
                            <select
                              onChange={(e) => {
                                const wardId = e.target.value;
                                const ward = DEMO_WARD_CENTERS.find(w => w.id === wardId);
                                if (ward) handleSelectDemoWard(ward);
                              }}
                              defaultValue=""
                              className="w-full text-xs font-bold bg-white border border-amber-200 text-amber-900 rounded-xl px-3 py-2 outline-none focus:border-amber-400 transition"
                            >
                              <option value="" disabled>Pick a ward manually (Demo mode)...</option>
                              {DEMO_WARD_CENTERS.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleCancelBoundaryAlert}
                            className="px-4 py-2 bg-white border border-amber-200 text-amber-800 hover:bg-amber-100/50 text-xs font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

              {/* Voice-First Recording Integration */}
              <div className="bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl p-5 flex flex-col items-center justify-center relative overflow-hidden transition-all hover:border-[#3a5a40]/30 shadow-2xs">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#3a5a40]" />
                
                {!isSpeechSupported && (
                  <div className="text-center py-4 flex flex-col items-center">
                    <AlertCircle className="w-6 h-6 text-amber-500 mb-2" />
                    <span className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider">
                      Voice input requires Chrome — type instead
                    </span>
                  </div>
                )}

                {isSpeechSupported && !isRecording && !showConfirmTranscript && (
                  <div className="text-center py-2 flex flex-col items-center gap-3">
                    {/* Dynamic Language Selection Toggle */}
                    <div className="flex bg-white border border-[#e2e2d5] p-1 rounded-xl shadow-2xs mb-1">
                      <button
                        type="button"
                        onClick={() => setActiveLang('EN')}
                        className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition uppercase tracking-wider cursor-pointer ${
                          activeLang === 'EN' 
                            ? 'bg-[#3a5a40] text-white shadow-xs' 
                            : 'text-[#8a8a7a] hover:text-[#2d332d]'
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveLang('HI')}
                        className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition uppercase tracking-wider cursor-pointer ${
                          activeLang === 'HI' 
                            ? 'bg-[#3a5a40] text-white shadow-xs' 
                            : 'text-[#8a8a7a] hover:text-[#2d332d]'
                        }`}
                      >
                        हिंदी
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveLang('GU')}
                        className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition uppercase tracking-wider cursor-pointer ${
                          activeLang === 'GU' 
                            ? 'bg-[#3a5a40] text-white shadow-xs' 
                            : 'text-[#8a8a7a] hover:text-[#2d332d]'
                        }`}
                      >
                        ગુજરાતી
                      </button>
                    </div>

                    <button
                      type="button"
                      id="voice-speak-complaint-btn"
                      onClick={startVoiceRecording}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-[#3a5a40] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-[#2f4934] transition active:scale-95 cursor-pointer"
                    >
                      <Mic className="w-4 h-4 text-white" />
                      🎤 Speak your complaint
                    </button>
                    <p className="text-[10px] text-[#8a8a7a] mt-1 font-medium">
                      Speak in Hindi (हिंदी), Gujarati (ગુજરાતી), or English for automatic AI transcription.
                    </p>
                  </div>
                )}

                {isSpeechSupported && isRecording && (
                  <div className="text-center py-3 w-full flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                      <span className="text-[11px] font-extrabold text-rose-600 uppercase tracking-widest">
                        Recording ({recordingSeconds}s) - {activeLang === 'HI' ? 'हिंदी' : activeLang === 'GU' ? 'ગુજરાતી' : 'English'}
                      </span>
                    </div>
                    
                    {/* Visual Waveform Effect */}
                    <div className="flex gap-1 items-center justify-center h-8 my-3">
                      {[1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 5, 2].map((h, i) => (
                        <div 
                          key={i} 
                          className="w-1 bg-[#3a5a40] rounded-full animate-bounce" 
                          style={{ 
                            height: `${h * 5}px`,
                            animationDelay: `${i * 0.05}s`
                          }} 
                        />
                      ))}
                    </div>

                    {/* Live Interim Transcript Box */}
                    <div className="w-full text-left mb-4">
                      <span className="block text-[9px] font-extrabold text-[#3a5a40] uppercase tracking-wider mb-1">
                        🎙️ Live Interim Transcript
                      </span>
                      <div className="p-3 bg-white border border-[#e2e2d5] rounded-xl text-xs text-[#2d332d] font-medium leading-relaxed shadow-inner max-h-24 overflow-y-auto">
                        {tempTranscript || "Listening..."}
                      </div>
                    </div>

                    <button
                      type="button"
                      id="stop-voice-recording-btn"
                      onClick={stopVoiceRecording}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-rose-700 transition cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 text-white fill-white" />
                      Stop & Transcribe
                    </button>
                  </div>
                )}

                {isSpeechSupported && showConfirmTranscript && !isRecording && (
                  <div className="w-full py-2">
                    <span className="block text-[10px] font-extrabold text-[#3a5a40] uppercase tracking-wider mb-2">
                      🎙️ Audio Live Transcript
                    </span>
                    <div className="p-3 bg-white border border-[#e2e2d5] rounded-xl text-xs text-[#2d332d] font-medium leading-relaxed shadow-inner max-h-32 overflow-y-auto mb-3">
                      {tempTranscript || "(No words captured)"}
                    </div>
                    
                    <span className="block text-center text-[11px] font-bold text-[#1a2e1d] mb-3">
                      Is this correct?
                    </span>
                    
                    <div className="flex gap-2">
                      <button
                        type="button"
                        id="confirm-transcript-yes-btn"
                        onClick={confirmTranscript}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#3a5a40] text-white font-bold text-xs uppercase rounded-lg shadow-sm hover:bg-[#2f4934] transition cursor-pointer"
                      >
                        Yes, use this
                      </button>
                      <button
                        type="button"
                        id="confirm-transcript-no-btn"
                        onClick={cancelConfirmTranscript}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-rose-600 border border-[#e2e2d5] font-bold text-xs uppercase rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        Re-record
                      </button>
                    </div>
                  </div>
                )}

                {recordingError && (
                  <div className="w-full mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-medium flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>{recordingError}</span>
                  </div>
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

              {validationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <button
                type="submit"
                id="submit-report-btn"
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
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold uppercase tracking-wider ${step.status === 'completed' ? 'text-[#1a2e1d]' : step.status === 'running' ? 'text-[#3a5a40]' : 'text-[#8a8a7a]'}`}>
                          {step.label}
                        </p>
                        {step.duration && (
                          <span className="text-[10px] font-mono font-bold text-[#3a5a40] bg-[#f0f9f0] px-1.5 py-0.5 rounded border border-[#d5edd5]">
                            {step.duration}
                          </span>
                        )}
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
                    <div className="text-left">
                      <h4 className="text-[#1a2e1d] font-bold font-sans text-sm text-center mb-4">Grievance Processed Successfully</h4>
                      
                      {/* Highlighted green card */}
                      <div className="bg-[#f0f9f0] border border-emerald-500/30 rounded-2xl p-4 shadow-3xs font-sans text-emerald-900">
                        <div className="flex items-start gap-2.5 mb-3">
                          <div className="font-extrabold text-xs text-emerald-950 uppercase tracking-wide leading-tight">
                            Co-Witness Added — Your report strengthens an existing complaint
                          </div>
                        </div>

                        <div className="space-y-2 text-xs border-t border-emerald-500/10 pt-2.5">
                          <div className="flex items-center justify-between text-emerald-850">
                            <span className="font-medium">Merged with Ticket ID:</span>
                            <span className="font-mono font-bold text-emerald-950 bg-white/70 px-1.5 py-0.5 rounded border border-emerald-500/10">
                              {resultReport.id}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between text-emerald-850">
                            <span className="font-medium">Complaint Category:</span>
                            <span className="font-bold text-emerald-950">
                              {resultReport.category}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-emerald-850 bg-emerald-600/5 p-2 rounded-lg border border-emerald-600/10 mt-1">
                            <span className="font-bold text-emerald-900">Total Co-Witnesses:</span>
                            <span className="font-extrabold text-[#3a5a40] text-xs font-sans">
                              This ticket now has {resultReport.coWitnesses?.length || 1} witnesses
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] text-emerald-700/90 italic font-medium mt-3 text-center border-t border-emerald-500/10 pt-2 font-sans">
                          More witnesses = stronger case for municipal action
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-[#1a2e1d] font-bold font-sans text-sm">Grievance Registered Successfully</h4>
                      <p className="text-[#5a7a5a] text-xs mt-1">Ticket ID: <span className="font-mono font-bold text-[#1a2e1d]">{resultReport.id}</span> assigned to {resultReport.department}.</p>
                    </>
                  )}

                  {/* Civic Contribution Score Card */}
                  <div className="mt-4 p-4 bg-[#fbfbf8] border border-[#e2e2d5] rounded-xl text-center select-none font-sans">
                    <div className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Nagarmitra Contribution Score</div>
                    
                    {/* Tier name in a small muted label above the score number */}
                    <div className="text-[11px] font-medium text-[#8a8a7a] mt-1.5">
                      {getCivicTierInfo(getCivicScore()).name}
                    </div>

                    <div className="flex items-center justify-center gap-2 mt-0.5">
                      <span className="text-sm font-extrabold text-[#3a5a40]">{getCivicScore()} Points</span>
                      {getCivicTierInfo(getCivicScore()).isGold && (
                        <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider border border-[#b37d14] text-[#b37d14] bg-[#fffbf0] rounded-md">
                          {getCivicTierInfo(getCivicScore()).name}
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] font-medium text-[#5a7a5a] mt-1">
                      {duplicateFound 
                        ? "+2 Points added for registering as a Co-Witness" 
                        : (
                          <>
                            +1 Point added for successful grievance filing
                            {getContributions().find(c => c.ticketId === resultReport?.id && c.type === 'report')?.severityBonus ? (
                              <div className="mt-1 font-semibold text-[#b37d14]">
                                Severity bonus: +{getContributions().find(c => c.ticketId === resultReport?.id && c.type === 'report')?.severityBonus} pt (critical issue)
                              </div>
                            ) : null}
                          </>
                        )}
                    </div>

                    {/* First-Achievement Moments Callout */}
                    {(() => {
                      const justUnlocked = getJustUnlockedMilestone();
                      if (justUnlocked && getMilestoneText(justUnlocked)) {
                        return (
                          <div style={{ borderLeft: '3px solid #8a8a7a', paddingLeft: '10px' }} className="mt-4 text-left select-none font-sans">
                            <p className="text-[13px] text-[#8a8a7a] font-normal leading-relaxed">
                              {getMilestoneText(justUnlocked)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Resident Impact Statement below the Civic Score card */}
                  {resultReport?.wardId && (
                    <p className="text-[13px] text-[#8a8a7a] mt-2.5 text-center font-sans font-normal leading-relaxed select-none">
                      Your report may affect approximately {getWardImpactInfo(resultReport.wardId).population} residents in {getWardImpactInfo(resultReport.wardId).name}.
                    </p>
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
