import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { analyzeIssueImageStub } from "./server/civicEngine";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure middleware for JSON and URL payloads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Route - Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", appName: "NagarMitra Server" });
  });

  // API Route - Analyze Civic Issue Photo / Note (AI Stubs)
  app.post("/api/analyze", async (req: express.Request, res: express.Response) => {
    try {
      const { photoUrl, note, lat, lng } = req.body;
      
      const latitude = Number(lat) || 23.2156 + (Math.random() - 0.5) * 0.04;
      const longitude = Number(lng) || 72.6369 + (Math.random() - 0.5) * 0.04;

      if (!photoUrl) {
        return res.status(400).json({ error: "photoUrl is required for analysis." });
      }

      console.log(`[Server API] Received /api/analyze request. Latitude: ${latitude}, Longitude: ${longitude}`);
      
      // Run municipal stubs
      const analyzedReportData = await analyzeIssueImageStub(
        photoUrl,
        note || "",
        latitude,
        longitude
      );

      return res.status(200).json({
        success: true,
        report: analyzedReportData
      });
    } catch (error) {
      console.error("[Server Error] Failed during issue analysis:", error);
      return res.status(500).json({ error: "Internal Server Error analyzing image" });
    }
  });

  // Vite development vs production compiler middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode.");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NagarMitra Server is listening at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error booting full-stack server:", err);
});
