import { CivicReport, GANDHINAGAR_WARDS, CATEGORIES } from '../src/types';

// Robust stub for image analysis (using Gemini 3.1 Pro mockup guidelines in comments)
export async function analyzeIssueImageStub(
  photoUrl: string,
  userNote: string,
  lat: number,
  lng: number
): Promise<Partial<CivicReport>> {
  console.log(`[CivicEngine Stub] Triggering AI analysis mock on photo: ${photoUrl} with note: "${userNote}"`);

  // Keyword heuristic to make the mock incredibly realistic!
  const noteLower = userNote.toLowerCase();
  let category = CATEGORIES[7]; // Others default
  let severity = 3; // Neutral default
  let hazards: string[] = [];

  if (noteLower.includes('hole') || noteLower.includes('road') || noteLower.includes('pavement') || noteLower.includes('pothole')) {
    category = CATEGORIES[0]; // Potholes & Roads
    severity = noteLower.includes('deep') || noteLower.includes('accident') ? 5 : 4;
    hazards = ['Two-wheeler skidding risk', 'Suspension damage', 'Traffic congestion'];
  } else if (noteLower.includes('garbage') || noteLower.includes('trash') || noteLower.includes('waste') || noteLower.includes('smell') || noteLower.includes('dumpster')) {
    category = CATEGORIES[1]; // Garbage & Sanitation
    severity = noteLower.includes('stray') || noteLower.includes('flies') ? 4 : 3;
    hazards = ['Airborne bacterial risk', 'Stray cattle aggregation', 'Footpath obstruction'];
  } else if (noteLower.includes('water') || noteLower.includes('sewage') || noteLower.includes('leak') || noteLower.includes('drain')) {
    category = CATEGORIES[2]; // Water Supply & Sewage
    severity = noteLower.includes('overflow') || noteLower.includes('flood') ? 4 : 2;
    hazards = ['Clean water waste', 'Algal slipperiness', 'Breeding ground for vectors'];
  } else if (noteLower.includes('light') || noteLower.includes('dark') || noteLower.includes('streetlight') || noteLower.includes('bulb')) {
    category = CATEGORIES[3]; // Streetlights
    severity = noteLower.includes('blackout') || noteLower.includes('afraid') ? 5 : 3;
    hazards = ['High susceptibility to nighttime crime', 'Vulnerable commuter safety', 'Pedestrian tripping zone'];
  } else if (noteLower.includes('dog') || noteLower.includes('bull') || noteLower.includes('cow') || noteLower.includes('bite') || noteLower.includes('animal')) {
    category = CATEGORIES[4]; // Stray Animals & Safety
    severity = noteLower.includes('bite') || noteLower.includes('aggressive') ? 5 : 3;
    hazards = ['Civic injuries', 'Traffic hazard', 'SOCIETY health alarm'];
  } else if (noteLower.includes('tree') || noteLower.includes('park') || noteLower.includes('bench') || noteLower.includes('sidewalk')) {
    category = CATEGORIES[5]; // Public Parks & Footpaths
    severity = 2;
    hazards = ['Pedestrian barrier', 'Recreational field hazard'];
  }

  // Geocode corresponding Gandhinagar Ward based on latitude or random distribution near coordinates
  // Gandhinagar is planned with Sector grids (Sector 1 to 30)
  // Coordinates range around Lat: 23.21, Lng: 72.63. We can associate specific bounds to wards.
  let selectedWard = GANDHINAGAR_WARDS[Math.floor(Math.random() * GANDHINAGAR_WARDS.length)];
  
  // Try to parse coordinate regions
  if (lat > 23.22 && lng > 72.64) {
    selectedWard = GANDHINAGAR_WARDS[2]; // Ward 3
  } else if (lat < 23.20 && lng < 72.63) {
    selectedWard = GANDHINAGAR_WARDS[4]; // Ward 5
  } else if (lat > 23.23) {
    selectedWard = GANDHINAGAR_WARDS[5]; // Ward 6
  }

  // Determine Municipal Department
  let department = "GMC General Administration Directorate";
  if (category === CATEGORIES[0]) department = "GMC Roads & Engineering Division";
  else if (category === CATEGORIES[1]) department = "GMC Solid Waste & Health Sanitation Department";
  else if (category === CATEGORIES[2]) department = "GMC Water Drainage and Irrigation Wing";
  else if (category === CATEGORIES[3]) department = "GMC Electrical Maintenance Bureau";
  else if (category === CATEGORIES[4]) department = "GMC Veterinary & Animal Control Desk";
  else if (category === CATEGORIES[5]) department = "GMC Horticulture & Parks Wing";
  else if (category === CATEGORIES[6]) department = "GMC Traffic and Police Coordinator Desk";

  // Formulate Complaint content (English + Hindi)
  const complaintEn = `To,\nThe Ward Officer,\n${department},\nGandhinagar Municipal Corporation (GMC),\nGujarat.\n\nSubject: Formal Complaint regarding ${category} in ${selectedWard.name}.\n\nRespected Sir/Madam,\nThis is a citizen report filed via NagarMitra regarding an urgent public concern. Visual inspection confirms: ${userNote || 'Visual issue reported at site.'}\n\nOur AI evaluation indicates severity level of [${severity}/5], presenting active hazards including:\n${hazards.map((h, i) => `  ${i+1}. ${h}`).join('\n') || '  1. Under assessment'}\n\nPlease register this grievance under active compliance monitoring and assign an engineering team to inspect the location coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)}) for speedy resolution.\n\nThanking you,\nResident of Gandhinagar.`;

  const complaintHi = `सेवा में,\nवार्ड अधिकारी,\n${department},\nगांधीनगर नगर निगम (GMC),\nगुजरात।\n\nविषय: ${selectedWard.name} में ${category} के संबंध में औपचारिक शिकायत।\n\nमहोदय/महोदया,\nयह गांधीनगर नगरमित्र मंच के माध्यम से दर्ज कराई गई एक नागरिक शिकायत है। साइट पर समस्या की पुष्टि हुई है: ${userNote || 'साइट पर समस्या पाई गई है।'}\n\nनगरमित्र विश्लेषण के अनुसार गंभीरता स्तर [${severity}/5] है, जिसके प्रमुख खतरे निम्नलिखित हैं:\n${hazards.map((h, i) => `  ${i+1}. ${h}`).join('\n') || '  1. समीक्षा के अधीन है'}\n\nकृपया इस शिकायत को नगर निगम के सक्रीय निगरानी प्रणाली में दर्ज करें और संबंधित स्थल समन्वयक (${lat.toFixed(5)}, ${lng.toFixed(5)}) पर समस्या निराकरण हेतु कर्मियों को निर्देशित करें।\n\nसधन्यवाद,\nगांधीनगर का स्थानीय नागरिक।`;

  return {
    category,
    severity,
    geo: {
      lat,
      lng,
      ward: selectedWard.id,
      wardName: selectedWard.name
    },
    aiAnalysis: {
      description: `Detected civic irregularity involving ${category}. Heuristic determination: "${userNote || 'Citizen photo submission'}"`,
      hazards,
      confidence: 0.88
    },
    department,
    officer: selectedWard.representative,
    complaintEn,
    complaintHi,
    status: 'open',
    createdAt: Date.now(),
    lastEscalatedAt: null,
    coWitnesses: [],
    embedding: [0.03, 0.12, -0.05],
    duplicateOf: null,
    note: userNote
  };
}
