/**
 * Client API Utility for FMB Full-Stack application
 */

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("fmb_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export const api = {
  // Authentication
  login: async (username: string, pass: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: pass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro de login");
    }
    return res.json();
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders()
      });
    } catch (e) {
      console.warn("Logout error:", e);
    }
    localStorage.removeItem("fmb_token");
  },

  getMe: async () => {
    const res = await fetch("/api/me", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      localStorage.removeItem("fmb_token");
      throw new Error("Sessão expirada");
    }
    return res.json();
  },

  // Users Management
  getUsers: async () => {
    const res = await fetch("/api/users", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter militares");
    return res.json();
  },

  getUserById: async (id: string) => {
    const res = await fetch(`/api/users/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter registro do militar");
    return res.json();
  },

  createMilitar: async (habboNick: string, pass: string, role: string) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ habboNick, password: pass, role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao alistar militar");
    }
    return res.json();
  },

  updateMilitarRank: async (id: string, newRank: string, reason: string) => {
    const res = await fetch(`/api/users/${id}/rank`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newRank, reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao processar promoção");
    }
    return res.json();
  },

  banMilitar: async (id: string, reason: string) => {
    const res = await fetch(`/api/users/${id}/ban`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao banir");
    }
    return res.json();
  },

  suspendMilitar: async (id: string, reason: string) => {
    const res = await fetch(`/api/users/${id}/suspend`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao suspender");
    }
    return res.json();
  },

  reactivateMilitar: async (id: string) => {
    const res = await fetch(`/api/users/${id}/reactivate`, {
      method: "PUT",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao reativar militar");
    }
    return res.json();
  },

  resetPassword: async (userId: string, pass: string) => {
    const res = await fetch(`/api/users/${userId}/password`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword: pass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao redefinir acesso");
    }
    return res.json();
  },

  deleteMilitar: async (id: string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir militar");
    }
    return res.json();
  },

  // 서비스 Clock In/Out
  clockIn: async () => {
    const res = await fetch("/api/service/clock-in", {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao entrar em serviço");
    }
    return res.json();
  },

  clockOut: async () => {
    const res = await fetch("/api/service/clock-out", {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao encerrar serviço");
    }
    return res.json();
  },

  getStats: async () => {
    const res = await fetch("/api/dashboard/stats", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter estatísticas");
    return res.json();
  },

  getRankings: async () => {
    const res = await fetch("/api/dashboard/rankings", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao obter rankings de destaques");
    return res.json();
  },

  // Trainings
  getTrainings: async () => {
    const res = await fetch("/api/trainings", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao listar treinamentos");
    return res.json();
  },

  createTraining: async (name: string, category: string, description: string, participants: string[], date?: string, time?: string) => {
    const res = await fetch("/api/trainings", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, category, description, participants, date, time })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao criar treinamento");
    }
    return res.json();
  },

  completeTraining: async (id: string, participants: string[]) => {
    const res = await fetch(`/api/trainings/${id}/complete`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ participants })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao concluir treinamento");
    }
    return res.json();
  },

  cancelTraining: async (id: string) => {
    const res = await fetch(`/api/trainings/${id}/cancel`, {
      method: "PUT",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao cancelar treinamento");
    }
    return res.json();
  },

  // Missions
  getMissions: async () => {
    const res = await fetch("/api/missions", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao buscar missões");
    return res.json();
  },

  createMission: async (title: string, description: string, category: string, targetCount: number, rewardMedals: string[], rewardPoints: number, rewardDestaque: boolean) => {
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, description, category, targetCount, rewardMedals, rewardPoints, rewardDestaque })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao cadastrar missão");
    }
    return res.json();
  },

  deleteMission: async (id: string) => {
    const res = await fetch(`/api/missions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao expurgar missão");
    }
    return res.json();
  },

  // Destaques (Hall da fama config)
  getDestaques: async () => {
    const res = await fetch("/api/destaques");
    if (!res.ok) throw new Error("Erro ao carregar destaques");
    return res.json();
  },

  updateDestaques: async (militaryOfTheMonth: string | null, instructorOfTheMonth: string | null, destaqueOperacional: string | null) => {
    const res = await fetch("/api/destaques", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ militaryOfTheMonth, instructorOfTheMonth, destaqueOperacional })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao atualizar Destaques FMB");
    }
    return res.json();
  },

  // System secret logs
  getLogs: async () => {
    const res = await fetch("/api/logs", {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Sem autorização de acesso aos logs confidenciais.");
    }
    return res.json();
  },

  // Habbo User Fetch
  getHabboNick: async (nick: string) => {
    const res = await fetch(`/api/habbo/${encodeURIComponent(nick)}`);
    if (!res.ok) throw new Error("Militar não localizado no Habbo original.");
    return res.json();
  },

  // Edit Mission
  updateMission: async (id: string, updates: any) => {
    const res = await fetch(`/api/missions/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar parameters da missão");
    }
    return res.json();
  },

  // Rank configurations
  getHierarchy: async () => {
    const res = await fetch("/api/hierarchy", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar dados da hierarquia");
    return res.json();
  },

  updateHierarchy: async (rank: string, label: string, description: string, permissions: any) => {
    const res = await fetch("/api/hierarchy", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ rank, label, description, permissions })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao salvar alterações da hierarquia");
    }
    return res.json();
  },

  // Documents & Classes
  getDocuments: async () => {
    const res = await fetch("/api/documents", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar os documentos da corporação");
    return res.json();
  },

  createDocument: async (title: string, category: string, content: string, attachmentUrl?: string) => {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, category, content, attachmentUrl })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao postar script/documento");
    }
    return res.json();
  },

  updateDocument: async (id: string, title: string, category: string, content: string, attachmentUrl?: string) => {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, category, content, attachmentUrl })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar script/documento");
    }
    return res.json();
  },

  deleteDocument: async (id: string) => {
    const res = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir o documento");
    }
    return res.json();
  },

  // Trainings extra edit/delete
  updateTraining: async (id: string, updates: any) => {
    const res = await fetch(`/api/trainings/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao editar fita de treinamento");
    }
    return res.json();
  },

  deleteTraining: async (id: string) => {
    const res = await fetch(`/api/trainings/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao apagar ata do treinamento");
    }
    return res.json();
  },

  // Recruit lessons & Classes Taught logging
  getRecruitLessons: async () => {
    const res = await fetch("/api/recruit-lessons", {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Erro ao carregar os relatórios de aula de recrutas");
    return res.json();
  },

  createRecruitLesson: async (lessonData: { studentNick: string, category: string, status: "Aprovado" | "Reprovado", notes?: string, screenshotUrl?: string }) => {
    const res = await fetch("/api/recruit-lessons", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(lessonData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao postar relatório de aula");
    }
    return res.json();
  },

  deleteRecruitLesson: async (id: string) => {
    const res = await fetch(`/api/recruit-lessons/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao excluir o relatório de aula");
    }
    return res.json();
  },

  // Habbo profile real-time synchronizer
  syncUserHabboProfile: async (userId: string) => {
    const res = await fetch(`/api/users/${userId}/sync`, {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro de comunicação ao sincronizar farda FMB");
    }
    return res.json();
  },

  uploadPrintImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: {
        ...(localStorage.getItem("fmb_token")
          ? { "Authorization": `Bearer ${localStorage.getItem("fmb_token")}` }
          : {})
      },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao fazer upload da imagem.");
    }
    return res.json();
  }
};
