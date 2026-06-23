import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { db, auth, ensureAnonymousAuth } from '../firebase';
import { CivicReport, IssueStatus } from '../types';
import { INITIAL_REPORTS } from '../data/mockData';

const STORAGE_KEY = 'nagarmitra_reports';

// Load reports initialized with the static dataset if storage is empty.
function getLocalReports(): CivicReport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REPORTS));
      return INITIAL_REPORTS;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error("Local storage read failure:", e);
    return INITIAL_REPORTS;
  }
}

function saveLocalReports(reports: CivicReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error("Local storage write failure:", e);
  }
}

export async function fetchReports(): Promise<CivicReport[]> {
  if (!db) {
    console.log("Firebase not configured. Serving from local storage.");
    return getLocalReports();
  }

  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const serverReports: CivicReport[] = [];
    
    querySnapshot.forEach((docSnap) => {
      serverReports.push({
        id: docSnap.id,
        ...docSnap.data()
      } as CivicReport);
    });

    if (serverReports.length === 0) {
      // Seed Firestore if empty with some base examples
      console.log("Firestore reports collection empty. Seeding with default data.");
      const localReports = getLocalReports();
      for (const rep of localReports) {
        const { id, ...cleanRep } = rep;
        await addDoc(collection(db, 'reports'), cleanRep);
      }
      return fetchReports(); // Fetch again after seeding
    }

    return serverReports;
  } catch (error) {
    console.error("Failed to query Firestore reports. Falling back to local storage:", error);
    return getLocalReports();
  }
}

export async function createReport(reportData: Omit<CivicReport, 'id'>): Promise<CivicReport> {
  // Ensure anonymous auth beforehand
  await ensureAnonymousAuth();

  if (!db) {
    console.log("Saving report to local storage (Firebase Offline).");
    const local = getLocalReports();
    const newReport: CivicReport = {
      ...reportData,
      id: 'rep_local_' + Math.random().toString(36).substr(2, 9)
    };
    local.unshift(newReport);
    saveLocalReports(local);
    return newReport;
  }

  try {
    const docRef = await addDoc(collection(db, 'reports'), reportData);
    return {
      ...reportData,
      id: docRef.id
    };
  } catch (error) {
    console.error("Firestore report submit failed. Saving locally as fallback:", error);
    const local = getLocalReports();
    const newReport: CivicReport = {
      ...reportData,
      id: 'rep_local_' + Math.random().toString(36).substr(2, 9)
    };
    local.unshift(newReport);
    saveLocalReports(local);
    return newReport;
  }
}

export async function updateReportStatus(reportId: string, status: IssueStatus): Promise<boolean> {
  if (!db || reportId.startsWith('rep_local_')) {
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      local[index].status = status;
      if (status === 'escalated') {
        local[index].lastEscalatedAt = Date.now();
      }
      saveLocalReports(local);
      return true;
    }
    return false;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    const updates: Partial<CivicReport> = { status };
    if (status === 'escalated') {
      updates.lastEscalatedAt = Date.now();
    }
    await updateDoc(docRef, updates);
    return true;
  } catch (error) {
    console.error("Firestore status modify failed. Attempting local edit:", error);
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      local[index].status = status;
      saveLocalReports(local);
      return true;
    }
    return false;
  }
}

export async function addCoWitness(reportId: string, email: string): Promise<boolean> {
  if (!db || reportId.startsWith('rep_local_')) {
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      if (!local[index].coWitnesses.includes(email)) {
        local[index].coWitnesses.push(email);
        saveLocalReports(local);
      }
      return true;
    }
    return false;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    await updateDoc(docRef, {
      coWitnesses: arrayUnion(email)
    });
    return true;
  } catch (error) {
    console.error("Firestore witness attachment failed. Writing locally:", error);
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      if (!local[index].coWitnesses.includes(email)) {
        local[index].coWitnesses.push(email);
        saveLocalReports(local);
      }
      return true;
    }
    return false;
  }
}
