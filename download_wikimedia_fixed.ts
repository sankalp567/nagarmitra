import fetch from 'node-fetch';
import fs from 'fs';

const urls = [
  // Pothole options
  { name: 'pothole1', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Pothole_with_water%2C_looking_east.JPG/640px-Pothole_with_water%2C_looking_east.JPG' },
  { name: 'pothole2', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Pothole_with_water,_looking_east.JPG/640px-Pothole_with_water,_looking_east.JPG' },
  { name: 'pothole3', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Pothole_with_water,_looking_east.JPG' },
  { name: 'pothole4', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Pothole_with_water%2C_looking_east.JPG' },

  // Garbage options
  { name: 'garbage1', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Garbage_and_dog_on_the_street_in_India.jpg/640px-Garbage_and_dog_on_the_street_in_India.jpg' },
  { name: 'garbage2', url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Garbage_and_dog_on_the_street_in_India.jpg' },

  // Leak options
  { name: 'leak1', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Leak_in_waterpipe%2C_looking_southwest.JPG/640px-Leak_in_waterpipe%2C_looking_southwest.JPG' },
  { name: 'leak2', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Leak_in_waterpipe,_looking_southwest.JPG/640px-Leak_in_waterpipe,_looking_southwest.JPG' },
  { name: 'leak3', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Leak_in_waterpipe,_looking_southwest.JPG' },
  { name: 'leak4', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Leak_in_waterpipe%2C_looking_southwest.JPG' }
];

async function download() {
  for (const item of urls) {
    try {
      console.log(`Downloading ${item.name} from ${item.url}...`);
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Wget/1.21.1'
        }
      });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(`${item.name}.jpg`, Buffer.from(buffer));
        console.log(`Saved ${item.name}.jpg (${buffer.byteLength} bytes)`);
      } else {
        const text = await res.text();
        console.log(`Failed: ${text.slice(0, 150)}`);
      }
    } catch (e: any) {
      console.log(`Error ${item.name}: ${e.message}`);
    }
    // sleep 500ms to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

download();
