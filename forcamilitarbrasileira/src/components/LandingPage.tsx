import React, { useEffect, useState } from "react";
import { Shield, Medal, Users, GraduationCap, Clock, Award, Star, ArrowRight, Zap, Target, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { User, MilitaryRank, LIST_OF_MEDALS } from "../types.js";

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenEnlist: () => void;
  destaques: {
    militaryOfTheMonth: User | null;
    instructorOfTheMonth: User | null;
    destaqueOperacional: User | null;
  } | null;
}

export default function LandingPage({ onOpenLogin, onOpenEnlist, destaques }: LandingPageProps) {
  const [currentHour, setCurrentHour] = useState(new Date().toLocaleTimeString("pt-BR"));

  // Real-time server clock to simulate command center feel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().toLocaleTimeString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const ranksList = Object.values(MilitaryRank).reverse();

  // Highlight elements
  const militaryStar = destaques?.militaryOfTheMonth;
  const instructorStar = destaques?.instructorOfTheMonth;
  const operationalStar = destaques?.destaqueOperacional;

  return (
    <div className="min-h-screen bg-fmb-black text-gray-100 font-sans military-grid relativ overflow-x-hidden">
      {/* Decorative overhead subtle tactical ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] bg-gradient-to-b from-fmb-army/10 via-fmb-olive/5 to-transparent blur-3xl pointer-events-none" />

      {/* TACTICAL FLOATING MONITOR STATUS HEADER */}
      <nav className="border-b border-fmb-army/30 bg-fmb-black/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 border border-fmb-gold/30 bg-fmb-dark rounded flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-fmb-gold animate-pulse" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-widest text-white leading-none uppercase">
                FORÇA MILITAR BRASILEIRA
              </h1>
              <span className="text-[9px] font-mono text-fmb-gold uppercase tracking-wider block mt-0.5">
                FMB • CENTRO OPERACIONAL DE COMANDO 🇧🇷
              </span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="text-right border-r border-fmb-army/25 pr-6">
              <span className="text-[9px] font-mono text-gray-500 block">HORÁRIO DE SÃO PAULO</span>
              <span className="text-xs font-mono font-bold text-fmb-gold tracking-widest">{currentHour}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-gray-500 block">COORDENAÇÃO INTEGRADA</span>
              <span className="text-xs font-mono font-bold text-green-500 flex items-center space-x-1 justify-end">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping mr-1" /> SERVIDORES OPERACIONAIS
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenLogin}
              className="bg-fmb-dark/70 border border-fmb-army/40 hover:bg-fmb-army/30 hover:border-fmb-gold/40 px-4 py-1.5 rounded transition-all text-xs font-mono uppercase tracking-widest text-gray-200"
              id="landing-login-btn"
            >
              Entrar
            </button>
            <button
              onClick={onOpenEnlist}
              className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 hover:border-fmb-gold text-white px-4 py-1.5 rounded transition-all text-xs font-mono uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(53,94,59,0.3)] animate-pulse"
              id="landing-enlist-btn"
            >
              Alistar-se
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative px-4 pt-16 pb-20 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center" id="fmb-tactical-hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          {/* Brazilian Ribbon Detail */}
          <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 bg-fmb-slate border border-fmb-army/40 rounded-full text-xs font-mono tracking-wider text-green-400">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
            <span className="w-2.5 h-2.5 bg-fmb-gold rounded-full inline-block" />
            <span>EXÉRCITO MILITAR ATIVO DO HABBO BRASIL</span>
          </div>

          <h1 className="font-display font-extrabold text-5xl md:text-7xl text-white tracking-tighter leading-none uppercase">
            FORÇA MILITAR BRASILEIRA
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl font-display font-medium text-gray-300 italic">
            "Disciplina, Honra e Compromisso."
          </p>

          <p className="max-w-2xl mx-auto text-sm text-gray-400 leading-relaxed">
            Seja bem-vindo ao portal de inteligência e regência tática da <strong className="text-fmb-gold">FMB</strong>. 
            Nossa doutrina preza pela excelência operacional, treinamentos de resiliência e meritocracia rigorosa. Prepare-se para defender a soberania nacional no Habbo!
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button
              onClick={onOpenLogin}
              className="bg-fmb-slate hover:bg-fmb-dark border border-fmb-army/60 hover:border-fmb-gold/50 px-8 py-3.5 rounded text-sm uppercase tracking-widest font-mono font-bold text-fmb-gold transition-all shadow-md flex items-center space-x-2 group"
              id="hero-dashboard-login-btn"
            >
              <span>Acessar Painel</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </button>
            <button
              onClick={onOpenEnlist}
              className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold px-8 py-3.5 rounded text-sm uppercase tracking-widest font-mono font-bold text-white transition-all shadow-[0_0_20px_rgba(53,94,59,0.4)] flex items-center space-x-2 animate-bounce"
              id="hero-recruit-enlist-btn"
            >
              <Zap className="w-4 h-4 text-fmb-gold" />
              <span>Alistar Novo Militar</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* CORE STATS BOARD */}
      <section className="bg-fmb-slate/40 border-y border-fmb-army/20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <Users className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">FORÇA DE COMBATE</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">124 MILITARES</span>
            <span className="text-[10px] font-mono text-green-400 block mt-1">● 100% REGULAMENTADOS</span>
          </div>

          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <Clock className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">HORAS DE SENTINELA</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">2.418 HS</span>
            <span className="text-[10px] font-mono text-gray-500 block mt-1">EM PATRULHA ATIVA</span>
          </div>

          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <GraduationCap className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">INSTRUTORES FORMADOS</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">52 OFICIAIS</span>
            <span className="text-[10px] font-mono text-green-400 block mt-1">ACADEMIA MILITAR DE TIPOS</span>
          </div>

          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <Award className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">BATALHA DE MISSÕES</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">15 ATIVAS</span>
            <span className="text-[10px] font-mono text-fmb-gold block mt-1">RECOMPENSAS EXCEPCIONAIS</span>
          </div>
        </div>
      </section>

      {/* HALL DA FAMA */}
      <section className="max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8" id="hall-da-fama-section">
        <div className="text-center mb-12">
          <Medal className="w-10 h-10 text-fmb-gold mx-auto mb-3 animate-pulse" />
          <h2 className="font-display text-3xl font-extrabold text-white tracking-tight uppercase">
            🏆 HALL DA FAMA MILITAR 🏆
          </h2>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
            Chancela e consagração do alto escalão pelas operações deste ciclo
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Militar do Mês */}
          <div className="border border-fmb-army/50 bg-fmb-slate/30 p-6 rounded-lg text-center relative group hover:border-fmb-gold/40 transition-colors">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-fmb-gold text-fmb-black font-display font-extrabold text-[10px] tracking-widest uppercase rounded shadow-lg">
              MILITAR DO MÊS
            </div>
            <div className="w-24 h-24 bg-fmb-black/60 border border-fmb-army/30 rounded-full mx-auto my-4 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform shrink-0">
              {militaryStar ? (
                <img 
                  src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${militaryStar.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                  alt={militaryStar.habboNick}
                  className="scale-125 translate-y-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Users className="w-10 h-10 text-gray-600" />
              )}
            </div>
            <h3 className="font-display font-extrabold text-lg text-white">
              {militaryStar ? militaryStar.habboNick : "A Nomear"}
            </h3>
            <p className="text-xs font-mono text-fmb-gold font-bold mt-1 uppercase">
              {militaryStar ? militaryStar.role : "Soberano Patrulheiro"}
            </p>
            <p className="text-xs text-gray-400 mt-3 italic leading-relaxed">
              "{militaryStar ? militaryStar.habboMotto : "Serviço leal e destemido focado na segurança nacional FMB."}"
            </p>
            <div className="mt-4 pt-4 border-t border-fmb-army/20 flex justify-center space-x-2">
              <span className="px-2 py-0.5 bg-fmb-army/40 border border-fmb-gold/20 text-[9px] font-mono rounded text-fmb-gold">
                🥇 Conquista Suprema
              </span>
            </div>
          </div>

          {/* Instrutor do Mês */}
          <div className="border border-fmb-army/50 bg-fmb-slate/30 p-6 rounded-lg text-center relative group hover:border-fmb-gold/40 transition-colors">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-fmb-gold text-fmb-black font-display font-extrabold text-[10px] tracking-widest uppercase rounded shadow-lg">
              INSTRUTOR DO MÊS
            </div>
            <div className="w-24 h-24 bg-fmb-black/60 border border-fmb-army/30 rounded-full mx-auto my-4 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform shrink-0">
              {instructorStar ? (
                <img 
                  src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${instructorStar.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                  alt={instructorStar.habboNick}
                  className="scale-125 translate-y-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <BookOpen className="w-10 h-10 text-gray-600" />
              )}
            </div>
            <h3 className="font-display font-extrabold text-lg text-white">
              {instructorStar ? instructorStar.habboNick : "A Nomear"}
            </h3>
            <p className="text-xs font-mono text-fmb-gold font-bold mt-1 uppercase">
              {instructorStar ? instructorStar.role : "Mestre Operacional"}
            </p>
            <p className="text-xs text-gray-400 mt-3 italic leading-relaxed">
              "{instructorStar ? instructorStar.habboMotto : "Doutrinar recrutas, construir a farda de ferro."}"
            </p>
            <div className="mt-4 pt-4 border-t border-fmb-army/20 flex justify-center space-x-2">
              <span className="px-2 py-0.5 bg-fmb-army/40 border border-fmb-gold/20 text-[9px] font-mono rounded text-fmb-gold">
                🥇 Elite de Treino
              </span>
            </div>
          </div>

          {/* Destaque Operacional */}
          <div className="border border-fmb-army/50 bg-fmb-slate/30 p-6 rounded-lg text-center relative group hover:border-fmb-gold/40 transition-colors">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-fmb-gold text-fmb-black font-display font-extrabold text-[10px] tracking-widest uppercase rounded shadow-lg">
              DESTAQUE OPERACIONAL
            </div>
            <div className="w-24 h-24 bg-fmb-black/60 border border-fmb-army/30 rounded-full mx-auto my-4 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform shrink-0">
              {operationalStar ? (
                <img 
                  src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${operationalStar.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                  alt={operationalStar.habboNick}
                  className="scale-125 translate-y-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Zap className="w-10 h-10 text-gray-600" />
              )}
            </div>
            <h3 className="font-display font-extrabold text-lg text-white">
              {operationalStar ? operationalStar.habboNick : "A Nomear"}
            </h3>
            <p className="text-xs font-mono text-fmb-gold font-bold mt-1 uppercase">
              {operationalStar ? operationalStar.role : "Sargento Tático"}
            </p>
            <p className="text-xs text-gray-400 mt-3 italic leading-relaxed">
              "{operationalStar ? operationalStar.habboMotto : "Em combate ostensivo com dedicação impecável."}"
            </p>
            <div className="mt-4 pt-4 border-t border-fmb-army/20 flex justify-center space-x-2">
              <span className="px-2 py-0.5 bg-fmb-army/40 border border-fmb-gold/20 text-[9px] font-mono rounded text-fmb-gold">
                🥇 Crachá de Bravura
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* MILITARY HIERARCHY MAP */}
      <section className="bg-fmb-slate/20 border-t border-fmb-army/10 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Target className="w-10 h-10 text-fmb-gold mx-auto mb-3" />
            <h2 className="font-display text-3xl font-extrabold text-white tracking-tight uppercase">
              ORGANOGRAMA & HIERARQUIA MILITAR
            </h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
              O ordenamento e precedência absoluta de nossa força de comando
            </p>
          </div>

          <div className="space-y-3 bg-fmb-black/80 border border-fmb-army/30 p-6 rounded-lg text-xs font-mono">
            {ranksList.map((rank, index) => {
              // Custom color-coding based on hierarchy power
              let rankStyle = "border-gray-800 text-gray-300 bg-fmb-slate/20";
              if (index < 2) {
                rankStyle = "border-fmb-gold/40 text-fmb-gold bg-fmb-gold/5 font-extrabold";
              } else if (index < 7) {
                rankStyle = "border-fmb-army/50 text-green-300 bg-fmb-army/10";
              }

              return (
                <div 
                  key={rank}
                  className={`flex items-center justify-between p-3 border rounded transition-colors hover:bg-fmb-slate/40 ${rankStyle}`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 text-gray-600 text-right">#{ranksList.length - index}</span>
                    <span className="font-bold text-sm tracking-wide">{rank}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {index < 2 ? (
                      <span className="px-2 py-0.5 bg-fmb-gold text-fmb-black rounded text-[9px] uppercase tracking-wider font-bold">
                        Alto Escalão
                      </span>
                    ) : index < 7 ? (
                      <span className="px-2 py-0.5 bg-fmb-army text-white rounded text-[9px] uppercase tracking-wider">
                        Oficiais
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[9px] uppercase tracking-widest">
                        Praças/Graduados
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-fmb-army/30 bg-fmb-black text-gray-500 py-12 px-4 sm:px-6 lg:px-8 text-center text-xs font-mono">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex justify-center items-center space-x-3">
            <Shield className="w-5 h-5 text-fmb-gold" />
            <span className="text-white font-display font-extrabold uppercase tracking-widest">FMB 🇧🇷</span>
          </div>
          <p className="max-w-md mx-auto text-[11px] text-gray-400 leading-relaxed">
            A Força Militar Brasileira é uma instituição virtual inspirada nas forças de defesa nacionais brasileiras sem quaisquer filiações governamentais políticas reais.
          </p>
          <div className="pt-4 border-t border-fmb-army/10 text-[9px]">
            © {new Date().getFullYear()} FORÇA MILITAR BRASILEIRA • TODOS OS DIREITOS RESERVADOS • SEGURANÇA MÁXIMA
          </div>
        </div>
      </footer>
    </div>
  );
}
