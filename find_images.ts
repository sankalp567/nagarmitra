import fs from 'fs';
import path from 'path';

const now = Date.now();
const fifteenMins = 15 * 60 * 1000;

function walk(dir: string, depth = 0) {
  if (depth > 6) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.git' && file !== '.next' && file !== 'dist' && file !== 'sys' && file !== 'proc' && file !== 'dev') {
          walk(fullPath, depth + 1);
        }
      } else {
        const age = now - stat.mtimeMs;
        if (age < fifteenMins) {
          console.log(`RECENTLY MODIFIED: ${fullPath} (${stat.size} bytes, ${Math.round(age / 1000)}s ago)`);
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

walk('/');
