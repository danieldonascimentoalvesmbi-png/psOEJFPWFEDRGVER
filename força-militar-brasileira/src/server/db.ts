import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { 
  User, 
  MilitaryRank, 
  UserStatus, 
  UserActiveState, 
  Promotion, 
  Training, 
  PontoLog, 
  Mission, 
  MissionProgress, 
  SystemLog, 
  SystemDestaques,
  LIST_OF_MEDALS,
  RankConfig,
  PoliceDocument,
  RankPermissions,
  RecruitLesson
} from "../types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "fmb_database.json");

// Structure of our file DB
interface DBStructure {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  promotions: Promotion[];
  trainings: Training[];
  pontes: PontoLog[];
  missions: Mission[];
  missionProgress: MissionProgress[];
  logs: SystemLog[];
  destaques: SystemDestaques;
  rankConfigs: RankConfig[];
  documents: PoliceDocument[];
  recruitLessons: RecruitLesson[];
}

// Fallback visual figures for army looking Habbo avatars
const SOLDIER_HABBO_FIGURE_FALLBACKS = [
  "hr-115-42.hd-180-2.ch-215-62.lg-270-62.sh-300-64", // Green military uniform
  "hr-893-45.hd-180-1.ch-3030-92.lg-275-64.sh-300-64.ha-1002-62.he-1607", // Tactical squad green
  "hr-125-31.hd-209-3.ch-210-92.lg-270-92.sh-300-92.ha-1002-92", // Dark military hat green
  "hr-802-37.hd-190-2.ch-215-64.lg-275-64.sh-905-64.he-1607-64", // Female tactician green
  "hr-115-31.hd-195-3.ch-210-62.lg-270-62.sh-300-62.ha-1002-62"  // Officer
];

// Helper to hash password
function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

// In-memory cache
let db: DBStructure = {
  users: [],
  passwords: {},
  promotions: [],
  trainings: [],
  pontes: [],
  missions: [],
  missionProgress: [],
  logs: [],
  destaques: {
    militaryOfTheMonth: null,
    instructorOfTheMonth: null,
    destaqueOperacional: null
  },
  rankConfigs: [],
  documents: [],
  recruitLessons: []
};

// Write in-memory cache to disk
function saveDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    
    // Asynchronously replicate to Supabase
    syncToSupabase();
  } catch (error) {
    console.error("Erro ao salvar banco de dados:", error);
  }
}

export async function syncToSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Try table upsert
    const { error: upsertError } = await supabase
      .from("fmb_state")
      .upsert({ id: 1, data: db, updated_at: new Date().toISOString() });

    if (!upsertError) {
      console.log("[SUPABASE] Sincronização concluída na tabela 'fmb_state'!");
      return;
    }

    console.warn("[SUPABASE] Tabela 'fmb_state' não localizada ou erro (" + upsertError.message + "). Tentando via Storage bucket...");

    // 2. Backup using a storage bucket (fmb-assets / database/fmb_database.json)
    const jsonStr = JSON.stringify(db, null, 2);
    const { error: uploadError } = await supabase.storage
      .from("fmb-assets")
      .upload("database/fmb_database.json", Buffer.from(jsonStr), {
        contentType: "application/json",
        upsert: true
      });

    if (!uploadError) {
      console.log("[SUPABASE] Sincronização concluída no bucket 'fmb-assets' com sucesso!");
    } else {
      console.error("[SUPABASE] Falha ao persistir em tabela ou bucket de storage:", uploadError.message);
    }
  } catch (err: any) {
    console.error("[SUPABASE ERROR] Erro no motor de sincronização:", err.message);
  }
}

export async function syncFromSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("[SUPABASE] Supabase não está configurado. Operando em modo de cache local.");
    return;
  }

  console.log("[SUPABASE] Conectando ao Banco de Dados do Supabase...");
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Try to query database table
    const { data, error } = await supabase
      .from("fmb_state")
      .select("data")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data && data.data) {
      db = data.data as any;
      console.log("[SUPABASE] Sucesso! Dados sincronizados a partir da tabela 'fmb_state' do Supabase.");
      ensureRankConfigsAndDocumentsExist();
      // Ensure local server has the synced cache
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
      return;
    }

    if (error) {
      console.warn("[SUPABASE] Erro ao ler tabela 'fmb_state' (" + error.message + "). Tentando via Storage...");
    }

    // 2. Try to query storage bucket
    const { data: fileData, error: fileError } = await supabase.storage
      .from("fmb-assets")
      .download("database/fmb_database.json");

    if (!fileError && fileData) {
      const text = await fileData.text();
      db = JSON.parse(text);
      console.log("[SUPABASE] Sucesso! Banco de dados militar recuperado do bucket 'fmb-assets/database/fmb_database.json'.");
      ensureRankConfigsAndDocumentsExist();
      // Ensure local server has the synced cache
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
      return;
    }

    console.log("[SUPABASE] Sem dados sincronizados anteriormente no canal do Supabase. Mantendo dados locais.");
  } catch (err: any) {
    console.error("[SUPABASE ERROR] Fracasso ao carregar do Supabase:", err.message);
  }
}

