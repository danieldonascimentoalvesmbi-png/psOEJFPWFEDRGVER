import express, { Request, Response, NextFunction } from "express";
import path from "path";
import jwt from "jsonwebtoken";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { initDB, dbOperations, fetchHabboData } from "./src/server/db.js";
import { MilitaryRank, UserStatus, UserActiveState } from "./src/types.js";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.GEMINI_API_KEY || "FMB_ESPIRITO_NACIONAL_TACTICAL_SECRET_2026";

// Initialize persistent database
initDB();

// Ensure local uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Configure multer file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".pdf") {
      return cb(new Error("Apenas arquivos no formato PDF são autorizados para o acervo de manuais táticos."));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB maximum
  }
});

const uploadImage = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    if (!allowed.includes(ext)) {
      return cb(new Error("Apenas imagens são autorizadas para relatórios de aulas (.png, .jpg, .jpeg, .webp, .gif)."));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB maximum for prints
  }
});


app.use(express.json());

// TYPES AND INTERFACES FOR EXPRESS LOGS/REQUESTS
interface AuthRequest extends Request {
  userId?: string;
  userRank?: MilitaryRank;
}

// Authentication Middleware
const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Sua sessão expirou ou o token é inválido. Autentique-se novamente." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = dbOperations.getUserById(decoded.userId);
    
    if (!user) {
      res.status(403).json({ error: "Militar não localizado no centro de comando." });
      return;
    }

    if (user.status === UserStatus.BANIDO) {
      res.status(403).json({ error: "Esta conta se encontra BANIDA do sistema." });
      return;
    }

    if (user.status === UserStatus.SUSPENSO) {
      res.status(403).json({ error: "Sua conta está temporariamente SUSPENSA do sistema." });
      return;
    }

    req.userId = user.id;
    req.userRank = user.role;
    next();
  } catch (err) {
    res.status(403).json({ error: "Token inválido, corrompido ou expirado." });
  }
};

// --- AUTHENTICATION ENDPOINTS ---

// Login
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Identificação militar errada: Nick e Senha são de preenchimento obrigatório." });
    return;
  }

  try {
    const user = dbOperations.authenticateUser(username, password);
    if (!user) {
      res.status(400).json({ error: "Militar não localizado ou senha tática incorreta." });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    res.json({
      token,
      user
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Erro durante o login militar." });
  }
});

// Logout
app.post("/api/auth/logout", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userId) {
    dbOperations.logoutUser(req.userId);
  }
  res.json({ message: "Desconexão efetuada com sucesso!" });
});

// Get session militar info
app.get("/api/me", authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(400).json({ error: "Militar não identificado." });
    return;
  }
  const user = dbOperations.getUserById(req.userId);
  res.json(user);
});


// --- MILITARY PERSONNEL MANAGEMENT ---

// List all militars
app.get("/api/users", authenticateToken, (req: AuthRequest, res: Response) => {
  const users = dbOperations.getUsers();
  // Don't return password hashes (the dbOperations avoids returning password hashes directly as we split them in dbStructure)
  res.json(users);
});

// Get single militar (including detailed logs/stats)
app.get("/api/users/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  const user = dbOperations.getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "Registro militar não localizado." });
    return;
  }
  
  // Return their detailed history
  const promotions = dbOperations.getPromotions().filter(
    p => p.promotedMilitarId === user.id || p.promoterId === user.id
  );
  const trainings = dbOperations.getTrainings().filter(
    t => t.instructorId === user.id || t.participants.includes(user.habboNick)
  );
  const pontes = dbOperations.getPontoLogs().filter(p => p.userId === user.id);
  const progress = dbOperations.getMissionProgress(user.id);

  res.json({
    user,
    promotions,
    trainings,
    pontes,
    progress
  });
});

