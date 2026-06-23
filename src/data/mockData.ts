import { CivicReport } from '../types';

export const INITIAL_REPORTS: CivicReport[] = [
  {
    id: "rep_001",
    photoUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
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
    department: "GMC Road Engineering Department",
    officer: "Dr. Ramesh Patel (Executive Engineer)",
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
    photoUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
    geo: {
      lat: 23.2215,
      lng: 72.6482,
      ward: "ward_03",
      wardName: "Ward 3 (Sectors 15-21)"
    },
    category: "Garbage & Sanitation",
    severity: 3,
    aiAnalysis: {
      description: "Overflowing commercial dumpster with garbage spilling onto the pedestrian footpath, attracting stray cattle and birds.",
      hazards: ["Health hazard from decay", "Footpath blockage", "Stray cattle accident risk"],
      confidence: 0.89
    },
    department: "GMC Solid Waste Management",
    officer: "Shri Amit Shah (Zonal Officer)",
    complaintEn: "To,\nThe Health Officer / Waste Management Division,\nGandhinagar Municipal Corporation.\n\nSubject: Malodor and overflow of garbage dumpster in Sector 17 Market.\n\nRespected Officer,\nAn overflowing public dumpster has been left uncollected in Sector 17 commercial market for over 48 hours. The rotting waste has spilled over the pedestrian footpath, inducing an intolerable stench and breeding stray dogs and cattle. Requesting immediate clearing and regular schedules.\n\nBest Regards,\nNagarMitra User",
    complaintHi: "सेवा में,\nस्वास्थ्य अधिकारी / ठोस कचरा प्रबंधन प्रभाग,\nगांधीनगर नगर निगम।\n\nविषय: सेक्टर 17 बाजार में कचरा डंपर के ओवरफ्लो होने और दुर्गंध के संबंध में।\n\nआदरणीय अधिकारी महोदय,\nसेक्टर 17 के व्यावसायिक बाजार में एक सार्वजनिक कचरा डंपर पिछले 48 घंटों से खाली नहीं किया गया है। सड़ा हुआ कचरा पैदल चलने वाले फुटपाथ पर फैल गया है, जिससे असहनीय दुर्गंध आ रही है और गाय-कुत्तों का जमावड़ा लगा हुआ है। तत्काल सफाई सुनिश्चित की जाए।\n\nसादर,\nनगरमित्र उपयोगकर्ता",
    status: "acknowledged",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
    lastEscalatedAt: null,
    coWitnesses: [],
    embedding: [0.12, 0.3, -0.15],
    duplicateOf: null,
    note: "Sanitation trucks haven't visited this sector since Monday."
  },
  {
    id: "rep_003",
    photoUrl: "https://images.unsplash.com/photo-1509395062183-67c5ad6faff9?auto=format&fit=crop&w=600&q=80",
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
    complaintHi: "सेवा में,\nमुख्य विद्युत अभियंता,\nगांधीनगर नगर निगम।\n\nविषय: कुदासन-सरगासन लिंक रोड पर स्ट्रीटलाइट ग्रिड खराब होने के संबंध में।\n\nप्रिय महोदय,\nसूचित करना है कि कुदासन में मुख्य आवासीय एवेन्यू की स्ट्रीटलाइट्स लगातार तीन रातों से चालू नहीं हुई हैं। पूरा मार्ग गहरे अंधकार में डूबा हुआ है, जिससे महिलाओं और बुजुर्गों की सुरक्षा को लेकर गंभीर चिंताएं पैदा हो गई हैं। कृपया प्राथमिकता के आधार पर इसे ठीक कराएं।\n\nधन्यवाद,\nस्थानीय निवासी",
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
    photoUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
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