// Ensure default rank configurations and manual templates exist
export function ensureRankConfigsAndDocumentsExist() {
  if (!db.rankConfigs || db.rankConfigs.length === 0) {
    db.rankConfigs = [
      {
        rank: MilitaryRank.SOLDADO,
        label: "Soldado",
        description: "Militar de entrada responsável por patrulhar o QG de sentinela.",
        permissions: { canEnlist: false, canPromote: false, canTrain: false, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.CABO,
        label: "Cabo",
        description: "Fiscal de entrada incumbido de direcionar novatos no saguão de recristalização.",
        permissions: { canEnlist: false, canPromote: false, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.SARGENTO,
        label: "Sargento",
        description: "Líder de divisão encarregado de ministrar instruções básicas aos recrutas.",
        permissions: { canEnlist: false, canPromote: false, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.SUBTENENTE,
        label: "Subtenente",
        description: "Auxiliar do corpo de oficiais focado no policiamento interno.",
        permissions: { canEnlist: false, canPromote: false, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.ASPIRANTE,
        label: "Aspirante",
        description: "Oficial sob observação exercendo liderança prática no comando do QG.",
        permissions: { canEnlist: false, canPromote: false, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.SEGUNDO_TENENTE,
        label: "Segundo-Tenente",
        description: "Suboficial inicial encarregado do alistamento de novos praças no centro de recrutas.",
        permissions: { canEnlist: true, canPromote: false, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.PRIMEIRO_TENENTE,
        label: "Primeiro-Tenente",
        description: "Oficial intermediário encarregado de consolidar relatórios táticos de instrução.",
        permissions: { canEnlist: true, canPromote: false, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.CAPITAO,
        label: "Capitão",
        description: "Militar comandante habilitado a assinar primeiras promoções no quadro operacional.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: false, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.MAJOR,
        label: "Major",
        description: "Supervisor-chefe de instruções oficiais e editor de materiais acadêmicos e PDFs.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.TENENTE_CORONEL,
        label: "Tenente-Coronel",
        description: "Co-gestor regimental orientador de diretrizes internas corporativas.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: false, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.CORONEL,
        label: "Coronel",
        description: "Comandante regimental com plenos poderes de criação de missões e metas de patrulha.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: true, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.GENERAL_BRIGADA,
        label: "General de Brigada",
        description: "General de infantaria encarregado das relações internacionais e cursos do Alto Comando.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: true, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.GENERAL_DIVISAO,
        label: "General de Divisão",
        description: "General sênior regulador de fluxos de progressão do exército e corporação.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: true, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.GENERAL_EXERCITO,
        label: "General de Exército",
        description: "Membro supremo executivo do Alto Conselho FMB com deveres estratégicos plenos.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: true, canAdminSystem: false }
      },
      {
        rank: MilitaryRank.COMANDANTE_GERAL,
        label: "Comandante-Geral",
        description: "Líder e reitor da corporação encarregado de homologar permissões de menor porte.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: true, canAdminSystem: true }
      },
      {
        rank: MilitaryRank.ADMSUPREMO,
        label: "Administrador Supremo",
        description: "Inaugurador e guardião-titular supremo de todos os bancos de dados, diretrizes da FMB, cargos e hierarquia.",
        permissions: { canEnlist: true, canPromote: true, canTrain: true, canManageDocs: true, canManageMissions: true, canAdminSystem: true }
      }
    ];
  }

  if (!db.documents || db.documents.length === 0) {
    db.documents = [
      {
        id: "doc_1",
        title: "Manual de Instruções e Conduta da FMB",
        category: "manual",
        content: `# MANUAL DE INSTRUÇÃO E CONDUTA MILITAR\n\nEste documento regula o comportamento ideal de todos os militares da **Força Militar Brasileira (FMB)** no Habbo.\n\n## 1. Tratamento e Hierarquia\n- Todo militar de patente superior deve ser tratado por **Senhor** ou **Senhora**.\n- Ao entrar um superior no recinto, ordene **"Sentido!"** em voz alta.\n- Mantenha-se na posição até ordem em contrário.\n\n## 2. Postura em Sentry (Sentinela)\n- Proibido dançar, usar balões coloridos em falas ou usar visuais desalinhados com a farda oficial.\n- Mantenha o silêncio tático quando operando alavancas do portão.\n\n## 3. Código Penal Militar (CPM)\n- Desobediência direta: Sujeita à suspensão imediata.\n- Invasão de área restrita: Perda de patente.\n- Cumplicidade com transgressores: Banimento definitivo.`,
        authorNick: "Comandante_FMB",
        createdAt: "2026-06-09T18:00:00.000Z"
      },
      {
        id: "doc_2",
        title: "Script Oficial de Auxílio de Recrutas (CFS)",
        category: "roteiro",
        content: `# SCRIPT OFICIAL PARA CURSO DE FORMAÇÃO DE SOLDADOS (CFS)\n\n*Copie e cole estas instruções para repassar aos Recrutas na Sala de Instrução FMB:*\n\n1. "Olá Recrutas! Sejam bem-vindos à Força Militar Brasileira (FMB)." \n2. "Eu sou o instrutor [Seu Nick] e guiarei vocês pelas táticas básicas de segurança." \n3. "Regra de Ouro: Nunca revele sua senha a ninguém, nem mesmo ao Comandante." \n4. "Comando de Sentido: Ao ouvir, fiquem parados, digitem 'Sim Senhor!' e fiquem em silêncio imediato."\n5. "Comando de À Vontade: Podem relaxar e digitar à vontade, preservando o bom senso."\n6. "A farda padrão é obrigatória no QG. Certifique-se de que está usando farda verde militar verde-oliva."`,
        authorNick: "Comandante_FMB",
        createdAt: "2026-06-09T18:10:00.000Z"
      }
    ];
  }
}

// Init Database & Seed if empty
export function initDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      try {
        db = JSON.parse(raw);
        if (!db.recruitLessons) {
          db.recruitLessons = [];
        }
        console.log("Banco de dados militar carregado com sucesso!");
        ensureRankConfigsAndDocumentsExist();
        // Verify defaults
        if (!db.users || db.users.length === 0) {
          seedInitialData();
        } else {
          saveDB(); // Persist any newly seeded configs
        }
      } catch (parseErr) {
        console.error("Erro ao ler JSON. Recriando banco...");
        seedInitialData();
      }
    } else {
      seedInitialData();
    }

    // Sincronizar com o Supabase de forma assíncrona após boot inicial
    syncFromSupabase();
  } catch (e) {
    console.error("Falha ao inicializar banco de dados:", e);
    seedInitialData();
  }
}

function seedInitialData() {
  console.log("Semeando banco de dados com elite inicial da FMB...");
  
  // Clean structure
  db = {
    users: [],
    passwords: {},
    promotions: [],
    trainings: [],
    pontes: [],
    missions: [
      {
        id: "m_1",
        title: "Treinador Padrão",
        description: "Ministre 5 treinamentos autorizados para formar novos recrutas.",
        rewardMedals: ["treinos_10"],
        rewardPoints: 10,
        rewardDestaque: false,
        active: true,
        targetCategory: "trainings",
        targetCount: 5
      },
      {
        id: "m_2",
        title: "Sentinela de Elite",
        description: "Acumule 20 horas (72.000 segundos) de patrulha em serviço ativo.",
        rewardMedals: ["servico_100h"],
        rewardPoints: 20,
        rewardDestaque: true,
        active: true,
        targetCategory: "service_hours",
        targetCount: 72000 // In target count, we'll store seconds
      },
      {
        id: "m_3",
        title: "Incentivador Militar",
        description: "Realize 3 promoções militares documentando as justificativas.",
        rewardMedals: [],
        rewardPoints: 15,
        rewardDestaque: false,
        active: true,
        targetCategory: "promotions",
        targetCount: 3
      }
    ],
    missionProgress: [],
    logs: [],
    destaques: {
      militaryOfTheMonth: "u_2",
      instructorOfTheMonth: "u_3",
      destaqueOperacional: "u_4"
    },
    rankConfigs: [],
    documents: [],
    recruitLessons: []
  };

  ensureRankConfigsAndDocumentsExist();

  // Seed Admin Supremo
  const adminId = "u_1";
  const adminUser: User = {
    id: adminId,
    username: "comandante",
    habboNick: "Comandante_FMB",
    habboAvatar: "hr-115-31.hd-195-3.ch-210-62.lg-270-62.sh-300-62.ha-1002-62",
    habboMotto: "Disciplina, Honra e Compromisso. FMB 🇧🇷",
    habboCreated: "12-10-2015",
    role: MilitaryRank.ADMSUPREMO,
    status: UserStatus.ATIVO,
    activeState: UserActiveState.OFFLINE,
    joinedAt: "2026-01-01T00:00:00.000Z",
    totalServiceSeconds: 345600, // 96 hours
    medals: ["servico_100h"],
    trainingsCreated: 24,
    promotionsGiven: 18
  };
  db.users.push(adminUser);
  db.passwords[adminId] = hashPassword("FMB123"); // Default master command password

  // Seed Comandante Geral
  const user2Id = "u_2";
  const user2: User = {
    id: user2Id,
    username: "general",
    habboNick: "General_Tatico",
    habboAvatar: "hr-893-45.hd-180-1.ch-3030-92.lg-275-64.sh-300-64.ha-1002-62",
    habboMotto: "FMB no comando! Operação Sobrevivência.",
    habboCreated: "15-04-2017",
    role: MilitaryRank.COMANDANTE_GERAL,
    status: UserStatus.ATIVO,
    activeState: UserActiveState.ONLINE,
    joinedAt: "2026-01-10T12:00:00.000Z",
    totalServiceSeconds: 216000, // 60 hours
    medals: ["militar_mes", "servico_100h"],
    trainingsCreated: 15,
    promotionsGiven: 10
  };
  db.users.push(user2);
  db.passwords[user2Id] = hashPassword("senha123");

  // Seed Major
  const user3Id = "u_3";
  const user3: User = {
    id: user3Id,
    username: "major_silva",
    habboNick: "Major_Silva",
    habboAvatar: "hr-115-42.hd-180-2.ch-215-62.lg-270-62.sh-300-64",
    habboMotto: "Instrução tática de combate avançado.",
    habboCreated: "20-11-2018",
    role: MilitaryRank.MAJOR,
    status: UserStatus.ATIVO,
    activeState: UserActiveState.OFFLINE,
    joinedAt: "2026-02-01T10:30:00.000Z",
    totalServiceSeconds: 144000, // 40 hours
    medals: ["instrutor_mes", "treinos_10"],
    trainingsCreated: 42,
    promotionsGiven: 5
  };
  db.users.push(user3);
  db.passwords[user3Id] = hashPassword("senha123");

  // Seed Capitão
  const user4Id = "u_4";
  const user4: User = {
    id: user4Id,
    username: "capitao_oliveira",
    habboNick: "Capitao_Oliveira",
    habboAvatar: "hr-115-42.hd-180-2.ch-215-62.lg-270-62.sh-300-64",
    habboMotto: "Liderando com honra e retidão.",
    habboCreated: "03-01-2019",
    role: MilitaryRank.CAPITAO,
    status: UserStatus.ATIVO,
    activeState: UserActiveState.OFFLINE,
    joinedAt: "2026-02-15T09:00:00.000Z",
    totalServiceSeconds: 324000, // 90 hours
    medals: ["destaque_operacional"],
    trainingsCreated: 21,
    promotionsGiven: 8
  };
  db.users.push(user4);
  db.passwords[user4Id] = hashPassword("senha123");

  // Seed Soldado (Recruta)
  const user5Id = "u_5";
  const user5: User = {
    id: user5Id,
    username: "recruta_felipe",
    habboNick: "Recruta_Felipe",
    habboAvatar: "hr-115-42.hd-180-2.ch-215-62.lg-270-62.sh-300-64",
    habboMotto: "Pronto para servir a FMB!",
    habboCreated: "14-02-2022",
    role: MilitaryRank.SOLDADO,
    status: UserStatus.ATIVO,
    activeState: UserActiveState.EM_SERVICO,
    joinedAt: "2026-06-01T08:00:00.000Z",
    totalServiceSeconds: 18000, // 5 hours
    medals: [],
    trainingsCreated: 0,
    promotionsGiven: 0
  };
  db.users.push(user5);
  db.passwords[user5Id] = hashPassword("senha123");

  // Seed initial promotion
  db.promotions.push({
    id: "promo_1",
    promotedMilitarId: "u_3",
    promotedMilitarName: "Major_Silva",
    promoterId: "u_1",
    promoterName: "Comandante_FMB",
    oldRank: MilitaryRank.CAPITAO,
    newRank: MilitaryRank.MAJOR,
    reason: "Grande bravura tática e excelência na ministração de treinamentos da academia militar.",
    date: "2026-06-01",
    time: "14:20:00"
  });

  // Seed initial training log
  db.trainings.push({
    id: "t_1",
    name: "Avançado de Tiro Tático",
    instructorId: "u_3",
    instructorName: "Major_Silva",
    participants: ["Capitao_Oliveira", "Recruta_Felipe"],
    category: "Armamento",
    description: "Treinamento especializado em fuzil FAL 7.62mm e simulações de confronto tático.",
    date: "2026-06-08",
    time: "19:00",
    status: "Concluido"
  }, {
    id: "t_2",
    name: "Curso de Formação de Oficiais - CFO",
    instructorId: "u_1",
    instructorName: "Comandante_FMB",
    participants: ["Major_Silva"],
    category: "Liderança",
    description: "Formação em comandamento tático de divisões especiais organizadas.",
    date: "2026-06-09",
    time: "21:00",
    status: "Agendado"
  });

  // Seed clock entry logs
  db.pontes.push({
    id: "p_1",
    userId: "u_5",
    userNick: "Recruta_Felipe",
    date: "2026-06-09",
    checkInTime: "2026-06-09T14:00:00.000Z",
    checkOutTime: null, // Still in service
    durationSeconds: 0
  }, {
    id: "p_2",
    userId: "u_2",
    userNick: "General_Tatico",
    date: "2026-06-08",
    checkInTime: "2026-06-08T14:00:00.000Z",
    checkOutTime: "2026-06-08T18:00:00.000Z", // 4 hours worked
    durationSeconds: 14400
  });

  // Seed system logs
  db.logs.push({
    id: "log_1",
    userId: null,
    userNick: "SISTEMA",
    action: "BANCO_INICIALIZADO",
    details: "Banco de dados militar semeado com a elite FMB inicial.",
    timestamp: new Date().toISOString()
  });

  saveDB();
}

// FETCH USER DATA FROM HABBO API PROXY
export async function fetchHabboData(nick: string): Promise<{
  name: string;
  motto: string;
  figureString: string;
  memberSince: string;
} | null> {
  const url = `https://www.habbo.com.br/api/public/users?name=${encodeURIComponent(nick)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36"
      },
      signal: AbortSignal.timeout(4000) // 4 seconds timeout
    });

    if (res.ok) {
      const data = await res.json();
      return {
        name: data.name || nick,
        motto: data.motto || "Sem compromissos.",
        figureString: data.figureString || SOLDIER_HABBO_FIGURE_FALLBACKS[Math.floor(Math.random() * SOLDIER_HABBO_FIGURE_FALLBACKS.length)],
        memberSince: data.memberSince ? new Date(data.memberSince).toLocaleDateString("pt-BR") : "Desconhecido"
      };
    }
    
    throw new Error(`Habbo API error code: ${res.status}`);
  } catch (err) {
    console.warn(`Falha ao buscar nick Habbo (${nick}):`, err instanceof Error ? err.message : err);
    // Return high quality dummy uniform look so it never fails!
    return {
      name: nick,
      motto: "A serviço da Força Militar Brasileira! 🇧🇷",
      figureString: SOLDIER_HABBO_FIGURE_FALLBACKS[Math.floor(Math.random() * SOLDIER_HABBO_FIGURE_FALLBACKS.length)],
      memberSince: "01/01/2020"
    };
  }
}

// CORE QUERY FUNCTIONS
export const dbOperations = {
  getUsers: () => db.users,
  
  getUserById: (id: string) => db.users.find(u => u.id === id) || null,
  
  getUserByNick: (nick: string) => {
    return db.users.find(u => u.habboNick.toLowerCase() === nick.toLowerCase()) || null;
  },

  hasPermission: (role: MilitaryRank, permission: keyof RankPermissions): boolean => {
    if (role === MilitaryRank.ADMSUPREMO) return true;
    const config = db.rankConfigs.find(rc => rc.rank === role);
    return config ? !!config.permissions[permission] : false;
  },

  createUser: async (nick: string, pass: string, role: MilitaryRank): Promise<User> => {
    const existing = dbOperations.getUserByNick(nick);
    if (existing) {
      throw new Error(`Militar com nick ${nick} já se encontra cadastrado no sistema.`);
    }

    // Call habbo API
    const habbo = await fetchHabboData(nick);
    
    const userId = "u_" + Math.random().toString(36).substr(2, 9);
    const newUser: User = {
      id: userId,
      username: nick.toLowerCase(),
      habboNick: habbo?.name || nick,
      habboAvatar: habbo?.figureString || SOLDIER_HABBO_FIGURE_FALLBACKS[0],
      habboMotto: habbo?.motto || "Honra e Disciplina.",
      habboCreated: habbo?.memberSince || "Recém-chegado",
      role: role,
      status: UserStatus.ATIVO,
      activeState: UserActiveState.OFFLINE,
      joinedAt: new Date().toISOString(),
      totalServiceSeconds: 0,
      medals: [],
      trainingsCreated: 0,
      promotionsGiven: 0
    };

    db.users.push(newUser);
    db.passwords[userId] = hashPassword(pass || "senha123");
    
    // Auto sync medals
    dbOperations.checkAndAwardLocalMedals(userId);
    
    // Save & Log
    dbOperations.addLog(null, "SISTEMA", "Militar Criado", `Militar ${newUser.habboNick} foi alistado com rank ${newUser.role}.`);
    saveDB();
    return newUser;
  },

  authenticateUser: (nick: string, pass: string): User | null => {
    const user = dbOperations.getUserByNick(nick);
    if (!user) return null;
    if (user.status === UserStatus.BANIDO) {
      throw new Error("Sua conta está banida. Acesso negado.");
    }
    const hash = db.passwords[user.id];
    if (!hash || !bcrypt.compareSync(pass, hash)) return null;

    // Set online status if offline
    if (user.activeState === UserActiveState.OFFLINE) {
      user.activeState = UserActiveState.ONLINE;
      dbOperations.addLog(user.id, user.habboNick, "LOGIN", `Militar ${user.habboNick} efetuou login no painel.`);
      saveDB();
    }
    return user;
  },

  logoutUser: (userId: string) => {
    const user = dbOperations.getUserById(userId);
    if (user) {
      if (user.activeState === UserActiveState.EM_SERVICO) {
        // Automatically clock out
        dbOperations.clockOut(userId);
      }
      user.activeState = UserActiveState.OFFLINE;
      dbOperations.addLog(user.id, user.habboNick, "LOGOUT", `Militar ${user.habboNick} se desconectou do painel.`);
      saveDB();
    }
  },

  updateUser: (userId: string, data: Partial<Omit<User, "id" | "username" | "habboNick">>): User => {
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Militar não localizado.");
    
    Object.assign(user, data);
    saveDB();
    return user;
  },

  resetPassword: (adminId: string, userId: string, newPass: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Apenas Administradores Supremos podem alterar senhas.");
    }
    
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Militar não encontrado.");

    db.passwords[userId] = hashPassword(newPass);
    dbOperations.addLog(adminId, admin.habboNick, "RESTAURAR_SENHA", `Senha do militar ${user.habboNick} alterada por ${admin.habboNick}.`);
    saveDB();
  },

  promoteMilitar: (promoterId: string, targetId: string, newRank: MilitaryRank, reason: string): Promotion => {
    const promoter = dbOperations.getUserById(promoterId);
    if (!promoter) throw new Error("Promovente não encontrado.");

    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar promovido não encontrado.");

    const oldRank = target.role;
    target.role = newRank;
    promoter.promotionsGiven += 1;

    // Create Promotion Record
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const promo: Promotion = {
      id: "promo_" + Math.random().toString(36).substr(2, 9),
      promotedMilitarId: targetId,
      promotedMilitarName: target.habboNick,
      promoterId: promoterId,
      promoterName: promoter.habboNick,
      oldRank: oldRank,
      newRank: newRank,
      reason: reason,
      date: dateStr,
      time: timeStr
    };

    db.promotions.push(promo);

    // Track mission progress for promotions
    dbOperations.trackMissionEvent(promoterId, "promotions", 1);

    dbOperations.addLog(
      promoterId, 
      promoter.habboNick, 
      "PROMOÇÃO", 
      `Promoveu ${target.habboNick} de ${oldRank} para ${newRank}. Motivo: ${reason}`
    );
    
    saveDB();
    return promo;
  },

  rebaixarMilitar: (promoterId: string, targetId: string, newRank: MilitaryRank, reason: string): Promotion => {
    const promoter = dbOperations.getUserById(promoterId);
    if (!promoter) throw new Error("Operador não encontrado.");

    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar rebaixado não encontrado.");

    const oldRank = target.role;
    target.role = newRank;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const rebaixamento: Promotion = {
      id: "promo_" + Math.random().toString(36).substr(2, 9),
      promotedMilitarId: targetId,
      promotedMilitarName: target.habboNick,
      promoterId: promoterId,
      promoterName: promoter.habboNick,
      oldRank: oldRank,
      newRank: newRank,
      reason: `REBAIXAMENTO: ${reason}`,
      date: dateStr,
      time: timeStr
    };

    db.promotions.push(rebaixamento);

    dbOperations.addLog(
      promoterId, 
      promoter.habboNick, 
      "REBAIXAMENTO", 
      `Rebaixou ${target.habboNick} de ${oldRank} para ${newRank}. Motivo: ${reason}`
    );
    
    saveDB();
    return rebaixamento;
  },

  banMilitar: (adminId: string, targetId: string, banReason: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Permissão insuficiente para banir.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não localizado.");

    target.status = UserStatus.BANIDO;
    target.activeState = UserActiveState.OFFLINE;

    dbOperations.addLog(adminId, admin.habboNick, "BANIMENTO", `Baniu o militar ${target.habboNick}. Motivo: ${banReason}`);
    saveDB();
  },

  suspendMilitar: (adminId: string, targetId: string, suspendReason: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || !dbOperations.hasPermission(admin.role, "canAdminSystem")) {
      throw new Error("Apenas Administrador Supremo ou militar com privilégios de Admin Supremo pode suspender.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não localizado.");

    target.status = UserStatus.SUSPENSO;
    target.activeState = UserActiveState.OFFLINE;

    dbOperations.addLog(adminId, admin.habboNick, "SUSPENSÃO", `Suspendeu o militar ${target.habboNick}. Justificativa: ${suspendReason}`);
    saveDB();
  },

  reactivateMilitar: (adminId: string, targetId: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || !dbOperations.hasPermission(admin.role, "canAdminSystem")) {
      throw new Error("Permissão insuficiente para reestruturar militar.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Militar não localizado.");

    target.status = UserStatus.ATIVO;

    dbOperations.addLog(adminId, admin.habboNick, "REATIVAÇÃO", `Reativou a conta do militar ${target.habboNick}.`);
    saveDB();
  },

  deleteMilitar: (adminId: string, targetId: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || !dbOperations.hasPermission(admin.role, "canAdminSystem")) {
      throw new Error("Requer privilégio de Administrador Supremo ou cargo militar autorizado.");
    }
    const target = dbOperations.getUserById(targetId);
    if (!target) throw new Error("Conta não encontrada.");

    db.users = db.users.filter(u => u.id !== targetId);
    delete db.passwords[targetId];

    dbOperations.addLog(adminId, admin.habboNick, "EXCLUSÃO", `Militar ${target.habboNick} foi totalmente apagado do sistema.`);
    saveDB();
  },

  // TIME CLOCK SYSTEM (Serviços)
  clockIn: (userId: string): PontoLog => {
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Usuário inválido.");
    if (user.activeState === UserActiveState.EM_SERVICO) {
      throw new Error("Você já está em serviço ativo!");
    }

    user.activeState = UserActiveState.EM_SERVICO;

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    const point: PontoLog = {
      id: "p_" + Math.random().toString(36).substr(2, 9),
      userId: userId,
      userNick: user.habboNick,
      date: dateStr,
      checkInTime: now.toISOString(),
      checkOutTime: null,
      durationSeconds: 0
    };

    db.pontes.push(point);
    dbOperations.addLog(userId, user.habboNick, "INICIO_SERVICO", `Entrou em patrulha/serviço às ${now.toLocaleTimeString("pt-BR")}.`);
    saveDB();
    return point;
  },

  clockOut: (userId: string): PontoLog => {
    const user = dbOperations.getUserById(userId);
    if (!user) throw new Error("Usuário inválido.");
    
    // Find open logs
    const openPoint = db.pontes.find(p => p.userId === userId && p.checkOutTime === null);
    if (!openPoint) {
      // Graceful error bypass: set status to ONLINE if no active clock
      user.activeState = UserActiveState.ONLINE;
      saveDB();
      throw new Error("Nenhum serviço em aberto localizado para você.");
    }

    const now = new Date();
    const checkIn = new Date(openPoint.checkInTime);
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - checkIn.getTime()) / 1000));

    openPoint.checkOutTime = now.toISOString();
    openPoint.durationSeconds = durationSeconds;

    user.activeState = UserActiveState.ONLINE;
    user.totalServiceSeconds += durationSeconds;

    // Track progress in missions
    dbOperations.trackMissionEvent(userId, "service_hours", durationSeconds);

    dbOperations.addLog(
      userId, 
      user.habboNick, 
      "FIM_SERVICO", 
      `Encerrou o turno militar. Duração: ${Math.floor(durationSeconds/60)} minutos.`
    );

    // Dynamic auto medals check
    dbOperations.checkAndAwardLocalMedals(userId);

    saveDB();
    return openPoint;
  },

  getPontoLogs: () => db.pontes,

  // TRAININGS
  createTraining: (instructorId: string, name: string, category: string, description: string, participants: string[], date: string, time: string): Training => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Instrutor inválido.");

    const trainingId = "t_" + Math.random().toString(36).substr(2, 9);
    const training: Training = {
      id: trainingId,
      name,
      instructorId,
      instructorName: instructor.habboNick,
      participants: participants,
      category,
      description,
      date,
      time,
      status: "Agendado"
    };

    db.trainings.push(training);
    dbOperations.addLog(instructorId, instructor.habboNick, "NOVO_TREINO", `Criou treinamento agendado: ${name}.`);
    saveDB();
    return training;
  },

  completeTraining: (instructorId: string, trainingId: string, participants: string[]): Training => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Operador inválido.");
    
    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    training.status = "Concluido";
    if (participants) {
      training.participants = participants;
    }

    instructor.trainingsCreated += 1;

    // Track training mission for instructor
    dbOperations.trackMissionEvent(instructorId, "trainings", 1);

    dbOperations.addLog(
      instructorId, 
      instructor.habboNick, 
      "CONCLUSAO_TREINO", 
      `Concluiu o treinamento militar "${training.name}". Integrantes: ${training.participants.join(", ")}`
    );

    // Check medals
    dbOperations.checkAndAwardLocalMedals(instructorId);

    saveDB();
    return training;
  },

  cancelTraining: (instructorId: string, trainingId: string): Training => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Operador inválido.");

    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    training.status = "Cancelado";
    dbOperations.addLog(instructorId, instructor.habboNick, "CANCELAR_TREINO", `Cancelou o treinamento agendado: ${training.name}.`);
    saveDB();
    return training;
  },

  getTrainings: () => db.trainings,

  getPromotions: () => db.promotions,

  // MISSIONS SYSTEM
  getMissions: () => db.missions,

  createMission: (adminId: string, title: string, description: string, category: "trainings" | "service_hours" | "promotions" | "operations", targetCount: number, rewardMedals: string[], rewardPoints: number, rewardDestaque: boolean): Mission => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Permissão exclusiva de Administrador Supremo.");
    }

    const mission: Mission = {
      id: "m_" + Math.random().toString(36).substr(2, 9),
      title,
      description,
      rewardMedals,
      rewardPoints,
      rewardDestaque,
      active: true,
      targetCategory: category,
      targetCount: Number(targetCount)
    };

    db.missions.push(mission);
    dbOperations.addLog(adminId, admin.habboNick, "CRIAR_MISSAO", `Criou missão tática: "${title}" com alvo ${targetCount} de ${category}.`);
    saveDB();
    return mission;
  },

  deleteMission: (adminId: string, missionId: string) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || (!dbOperations.hasPermission(admin.role, "canAdminSystem") && !dbOperations.hasPermission(admin.role, "canManageMissions"))) {
      throw new Error("Permissão exclusiva de oficial de missões ou administrador supremo.");
    }
    db.missions = db.missions.filter(m => m.id !== missionId);
    db.missionProgress = db.missionProgress.filter(p => p.missionId !== missionId);
    saveDB();
  },

  // Track mission progress increments
  trackMissionEvent: (userId: string, category: string, increment: number) => {
    const activeMissions = db.missions.filter(m => m.active && m.targetCategory === category);
    
    for (const m of activeMissions) {
      let progress = db.missionProgress.find(p => p.missionId === m.id && p.userId === userId);
      if (!progress) {
        progress = {
          id: "mp_" + Math.random().toString(36).substr(2, 9),
          missionId: m.id,
          userId: userId,
          currentCount: 0,
          completed: false,
          completedAt: null
        };
        db.missionProgress.push(progress);
      }

      if (progress.completed) continue;

      progress.currentCount += increment;
      if (progress.currentCount >= m.targetCount) {
        progress.completed = true;
        progress.completedAt = new Date().toISOString();
        
        // Award rewards
        const user = dbOperations.getUserById(userId);
        if (user) {
          // Award medals
          if (m.rewardMedals && m.rewardMedals.length > 0) {
            m.rewardMedals.forEach(medalId => {
              if (!user.medals.includes(medalId)) {
                user.medals.push(medalId);
              }
            });
          }
          dbOperations.addLog(
            userId, 
            user.habboNick, 
            "CONQUISTA_MISSAO", 
            `Completou a missão tática "${m.title}". Recompensas creditadas!`
          );
        }
      }
    }
  },

  getMissionProgress: (userId: string) => {
    return db.missionProgress.filter(p => p.userId === userId);
  },

  // HALL DA FAMA & DESTAQUES SETTINGS
  getDestaques: () => {
    const ds = db.destaques;
    return {
      militaryOfTheMonth: ds.militaryOfTheMonth ? dbOperations.getUserById(ds.militaryOfTheMonth) : null,
      instructorOfTheMonth: ds.instructorOfTheMonth ? dbOperations.getUserById(ds.instructorOfTheMonth) : null,
      destaqueOperacional: ds.destaqueOperacional ? dbOperations.getUserById(ds.destaqueOperacional) : null
    };
  },

  updateDestaques: (adminId: string, updates: Partial<SystemDestaques>) => {
    const admin = dbOperations.getUserById(adminId);
    if (!admin || admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Privilégios de Administrador Supremo requeridos.");
    }
    
    db.destaques = {
      ...db.destaques,
      ...updates
    };

    // Auto award specific medals for destaques
    if (updates.militaryOfTheMonth) {
      const user = dbOperations.getUserById(updates.militaryOfTheMonth);
      if (user && !user.medals.includes("militar_mes")) {
        user.medals.push("militar_mes");
      }
    }
    if (updates.instructorOfTheMonth) {
      const user = dbOperations.getUserById(updates.instructorOfTheMonth);
      if (user && !user.medals.includes("instrutor_mes")) {
        user.medals.push("instrutor_mes");
      }
    }
    if (updates.destaqueOperacional) {
      const user = dbOperations.getUserById(updates.destaqueOperacional);
      if (user && !user.medals.includes("destaque_operacional")) {
        user.medals.push("destaque_operacional");
      }
    }

    dbOperations.addLog(adminId, admin.habboNick, "CONFIGURAR_HALL_FAMA", "Atualizou destaques do Hall da Fama.");
    saveDB();
  },

  // UTILITY MEDAL CHECKER
  checkAndAwardLocalMedals: (userId: string) => {
    const user = dbOperations.getUserById(userId);
    if (!user) return;

    const curMedals = new Set(user.medals);

    // 1. trainings
    if (user.trainingsCreated >= 10 && !curMedals.has("treinos_10")) {
      user.medals.push("treinos_10");
    }
    if (user.trainingsCreated >= 50 && !curMedals.has("treinos_50")) {
      user.medals.push("treinos_50");
    }

    // 2. service hours
    const hours = user.totalServiceSeconds / 3600;
    if (hours >= 100 && !curMedals.has("servico_100h")) {
      user.medals.push("servico_100h");
    }
    if (hours >= 500 && !curMedals.has("servico_500h")) {
      user.medals.push("servico_500h");
    }

    saveDB();
  },

  // HIERARQUIA & CARGOS (RANK CONFIGS)
  getRankConfigs: () => {
    return db.rankConfigs || [];
  },

  updateRankConfig: (adminId: string, rank: MilitaryRank, label: string, description: string, permissions: any): RankConfig => {
    const admin = dbOperations.getUserById(adminId)!;
    if (admin.role !== MilitaryRank.ADMSUPREMO) {
      throw new Error("Somente o Administrador Supremo pode alterar a hierarquia e atribuições de cargos.");
    }

    let config = db.rankConfigs.find(rc => rc.rank === rank);
    if (!config) {
      config = {
        rank,
        label,
        description,
        permissions: {
          canEnlist: !!permissions?.canEnlist,
          canPromote: !!permissions?.canPromote,
          canTrain: !!permissions?.canTrain,
          canManageDocs: !!permissions?.canManageDocs,
          canManageMissions: !!permissions?.canManageMissions,
          canAdminSystem: !!permissions?.canAdminSystem
        }
      };
      db.rankConfigs.push(config);
    } else {
      config.label = label;
      config.description = description;
      config.permissions = {
        canEnlist: !!permissions?.canEnlist,
        canPromote: !!permissions?.canPromote,
        canTrain: !!permissions?.canTrain,
        canManageDocs: !!permissions?.canManageDocs,
        canManageMissions: !!permissions?.canManageMissions,
        canAdminSystem: !!permissions?.canAdminSystem
      };
    }

    dbOperations.addLog(adminId, admin.habboNick, "EDITAR_CARGO", `Alterou permissões e descrição do cargo: ${label} (${rank}).`);
    saveDB();
    return config;
  },

  // DOCUMENTOS & SCRIPTS / AULAS
  getDocuments: () => {
    return db.documents || [];
  },

  createDocument: (userId: string, title: string, category: "manual" | "aula" | "roteiro" | "diretriz", content: string, attachmentUrl?: string): PoliceDocument => {
    const user = dbOperations.getUserById(userId)!;
    
    // Check custom permissions or Supremo
    const userConfig = db.rankConfigs.find(rc => rc.rank === user.role);
    const hasPermission = user.role === MilitaryRank.ADMSUPREMO || userConfig?.permissions.canManageDocs;

    if (!hasPermission) {
      throw new Error("Seu cargo militar não possui privilégios de postar manuais ou scripts de aula.");
    }

    const doc: PoliceDocument = {
      id: "doc_" + Math.random().toString(36).substr(2, 9),
      title,
      category,
      content,
      attachmentUrl: attachmentUrl || "",
      authorNick: user.habboNick,
      createdAt: new Date().toISOString()
    };

    db.documents.push(doc);
    dbOperations.addLog(userId, user.habboNick, "POSTAR_DOCUMENTO", `Postou o documento: "${title}" na categoria ${category}.`);
    saveDB();
    return doc;
  },

  updateDocument: (userId: string, docId: string, title: string, category: "manual" | "aula" | "roteiro" | "diretriz", content: string, attachmentUrl?: string): PoliceDocument => {
    const user = dbOperations.getUserById(userId)!;
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) throw new Error("Documento não encontrado para edição.");

    const userConfig = db.rankConfigs.find(rc => rc.rank === user.role);
    const hasPermission = user.role === MilitaryRank.ADMSUPREMO || userConfig?.permissions.canManageDocs || doc.authorNick === user.habboNick;

    if (!hasPermission) {
      throw new Error("Você não possui permissão para editar este script / aula.");
    }

    doc.title = title;
    doc.category = category;
    doc.content = content;
    doc.attachmentUrl = attachmentUrl || "";

    dbOperations.addLog(userId, user.habboNick, "EDITAR_DOCUMENTO", `Editou o documento: "${title}".`);
    saveDB();
    return doc;
  },

  deleteDocument: (userId: string, docId: string): void => {
    const user = dbOperations.getUserById(userId)!;
    const doc = db.documents.find(d => d.id === docId);
    if (!doc) throw new Error("Documento não localizado.");

    const userConfig = db.rankConfigs.find(rc => rc.rank === user.role);
    const hasPermission = user.role === MilitaryRank.ADMSUPREMO || userConfig?.permissions.canManageDocs || doc.authorNick === user.habboNick;

    if (!hasPermission) {
      throw new Error("Seu cargo militar não permite apagar este material acadêmico.");
    }

    db.documents = db.documents.filter(d => d.id !== docId);
    dbOperations.addLog(userId, user.habboNick, "APAGAR_DOCUMENTO", `Removeu o documento: "${doc.title}" do banco militar.`);
    saveDB();
  },

  // MISSIONS UPDATE / EDITING
  updateMission: (adminId: string, missionId: string, updates: Partial<Mission>): Mission => {
    const admin = dbOperations.getUserById(adminId)!;
    const hasPermission = dbOperations.hasPermission(admin.role, "canAdminSystem") || dbOperations.hasPermission(admin.role, "canManageMissions");
    if (!hasPermission) {
      throw new Error("Permissão exclusiva de Administrador Supremo ou cargo militar autorizado para gerenciar missões.");
    }

    const mission = db.missions.find(m => m.id === missionId);
    if (!mission) throw new Error("Missão não encontrada.");

    if (updates.title) mission.title = updates.title;
    if (updates.description) mission.description = updates.description;
    if (updates.targetCategory) mission.targetCategory = updates.targetCategory;
    if (updates.targetCount !== undefined) mission.targetCount = Number(updates.targetCount);
    if (updates.rewardMedals !== undefined) mission.rewardMedals = updates.rewardMedals;
    if (updates.rewardPoints !== undefined) mission.rewardPoints = Number(updates.rewardPoints);
    if (updates.rewardDestaque !== undefined) mission.rewardDestaque = !!updates.rewardDestaque;
    if (updates.active !== undefined) mission.active = !!updates.active;

    dbOperations.addLog(adminId, admin.habboNick, "EDITAR_MISSAO", `Editou parâmetros da missão: "${mission.title}".`);
    saveDB();
    return mission;
  },

  // TRAINING UPDATE / EDITING
  updateTraining: (instructorId: string, trainingId: string, updates: Partial<Training>): Training => {
    const user = dbOperations.getUserById(instructorId)!;
    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    const isAuthorized = training.instructorId === instructorId || dbOperations.hasPermission(user.role, "canAdminSystem") || dbOperations.hasPermission(user.role, "canTrain");
    if (!isAuthorized) {
      throw new Error("Você não é o instrutor deste treinamento nem possui privilégios de coordenação de treinos.");
    }

    if (updates.name) training.name = updates.name;
    if (updates.category) training.category = updates.category;
    if (updates.description) training.description = updates.description;
    if (updates.participants !== undefined) training.participants = updates.participants;
    if (updates.date) training.date = updates.date;
    if (updates.time) training.time = updates.time;
    if (updates.status) training.status = updates.status;

    dbOperations.addLog(instructorId, user.habboNick, "EDITAR_TREINO", `Editou ata do treino "${training.name}".`);
    saveDB();
    return training;
  },

  deleteTraining: (instructorId: string, trainingId: string): void => {
    const user = dbOperations.getUserById(instructorId)!;
    const training = db.trainings.find(t => t.id === trainingId);
    if (!training) throw new Error("Treinamento não localizado.");

    const isAuthorized = training.instructorId === instructorId || dbOperations.hasPermission(user.role, "canAdminSystem") || dbOperations.hasPermission(user.role, "canTrain");
    if (!isAuthorized) {
      throw new Error("Apenas o instrutor responsável, Comando Supremo ou oficiais responsáveis por treinos podem remover atas.");
    }

    db.trainings = db.trainings.filter(t => t.id !== trainingId);
    dbOperations.addLog(instructorId, user.habboNick, "EXCLUIR_TREINO", `Removeu o registro do treino "${training.name}".`);
    saveDB();
  },

  // ADMIN CONFIGURATION (edit entire user ranks, banish, promotes etc.)
  getLogs: () => db.logs,

  addLog: (userId: string | null, nick: string, action: string, details: string) => {
    db.logs.unshift({
      id: "log_" + Math.random().toString(36).substr(2, 9),
      userId,
      userNick: nick,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    // Truncate logs if they exceed 500
    if (db.logs.length > 500) {
      db.logs = db.logs.slice(0, 500);
    }
    saveDB();
  },

  getRecruitLessons: () => db.recruitLessons || [],

  createRecruitLesson: (
    instructorId: string, 
    studentNick: string, 
    category: string, 
    status: "Aprovado" | "Reprovado", 
    notes?: string, 
    screenshotUrl?: string
  ): RecruitLesson => {
    const instructor = dbOperations.getUserById(instructorId);
    if (!instructor) throw new Error("Instrutor inválido no centro de comando.");

    const lessonId = "l_" + Math.random().toString(36).substr(2, 9);
    const newLesson: RecruitLesson = {
      id: lessonId,
      instructorId,
      instructorName: instructor.habboNick,
      studentNick,
      category,
      status,
      notes: notes || "",
      screenshotUrl: screenshotUrl || "",
      createdAt: new Date().toISOString()
    };

    if (!db.recruitLessons) {
      db.recruitLessons = [];
    }
    db.recruitLessons.unshift(newLesson);

    dbOperations.addLog(
      instructorId, 
      instructor.habboNick, 
      "POSTAR_AULA", 
      `Registrou aula militar ("${category}") ministrada para Recruta @${studentNick} de status [${status}].`
    );
    saveDB();
    return newLesson;
  },

  deleteRecruitLesson: (instructorId: string, id: string): void => {
    const user = dbOperations.getUserById(instructorId);
    if (!user) throw new Error("Militar não localizado.");

    const lesson = db.recruitLessons?.find(l => l.id === id);
    if (!lesson) throw new Error("Registro de aula não localizado.");

    const isAuthorized = lesson.instructorId === instructorId || dbOperations.hasPermission(user.role, "canAdminSystem") || dbOperations.hasPermission(user.role, "canTrain");
    if (!isAuthorized) {
      throw new Error("Apenas o instrutor responsável ou oficial superior podem excluir esta aula.");
    }

    db.recruitLessons = db.recruitLessons.filter(l => l.id !== id);
    dbOperations.addLog(
      instructorId, 
      user.habboNick, 
      "EXCLUIR_AULA", 
      `Removeu o relatório de aula ministrada para Recruta @${lesson.studentNick}.`
    );
    saveDB();
  },

  syncHabboProfile: async (userId: string): Promise<User> => {
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error("Usuário militar não cadastrado no banco FMB.");

    const liveData = await fetchHabboData(user.habboNick);
    if (!liveData) {
      throw new Error("Não foi possível sincronizar no Habbo BR no momento.");
    }

    user.habboAvatar = liveData.figureString;
    user.habboMotto = liveData.motto;
    user.habboCreated = liveData.memberSince;

    dbOperations.addLog(
      null, 
      "SISTEMA", 
      "SINCRONIZAR_HABBO", 
      `Sincronizou perfil e farda de @${user.habboNick} no Habbo BR. Missão atual: "${user.habboMotto}".`
    );
    saveDB();
    return user;
  }
};
