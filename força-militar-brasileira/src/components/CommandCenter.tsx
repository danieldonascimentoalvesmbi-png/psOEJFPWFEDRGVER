import React, { useEffect, useState } from "react";
import { 
  Shield, Clock, Power, Users, GraduationCap, Award, Star, BookOpen, 
  Map, Activity, ClipboardList, Settings, Lock, LogOut, Check, ChevronRight, Zap,
  ClipboardCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User, MilitaryRank, UserActiveState, UserStatus } from "../types.js";

// Helper components & panels
import UserProfile from "./UserProfile.js";
import TrainingsPanel from "./TrainingsPanel.js";
import MissionsPanel from "./MissionsPanel.js";
import AdminPanel from "./AdminPanel.js";
import DocumentsPanel from "./DocumentsPanel.js";
import RecruitLessonsPanel from "./RecruitLessonsPanel.js";

interface CommandCenterProps {
  user: User;
  onLogout: () => void;
  onUpdateMe: (updatedUser: User) => void;
}

export default function CommandCenter({ user, onLogout, onUpdateMe }: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState<"operacional" | "militares" | "instrucoes" | "missoes" | "documentos" | "admin" | "postar-aulas">("operacional");
  
  // Dashboard indicators
  const [stats, setStats] = useState<{
    totalMilitars: number;
    online: number;
    emServico: number;
    trainingsConcluded: number;
    promotionsTotal: number;
    totalHoursActivity: number;
  }>({
    totalMilitars: 0,
    online: 0,
    emServico: 0,
    trainingsConcluded: 0,
    promotionsTotal: 0,
    totalHoursActivity: 0
  });

  const [serviceTimer, setServiceTimer] = useState<number>(0);
  const [militars, setMilitars] = useState<User[]>([]);
  const [selectedMilitarId, setSelectedMilitarId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Quick Action Forms State
  const [enlistNick, setEnlistNick] = useState("");
  const [enlistPass, setEnlistPass] = useState("");
  const [enlistRank, setEnlistRank] = useState<MilitaryRank>(MilitaryRank.SOLDADO);
  const [enlistSuccess, setEnlistSuccess] = useState<string | null>(null);
  const [enlistError, setEnlistError] = useState<string | null>(null);
  const [enlisting, setEnlisting] = useState(false);

  // Promotion/Demotion Form
  const [promTargetId, setPromTargetId] = useState("");
  const [promRank, setPromRank] = useState<MilitaryRank>(MilitaryRank.CABO);
  const [promReason, setPromReason] = useState("");
  const [promSuccess, setPromSuccess] = useState<string | null>(null);
  const [promError, setPromError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  // Load stats and active militars
  const loadDashboardData = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
      
      const militarsList = await api.getUsers();
      setMilitars(militarsList);

      try {
        const hierarchy = await api.getHierarchy();
        const userConfig = hierarchy.find((rc: any) => rc.rank === user.role);
        const canAdmin = user.role === MilitaryRank.ADMSUPREMO || user.role === MilitaryRank.COMANDANTE_GERAL || !!userConfig?.permissions?.canAdminSystem;
        setIsAdminUser(canAdmin);
      } catch (hierErr) {
        console.warn("Erro ao obter hierarquias de administração:", hierErr);
        setIsAdminUser(user.role === MilitaryRank.ADMSUPREMO);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do QG:", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // refresh metadata every 10s
    return () => clearInterval(interval);
  }, []);

  // Time Clock counter execution
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (user.activeState === UserActiveState.EM_SERVICO) {
      // Find relative check-in time by requesting user profile once or local simulation
      // We'll increment every second
      timer = setInterval(() => {
        setServiceTimer(prev => prev + 1);
      }, 1000);
    } else {
      setServiceTimer(0);
    }
    return () => clearInterval(timer);
  }, [user.activeState]);

  const handleClockToggle = async () => {
    try {
      if (user.activeState === UserActiveState.EM_SERVICO) {
        const res = await api.clockOut();
        // Update user state
        const updated = { ...user, activeState: UserActiveState.ONLINE };
        onUpdateMe(updated);
        setServiceTimer(0);
      } else {
        const res = await api.clockIn();
        const updated = { ...user, activeState: UserActiveState.EM_SERVICO };
        onUpdateMe(updated);
        setServiceTimer(1); // begin counting
      }
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Erro operacional ao registrar folha de ponto.");
    }
  };

  const handleEnlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enlistNick || !enlistPass) {
      setEnlistError("Nick e Senha são de preenchimento obrigatório.");
      return;
    }
    
    setEnlisting(true);
    setEnlistError(null);
    setEnlistSuccess(null);

    try {
      const res = await api.createMilitar(enlistNick, enlistPass, enlistRank);
      setEnlistSuccess(`Militar ${res.habboNick} foi alistado com êxito!`);
      setEnlistNick("");
      setEnlistPass("");
      setEnlistRank(MilitaryRank.SOLDADO);
      loadDashboardData();
    } catch (err: any) {
      setEnlistError(err.message || "Erro ao alistar recruta.");
    } finally {
      setEnlisting(false);
    }
  };

  const handlePromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promTargetId || !promReason) {
      setPromError("Selecione o militar e insira a justificativa oficial.");
      return;
    }

    setPromoting(true);
    setPromError(null);
    setPromSuccess(null);

    try {
      const res = await api.updateMilitarRank(promTargetId, promRank, promReason);
      setPromSuccess("Patente militar alterada e histórico permanente gravado!");
      setPromReason("");
      setPromTargetId("");
      loadDashboardData();
    } catch (err: any) {
      setPromError(err.message || "Sua patente não possui nível suficiente para alterar este registro.");
    } finally {
      setPromoting(false);
    }
  };

  const handleLogInOutBtn = async () => {
    await api.logout();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-fmb-black text-gray-100 flex flex-col font-sans military-grid-coarse">
      
      {/* GLOBAL TELEMETRY HEADER STATUS */}
      <header className="border-b border-fmb-army/30 bg-fmb-slate/90 text-xs px-4 py-3 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="border border-fmb-gold/40 p-1 bg-fmb-black rounded shadow">
            <Shield className="w-5 h-5 text-fmb-gold" />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-sm tracking-widest text-white uppercase leading-none">
              FORÇA MILITAR BRASILEIRA • FMB 🇧🇷
            </h2>
            <span className="text-[10px] font-mono text-fmb-gold tracking-widest block uppercase mt-0.5">
              Terminal de Operações de Comando
            </span>
          </div>
        </div>

        {/* User Telemetry Card */}
        <div className="flex items-center space-x-4 ml-auto border-l border-fmb-army/30 pl-4">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-fmb-black border border-fmb-army/40 overflow-hidden shrink-0 flex items-center justify-center">
              <img 
                src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${user.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                alt={user.habboNick}
                className="scale-125 translate-y-1.5"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-left leading-none">
              <span className="font-bold text-white text-xs block">{user.habboNick}</span>
              <span className="text-[9px] font-mono text-fmb-gold uppercase mt-0.5 block font-semibold">{user.role}</span>
            </div>
          </div>

          {/* Active status indicator */}
          <div className="hidden sm:flex flex-col items-start px-3 py-1 bg-fmb-black/50 border border-fmb-army/20 rounded font-mono text-[9px]">
            <span className="text-gray-500">ESTADO ATIVO</span>
            {user.activeState === UserActiveState.EM_SERVICO ? (
              <span className="text-amber-400 font-bold flex items-center">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping mr-1" /> EM SERVIÇO
              </span>
            ) : (
              <span className="text-green-500 font-bold flex items-center">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1" /> ONLINE
              </span>
            )}
          </div>
          
          {/* PONTO SYSTEM CONTROL */}
          <div className="flex items-center space-x-2">
            {user.activeState === UserActiveState.EM_SERVICO && (
              <div className="font-mono text-xs px-2.5 py-1 bg-fmb-dark border border-amber-500/30 text-amber-300 rounded flex items-center font-bold">
                <Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <span>
                  {Math.floor(serviceTimer / 3600).toString().padStart(2, "0")}:
                  {Math.floor((serviceTimer % 3600) / 60).toString().padStart(2, "0")}:
                  {(serviceTimer % 60).toString().padStart(2, "0")}
                </span>
              </div>
            )}

            <button
              onClick={handleClockToggle}
              className={`px-3 py-1.5 rounded transition-all font-mono text-[10px] uppercase tracking-wider font-bold shrink-0 shadow flex items-center space-x-1.5 ${
                user.activeState === UserActiveState.EM_SERVICO
                  ? "bg-red-700 hover:bg-red-800 text-white border border-red-500/30"
                  : "bg-fmb-army hover:bg-fmb-olive text-white border border-fmb-gold/40 animate-pulse"
              }`}
              id="ponto-clock-btn"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{user.activeState === UserActiveState.EM_SERVICO ? "Encerrar Serviço" : "Entrar em Serviço"}</span>
            </button>
          </div>

          <button
            onClick={handleLogInOutBtn}
            className="text-gray-400 hover:text-white p-1 hover:bg-fmb-slate/60 rounded"
            title="Desconectar do Terminal"
            id="header-logout-btn"
          >
            <LogOut className="w-5 h-5 text-red-400 hover:scale-105 transition-transform" />
          </button>
        </div>
      </header>

      {/* DASHBOARD STRUCTURE WITH PERSISTENT SIDEBAR */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* SIDEBAR TACTICAL NAV */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          
          <div className="p-4 bg-fmb-slate/40 border border-fmb-army/20 rounded-lg select-none text-center">
            <span className="text-[10px] font-mono text-gray-500 block uppercase tracking-widest">PATTRIA E HONRA</span>
            <div className="font-display font-black text-xs text-white uppercase tracking-widest mt-1">
              BRASIL ACIMA DE TUDO! 🇧🇷
            </div>
          </div>

          <div className="bg-fmb-black/80 border border-fmb-army/30 rounded-lg p-2.5 space-y-1">
            <button
              onClick={() => { setActiveTab("operacional"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "operacional" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-operacional-btn"
            >
              <Activity className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Central Operacional</span>
            </button>

            <button
              onClick={() => { setActiveTab("militares"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "militares" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-militares-btn"
            >
              <Users className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Efetivo Militar</span>
            </button>

            <button
              onClick={() => { setActiveTab("instrucoes"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "instrucoes" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-instrucoes-btn"
            >
              <GraduationCap className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Instruções de Treino</span>
            </button>

            <button
              onClick={() => { setActiveTab("missoes"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "missoes" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-missoes-btn"
            >
              <Award className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Operações & Missões</span>
            </button>

            <button
              onClick={() => { setActiveTab("documentos"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "documentos" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-documentos-btn"
            >
              <BookOpen className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Documentos & Aulas</span>
            </button>

            <button
              onClick={() => { setActiveTab("postar-aulas"); setSelectedMilitarId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "postar-aulas" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-postar-aulas-btn"
            >
              <ClipboardCheck className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Postar Aulas (Recrutas)</span>
            </button>

            <button
              onClick={() => {
                if (isAdminUser) {
                  setActiveTab("admin");
                  setSelectedMilitarId(null);
                } else {
                  alert("Acesso exclusivo reservado ao Alto Comando com privilégios administrativos.");
                }
              }}
              className={`w-full text-left px-3 py-2.5 rounded transition-all font-mono text-[11px] uppercase tracking-wider flex items-center space-x-2.5 ${
                activeTab === "admin" && !selectedMilitarId
                  ? "bg-fmb-army text-white font-bold border-l-4 border-fmb-gold shadow-md"
                  : "text-gray-300 hover:bg-fmb-slate/60"
              }`}
              id="sidebar-admin-btn"
            >
              <Settings className="w-4 h-4 text-fmb-gold shrink-0" />
              <span>Administração Geral</span>
              {!isAdminUser && (
                <Lock className="w-3 h-3 text-gray-500 ml-auto" />
              )}
            </button>
          </div>
        </aside>

        {/* MAIN PANEL CONTENT BOX */}
        <main className="flex-1 bg-fmb-black/80 border border-fmb-army/30 rounded-lg p-5 shadow-xl min-w-0">
          
          {/* PROFILE VIEW OVERLAY DIRECTIVE */}
          {selectedMilitarId ? (
            <UserProfile 
              militarId={selectedMilitarId} 
              onClose={() => setSelectedMilitarId(null)}
              viewer={user}
            />
          ) : (
            <AnimatePresence mode="wait">
              
              {/* TAB 1: CENTRAL OPERACIONAL (DASHBOARD) */}
              {activeTab === "operacional" && (
                <motion.div
                  key="operacional-view"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center space-x-2 pb-3 border-b border-fmb-army/20">
                    <Activity className="w-5 h-5 text-fmb-gold" />
                    <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Central de Inteligência Operacional</h3>
                  </div>

                  {/* Operational Counters Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-fmb-slate/60 border border-fmb-army/30 p-4 rounded text-center">
                      <span className="text-[10px] font-mono text-gray-400 block uppercase tracking-widest">FORÇA ONLINE</span>
                      <span className="font-mono text-3xl font-extrabold text-white block mt-1">{stats.online}</span>
                      <span className="text-[9px] font-mono text-green-400 mt-1 block">CONEXÃO IP ATIVA</span>
                    </div>

                    <div className="bg-fmb-slate/60 border border-fmb-army/30 p-4 rounded text-center">
                      <span className="text-[10px] font-mono text-gray-400 block uppercase tracking-widest">MILITARES EM SERVIÇO</span>
                      <span className="font-mono text-3xl font-extrabold text-amber-400 block mt-1">{stats.emServico}</span>
                      <span className="text-[9px] font-mono text-amber-500 mt-1 block">EFETIVO ATIVO NESSE INSTANTE</span>
                    </div>

                    <div className="bg-fmb-slate/60 border border-fmb-army/30 p-4 rounded text-center col-span-2 lg:col-span-1">
                      <span className="text-[10px] font-mono text-gray-400 block uppercase tracking-widest">HORAS DE COMBATE</span>
                      <span className="font-mono text-3xl font-extrabold text-fmb-gold block mt-1">{stats.totalHoursActivity} hs</span>
                      <span className="text-[9px] font-mono text-gray-500 mt-1 block">EFETIVO ACUMULADO</span>
                    </div>
                  </div>

                  {/* QUICK COMBAT CONTROL ROOM (ENLIST & PROMOTION DESK) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                    
                    {/* ENLIST DESK */}
                    <div className="bg-fmb-black/95 border border-fmb-army/30 p-5 rounded-lg relative">
                      <div className="absolute top-0 right-0 p-2 bg-fmb-army/10 text-fmb-gold">
                        <Users className="w-5 h-5" />
                      </div>
                      <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-4 border-b border-fmb-army/20 pb-2">
                        Alistamento Militar (Cadastrar)
                      </h4>

                      {enlistSuccess && (
                        <div className="mb-4 p-2.5 border border-green-500/30 bg-green-950/20 text-green-300 text-xs rounded">
                          {enlistSuccess}
                        </div>
                      )}
                      {enlistError && (
                        <div className="mb-4 p-2.5 border border-red-500/30 bg-red-950/20 text-red-300 text-xs rounded">
                          {enlistError}
                        </div>
                      )}

                      <form onSubmit={handleEnlistSubmit} className="space-y-3 font-mono text-xs">
                        <div>
                          <label className="text-[10px] uppercase text-fmb-gold block mb-1">Nick Habbo Recruto</label>
                          <input
                            type="text"
                            placeholder="Ex: Recuta_Militar"
                            value={enlistNick}
                            onChange={(e) => setEnlistNick(e.target.value)}
                            className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase text-fmb-gold block mb-1">Senha Tática Inicial</label>
                            <input
                              type="password"
                              placeholder="FMB123"
                              value={enlistPass}
                              onChange={(e) => setEnlistPass(e.target.value)}
                              className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase text-fmb-gold block mb-1">Patente</label>
                            <select
                              value={enlistRank}
                              onChange={(e) => setEnlistRank(e.target.value as MilitaryRank)}
                              className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none cursor-pointer"
                            >
                              <option value={MilitaryRank.SOLDADO}>Soldado (Padrão)</option>
                              <option value={MilitaryRank.CABO}>Cabo</option>
                              <option value={MilitaryRank.SARGENTO}>Sargento</option>
                            </select>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={enlisting}
                          className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 hover:border-gold py-2 text-white font-bold rounded text-xs uppercase tracking-wider transition-colors mt-2"
                        >
                          {enlisting ? "ALISTANDO..." : "Chancelar Alistamento"}
                        </button>
                      </form>
                    </div>

                    {/* PROMOTION DESK */}
                    <div className="bg-fmb-black/95 border border-fmb-army/30 p-5 rounded-lg relative">
                      <div className="absolute top-0 right-0 p-2 bg-fmb-army/10 text-fmb-gold">
                        <Award className="w-5 h-5" />
                      </div>
                      <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider mb-4 border-b border-fmb-army/20 pb-2">
                        Despacho de Promoções & Cargos
                      </h4>

                      {promSuccess && (
                        <div className="mb-4 p-2.5 border border-green-500/30 bg-green-950/20 text-green-300 text-xs rounded">
                          {promSuccess}
                        </div>
                      )}
                      {promError && (
                        <div className="mb-4 p-2.5 border border-red-500/30 bg-red-950/20 text-red-300 text-xs rounded">
                          {promError}
                        </div>
                      )}

                      <form onSubmit={handlePromotionSubmit} className="space-y-3 font-mono text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase text-fmb-gold block mb-1">Selecione o Militar</label>
                            <select
                              value={promTargetId}
                              onChange={(e) => setPromTargetId(e.target.value)}
                              className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none cursor-pointer"
                              required
                            >
                              <option value="">Selecione...</option>
                              {militars
                                .filter(m => m.id !== user.id && m.status === UserStatus.ATIVO)
                                .map(m => (
                                  <option key={m.id} value={m.id}>
                                    @{m.habboNick} ({m.role})
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase text-fmb-gold block mb-1">Destino Militar</label>
                            <select
                              value={promRank}
                              onChange={(e) => setPromRank(e.target.value as MilitaryRank)}
                              className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none cursor-pointer font-bold"
                            >
                              {Object.values(MilitaryRank).map(rank => (
                                <option key={rank} value={rank}>{rank}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase text-fmb-gold block mb-1">Justificativa Oficial de Decreto</label>
                          <textarea
                            placeholder="Descreva detalhadamente o desempenho e a razão militar para este despacho..."
                            rows={2}
                            value={promReason}
                            onChange={(e) => setPromReason(e.target.value)}
                            className="w-full bg-fmb-slate border border-fmb-army/30 focus:border-fmb-gold py-1.5 px-2 rounded text-white outline-none resize-none"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={promoting}
                          className="w-full bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 hover:border-gold py-2 text-white font-bold rounded text-xs uppercase tracking-wider transition-colors"
                        >
                          {promoting ? "DESPACHANDO..." : "Consagrar Despacho"}
                        </button>
                      </form>
                    </div>

                  </div>

                </motion.div>
              )}

              {/* TAB 2: EFETIVO MILITAR LIST (PROFILES SEARCH) */}
              {activeTab === "militares" && (
                <motion.div
                  key="militares-view"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center space-x-2 pb-3 border-b border-fmb-army/20">
                    <Users className="w-5 h-5 text-fmb-gold" />
                    <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight">Efetivo de Oficiais e Praças</h3>
                  </div>

                  <p className="text-xs text-gray-400">
                    Selecione um soldado da Força Militar Brasileira para visualizar sua ficha de cadastro militar integral, conquistas, medalhas e folha de serviço.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {militars.map(m => {
                      let activeIndicator = "border-gray-800 bg-gray-500";
                      if (m.activeState === UserActiveState.ONLINE) activeIndicator = "border-green-500 bg-green-500";
                      if (m.activeState === UserActiveState.EM_SERVICO) activeIndicator = "border-amber-400 bg-amber-400";

                      return (
                        <div 
                          key={m.id}
                          onClick={() => setSelectedMilitarId(m.id)}
                          className="bg-fmb-slate/40 border border-fmb-army/30 hover:border-fmb-gold/40 p-4 rounded-lg flex items-center justify-between cursor-pointer group transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full bg-fmb-black border border-fmb-army/30 overflow-hidden flex items-center justify-center shrink-0">
                                <img 
                                  src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${m.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                                  alt={m.habboNick}
                                  className="scale-125 translate-y-2 group-hover:scale-135 transition-transform"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${activeIndicator}`} />
                            </div>

                            <div className="text-left font-mono leading-tight">
                              <span className="font-bold text-white text-xs block group-hover:text-fmb-gold transition-colors">@{m.habboNick}</span>
                              <span className="text-[10px] text-fmb-gold mt-1 block font-semibold">{m.role}</span>
                              
                              {m.status === UserStatus.BANIDO && (
                                <span className="text-[8px] bg-red-950 text-red-200 border border-red-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block uppercase">BANIDO</span>
                              )}
                              {m.status === UserStatus.SUSPENSO && (
                                <span className="text-[8px] bg-amber-950 text-amber-200 border border-amber-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block uppercase">SUSPENSO</span>
                              )}
                            </div>
                          </div>

                          <ChevronRight className="w-5 h-5 text-gray-500 group-hover:translate-x-1 transition-transform" />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* TAB 3: COMPANHIA DE INSTRUÇÃO (TREINAMENTOS) */}
              {activeTab === "instrucoes" && (
                <TrainingsPanel viewer={user} onRefreshStats={loadDashboardData} />
              )}

              {/* TAB 4: MISSÕES */}
              {activeTab === "missoes" && (
                <MissionsPanel viewer={user} />
              )}

              {/* TAB 4.5: DOCUMENTS */}
              {activeTab === "documentos" && (
                <DocumentsPanel viewer={user} />
              )}

              {/* TAB 4.6: RECRUIT LESSONS (POSTAR AULAS) */}
              {activeTab === "postar-aulas" && (
                <RecruitLessonsPanel user={user} />
              )}

              {/* TAB 5: ADMIN CONTROLS DESIGN */}
              {activeTab === "admin" && (
                <AdminPanel 
                  viewer={user} 
                  militarsList={militars}
                  onRefreshDashboard={loadDashboardData}
                />
              )}

            </AnimatePresence>
          )}

        </main>
      </div>
    </div>
  );
}
