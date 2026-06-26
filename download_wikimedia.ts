import fetch from 'node-fetch';
import fs from 'fs';

const variations = [
  // Potholes
  { name: 'pothole', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Pothole_with_water%2C_looking_east.JPG' },
  { name: 'pothole', url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Pothole_with_water,_looking_east.JPG' },
  { name: 'pothole', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Pothole_with_water%2C_looking_east.JPG/640px-Pothole_with_water%2C_looking_east.JPG' },
  { name: 'pothole', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Pothole_with_water,_looking_east.JPG/640px-Pothole_with_water,_looking_east.JPG' },
  
  // Garbage
  { name: 'garbage', url: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Garbage_and_dog_on_the_street_in_India.jpg' },
  { name: 'garbage', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Garbage_and_dog_on_the_street_in_India.jpg/640px-Garbage_and_dog_on_the_street_in_India.jpg' },
  
  // Leak
  { name: 'leak', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Leak_in_waterpipe%2C_looking_southwest.JPG' },
  { name: 'leak', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Leak_in_waterpipe,_looking_southwest.JPG' },
  { name: 'leak', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Leak_in_waterpipe%2C_looking_southwest.JPG/640px-Leak_in_waterpipe%2C_looking_southwest.JPG' },
  { name: 'leak', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Leak_in_waterpipe,_looking_southwest.JPG/640px-Leak_in_waterpipe,_looking_southwest.JPG' }
];

async function check() {
  for (const item of variations) {
    try {
      console.log(`Checking ${item.url}...`);
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(`${item.name}_test_${variations.indexOf(item)}.jpg`, Buffer.from(buffer));
        console.log(`Saved successfully!`);
      }
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }
}

check();
