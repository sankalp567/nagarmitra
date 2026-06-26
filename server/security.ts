import express from 'express';
import crypto from 'crypto';

// Rate limit state
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

const getLimitAndDuration = (path: string, method: string) => {
  if (method === 'POST') {
    if (path === '/api/analyze') return { limit: 10, duration: 60 };
    if (path === '/api/chat') return { limit: 20, duration: 60 };
    if (path === '/api/escalate-notice') return { limit: 5, duration: 300 };
    if (path === '/api/watchdog') return { limit: 3, duration: 300 };
  }
  return { limit: 60, duration: 60 };
};

// Purge rate limits map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    const parts = key.split(':');
    const method = parts[1];
    const path = parts.slice(2).join(':');
    const { duration } = getLimitAndDuration(path, method);
    if (now > record.windowStart + duration * 1000) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// HMAC Token state
const secret = crypto.randomBytes(32).toString('hex');

const generateHMAC = (data: string, secretKey: string): string => {
  return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
};

const base64urlEncode = (str: string): string => {
  return Buffer.from(str, 'utf8').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const base64urlDecode = (str: string): string => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

// Rate limiter middleware
const rateLimiterMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const ip = req.ip || 'unknown';
  const path = req.path;
  const method = req.method;
  
  const { limit, duration } = getLimitAndDuration(path, method);
  const key = `${ip}:${method}:${path}`;
  const now = Date.now();
  
  const record = rateLimitMap.get(key);
  if (!record) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return next();
  }
  
  if (now > record.windowStart + duration * 1000) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return next();
  }
  
  if (record.count >= limit) {
    const secondsRemaining = Math.ceil(((record.windowStart + duration * 1000) - now) / 1000);
    res.setHeader('Retry-After', String(secondsRemaining));
    return res.status(429).json({
      error: "rate_limit",
      retryAfter: secondsRemaining,
      message: `Too many requests — please wait ${secondsRemaining} seconds`
    });
  }
  
  record.count += 1;
  return next();
};

// Payload Guard
const payloadGuardMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const method = req.method;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(415).json({
        error: "unsupported_media_type",
        message: "Content-Type must be application/json"
      });
    }
  }
  return next();
};

// HMAC Session token middleware (specifically for POST /api/analyze)
const sessionTokenMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers['x-session-token'];
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: "invalid_token", message: "Session token invalid or expired" });
  }

  try {
    const decoded = base64urlDecode(token);
    const parts = decoded.split(':');
    if (parts.length < 3) {
      return res.status(401).json({ error: "invalid_token", message: "Session token invalid or expired" });
    }

    const hmac = parts[parts.length - 1];
    const timestampStr = parts[parts.length - 2];
    const ip = parts.slice(0, parts.length - 2).join(':');

    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();

    if (isNaN(timestamp) || Math.abs(now - timestamp) > 1800 * 1000) {
      return res.status(401).json({ error: "invalid_token", message: "Session token invalid or expired" });
    }

    const reqIp = req.ip || 'unknown';
    if (ip !== reqIp) {
      return res.status(401).json({ error: "invalid_token", message: "Session token invalid or expired" });
    }

    const dataToSign = `${ip}:${timestampStr}`;
    const expectedHmac = generateHMAC(dataToSign, secret);
    if (hmac !== expectedHmac) {
      return res.status(401).json({ error: "invalid_token", message: "Session token invalid or expired" });
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token", message: "Session token invalid or expired" });
  }
};

// Input Validation for POST /api/analyze
const analyzeInputValidationMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let imageBase64 = req.body.imageBase64;
  let mimeType = req.body.mimeType;

  if (req.body.photoUrl && typeof req.body.photoUrl === 'string' && req.body.photoUrl.startsWith('data:')) {
    const matches = req.body.photoUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      imageBase64 = matches[2];
    }
  }

  if (imageBase64) {
    if (!imageBase64.startsWith('/9j/') && !imageBase64.startsWith('iVBOR') && !imageBase64.startsWith('UklGR')) {
      return res.status(400).json({ error: "invalid_image", field: "imageBase64", message: "Invalid image encoding" });
    }
    
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
      return res.status(400).json({ error: "invalid_image", message: "MIME type must be one of image/jpeg, image/png, image/webp" });
    }
  }

  const { lat, lng } = req.body;
  if (typeof lat !== 'undefined') {
    const latNum = Number(lat);
    if (isNaN(latNum) || !isFinite(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({ error: "invalid_location", field: "lat", message: "Latitude must be a valid number between -90 and 90" });
    }
    req.body.lat = latNum;
  } else {
    return res.status(400).json({ error: "invalid_location", field: "lat", message: "Latitude is required" });
  }

  if (typeof lng !== 'undefined') {
    const lngNum = Number(lng);
    if (isNaN(lngNum) || !isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: "invalid_location", field: "lng", message: "Longitude must be a valid number between -180 and 180" });
    }
    req.body.lng = lngNum;
  } else {
    return res.status(400).json({ error: "invalid_location", field: "lng", message: "Longitude is required" });
  }

  if (typeof req.body.note === 'string') {
    req.body.note = req.body.note.slice(0, 500);
  }

  return next();
};

// Input Validation for POST /api/chat
const chatInputValidationMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const message = req.body.message;
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 1000) {
    return res.status(400).json({ error: "invalid_message", message: "Message must be 1–1000 characters" });
  }
  req.body.message = message.replace(/<[^>]*>/g, '');
  return next();
};

export function applySecurityMiddleware(app: express.Express) {
  // Layer 1: IP Rate Limiter
  app.use(rateLimiterMiddleware);

  // Layer 2: Payload Guard
  app.use(payloadGuardMiddleware);

  // Layer 4: GET /api/token
  app.get("/api/token", (req, res) => {
    const ip = req.ip || 'unknown';
    const timestamp = Date.now().toString();
    const dataToSign = `${ip}:${timestamp}`;
    const hmac = generateHMAC(dataToSign, secret);
    const tokenPayload = `${ip}:${timestamp}:${hmac}`;
    const token = base64urlEncode(tokenPayload);
    return res.json({ token, expiresIn: 1800 });
  });

  // Layer 3 & Layer 4 selective checks
  app.use((req, res, next) => {
    if (req.method === 'POST') {
      if (req.path === '/api/analyze') {
        return sessionTokenMiddleware(req, res, () => {
          return analyzeInputValidationMiddleware(req, res, next);
        });
      }
      if (req.path === '/api/chat') {
        return chatInputValidationMiddleware(req, res, next);
      }
    }
    return next();
  });
}
