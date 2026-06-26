import { CivicReport } from '../types';

export function getSvgDataUriForCategory(category: string): string {
  const cat = category.toLowerCase();
  
  if (cat.includes('pothole') || cat.includes('road')) {
    const potholeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#78350f"/><text x="100" y="65" font-family="Arial" font-size="42" text-anchor="middle" fill="white">🕳️</text><text x="100" y="110" font-family="Arial" font-size="13" text-anchor="middle" fill="#fef3c7">Potholes &amp; Roads</text></svg>`;
    const base64 = typeof btoa !== 'undefined' 
      ? btoa(unescape(encodeURIComponent(potholeSvg))) 
      : Buffer.from(potholeSvg, 'utf-8').toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
  
  if (cat.includes('drainage') || cat.includes('flooding') || cat.includes('overflow') || cat.includes('waterlogging')) {
    const overflowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#1e40af"/><text x="100" y="65" font-family="Arial" font-size="42" text-anchor="middle" fill="white">🌊</text><text x="100" y="110" font-family="Arial" font-size="13" text-anchor="middle" fill="#dbeafe">Drainage &amp; Flooding</text></svg>`;
    const base64 = typeof btoa !== 'undefined' 
      ? btoa(unescape(encodeURIComponent(overflowSvg))) 
      : Buffer.from(overflowSvg, 'utf-8').toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
  
  let bgColor = '#6B7280'; // Others
  let iconPaths = '';
  let label = category;
  
  if (cat.includes('streetlight') || cat.includes('lighting')) {
    bgColor = '#EAB308'; // yellow
    iconPaths = `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" />`;
    label = "Street Lighting";
  } else if (cat.includes('garbage') || cat.includes('sanitation')) {
    bgColor = '#22C55E'; // green
    iconPaths = `<path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />`;
    label = "Garbage & Sanitation";
  } else if (cat.includes('water supply') || cat.includes('sewage') || cat.includes('water tap')) {
    bgColor = '#06B6D4'; // cyan
    iconPaths = `<path d="M2 12h6" /><path d="M8 10h8c1 0 2 1 2 2v3" /><path d="M12 10V6M9 6h6" /><path d="M18 19a1.5 1.5 0 1 1-3 0c0-1 1.5-2.5 1.5-2.5s1.5 1.5 1.5 2.5z" />`;
    label = "Water Supply";
  } else if (cat.includes('park') || cat.includes('footpath') || cat.includes('tree')) {
    bgColor = '#10B981'; // teal
    iconPaths = `<path d="M8 19a5 5 0 0 1-2.23-9.5A6 6 0 0 1 16 7a5 5 0 0 1 1.77 9.5A5 5 0 0 1 16 19Z" /><path d="M12 19v3" />`;
    label = "Parks & Footpaths";
  } else {
    bgColor = '#6B7280'; // gray
    iconPaths = `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />`;
    label = category;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <rect width="100%" height="100%" fill="${bgColor}" />
    <rect x="15" y="15" width="370" height="270" rx="12" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
    <g transform="translate(152, 70) scale(4)" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
      ${iconPaths}
    </g>
    <text x="200" y="235" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="0.5">
      ${label}
    </text>
    <text x="200" y="260" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-weight="500" letter-spacing="1">
      NAGARMITRA CIVIC PLATFORM
    </text>
  </svg>`.replace(/\s+/g, ' ');

  let base64 = '';
  if (typeof btoa !== 'undefined') {
    base64 = btoa(unescape(encodeURIComponent(svg)));
  } else if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(svg, 'utf-8').toString('base64');
  }
  return `data:image/svg+xml;base64,${base64}`;
}

export const INITIAL_REPORTS: CivicReport[] = [
  {
    id: "rep_001",
    referenceId: "GMC-REF-100001",
    photoUrl: getSvgDataUriForCategory("Potholes & Roads"),
    geo: {
      lat: 23.2172,
      lng: 72.6385,
      ward: "ward_01",
      wardName: "Ward 1 (Sectors 1-7)"
    },
    category: "Potholes & Roads",
    severity: 4,
    aiAnalysis: {
      description: "Severe road deterioration and deep potholes creating hazardous driving conditions near the sector main intersection.",
      hazards: ["Vehicle damage risk", "Two-wheeler skidding hazard", "Traffic traffic bottleneck"],
      confidence: 0.94
    },
    department: "GMC Roads & Engineering Division",
    officer: "Executive Engineer, Roads & Engineering",
    complaintEn: "To,\nThe Municipal Commissioner,\nGandhinagar Municipal Corporation.\n\nSubject: Urgent repair of deep potholes near Sector 3 Intersection.\n\nDear Sir/Madam,\nThis is to draw your immediate attention to the critical state of the road near Sector 3 intersection. Multiple deep potholes have opened up, causing severe vehicle damage and presenting an immediate collision hazard for two-wheeler commuters, especially during night hours. Prompt resurfacing is highly requested.\n\nSincerely,\nConcerned Citizen of Gandhinagar",
    complaintHi: "सेवा में,\nनगर आयुक्त,\nगांधीनगर नगर निगम।\n\nविषय: सेक्टर 3 चौराहे के पास गहरे गड्ढों की तत्काल मरम्मत के संबंध में।\n\nमहोदय/महोदया,\nइस पत्र के माध्यम से आपका ध्यान सेक्टर 3 चौराहे के पास सड़क की अत्यंत जर्जर स्थिति की ओर आकर्षित करना है। सड़क पर कई गहरे गड्ढे हो गए हैं, जिससे वाहनों को भारी नुकसान हो रहा है और दोपहिया वाहन चालकों के फिसलने का गंभीर खतरा बना हुआ है। कृपया इस पर तत्काल संज्ञान लेकर सड़क मरम्मत का कार्य शुरू कराएं।\n\nभवदीय,\nगांधीनगर का जागरूक नागरिक",
    status: "open",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
    lastEscalatedAt: null,
    coWitnesses: ["sankalpturankar567@gmail.com", "gandhinagar_resident_12@gmail.com"],
    embedding: [0.1, -0.2, 0.45],
    duplicateOf: null,
    note: "Potholes are very deep. Already saw a scooter slide today morning."
  },
  {
    id: "rep_002",
    referenceId: "GMC-REF-100002",
    photoUrl: getSvgDataUriForCategory("Drainage & Flooding"),
    geo: {
      lat: 23.2215,
      lng: 72.6482,
      ward: "ward_03",
      wardName: "Ward 3 (Sectors 15-21)"
    },
    category: "Drainage & Flooding",
    severity: 3,
    aiAnalysis: {
      description: "Severe waterlogging and drainage overflow in Sector 17 commercial market.",
      hazards: ["Vehicle stalling risk", "Pedestrian slip and fall risk", "Contaminated water exposure"],
      confidence: 0.92
    },
    department: "GMC Water Works Division",
    officer: "Executive Engineer, Drainage & Water Works",
    complaintEn: "To,\nThe Health Officer / Waste Management Division,\nGandhinagar Municipal Corporation.\n\nSubject: Urgent attention required for drainage overflow in Sector 17 Market.\n\nRespected Officer,\nThis is to report severe drainage overflow and waterlogging in the Sector 17 Market area. The stagnant water has accumulated on the main road and walkways, creating extremely unhygienic conditions and disrupting commercial activities. Immediate action to clear the blockage is highly requested.\n\nSincerely,\nConcerned Citizen of Gandhinagar",
    complaintHi: "सेवा में,\nस्वास्थ्य अधिकारी / ठोस कचरा प्रबंधन प्रभाग,\nगांधीनगर नगर निगम।\n\nविषय: सेक्टर 17 बाजार में सीवरेज और जलभराव की समस्या के संबंध में।\n\nआदरणीय अधिकारी महोदय,\nइस पत्र के माध्यम से सेक्टर 17 बाजार क्षेत्र में सीवरेज के अतिप्रवाह और जलभराव की गंभीर समस्या की ओर आपका ध्यान आकर्षित करना है। बाजार के मुख्य मार्ग पर गंदा पानी जमा हो गया है, जिससे भारी परेशानी हो रही है। कृपया तत्काल सफाई कराएं।\n\nभवदीय,\nजागरूक नागरिक",
    status: "acknowledged",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
    lastEscalatedAt: null,
    coWitnesses: [],
    embedding: [0.12, 0.3, -0.15],
    duplicateOf: null,
    note: "Drainage lines are completely blocked."
  },
  {
    id: "rep_003",
    referenceId: "GMC-REF-100003",
    photoUrl: getSvgDataUriForCategory("Streetlights"),
    geo: {
      lat: 23.1895,
      lng: 72.6288,
      ward: "ward_05",
      wardName: "Ward 5 (Kudasan & Sargasan)"
    },
    category: "Streetlights",
    severity: 5,
    aiAnalysis: {
      description: "Complete failure of primary street lighting grid spanning a major residential back street, creating absolute dark zones.",
      hazards: ["Pedestrian security risk", "Increased crime susceptibility", "Low visibility driver hazard"],
      confidence: 0.98
    },
    department: "GMC Electrical Maintenance Department",
    officer: "Smt. Priya Sharma (Health Officer / Coordinator)",
    complaintEn: "To,\nThe Chief Electrical Engineer,\nGandhinagar Municipal Corporation.\n\nSubject: Streetlight grid failure along Kudasan-Sargasan Link Road.\n\nDear Sir,\nThis is to report that the civic streetlights along the primary residential avenue in Kudasan have been non-functional for three consecutive nights. The entire street is engulfed in total darkness, presenting significant safety concerns for female commuters and senior citizens after dark. Please dispatch maintenance crews on high priority.\n\nThanking you,\nResident Association Member",
    complaintHi: "सेवा में,\nमुख्य विद्युत अभियंता,\nगांधीनगर नगर निगम।\n\nविषय: कुदासन-सरगासन लिंक रोड पर स्ट्रीटलाइट ग्रिड खराब होने के संबंध में।\n\nप्रिय महोदय,\nसूची करना है कि कुदासन में मुख्य आवासीय एवेन्यू की स्ट्रीटलाइट्स लगातार तीन रातों से चालू नहीं हुई हैं। पूरा मार्ग गहरे अंधकार में डूबा हुआ है, जिससे महिलाओं और बुजुर्गों की सुरक्षा को लेकर गंभीर चिंताएं पैदा हो गई हैं। कृपया प्राथमिकता के आधार पर इसे ठीक कराएं।\n\nधन्यवाद,\nस्थानीय निवासी",
    status: "escalated",
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
    lastEscalatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    coWitnesses: ["neighbor_kudasan@rwa.org", "resident234@gmail.com", "vavol_citizen@outlook.com"],
    embedding: [-0.05, -0.4, 0.22],
    duplicateOf: null,
    note: "Whole street is pitch black from 7:00 PM onwards."
  },
  {
    id: "rep_004",
    referenceId: "GMC-REF-100004",
    photoUrl: getSvgDataUriForCategory("Water Supply & Sewage"),
    geo: {
      lat: 23.2354,
      lng: 72.6598,
      ward: "ward_06",
      wardName: "Ward 6 (Infocity & Indroda)"
    },
    category: "Water Supply & Sewage",
    severity: 2,
    aiAnalysis: {
      description: "Minor leakage from clean water pipeline causing water logging on secondary pavement.",
      hazards: ["Water wastage", "Moss accumulation slipperiness"],
      confidence: 0.91
    },
    department: "GMC Water Works Division",
    officer: "Shri Nilesh Mehta (IT & Sanitation Chief / Coordinator)",
    complaintEn: "To,\nThe Executive Engineer (Water Works Division),\nGandhinagar Municipal Corporation.\n\nSubject: Pipeline leakage and standing water near Infocity Road.\n\nRespected Sir,\nI am writing to report a slow but persistent clean water leakage from the utility pipeline valve at Infocity Road. Thousands of liters of pure water are leaking daily, leading to stagnant logs on the pavement. Prompt valve sealing is highly appreciated.\n\nCordially,\nInfocity Commuter",
    complaintHi: "सेवा में,\nअधिशासी अभियंता (जल कार्य प्रभाग),\nगांधीनगर नगर निगम।\n\nविषय: इन्फोसिटी रोड के पास पाइपलाइन लीकेज और जलभराव के संबंध में।\n\nआदरणीय महोदय,\nइन्फोसिटी रोड पर उपयोगिता पाइपलाइन वाल्व से लगातार हो रहे स्वच्छ जल रिसाव की रिपोर्ट दर्ज कराना चाहता हूँ। प्रतिदिन हजारों लीटर पानी बर्बाद हो रहा है और फुटपाथ पर पानी जमा हो रहा है। कृपया वाल्व को तत्काल ठीक करें।\n\nसादर,\nसंबंधित नागरिक",
    status: "resolved",
    createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000, // 12 days ago
    lastEscalatedAt: null,
    coWitnesses: [],
    embedding: [0.15, 0.1, -0.3],
    duplicateOf: null,
    note: "It is drinking water leaking. Please fix soon."
  }
];