// Alistar Militar (Insert Count)
app.post("/api/users", authenticateToken, async (req: AuthRequest, res: Response) => {
  // Only Admin Supremo or higher military ranks can enrol
  const ranksAllowedToEnlist = [
    MilitaryRank.ADMSUPREMO,
    MilitaryRank.COMANDANTE_GERAL,
    MilitaryRank.GENERAL_EXERCITO,
    MilitaryRank.GENERAL_DIVISAO,
    MilitaryRank.GENERAL_BRIGADA,
    MilitaryRank.CORONEL,
    MilitaryRank.TENENTE_CORONEL,
    MilitaryRank.MAJOR
  ];

  if (!req.userRank || !ranksAllowedToEnlist.includes(req.userRank)) {
    res.status(403).json({ error: "Seu cargo militar não possui autorização tática para alistar recrutas." });
    return;
  }

  const { habboNick, password, role } = req.body;
  if (!habboNick || !password || !role) {
    res.status(400).json({ error: "Dados incompletos. Informe Nick Habbo, Senha e Patente inicial." });
    return;
  }

  try {
    const newUser = await dbOperations.createUser(habboNick, password, role as MilitaryRank);
    res.status(201).json(newUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Falha ao alistar militar." });
  }
});

// Promote / Demote Militar
app.put("/api/users/:id/rank", authenticateToken, (req: AuthRequest, res: Response) => {
  const { newRank, reason } = req.body;
  const targetId = req.params.id;
  const promoterId = req.userId!;

  if (!newRank || !reason) {
    res.status(400).json({ error: "Especifique a nova patente militar e a justificativa oficial." });
    return;
  }

  try {
    const promoter = dbOperations.getUserById(promoterId)!;
    const target = dbOperations.getUserById(targetId);
    if (!target) {
      res.status(404).json({ error: "Militar não localizado." });
      return;
    }

    // Role hierarchies
    const isSupremo = promoter.role === MilitaryRank.ADMSUPREMO;

    if (!isSupremo) {
      // Must be officer
      const allowedOfficers = [
        MilitaryRank.COMANDANTE_GERAL,
        MilitaryRank.GENERAL_EXERCITO,
        MilitaryRank.GENERAL_DIVISAO,
        MilitaryRank.GENERAL_BRIGADA,
        MilitaryRank.CORONEL,
        MilitaryRank.TENENTE_CORONEL,
        MilitaryRank.MAJOR,
        MilitaryRank.CAPITAO
      ];
      if (!allowedOfficers.includes(promoter.role)) {
        res.status(403).json({ error: "Patentes subalternas não têm autonomia de promoção/rebaixamento." });
        return;
      }
    }

    // Compare hierarchies
    // Promoted rank or old rank can't be above promoter's rank unless they are Supremo
    if (!isSupremo) {
      const getRankValue = (r: MilitaryRank) => {
        const order = Object.values(MilitaryRank);
        return order.indexOf(r);
      };
      // High indexes are higher ranks in the enum list!
      // Soldado is last in Enum definition? No, look at types.ts getRankOrder!
      // In types.ts we coded a helper getRankOrder()
      const { getRankOrder } = require("./src/types.js");
      const pOrder = getRankOrder(promoter.role);
      const tOrder = getRankOrder(target.role);
      const nOrder = getRankOrder(newRank as MilitaryRank);

      if (tOrder >= pOrder) {
        res.status(403).json({ error: "Você não possui precedência para alterar a patente de um militar de nível igual ou superior ao seu." });
        return;
      }

      if (nOrder >= pOrder) {
        res.status(403).json({ error: "Você não pode promover um militar para um nível igual ou acima do seu próprio." });
        return;
      }
    }

    // Determine if it is a promotion or demotion
    const { getRankOrder } = require("./src/types.js");
    const tOrder = getRankOrder(target.role);
    const nOrder = getRankOrder(newRank as MilitaryRank);

    let result;
    if (nOrder > tOrder) {
      result = dbOperations.promoteMilitar(promoterId, targetId, newRank as MilitaryRank, reason);
    } else {
      result = dbOperations.rebaixarMilitar(promoterId, targetId, newRank as MilitaryRank, reason);
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Erro ao processar promoção militar." });
  }
});

// Ban militar (Supremo only)
app.put("/api/users/:id/ban", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Ação restrita ao Administrador Supremo do Comando Militar." });
    return;
  }
  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ error: "Informe a justificativa do banimento oficial." });
    return;
  }

  try {
    dbOperations.banMilitar(req.userId!, req.params.id, reason);
    res.json({ message: "Militar banido com êxito." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Suspend militar (Supremo only)
app.put("/api/users/:id/suspend", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Militar sem autonomia. Ação restrita ao Administrador Supremo." });
    return;
  }
  const { reason } = req.body;
  if (!reason) {
    res.status(400).json({ error: "Informe os motivos táticos para suspensão militar." });
    return;
  }

  try {
    dbOperations.suspendMilitar(req.userId!, req.params.id, reason);
    res.json({ message: "Militar suspenso com sucesso." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Reactivate militar (Supremo only)
app.put("/api/users/:id/reactivate", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administradores do Alto Comando podem reativar cadastros." });
    return;
  }
  try {
    dbOperations.reactivateMilitar(req.userId!, req.params.id);
    res.json({ message: "Militar reativado com sucesso." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create custom role (Requested by user under Supremo)
app.put("/api/users/:id/password", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Somente Administradores Supremos podem alterar credenciais alheias." });
    return;
  }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ error: "Forneça uma senha segura de ao menos 4 caracteres." });
    return;
  }

  try {
    dbOperations.resetPassword(req.userId!, req.params.id, newPassword);
    res.json({ message: "Credenciais de acesso redefinidas sob chancela do Comando Supremo." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete account (Supremo only)
app.delete("/api/users/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administradores Supremos podem purgar registros militares do sistema." });
    return;
  }
  try {
    dbOperations.deleteMilitar(req.userId!, req.params.id);
    res.json({ message: "Registro militar banido definitivamente e apagado do banco tático." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- TIME CLOCK SYSTEM (Folha de Ponto) ---

// Clock In
app.post("/api/service/clock-in", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const point = dbOperations.clockIn(req.userId!);
    res.json(point);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Clock Out
app.post("/api/service/clock-out", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const point = dbOperations.clockOut(req.userId!);
    res.json(point);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get operations summary
app.get("/api/dashboard/stats", authenticateToken, (req: AuthRequest, res: Response) => {
  const users = dbOperations.getUsers();
  const trainings = dbOperations.getTrainings();
  const promotions = dbOperations.getPromotions();
  
  const online = users.filter(u => u.activeState === UserActiveState.ONLINE).length;
  const emServico = users.filter(u => u.activeState === UserActiveState.EM_SERVICO).length;
  
  // Calculate total operational hours
  const totalSeconds = users.reduce((sum, u) => sum + u.totalServiceSeconds, 0);
  const totalHours = Math.round(totalSeconds / 3600);

  res.json({
    totalMilitars: users.length,
    online,
    emServico,
    trainingsConcluded: trainings.filter(t => t.status === "Concluido").length,
    promotionsTotal: promotions.length,
    totalHoursActivity: totalHours
  });
});


// --- MILITARY TRAINING SYSTEM ---

// Get trainings
app.get("/api/trainings", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getTrainings());
});

// Create training
app.post("/api/trainings", authenticateToken, (req: AuthRequest, res: Response) => {
  const { name, category, description, participants, date, time } = req.body;
  
  if (!name || !category || !description) {
    res.status(400).json({ error: "Preencha todos os campos fundamentais da ata de instrução." });
    return;
  }

  try {
    const tr = dbOperations.createTraining(
      req.userId!,
      name,
      category,
      description,
      participants || [],
      date || new Date().toISOString().split("T")[0],
      time || new Date().toTimeString().slice(0, 5)
    );
    res.status(201).json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Complete / cancel training
app.put("/api/trainings/:id/complete", authenticateToken, (req: AuthRequest, res: Response) => {
  const { participants } = req.body;
  try {
    const tr = dbOperations.completeTraining(req.userId!, req.params.id, participants);
    res.json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/trainings/:id/cancel", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const tr = dbOperations.cancelTraining(req.userId!, req.params.id);
    res.json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- MISSIONS SYSTEM ---

// Get active missions
app.get("/api/missions", authenticateToken, (req: AuthRequest, res: Response) => {
  const list = dbOperations.getMissions();
  res.json(list);
});

// Create task mission (Admin supremo)
app.post("/api/missions", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Requer privilégios de Administrador Supremo." });
    return;
  }

  const { title, description, category, targetCount, rewardMedals, rewardPoints, rewardDestaque } = req.body;
  if (!title || !description || !category || !targetCount) {
    res.status(400).json({ error: "Campos obrigatórios ausentes para registro de missão tática." });
    return;
  }

  try {
    const mission = dbOperations.createMission(
      req.userId!,
      title,
      description,
      category,
      targetCount,
      rewardMedals || [],
      Number(rewardPoints) || 0,
      !!rewardDestaque
    );
    res.status(201).json(mission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Purge mission (Admin supremo)
app.delete("/api/missions/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administrador Supremo pode expurgar missões." });
    return;
  }
  try {
    dbOperations.deleteMission(req.userId!, req.params.id);
    res.json({ message: "Missão tática removida do quartel-general." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update mission (Admin supremo)
app.put("/api/missions/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas Administrador Supremo pode editar missões." });
    return;
  }
  try {
    const updated = dbOperations.updateMission(req.userId!, req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- HIERARCHY & CARGOS / PERMISSOES ---
app.get("/api/hierarchy", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getRankConfigs());
});

app.put("/api/hierarchy", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Apenas o Administrador Supremo pode alterar permissões ou hierarquias decretadas." });
    return;
  }
  const { rank, label, description, permissions } = req.body;
  if (!rank || !label) {
    res.status(400).json({ error: "Informe a patente do cargo e o rótulo descritivo." });
    return;
  }
  try {
    const updated = dbOperations.updateRankConfig(req.userId!, rank, label, description, permissions);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- FILE STORAGE & PDF UPLOADS ---
app.post("/api/upload", authenticateToken, upload.single("pdf"), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo PDF foi enviado." });
    return;
  }

  // File saved locally, let's construct local URL path
  let fileUrl = `/uploads/${req.file.filename}`;

  // If Supabase credentials exist, try uploading to Supabase Storage!
  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (supabaseUrl && supabaseKey) {
    if (supabaseUrl.endsWith("/rest/v1/")) {
      supabaseUrl = supabaseUrl.slice(0, -"/rest/v1/".length);
    } else if (supabaseUrl.endsWith("/rest/v1")) {
      supabaseUrl = supabaseUrl.slice(0, -"/rest/v1".length);
    }
    if (supabaseUrl.endsWith("/")) {
      supabaseUrl = supabaseUrl.slice(0, -1);
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileName = `pdfs/${Date.now()}-${req.file.filename}`;
      
      // Upload to "fmb-assets" bucket
      const { data, error } = await supabase.storage
        .from("fmb-assets")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf",
          upsert: true
        });

      if (!error && data) {
        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from("fmb-assets")
          .getPublicUrl(fileName);
          
        if (publicUrlData?.publicUrl) {
          fileUrl = publicUrlData.publicUrl;
          console.log("[SUPABASE] PDF carregado no Storage do Supabase com sucesso:", fileUrl);
        }
      } else {
        console.warn("[SUPABASE] Falha ao gravar no Storage, usando fallback de link local:", error?.message);
      }
    } catch (uploadErr: any) {
      console.warn("[SUPABASE ERROR] Erro ao instanciar ou subir no Supabase, usando backup local:", uploadErr.message);
    }
  }

  res.json({ url: fileUrl });
});

// --- FILE STORAGE & IMAGE UPLOADS FOR PRINTS ---
app.post("/api/upload-image", authenticateToken, uploadImage.single("image"), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhuma imagem de farda ou print foi enviada." });
    return;
  }

  let fileUrl = `/uploads/${req.file.filename}`;

  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (supabaseUrl && supabaseKey) {
    if (supabaseUrl.endsWith("/rest/v1/")) {
      supabaseUrl = supabaseUrl.slice(0, -"/rest/v1/".length);
    } else if (supabaseUrl.endsWith("/rest/v1")) {
      supabaseUrl = supabaseUrl.slice(0, -"/rest/v1".length);
    }
    if (supabaseUrl.endsWith("/")) {
      supabaseUrl = supabaseUrl.slice(0, -1);
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileName = `prints/${Date.now()}-${req.file.filename}`;
      const ext = path.extname(req.file.filename).toLowerCase();
      let contentType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      if (ext === ".gif") contentType = "image/gif";
      if (ext === ".webp") contentType = "image/webp";
      
      const { data, error } = await supabase.storage
        .from("fmb-assets")
        .upload(fileName, fileBuffer, {
          contentType: contentType,
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from("fmb-assets")
          .getPublicUrl(fileName);
          
        if (publicUrlData?.publicUrl) {
          fileUrl = publicUrlData.publicUrl;
          console.log("[SUPABASE] Print carregado no Storage do Supabase com sucesso:", fileUrl);
        }
      } else {
        console.warn("[SUPABASE] Falha ao gravar print no Storage, usando fallback local:", error?.message);
      }
    } catch (uploadErr: any) {
      console.warn("[SUPABASE ERROR] Erro ao carregar print no Supabase, usando backup local:", uploadErr.message);
    }
  }

  res.json({ url: fileUrl });
});

// --- RECRUIT LESSONS ENDPOINTS ---
app.get("/api/recruit-lessons", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getRecruitLessons());
});

app.post("/api/recruit-lessons", authenticateToken, (req: AuthRequest, res: Response) => {
  const { studentNick, category, status, notes, screenshotUrl } = req.body;
  if (!studentNick || !category || !status) {
    res.status(400).json({ error: "Nick do recruta, tipo de aula e resultado final são obrigatórios." });
    return;
  }
  try {
    const lesson = dbOperations.createRecruitLesson(req.userId!, studentNick, category, status, notes, screenshotUrl);
    res.status(201).json(lesson);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/recruit-lessons/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteRecruitLesson(req.userId!, req.params.id);
    res.json({ message: "Relatório de aula para recruta excluído com sucesso do QG FMB." });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- SYNC HABBO PROFILE ---
app.post("/api/users/:id/sync", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const updatedUser = await dbOperations.syncHabboProfile(req.params.id);
    res.json(updatedUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Erro de sincronização." });
  }
});


// --- DOCUMENTOS & SCRIPTS AULAS ---
app.get("/api/documents", authenticateToken, (req: AuthRequest, res: Response) => {
  res.json(dbOperations.getDocuments());
});

app.post("/api/documents", authenticateToken, (req: AuthRequest, res: Response) => {
  const { title, category, content, attachmentUrl } = req.body;
  if (!title || !category || !content) {
    res.status(400).json({ error: "Título, categoria e o conteúdo de texto são de preenchimento obrigatório." });
    return;
  }
  try {
    const doc = dbOperations.createDocument(req.userId!, title, category, content, attachmentUrl);
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/documents/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  const { title, category, content, attachmentUrl } = req.body;
  if (!title || !category || !content) {
    res.status(400).json({ error: "Título, categoria e o conteúdo de texto são obrigatórios." });
    return;
  }
  try {
    const updated = dbOperations.updateDocument(req.userId!, req.params.id, title, category, content, attachmentUrl);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/documents/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteDocument(req.userId!, req.params.id);
    res.json({ message: "Material de aula excluído com sucesso do QG FMB." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- TRAININGS EXTRA EDIT/DELETE ---
app.put("/api/trainings/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const tr = dbOperations.updateTraining(req.userId!, req.params.id, req.body);
    res.json(tr);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/trainings/:id", authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    dbOperations.deleteTraining(req.userId!, req.params.id);
    res.json({ message: "Ata de treinamento excluída com sucesso pelo comando." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- HALL OF FAME DIRECTIVE ---

app.get("/api/destaques", (req: Request, res: Response) => {
  res.json(dbOperations.getDestaques());
});

app.put("/api/destaques", authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.userRank !== MilitaryRank.ADMSUPREMO) {
    res.status(403).json({ error: "Configuração restrita ao Administrador Supremo." });
    return;
  }
  const { militaryOfTheMonth, instructorOfTheMonth, destaqueOperacional } = req.body;
  try {
    dbOperations.updateDestaques(req.userId!, {
      militaryOfTheMonth: militaryOfTheMonth || null,
      instructorOfTheMonth: instructorOfTheMonth || null,
      destaqueOperacional: destaqueOperacional || null
    });
    res.json({ message: "Quadro de Destaques e Medalhas do Hall da Fama atualizados!" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// --- GENERAL AUDIT LOGS ---
app.get("/api/logs", authenticateToken, (req: AuthRequest, res: Response) => {
  // Only supreme command/high ranking of officers can audit logs
  const allowed = [
    MilitaryRank.ADMSUPREMO,
    MilitaryRank.COMANDANTE_GERAL,
    MilitaryRank.GENERAL_EXERCITO,
    MilitaryRank.GENERAL_DIVISAO
  ];
  if (!req.userRank || !allowed.includes(req.userRank)) {
    res.status(403).json({ error: "Sua patente militar não confere autorização tática para auditar as caixas de logs secretos." });
    return;
  }
  res.json(dbOperations.getLogs());
});


// --- HABBO API ACCESS PROXY ---
app.get("/api/habbo/:nick", async (req: Request, res: Response) => {
  const result = await fetchHabboData(req.params.nick);
  if (result) {
    res.json(result);
  } else {
    res.status(404).json({ error: "Avatar Habbo não foi localizado na rede oficial." });
  }
});

// HABBO EMBEDDED CONSTANTS FOR RANKING OF INSTRUCTORS
app.get("/api/dashboard/rankings", authenticateToken, (req: AuthRequest, res: Response) => {
  const users = dbOperations.getUsers();
  // Sort by trainingCount
  const sortedInstructors = [...users]
    .filter(u => u.trainingsCreated > 0)
    .sort((a, b) => b.trainingsCreated - a.trainingsCreated)
    .slice(0, 5);

  // Sort by hours
  const sortedServiceHours = [...users]
    .filter(u => u.totalServiceSeconds > 0)
    .sort((a, b) => b.totalServiceSeconds - a.totalServiceSeconds)
    .slice(0, 5);

  // Sort by promotions
  const sortedPromotions = [...users]
    .filter(u => u.promotionsGiven > 0)
    .sort((a, b) => b.promotionsGiven - a.promotionsGiven)
    .slice(0, 5);

  res.json({
    topInstructors: sortedInstructors,
    topService: sortedServiceHours,
    topPromoters: sortedPromotions
  });
});


// --- VITE WEB APP ROUTING MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FMB BANNER] COMANDO ATIVO NA PORTA ${PORT}`);
  });
}

startServer();
