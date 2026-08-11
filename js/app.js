(function () {
  const state = {
    view: "dashboard",
    search: "",
    selectedProjectId: "all",
    calendarType: "all",
    calendarMonth: monthStartIso(new Date().toISOString().slice(0, 10)),
    calendarView: "month",
    calendarSelectedDate: null,
    pipelineView: "kanban",
    showInactiveRoles: false,
    selectedPositionIds: new Set(),
    data: structuredClone(window.staffingSeed),
    dbMode: "memory"
  };

  const applicationSteps = [
    "IDENTIFIED",
    "CV_INTERNAL_REVIEW",
    "INTERNAL_INTERVIEW_SCHEDULED",
    "INTERNAL_INTERVIEW_COMPLETED",
    "INTERNAL_INTERVIEW_APPROVED",
    "CV_LOCAL_REVIEW",
    "LOCAL_INTERVIEW_SCHEDULED",
    "LOCAL_INTERVIEW_COMPLETED",
    "LOCAL_INTERVIEW_APPROVED",
    "GLOBAL_INTERVIEW_SCHEDULED",
    "GLOBAL_INTERVIEW_COMPLETED",
    "GLOBAL_INTERVIEW_APPROVED",
    "CONFIRMED",
    "CANCELLED",
    "REJECTED"
  ];

  const pipelineGroups = [
    {
      id: "identification",
      title: "Identificacao",
      statuses: ["IDENTIFIED"]
    },
    {
      id: "internal",
      title: "Avaliacao interna",
      statuses: [
        "CV_INTERNAL_REVIEW",
        "INTERNAL_INTERVIEW_SCHEDULED",
        "INTERNAL_INTERVIEW_COMPLETED",
        "INTERNAL_INTERVIEW_APPROVED"
      ]
    },
    {
      id: "local",
      title: "Avaliacao local",
      statuses: [
        "CV_LOCAL_REVIEW",
        "LOCAL_INTERVIEW_SCHEDULED",
        "LOCAL_INTERVIEW_COMPLETED",
        "LOCAL_INTERVIEW_APPROVED"
      ]
    },
    {
      id: "global",
      title: "Avaliacao global",
      statuses: [
        "GLOBAL_INTERVIEW_SCHEDULED",
        "GLOBAL_INTERVIEW_COMPLETED",
        "GLOBAL_INTERVIEW_APPROVED"
      ]
    },
    {
      id: "decision",
      title: "Decisao",
      statuses: ["CONFIRMED", "CANCELLED", "REJECTED"]
    }
  ];

  const labels = {
    ACTIVE: "Ativo",
    CLOSED: "Fechado",
    CANCELLED: "Cancelado",
    DRAFT: "Rascunho",
    OPEN: "Aberta",
    ON_HOLD: "Em espera",
    FILLED: "Preenchida",
    NEW: "Nova",
    IN_PROCESS: "Em processo",
    IDENTIFIED: "Identificado",
    CV_INTERNAL_REVIEW: "CV em avaliacao interna",
    INTERNAL_INTERVIEW_SCHEDULED: "Entrevista interna agendada",
    INTERNAL_INTERVIEW_COMPLETED: "Entrevista interna executada",
    INTERNAL_INTERVIEW_APPROVED: "Aprovado internamente",
    CV_LOCAL_REVIEW: "CV em avaliacao local",
    LOCAL_INTERVIEW_SCHEDULED: "Entrevista local agendada",
    LOCAL_INTERVIEW_COMPLETED: "Entrevista local executada",
    LOCAL_INTERVIEW_APPROVED: "Aprovado localmente",
    GLOBAL_INTERVIEW_SCHEDULED: "Entrevista global agendada",
    GLOBAL_INTERVIEW_COMPLETED: "Entrevista global executada",
    GLOBAL_INTERVIEW_APPROVED: "Aprovado globalmente",
    CONFIRMED: "Confirmado",
    REJECTED: "Rejeitado"
  };

  const views = [
    { id: "dashboard", label: "Dashboard", icon: "▦", title: "Dashboard", eyebrow: "Visao geral" },
    { id: "projects", label: "Projetos", icon: "◇", title: "Projetos", eyebrow: "Cadastro" },
    { id: "projectroles", label: "Roles", icon: "#", title: "Roles de Projeto", eyebrow: "Numeros de role por projeto" },
    { id: "positions", label: "Posicoes", icon: "□", title: "Posicoes", eyebrow: "Vagas do staffing" },
    { id: "candidates", label: "Candidatos", icon: "○", title: "Candidatos", eyebrow: "Pessoas e custos" },
    { id: "companies", label: "Empresas", icon: "▣", title: "Empresas", eyebrow: "Cadastro" },
    { id: "pipeline", label: "Candidaturas", icon: "→", title: "Candidaturas", eyebrow: "" },
    { id: "calendar", label: "Calendario", icon: "◷", title: "Calendario", eyebrow: "Datas importantes" },
    { id: "import", label: "Importacao", icon: "⇅", title: "Importacao", eyebrow: "Carga externa" },
    { id: "skills", label: "Skills", icon: "✦", title: "Skills", eyebrow: "Catalogo" },
    { id: "alerts", label: "Alertas", icon: "!", title: "Alertas", eyebrow: "Conflitos e pendencias" },
    { id: "reports", label: "Relatorios", icon: "≡", title: "Relatorios", eyebrow: "Consultas prontas" }
  ];

  const el = {
    nav: document.querySelector("#navList"),
    content: document.querySelector("#appContent"),
    title: document.querySelector("#viewTitle"),
    eyebrow: document.querySelector("#viewEyebrow"),
    search: document.querySelector("#globalSearch"),
    toast: document.querySelector("#toast"),
    primaryAction: document.querySelector("#primaryAction"),
    openDbButton: document.querySelector("#openDbButton"),
    saveDbButton: document.querySelector("#saveDbButton"),
    openDbInput: document.querySelector("#openDbInput"),
    dbStatus: document.querySelector("#dbStatus")
  };

  async function init() {
    renderNav();
    bindEvents();
    render();
    await initDatabase();
    render();
  }

  function bindEvents() {
    el.search.addEventListener("input", (event) => {
      state.search = event.target.value.trim().toLowerCase();
      render();
    });

    el.primaryAction.addEventListener("click", () => {
      openApplicationForm();
    });

    el.openDbButton.addEventListener("click", () => {
      el.openDbInput.click();
    });

    el.openDbInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      await loadDatabaseFile(file);
      event.target.value = "";
    });

    el.saveDbButton.addEventListener("click", async () => {
      await saveDatabase();
    });
  }

  async function initDatabase() {
    if (!window.staffingDatabase) {
      state.dbMode = "memory";
      updateDbStatus("Modo em memoria");
      toast("SQLite/WASM nao foi encontrado. A aplicacao continua em memoria.");
      return;
    }

    try {
      state.data = await window.staffingDatabase.createFromData(state.data);
      state.dbMode = "new";
      updateDbStatus("Banco novo nao salvo");
    } catch (error) {
      state.dbMode = "memory";
      updateDbStatus("Modo em memoria");
      toast("Nao foi possivel iniciar SQLite/WASM. Verifique os arquivos em lib/.");
      console.error(error);
    }
  }

  async function loadDatabaseFile(file) {
    if (!window.staffingDatabase) {
      toast("SQLite/WASM nao esta disponivel para abrir bancos.");
      return;
    }

    try {
      state.data = await window.staffingDatabase.loadFile(file);
      state.dbMode = "loaded";
      updateDbStatus(file.name);
      toast(`Banco carregado: ${file.name}`);
      render();
    } catch (error) {
      toast("Nao foi possivel abrir este banco SQLite.");
      console.error(error);
    }
  }

  async function saveDatabase() {
    if (!window.staffingDatabase) {
      toast("SQLite/WASM nao esta disponivel para salvar bancos.");
      return;
    }

    try {
      if (!window.staffingDatabase.hasDatabase()) {
        state.data = await window.staffingDatabase.createFromData(state.data);
      }
      await window.staffingDatabase.exportFile("staffing.db");
      state.dbMode = "saved";
      updateDbStatus("staffing.db exportado");
      toast("Banco SQLite salvo como staffing.db.");
    } catch (error) {
      toast("Nao foi possivel salvar o banco SQLite.");
      console.error(error);
    }
  }

  function updateDbStatus(message) {
    el.dbStatus.textContent = message;
  }

  function renderNav() {
    el.nav.innerHTML = views.map((view) => `
      <button class="nav-item" type="button" data-view="${view.id}" aria-current="${view.id === state.view ? "page" : "false"}">
        <span class="nav-icon" aria-hidden="true">${view.icon}</span>
        <span>${view.label}</span>
      </button>
    `).join("");

    el.nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) return;
      state.view = button.dataset.view;
      render();
    });
  }

  function render() {
    const view = views.find((item) => item.id === state.view);
    el.title.textContent = view.title;
    el.eyebrow.textContent = view.eyebrow;
    el.eyebrow.style.display = view.eyebrow ? "" : "none";

    const hideTopbarExtras = state.view === "projects";
    el.search.closest(".search-box").style.display = hideTopbarExtras ? "none" : "";
    el.primaryAction.style.display = hideTopbarExtras ? "none" : "";

    document.querySelectorAll(".nav-item").forEach((button) => {
      button.setAttribute("aria-current", button.dataset.view === state.view ? "page" : "false");
    });

    const renderers = {
      dashboard: renderDashboard,
      projects: renderProjects,
      projectroles: renderProjectRoles,
      positions: renderPositions,
      candidates: renderCandidates,
      companies: renderCompanies,
      pipeline: renderPipeline,
      calendar: renderCalendar,
      import: renderImport,
      skills: renderSkills,
      alerts: renderAlerts,
      reports: renderReports
    };

    el.content.innerHTML = renderers[state.view]();
    bindContentEvents();
  }

  function bindContentEvents() {
    document.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.route;
        render();
      });
    });

    document.querySelectorAll("[data-project-filter]").forEach((select) => {
      select.addEventListener("change", (event) => {
        state.selectedProjectId = event.target.value;
        render();
      });
    });

    document.querySelectorAll("[data-calendar-type]").forEach((select) => {
      select.addEventListener("change", (event) => {
        state.calendarType = event.target.value;
        render();
      });
    });

    document.querySelectorAll("[data-calendar-month]").forEach((button) => {
      button.addEventListener("click", () => {
        state.calendarMonth = shiftMonthIso(state.calendarMonth, Number(button.dataset.calendarMonth));
        state.calendarSelectedDate = null;
        render();
      });
    });

    document.querySelectorAll("[data-calendar-today]").forEach((button) => {
      button.addEventListener("click", () => {
        state.calendarMonth = monthStartIso(todayIso());
        state.calendarSelectedDate = null;
        render();
      });
    });

    document.querySelectorAll("[data-calendar-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.calendarView = button.dataset.calendarView;
        if (state.calendarView === "month") state.calendarSelectedDate = null;
        render();
      });
    });

    document.querySelectorAll("[data-calendar-day]").forEach((button) => {
      button.addEventListener("click", () => {
        state.calendarSelectedDate = button.dataset.calendarDay;
        state.calendarView = "agenda";
        render();
      });
    });

    document.querySelectorAll("[data-calendar-clear-date]").forEach((button) => {
      button.addEventListener("click", () => {
        state.calendarSelectedDate = null;
        render();
      });
    });

    document.querySelectorAll("[data-pipeline-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.pipelineView = button.dataset.pipelineView;
        render();
      });
    });

    document.querySelectorAll("[data-project-new]").forEach((button) => {
      button.addEventListener("click", () => openProjectForm());
    });

    document.querySelectorAll("[data-project-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const project = byId("projects", button.dataset.projectEdit);
        openProjectForm(project);
      });
    });

    document.querySelectorAll("[data-project-export]").forEach((button) => {
      button.addEventListener("click", exportProjectsToExcel);
    });

    document.querySelectorAll("[data-project-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await importProjectsFromExcel(file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-skill-new]").forEach((button) => {
      button.addEventListener("click", () => openSkillForm());
    });

    document.querySelectorAll("[data-skill-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const skill = byId("skills", button.dataset.skillEdit);
        openSkillForm(skill);
      });
    });

    document.querySelectorAll("[data-skill-export]").forEach((button) => {
      button.addEventListener("click", exportSkillsToExcel);
    });

    document.querySelectorAll("[data-skill-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await importSkillsFromExcel(file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-company-new]").forEach((button) => {
      button.addEventListener("click", () => openCompanyForm());
    });

    document.querySelectorAll("[data-company-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const company = byId("companies", button.dataset.companyEdit);
        openCompanyForm(company);
      });
    });

    document.querySelectorAll("[data-candidate-new]").forEach((button) => {
      button.addEventListener("click", () => openCandidateForm());
    });

    document.querySelectorAll("[data-candidate-search]").forEach((button) => {
      button.addEventListener("click", openCandidateSearchModal);
    });

    document.querySelectorAll("[data-candidate-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const candidate = byId("candidates", button.dataset.candidateEdit);
        openCandidateForm(candidate);
      });
    });

    document.querySelectorAll("[data-candidate-goto]").forEach((button) => {
      button.addEventListener("click", () => {
        const candidate = byId("candidates", button.dataset.candidateGoto);
        openCandidateForm(candidate);
      });
    });

    document.querySelectorAll("[data-candidate-export]").forEach((button) => {
      button.addEventListener("click", exportCandidatesToExcel);
    });

    document.querySelectorAll("[data-candidate-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await importCandidatesFromExcel(file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-people-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await handleImportFile("people", file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-calendar-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await handleImportFile("calendar", file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-demandroles-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await handleImportFile("demandroles", file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-import-drop]").forEach((dropArea) => {
      dropArea.addEventListener("click", (event) => {
        if (event.target.matches("input")) return;
        dropArea.querySelector("input[type='file']").click();
      });
      dropArea.addEventListener("keydown", (event) => {
        if (!["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        dropArea.querySelector("input[type='file']").click();
      });
      dropArea.addEventListener("dragenter", (event) => handleImportDrag(event, dropArea, true));
      dropArea.addEventListener("dragover", (event) => handleImportDrag(event, dropArea, true));
      dropArea.addEventListener("dragleave", (event) => {
        if (!dropArea.contains(event.relatedTarget)) handleImportDrag(event, dropArea, false);
      });
      dropArea.addEventListener("drop", async (event) => {
        handleImportDrag(event, dropArea, false);
        const file = event.dataTransfer.files[0];
        if (!file) return;
        await handleImportFile(dropArea.dataset.importDrop, file);
      });
    });

    document.querySelectorAll("[data-project-role-new]").forEach((button) => {
      button.addEventListener("click", () => openProjectRoleForm());
    });

    document.querySelectorAll("[data-project-role-search]").forEach((button) => {
      button.addEventListener("click", openDemandRoleSearchModal.bind(null, (demandRole) => {
        openProjectRoleForm({ prefillRole: demandRole });
      }));
    });

    document.querySelectorAll("[data-project-role-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const role = byId("projectRoles", button.dataset.projectRoleEdit);
        if (role) openProjectRoleForm({ existingRole: role });
      });
    });

    document.querySelectorAll("[data-show-inactive-roles]").forEach((cb) => {
      cb.addEventListener("change", () => {
        state.showInactiveRoles = cb.checked;
        render();
      });
    });

    document.querySelectorAll("[data-project-role-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm("Excluir esta role do pool?")) return;
        try {
          if (window.staffingDatabase) {
            state.data = await window.staffingDatabase.deleteProjectRole(button.dataset.projectRoleDelete);
          } else {
            state.data.projectRoles = state.data.projectRoles.filter((r) => r.id !== button.dataset.projectRoleDelete);
          }
          state.dbMode = "dirty";
          updateDbStatus("Banco alterado nao salvo");
          render();
        } catch (e) {
          toast("Nao foi possivel excluir a role.");
          console.error(e);
        }
      });
    });

    document.querySelectorAll("[data-project-role-filter]").forEach((sel) => {
      sel.addEventListener("change", () => {
        state.selectedProjectId = sel.value;
        render();
      });
    });

    document.querySelectorAll("[data-project-role-export]").forEach((button) => {
      button.addEventListener("click", exportProjectRolesToExcel);
    });

    document.querySelectorAll("[data-project-role-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await importProjectRolesFromExcel(file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-position-new]").forEach((button) => {
      button.addEventListener("click", () => openPositionForm());
    });

    document.querySelectorAll("[data-position-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const position = byId("positions", button.dataset.positionEdit);
        openPositionForm(position);
      });
    });

    document.querySelectorAll("[data-position-goto]").forEach((button) => {
      button.addEventListener("click", () => {
        const position = byId("positions", button.dataset.positionGoto);
        openPositionForm(position);
      });
    });

    document.querySelectorAll("[data-position-select]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedPositionIds.add(cb.dataset.positionSelect);
        else state.selectedPositionIds.delete(cb.dataset.positionSelect);
        render();
      });
    });

    document.querySelectorAll("[data-position-select-all]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const allCheckboxes = document.querySelectorAll("[data-position-select]");
        allCheckboxes.forEach((box) => {
          if (cb.checked) state.selectedPositionIds.add(box.dataset.positionSelect);
          else state.selectedPositionIds.delete(box.dataset.positionSelect);
        });
        render();
      });
    });

    document.querySelectorAll("[data-position-bulk-copy]").forEach((button) => {
      button.addEventListener("click", () => bulkCopyPositions());
    });

    document.querySelectorAll("[data-position-export]").forEach((button) => {
      button.addEventListener("click", exportPositionsToExcel);
    });

    document.querySelectorAll("[data-position-import]").forEach((input) => {
      input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        await importPositionsFromExcel(file);
        event.target.value = "";
      });
    });

    document.querySelectorAll("[data-application-new]").forEach((button) => {
      button.addEventListener("click", () => openApplicationForm());
    });

    document.querySelectorAll("[data-application-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const application = byId("applications", button.dataset.applicationEdit);
        openApplicationForm(application);
      });
    });

    document.querySelectorAll("[data-alert-action]").forEach((button) => {
      button.addEventListener("click", () => handleAlertAction(button.dataset.alertAction, button.dataset.alertTarget));
    });
  }

  function handleImportDrag(event, dropArea, active) {
    event.preventDefault();
    event.stopPropagation();
    dropArea.classList.toggle("drag-active", active);
  }

  async function handleImportFile(type, file) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast("Selecione um arquivo Excel (.xlsx ou .xls).");
      return;
    }

    const dropArea = document.querySelector(`[data-import-drop="${type}"]`);
    const onProgress = dropArea ? (msg) => showImportProgress(dropArea, msg) : () => {};

    try {
      if (type === "people") await importPeopleFromExcel(file, onProgress);
      else if (type === "calendar") await importAllocationCalendarsFromExcel(file, onProgress);
      else if (type === "demandroles") await importDemandRolesFromExcel(file, onProgress);
    } finally {
      if (dropArea) clearImportProgress(dropArea);
    }
  }

  function renderDashboard() {
    const activeProjects = state.data.projects.filter((p) => p.status === "ACTIVE").length;
    const activePositions = state.data.positions.filter((p) => !["CANCELLED", "CLOSED"].includes(p.status)).length;
    const activeRoles = (state.data.projectRoles || []).length;
    const activeApplications = state.data.applications.filter((a) => a.status !== "REJECTED" && a.status !== "CANCELLED").length;

    return `
      <section class="metric-grid">
        ${metricCard("Projetos ativos", activeProjects, "Projetos com status Ativo")}
        ${metricCard("Posicoes ativas", activePositions, "Posicoes nao canceladas ou encerradas")}
        ${metricCard("Roles no pool", activeRoles, "Roles cadastradas no pool")}
        ${metricCard("Candidaturas ativas", activeApplications, "Candidaturas em andamento")}
      </section>
    `;
  }

  function renderProjects() {
    const projects = filterItems(state.data.projects, ["name", "description", "status"]);
    const allAlerts = getAlerts();

    return `
      <section class="panel">
        <div class="panel-header">
          <div></div>
          <div class="toolbar">
            <button class="ghost-button compact btn-icon" type="button" data-project-export title="Exportar Excel" aria-label="Exportar Excel">${iconExport()}</button>
            <label class="file-button compact btn-icon" title="Importar Excel" aria-label="Importar Excel">${iconImport()}<input type="file" accept=".xlsx,.xls" data-project-import></label>
            <button class="primary-button compact" type="button" data-project-new>Novo</button>
          </div>
        </div>
        <div class="card-grid">
          ${projects.map((project) => {
            const positions = state.data.positions.filter((p) => p.projectId === project.id);
            const roles = state.data.positions
              .filter((p) => p.projectId === project.id && p.externalRoleId)
              .map((p) => p.externalRoleId);
            const uniqueRoles = [...new Set(roles)];
            const alertCount = allAlerts.filter((a) => a.projectId === project.id).length;
            const totals = projectCostTotals(positions, project);
            const totalLine = totals.size
              ? [...totals.entries()].map(([cur, val]) => formatCurrency(val, cur)).join(" + ")
              : null;
            const statusKey = project.status ? project.status.toLowerCase() : "draft";
            return `
              <article class="record-card project-card project-card--${statusKey}">
                <div class="project-card-head">
                  <strong class="project-card-name">${escapeHtml(project.name)}</strong>
                  ${statusPill(project.status)}
                </div>
                ${project.description ? `<p class="project-card-desc">${escapeHtml(project.description)}</p>` : ""}
                <div class="project-card-stats">
                  <div class="project-stat">
                    <span class="project-stat-value">${positions.length}</span>
                    <span class="project-stat-label">posições</span>
                  </div>
                  <div class="project-stat">
                    <span class="project-stat-value">${uniqueRoles.length}</span>
                    <span class="project-stat-label">roles</span>
                  </div>
                  ${alertCount ? `
                  <div class="project-stat project-stat--alert">
                    <span class="project-stat-value">${alertCount}</span>
                    <span class="project-stat-label">alertas</span>
                  </div>` : ""}
                </div>
                <div class="project-card-footer">
                  <div class="project-card-meta">
                    <span>${formatDate(project.startDate)} – ${formatDate(project.endDate)}</span>
                    ${totalLine ? `<span class="project-card-cost">${escapeHtml(totalLine)}</span>` : ""}
                  </div>
                  <div class="project-card-actions">
                    <button class="ghost-button compact" type="button" data-project-edit="${escapeAttr(project.id)}">Editar</button>
                  </div>
                </div>
              </article>
            `;
          }).join("") || emptyState("Nenhum projeto encontrado.")}
        </div>
      </section>
    `;
  }

  function projectRoleRows(projectRoles) {
    const today = todayIso();
    const calendars = state.data.allocationCalendars || [];
    const demandByRoleId = new Map((state.data.demandRoles || []).map((dr) => [dr.roleIdExternal, dr]));

    const roleToProjectIds = new Map();
    state.data.positions.forEach((position) => {
      if (position.externalRoleId) {
        if (!roleToProjectIds.has(position.externalRoleId)) roleToProjectIds.set(position.externalRoleId, new Set());
        roleToProjectIds.get(position.externalRoleId).add(position.projectId);
      }
    });

    return (projectRoles || []).map((r) => {
      const dr = demandByRoleId.get(r.roleNumber) || {};
      const allocations = calendars
        .filter((cal) =>
          cal.roleIdExternal === r.roleNumber &&
          cal.calendarStartDate && cal.calendarEndDate &&
          cal.calendarStartDate <= today && cal.calendarEndDate >= today
        )
        .map((cal) => ({ name: cal.employeeName || "—", status: cal.candidateStatus || "—" }));

      const linkedProjectIds = [...(roleToProjectIds.get(r.roleNumber) || [])];
      const linkedProjects = linkedProjectIds.map((id) => byId("projects", id)).filter(Boolean);

      return {
        id: r.id,
        roleNumber: r.roleNumber,
        active: r.active !== false,
        linkedProjectIds,
        linkedProjects,
        client: dr.client || "",
        roleTitle: dr.roleTitle || "",
        roleStatus: dr.roleStatus || "",
        cancellationReason: dr.cancellationReason,
        candidatesIdentified: dr.candidatesIdentified,
        candidatesIdentifiedSelf: dr.candidatesIdentifiedSelf,
        candidatesProposed: dr.candidatesProposed,
        candidatesConfirming: dr.candidatesConfirming,
        candidatesFilled: dr.candidatesFilled,
        candidatesNotSelected: dr.candidatesNotSelected,
        startDate: dr.startDate || "",
        endDate: dr.endDate || "",
        joinerName: dr.joinerName,
        contractorName: dr.contractorName,
        allocations
      };
    });
  }

  function rolesTable(rows) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Projeto(s)</th>
              <th>Cliente</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Status</th>
              <th>Alocado</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.active ? "" : "row-inactive"}">
                <td><code>${escapeHtml(row.roleNumber)}</code>${row.active ? "" : ` <span class="muted" style="font-size:11px">(inativa)</span>`}</td>
                <td>${row.linkedProjects.length
                  ? row.linkedProjects.map((p) => escapeHtml(p.name)).join(", ")
                  : `<span class="muted">Sem posicao</span>`}</td>
                <td>${escapeHtml(row.client || "—")}</td>
                <td>${row.startDate ? formatDate(row.startDate) : `<span class="muted">—</span>`}</td>
                <td>${row.endDate ? formatDate(row.endDate) : `<span class="muted">—</span>`}</td>
                <td>${demandRoleInfoHtml(row) || `<span class="muted">—</span>`}</td>
                <td>${allocationSummaryHtml(row.allocations)}</td>
                <td style="white-space:nowrap">
                  <button class="ghost-button compact" type="button" data-project-role-edit="${escapeAttr(row.id)}">Editar</button>
                  <button class="icon-button" type="button" data-project-role-delete="${escapeAttr(row.id)}" title="Excluir">×</button>
                </td>
              </tr>
            `).join("") || tableEmpty(8, "Nenhuma role cadastrada.")}
          </tbody>
        </table>
      </div>
    `;
  }

  function allocationSummaryHtml(allocations) {
    if (!allocations || !allocations.length) return `<span class="muted-cell">Sem alocacao vigente</span>`;
    return allocations.map((a) => `<div><strong>${escapeHtml(a.name)}</strong> <span class="muted-cell" style="font-size:12px">${escapeHtml(a.status)}</span></div>`).join("");
  }

  function renderPositions() {
    const projects = state.data.projects;
    const positions = filterItems(state.data.positions, ["name", "description", "status"])
      .filter((position) => state.selectedProjectId === "all" || position.projectId === state.selectedProjectId);
    const selCount = state.selectedPositionIds.size;

    return `
      <section class="panel">
        <div class="panel-header toolbar-header">
          <div>
            <span class="eyebrow">Posicoes</span>
            <h2>Vagas por projeto</h2>
          </div>
          <div class="toolbar">
            <select data-project-filter aria-label="Filtrar por projeto">
              <option value="all"${state.selectedProjectId === "all" ? " selected" : ""}>Todos os projetos</option>
              ${projects.map((project) => `
                <option value="${project.id}"${state.selectedProjectId === project.id ? " selected" : ""}>${escapeHtml(project.name)}</option>
              `).join("")}
            </select>
            <button class="ghost-button compact btn-icon" type="button" data-position-export title="Exportar Excel" aria-label="Exportar Excel">${iconExport()}</button>
            <label class="file-button compact btn-icon" title="Importar Excel" aria-label="Importar Excel">${iconImport()}<input type="file" accept=".xlsx,.xls" data-position-import></label>
            ${selCount ? `
              <span class="selection-badge">${selCount} selecionada(s)</span>
              <button class="ghost-button compact" type="button" data-position-bulk-copy>Copiar</button>
            ` : ""}
            <button class="primary-button compact" type="button" data-position-new>Novo</button>
          </div>
        </div>
        ${positionsTable(positions)}
      </section>
    `;
  }

  function renderProjectRoles() {
    const projects = state.data.projects;
    const allRows = projectRoleRows(state.data.projectRoles);
    const filteredRows = filterItems(allRows, ["roleNumber", "roleTitle", "roleStatus", "client"])
      .filter((r) => state.selectedProjectId === "all" || r.linkedProjectIds.includes(state.selectedProjectId))
      .filter((r) => state.showInactiveRoles || r.active);

    return `
      <section class="panel">
        <div class="panel-header toolbar-header">
          <div>
            <span class="eyebrow">Pool de Roles</span>
            <h2>Roles cadastradas</h2>
          </div>
          <div class="toolbar">
            <label class="checkbox-label">
              <input type="checkbox" data-show-inactive-roles ${state.showInactiveRoles ? "checked" : ""}>
              Mostrar desativadas
            </label>
            <select data-project-role-filter aria-label="Filtrar por projeto">
              <option value="all"${state.selectedProjectId === "all" ? " selected" : ""}>Todos os projetos</option>
              ${projects.map((p) => `
                <option value="${escapeAttr(p.id)}"${state.selectedProjectId === p.id ? " selected" : ""}>${escapeHtml(p.name)}</option>
              `).join("")}
            </select>
            <button class="ghost-button compact btn-icon" type="button" data-project-role-export title="Exportar Excel" aria-label="Exportar Excel">${iconExport()}</button>
            <label class="file-button compact btn-icon" title="Importar Excel" aria-label="Importar Excel">${iconImport()}<input type="file" accept=".xlsx,.xls" data-project-role-import></label>
            <button class="ghost-button compact" type="button" data-project-role-search>Procurar role</button>
            <button class="primary-button compact" type="button" data-project-role-new>Novo</button>
          </div>
        </div>
        ${rolesTable(filteredRows)}
      </section>
    `;
  }

  function renderCandidates() {
    const candidates = state.data.candidates.filter((candidate) => {
      if (!state.search) return true;
      return [
        candidate.name,
        candidate.email,
        candidate.externalPersonId,
        companyName(candidate.companyId)
      ].join(" ").toLowerCase().includes(state.search);
    });
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Candidatos</span>
            <h2>Pessoas, custos e disponibilidade</h2>
          </div>
          <div class="toolbar">
            <button class="ghost-button compact btn-icon" type="button" data-candidate-export title="Exportar Excel" aria-label="Exportar Excel">${iconExport()}</button>
            <label class="file-button compact btn-icon" title="Importar Excel" aria-label="Importar Excel">${iconImport()}<input type="file" accept=".xlsx,.xls" data-candidate-import></label>
            <button class="ghost-button compact" type="button" data-candidate-search>Procurar candidato</button>
            <button class="primary-button compact" type="button" data-candidate-new>Novo</button>
          </div>
        </div>
        ${candidatesTable(candidates)}
      </section>
    `;
  }

  function calendarsForPerson(person) {
    return (state.data.allocationCalendars || []).filter((item) => {
      return (person.personnelNumber && item.personnelNumber === person.personnelNumber)
        || (person.corporateId && item.enterpriseId && item.enterpriseId.toLowerCase() === person.corporateId.toLowerCase())
        || (person.id && item.importedPersonId === person.id);
    });
  }

  function calendarsForCandidate(candidate) {
    return (state.data.allocationCalendars || []).filter((item) => allocationCalendarMatchesCandidate(item, candidate));
  }

  function allocationCalendarMatchesCandidate(item, candidate) {
    return (candidate.importedPersonId && item.importedPersonId === candidate.importedPersonId)
      || (candidate.externalPersonId && item.personnelNumber === candidate.externalPersonId)
      || (candidate.externalPersonId && item.enterpriseId && item.enterpriseId.toLowerCase() === candidate.externalPersonId.toLowerCase())
      || (candidate.email && item.enterpriseId && candidate.email.toLowerCase().startsWith(item.enterpriseId.toLowerCase()));
  }

  function companyIdFromEmail(email) {
    const domain = String(email || "").toLowerCase().split("@")[1] || "";
    if (domain.includes("avanade")) return "company-avanade";
    if (domain.includes("accenture")) return "company-accenture";
    return "";
  }

  function candidateFromImportedPerson(person) {
    return {
      id: createId(),
      importedPersonId: person.id,
      companyId: companyIdFromEmail(person.email),
      externalPersonId: person.corporateId || corporateIdFromEmail(person.email),
      name: displayNameFromImportedPerson(person.name),
      email: person.email || "",
      ucrAmount: 0,
      lcrAmount: 0,
      costCurrency: "BRL",
      costPeriod: "MONTH",
      active: true,
      skills: skillIdsFromText(person.skillsText),
      skillLevels: skillLevelsFromText(person.skillsText)
    };
  }

  function skillIdsFromText(text) {
    return parseImportedSkills(text).map((importedSkill) => {
      const name = importedSkill.name;
      const skill = state.data.skills.find((item) => item.name.toLowerCase() === name.toLowerCase());
      return skill ? skill.id : null;
    }).filter(Boolean);
  }

  function skillLevelsFromText(text) {
    return Object.fromEntries(parseImportedSkills(text).map((importedSkill) => {
      const skill = state.data.skills.find((item) => item.name.toLowerCase() === importedSkill.name.toLowerCase());
      return skill && importedSkill.levelLabel ? [skill.id, importedSkill.levelLabel] : null;
    }).filter(Boolean));
  }

  function parseImportedSkills(text) {
    const decodedText = decodeImportedSkillText(text);
    const separator = decodedText.includes("|") ? "|" : ",";
    return decodedText
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const withoutOrder = item.replace(/^\d+\s*-\s*/, "").trim();
        const match = withoutOrder.match(/^(.*)\((P\d+\s*-\s*[^)]+)\)\s*$/);
        const name = (match ? match[1] : withoutOrder).trim();
        const levelLabel = match ? normalizeWhitespace(match[2]) : "";
        const levelCode = levelLabel ? levelLabel.split("-")[0].trim() : "";
        return { name: normalizeWhitespace(name), levelLabel, levelCode };
      })
      .filter((item) => item.name);
  }

  function importedExperienceLevels() {
    const levels = new Map();
    (state.data.importedPeople || []).forEach((person) => {
      parseImportedSkills(person.skillsText).forEach((skill) => {
        if (skill.levelLabel) levels.set(skill.levelLabel, skill.levelLabel);
      });
    });

    if (!levels.size) {
      ["P1 - Beginner", "P2 - Intermediate", "P3 - Advanced", "P5 - Master"].forEach((level) => levels.set(level, level));
    }

    return Array.from(levels.values()).sort((a, b) => {
      const aRank = Number((a.match(/^P(\d+)/) || [])[1] || 99);
      const bRank = Number((b.match(/^P(\d+)/) || [])[1] || 99);
      return aRank - bRank || a.localeCompare(b);
    });
  }

  function decodeImportedSkillText(text) {
    return cleanCell(text)
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", "\"")
      .replaceAll("&#039;", "'");
  }

  function normalizeWhitespace(text) {
    return cleanCell(text).replace(/\s+/g, " ");
  }

  function displayNameFromImportedPerson(name) {
    const value = cleanCell(name);
    if (!value.includes(",")) return value;

    const [lastName, ...givenNameParts] = value.split(",");
    const givenNames = givenNameParts.join(",").trim();
    const normalizedLastName = lastName.trim();
    return [givenNames, normalizedLastName].filter(Boolean).join(" ");
  }

  function openCandidateSearchModal() {
    openModal(`
      <section class="modal-card wide-modal" id="candidateSearchModal">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Candidatos</span>
            <h2>Procurar pessoa importada</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <div class="candidate-search-layout">
          <aside class="candidate-search-filters">
            <div class="search-section">
              <p class="search-section-label">Identificacao</p>
              <input class="filter-input" name="personName" placeholder="Nome" autocomplete="off" aria-label="Nome">
              <input class="filter-input" name="personEid" placeholder="EID / ID corporativo" autocomplete="off" aria-label="EID">
              <input class="filter-input" name="personLocation" placeholder="Localidade" autocomplete="off" aria-label="Localidade">
            </div>

            <div class="search-section">
              <p class="search-section-label">Nivel de carreira</p>
              <div class="cl-range-filter" data-cl-range-filter>
                <div class="cl-range-display">
                  <span data-cl-range-label>Todos os niveis (CL1 – CL12)</span>
                </div>
                <div class="cl-range-slider">
                  <div class="cl-range-track"></div>
                  <div class="cl-range-fill" data-cl-range-fill></div>
                  <input type="range" name="clRangeMin" min="1" max="12" value="1" data-cl-min>
                  <input type="range" name="clRangeMax" min="1" max="12" value="12" data-cl-max>
                </div>
                <div class="cl-range-endpoints">
                  <span>CL1</span>
                  <span>CL12</span>
                </div>
              </div>
            </div>

            <div class="search-section">
              <p class="search-section-label">Skills</p>
              <div class="skill-picker skill-picker--search">
                <label>
                  <span>Skill</span>
                  <input name="skillLookup" list="candidateSkillSuggestions" placeholder="Nome da skill" autocomplete="off">
                </label>
                <datalist id="candidateSkillSuggestions">
                  ${state.data.skills.map((skill) => `<option value="${escapeAttr(skill.name)}"></option>`).join("")}
                </datalist>
                <label>
                  <span>Nivel</span>
                  <select name="skillLookupLevel">
                    <option value=""></option>
                    ${importedExperienceLevels().map((level) => {
                      const code = level.split("-")[0].trim();
                      return `<option value="${escapeAttr(level)}">${escapeHtml(code)}</option>`;
                    }).join("")}
                  </select>
                </label>
                <button class="ghost-button skill-add-btn" type="button" data-skill-filter-add>+</button>
              </div>
              <div class="selected-skill-filters" data-selected-skill-filters>
                <span class="muted">Nenhuma skill selecionada.</span>
              </div>
              <div class="skill-filter-legend">
                ${importedExperienceLevels().map((level) => {
                  const code = level.split("-")[0].trim();
                  const desc = level.replace(/^[^-]+-\s*/, "").trim();
                  return `<span><strong>${escapeHtml(code)}</strong> ${escapeHtml(desc)}</span>`;
                }).join("")}
              </div>
            </div>

            <div class="modal-actions search-actions">
              <button class="ghost-button" type="button" data-candidate-search-clear>Limpar</button>
              <button class="primary-button" type="button" data-candidate-search-run>Pesquisar</button>
            </div>
          </aside>

          <div class="candidate-search-results-panel">
            <div class="search-results" data-candidate-search-results>
              ${emptyState("Informe um nome, EID/ID corporativo ou skill para procurar pessoas importadas.")}
            </div>
          </div>
        </div>
      </section>
    `);

    const modal = document.querySelector("#candidateSearchModal");

    function updateClRange(modal) {
      const minInput = modal.querySelector("[data-cl-min]");
      const maxInput = modal.querySelector("[data-cl-max]");
      if (!minInput || !maxInput) return;
      let minVal = parseInt(minInput.value, 10);
      let maxVal = parseInt(maxInput.value, 10);
      if (minVal > maxVal) { minInput.value = maxVal; minVal = maxVal; }
      if (maxVal < minVal) { maxInput.value = minVal; maxVal = minVal; }
      const pct = (v) => ((v - 1) / 11) * 100;
      const fill = modal.querySelector("[data-cl-range-fill]");
      if (fill) { fill.style.left = `${pct(minVal)}%`; fill.style.width = `${pct(maxVal) - pct(minVal)}%`; }
      const label = modal.querySelector("[data-cl-range-label]");
      if (label) label.textContent = minVal === 1 && maxVal === 12 ? "Todos os niveis (CL1 – CL12)" : minVal === maxVal ? `CL${minVal}` : `CL${minVal} – CL${maxVal}`;
    }

    modal.querySelector("[data-candidate-search-run]").addEventListener("click", () => renderCandidateSearchResults(modal));
    modal.querySelector("[data-skill-filter-add]").addEventListener("click", () => addCandidateSkillFilter(modal));
    modal.querySelector("[data-candidate-search-clear]").addEventListener("click", () => {
      modal.querySelectorAll("input").forEach((input) => {
        input.value = "";
      });
      modal.querySelectorAll("select").forEach((select) => {
        select.value = "";
      });
      modal.querySelector("[data-cl-min]").value = "1";
      modal.querySelector("[data-cl-max]").value = "12";
      updateClRange(modal);
      modal.dataset.skillFilters = "[]";
      renderSelectedSkillFilters(modal);
      modal.querySelector("[data-candidate-search-results]").innerHTML = emptyState("Informe um nome, EID/ID corporativo ou skill para procurar pessoas importadas.");
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("[name='skillLookup']")) {
        event.preventDefault();
        addCandidateSkillFilter(modal);
        return;
      }
      if (event.key === "Enter" && event.target.matches("input")) {
        event.preventDefault();
        renderCandidateSearchResults(modal);
      }
    });
    modal.addEventListener("click", (event) => {
      const zoomButton = event.target.closest("[data-timeline-zoom]");
      if (zoomButton) {
        setTimelineZoom(zoomButton.closest("[data-allocation-timeline]"), zoomButton.dataset.timelineZoom);
        return;
      }

      const removeSkillButton = event.target.closest("[data-remove-skill-filter]");
      if (removeSkillButton) {
        removeCandidateSkillFilter(modal, removeSkillButton.dataset.removeSkillFilter);
        return;
      }

      const button = event.target.closest("[data-add-imported-candidate]");
      if (!button) return;
      const person = byId("importedPeople", button.dataset.addImportedCandidate);
      if (person) openCandidateForm(candidateFromImportedPerson(person));
    });

    modal.addEventListener("mouseover", (event) => {
      const bar = event.target.closest("[data-bar-info]");
      if (!bar) return;
      const timeline = bar.closest("[data-allocation-timeline]");
      if (!timeline) return;
      const detail = timeline.querySelector("[data-timeline-detail]");
      if (!detail) return;
      const info = JSON.parse(bar.dataset.barInfo);
      detail.innerHTML = renderTimelineBarDetail(info);
    });

    modal.addEventListener("mouseout", (event) => {
      const timeline = event.target.closest("[data-allocation-timeline]");
      if (!timeline) return;
      if (timeline.contains(event.relatedTarget)) return;
      const detail = timeline.querySelector("[data-timeline-detail]");
      if (detail) detail.innerHTML = "<span class=\"timeline-detail-placeholder\">Passe o mouse sobre uma barra para ver os detalhes.</span>";
    });
    modal.querySelector("[data-cl-min]").addEventListener("input", () => updateClRange(modal));
    modal.querySelector("[data-cl-max]").addEventListener("input", () => updateClRange(modal));
    modal.dataset.skillFilters = "[]";
    renderSelectedSkillFilters(modal);
    updateClRange(modal);
  }

  function addCandidateSkillFilter(modal) {
    const lookup = modal.querySelector("[name='skillLookup']");
    const levelSelect = modal.querySelector("[name='skillLookupLevel']");
    const skillName = cleanCell(lookup.value);
    if (!skillName) {
      toast("Digite uma skill para adicionar ao filtro.");
      return;
    }

    const skill = state.data.skills.find((item) => item.name.toLowerCase() === skillName.toLowerCase())
      || state.data.skills.find((item) => item.name.toLowerCase().includes(skillName.toLowerCase()));

    if (!skill) {
      toast("Skill nao encontrada no catalogo.");
      return;
    }

    const filters = selectedCandidateSkillFilters(modal);
    const levelLabel = cleanCell(levelSelect.value);
    const exists = filters.some((filter) => filter.id === skill.id && filter.levelLabel === levelLabel);
    if (!exists) filters.push({ id: skill.id, name: skill.name, levelLabel });

    modal.dataset.skillFilters = JSON.stringify(filters);
    lookup.value = "";
    levelSelect.value = "";
    renderSelectedSkillFilters(modal);
  }

  function removeCandidateSkillFilter(modal, filterIndex) {
    const index = Number(filterIndex);
    const filters = selectedCandidateSkillFilters(modal).filter((_, itemIndex) => itemIndex !== index);
    modal.dataset.skillFilters = JSON.stringify(filters);
    renderSelectedSkillFilters(modal);
  }

  function selectedCandidateSkillFilters(modal) {
    try {
      return JSON.parse(modal.dataset.skillFilters || "[]");
    } catch {
      return [];
    }
  }

  function renderSelectedSkillFilters(modal) {
    const container = modal.querySelector("[data-selected-skill-filters]");
    const filters = selectedCandidateSkillFilters(modal);
    container.innerHTML = filters.length
      ? filters.map((filter, index) => `
        <button class="filter-chip" type="button" data-remove-skill-filter="${index}" title="Remover filtro">
          ${escapeHtml(filter.name)}${filter.levelLabel ? ` (${escapeHtml(filter.levelLabel.split("-")[0].trim())})` : ""}
          <span>×</span>
        </button>
      `).join("")
      : "<span class=\"muted\">Nenhuma skill selecionada.</span>";
  }

  function renderCandidateSearchResults(modal) {
    const resultsContainer = modal.querySelector("[data-candidate-search-results]");
    const matches = filterImportedPeopleForCandidateSearch(modal).slice(0, 30);

    resultsContainer.innerHTML = matches.length
      ? matches.map((person) => importedCandidateSearchCard(person)).join("")
      : emptyState("Nenhuma pessoa importada encontrada para esses filtros.");
  }

  function filterImportedPeopleForCandidateSearch(modal) {
    const name = cleanCell(modal.querySelector("[name='personName']").value).toLowerCase();
    const eid = cleanCell(modal.querySelector("[name='personEid']").value).toLowerCase();
    const location = cleanCell(modal.querySelector("[name='personLocation']").value).toLowerCase();
    const selectedSkills = selectedCandidateSkillFilters(modal);
    const clMin = parseInt(modal.querySelector("[name='clRangeMin']")?.value || "1", 10);
    const clMax = parseInt(modal.querySelector("[name='clRangeMax']")?.value || "12", 10);
    const filteringCl = clMin > 1 || clMax < 12;

    if (!name && !eid && !location && !selectedSkills.length && !filteringCl) return [];

    return (state.data.importedPeople || []).filter((person) => {
      const displayName = displayNameFromImportedPerson(person.name).toLowerCase();
      const searchableName = [displayName, person.name].join(" ").toLowerCase();
      const searchableEid = [
        person.corporateId,
        corporateIdFromEmail(person.email),
        person.email,
        person.personnelNumber
      ].join(" ").toLowerCase();
      const personSkills = parseImportedSkills(person.skillsText);

      const searchableLocation = [person.metroCity, person.locationPath, person.country].join(" ").toLowerCase();
      const matchesName = !name || searchableName.includes(name);
      const matchesEid = !eid || searchableEid.includes(eid);
      const matchesLocation = !location || searchableLocation.includes(location);
      const matchesSkills = !selectedSkills.length || selectedSkills.every((selectedSkill) => personHasImportedSkill(personSkills, selectedSkill));
      const matchesCl = !filteringCl || (() => {
        const clNum = parseClNumber(person.resourceLevel);
        return clNum !== null && clNum >= clMin && clNum <= clMax;
      })();

      return matchesName && matchesEid && matchesLocation && matchesSkills && matchesCl;
    });
  }

  function personHasImportedSkill(personSkills, selectedSkill) {
    const skill = byId("skills", selectedSkill.id);
    if (!skill) return false;
    return personSkills.some((personSkill) => {
      const sameName = personSkill.name.toLowerCase() === skill.name.toLowerCase();
      const sameLevel = !selectedSkill.levelLabel || personSkill.levelLabel === selectedSkill.levelLabel;
      return sameName && sameLevel;
    });
  }

  function importedCandidateSearchCard(person) {
    const calendars = calendarsForPerson(person)
      .sort((a, b) => cleanCell(a.calendarStartDate).localeCompare(cleanCell(b.calendarStartDate)));
    const alreadyCandidate = isImportedPersonAlreadyCandidate(person);
    const skills = parseImportedSkills(person.skillsText);
    const availability = personAvailabilityLabel(calendars);
    const careerLevel = formatCareerLevel(person.resourceLevel);
    const jobTitle = person.resourceRole || person.jobFamilyGroup || "";

    return `
      <article class="record-card candidate-search-card">
        <div class="record-head">
          <div>
            <strong>${escapeHtml(displayNameFromImportedPerson(person.name))}</strong>
            <div class="candidate-title-row">
              ${jobTitle ? `<span class="candidate-role-text">${escapeHtml(jobTitle)}</span>` : ""}
              ${careerLevel ? `<span class="career-level-badge">${escapeHtml(careerLevel)}</span>` : ""}
            </div>
          </div>
          <div class="candidate-head-right">
            ${alreadyCandidate ? statusPill("ACTIVE", "Ja candidato") : ""}
            ${person.cvLink ? `<a class="cv-top-link" href="${escapeAttr(person.cvLink)}" target="_blank" rel="noreferrer">Link para o CV</a>` : ""}
          </div>
        </div>
        <div class="candidate-info-list">
          ${person.email ? `<span>${escapeHtml(person.email)}</span>` : ""}
          ${(person.metroCity || person.country) ? `<span>${escapeHtml(person.metroCity || person.country)}</span>` : ""}
          <span class="availability-chip${availability.available ? " availability-chip--free" : ""}">${escapeHtml(availability.label)}</span>
        </div>
        <div class="candidate-card-sections">
          <details class="collapsible-section">
            <summary>
              <span>Skills</span>
              <small>${skills.length ? `${skills.length} registrada(s)` : "Sem skills"}</small>
            </summary>
            <div class="skill-scroll">
              <div class="skill-row">${importedSkillBadges(person.skillsText)}</div>
            </div>
            ${importedSkillsLegend(person.skillsText)}
          </details>

          <details class="collapsible-section">
            <summary>
              <span>Calendario</span>
              <small>${calendars.length ? `${calendars.length} evento(s)` : "Sem eventos"}</small>
            </summary>
            ${allocationTimeline(calendars)}
          </details>
        </div>
        <div class="record-actions">
          <button class="primary-button compact" type="button" data-add-imported-candidate="${escapeAttr(person.id)}" ${alreadyCandidate ? "disabled" : ""}>Adicionar candidato</button>
        </div>
      </article>
    `;
  }

  function setTimelineZoom(timeline, zoom) {
    if (!timeline) return;
    timeline.dataset.zoom = zoom;
    timeline.querySelectorAll("[data-timeline-zoom]").forEach((button) => {
      button.setAttribute("aria-pressed", button.dataset.timelineZoom === zoom ? "true" : "false");
    });
    timeline.querySelector("[data-timeline-scale]").innerHTML = allocationTimelineScale(timeline.dataset.start, timeline.dataset.end, zoom);
    timeline.querySelector("[data-timeline-bars]").innerHTML = allocationTimelineBars(JSON.parse(timeline.dataset.items || "[]"), timeline.dataset.start, timeline.dataset.end, zoom);
    const detail = timeline.querySelector("[data-timeline-detail]");
    if (detail) detail.innerHTML = "<span class=\"timeline-detail-placeholder\">Passe o mouse sobre uma barra para ver os detalhes.</span>";
  }

  function allocationTimeline(calendars) {
    const items = calendars
      .filter((item) => item.calendarStartDate && item.calendarEndDate)
      .map((item) => ({
        startDate: item.calendarStartDate,
        endDate: item.calendarEndDate,
        calendarType: item.calendarType || "Calendario",
        projectName: item.projectName || item.client || "Sem projeto",
        roleIdExternal: item.roleIdExternal || "",
        percentAllocated: item.percentAllocated || item.percentStaffable || ""
      }));

    if (!items.length) return "";

    const start = items.reduce((min, item) => item.startDate < min ? item.startDate : min, items[0].startDate);
    const end = items.reduce((max, item) => item.endDate > max ? item.endDate : max, items[0].endDate);
    const encodedItems = escapeAttr(JSON.stringify(items));

    return `
      <div class="allocation-timeline" data-allocation-timeline data-start="${escapeAttr(start)}" data-end="${escapeAttr(end)}" data-zoom="year" data-items="${encodedItems}">
        <div class="timeline-zoom">
          ${["year", "month"].map((zoom) => `
            <button type="button" data-timeline-zoom="${zoom}" aria-pressed="${zoom === "year" ? "true" : "false"}">${timelineZoomLabel(zoom)}</button>
          `).join("")}
        </div>
        <div class="timeline-viewport">
          <div class="timeline-scale" data-timeline-scale>${allocationTimelineScale(start, end, "year")}</div>
          <div class="timeline-bars" data-timeline-bars>${allocationTimelineBars(items, start, end, "year")}</div>
        </div>
        <div class="timeline-detail" data-timeline-detail><span class="timeline-detail-placeholder">Passe o mouse sobre uma barra para ver os detalhes.</span></div>
      </div>
    `;
  }

  function allocationTimelineScale(start, end, zoom) {
    const ticks = timelineTicks(start, end, zoom);
    return ticks.map((tick) => `
      <span style="left: ${tick.left}%">${escapeHtml(tick.label)}</span>
    `).join("");
  }

  function allocationTimelineBars(items, start, end, zoom) {
    const rangeStart = dateToTime(start);
    const rangeEnd = dateToTime(end);
    const range = Math.max(1, rangeEnd - rangeStart);
    const minWidth = zoom === "month" ? 2 : 1;
    const today = todayIso();

    const todayPos = (dateToTime(today) - rangeStart) / range * 100;
    const todayMarker = todayPos > 0 && todayPos < 100
      ? `<div class="timeline-today" style="left: ${todayPos.toFixed(2)}%"></div>`
      : "";

    const bars = items.map((item) => {
      const itemStart = Math.max(0, ((dateToTime(item.startDate) - rangeStart) / range) * 100);
      const itemEnd = Math.min(100, ((dateToTime(item.endDate) - rangeStart) / range) * 100);
      const width = Math.max(minWidth, itemEnd - itemStart);
      const typeClass = calendarTypeClass(item.calendarType);
      const isActive = item.startDate <= today && item.endDate >= today;
      const barInfo = escapeAttr(JSON.stringify({
        type: item.calendarType,
        project: item.projectName,
        role: item.roleIdExternal,
        dates: `${item.startDate} – ${item.endDate}`,
        alloc: item.percentAllocated
      }));
      return `
        <div class="timeline-bar-row">
          <div class="timeline-track">
            <div class="timeline-bar timeline-bar--${typeClass}${isActive ? " timeline-bar--active" : ""}"
                 style="left: ${itemStart.toFixed(2)}%; width: ${width.toFixed(2)}%"
                 data-bar-info="${barInfo}">
              <span class="timeline-bar-label">${escapeHtml(item.projectName)}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return bars + todayMarker;
  }

  function timelineTicks(start, end, zoom) {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const ticks = [];
    const cursor = new Date(startDate);

    if (zoom === "year") {
      cursor.setMonth(0, 1);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= endDate) {
        ticks.push({ date: new Date(cursor), label: String(cursor.getFullYear()) });
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
    } else if (zoom === "month") {
      cursor.setDate(1);
      while (cursor <= endDate) {
        ticks.push({ date: new Date(cursor), label: `${String(cursor.getMonth() + 1).padStart(2, "0")}/${String(cursor.getFullYear()).slice(2)}` });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      while (cursor.getDay() !== 1) cursor.setDate(cursor.getDate() - 1);
      while (cursor <= endDate) {
        ticks.push({ date: new Date(cursor), label: `${String(cursor.getDate()).padStart(2, "0")}/${String(cursor.getMonth() + 1).padStart(2, "0")}` });
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    const rangeStart = dateToTime(start);
    const rangeEnd = dateToTime(end);
    const range = Math.max(1, rangeEnd - rangeStart);
    return ticks.map((tick) => ({
      label: tick.label,
      left: Math.max(0, Math.min(100, ((tick.date.getTime() - rangeStart) / range) * 100))
    }));
  }

  function timelineZoomLabel(zoom) {
    return { year: "Ano", month: "Mes" }[zoom] || zoom;
  }

  function renderTimelineBarDetail(info) {
    const typeLabel = allocationTypeLabel(info.type);
    const typeCls = calendarTypeClass(info.type);
    return `
      <span class="calendar-type-badge calendar-type-badge--${typeCls}">${escapeHtml(typeLabel)}</span>
      <span class="timeline-detail-project">${escapeHtml(info.project || "—")}</span>
      ${info.role ? `<span class="timeline-detail-role">${escapeHtml(info.role)}</span>` : ""}
      <span class="timeline-detail-dates">${escapeHtml(info.dates || "")}</span>
      ${info.alloc ? `<span class="timeline-detail-alloc">${escapeHtml(info.alloc)}</span>` : ""}
    `;
  }


  function calendarTypeClass(calendarType) {
    const t = String(calendarType || "").toLowerCase();
    if (t.includes("booked")) return "booked";
    if (t.includes("staffable")) return "staffable";
    if (t.includes("training") || t.includes("treinamento")) return "training";
    if (t.includes("vacation") || t.includes("ferias")) return "vacation";
    return "other";
  }

  function allocationTypeLabel(calendarType) {
    const t = String(calendarType || "").toLowerCase();
    if (t.includes("booked to a project")) return "Projeto";
    if (t.includes("booked to internal")) return "Interno";
    if (t.includes("booked")) return "Alocado";
    if (t.includes("staffable")) return "Disponivel";
    if (t.includes("training") || t.includes("treinamento")) return "Treinamento";
    if (t.includes("vacation") || t.includes("ferias")) return "Ferias";
    return calendarType || "Outro";
  }

  function isImportedPersonAlreadyCandidate(person) {
    const corporateId = person.corporateId || corporateIdFromEmail(person.email);
    return state.data.candidates.some((candidate) => {
      return candidate.importedPersonId === person.id
        || (corporateId && candidate.externalPersonId && candidate.externalPersonId.toLowerCase() === corporateId.toLowerCase())
        || (candidate.email && person.email && candidate.email.toLowerCase() === person.email.toLowerCase());
    });
  }

  function importedSkillBadges(text) {
    const items = parseImportedSkills(text);
    return items.map((item) => {
      const label = item.levelCode ? `${item.name} (${item.levelCode})` : item.name;
      return `<span class="skill-badge">${escapeHtml(label)}</span>`;
    }).join("") || "<span class=\"muted\">Sem skills importadas</span>";
  }

  function importedSkillsLegend(text) {
    const seen = new Map();
    parseImportedSkills(text).forEach((item) => {
      if (item.levelCode && item.levelLabel && !seen.has(item.levelCode)) {
        seen.set(item.levelCode, item.levelLabel);
      }
    });
    if (!seen.size) return "";
    const items = [...seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, label]) => `<span><strong>${escapeHtml(code)}</strong> ${escapeHtml(label.replace(code, "").replace(/^[\s\-]+/, ""))}</span>`)
      .join("");
    return `<div class="skill-legend">${items}</div>`;
  }

  function renderPipeline() {
    const applications = filterApplications();
    const positionCount = state.data.positions.filter((p) =>
      state.selectedProjectId === "all" || p.projectId === state.selectedProjectId
    ).length;
    const positionLabel = positionCount === 1 ? "1 posicao" : `${positionCount} posicoes`;
    return `
      <section class="panel">
        <div class="panel-header toolbar-header">
          <div>
            <h2>Pipeline</h2>
            <span class="panel-subtitle">${positionLabel}</span>
          </div>
          <div class="toolbar">
            <select data-project-filter aria-label="Filtrar pipeline por projeto">
              <option value="all"${state.selectedProjectId === "all" ? " selected" : ""}>Todos os projetos</option>
              ${state.data.projects.map((project) => `
                <option value="${project.id}"${state.selectedProjectId === project.id ? " selected" : ""}>${escapeHtml(project.name)}</option>
              `).join("")}
            </select>
            <div class="segmented-control" role="group" aria-label="Visualizacao do pipeline">
              <button type="button" data-pipeline-view="kanban" aria-pressed="${state.pipelineView === "kanban"}">Quadro</button>
              <button type="button" data-pipeline-view="list" aria-pressed="${state.pipelineView === "list"}">Lista</button>
            </div>
            <button class="primary-button compact" type="button" data-application-new>Novo</button>
          </div>
        </div>
        ${state.pipelineView === "kanban" ? renderPipelineKanban(applications) : renderPipelineList(applications)}
      </section>
    `;
  }

  function renderPipelineList(applications) {
    return `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Posicao</th>
                <th>Projeto</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th>Alertas</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${applications.map((app) => {
                const candidate = byId("candidates", app.candidateId);
                const position = byId("positions", app.positionId);
                const project = byId("projects", position.projectId);
                const alerts = getApplicationAlerts(app);
                return `
                  <tr>
                    <td><strong>${candidate.name}</strong><span>${candidate.email}</span></td>
                    <td>${position.name}</td>
                    <td>${project.name}</td>
                    <td>${statusPill(app.status)}</td>
                    <td>${formatDateTime(app.statusDate)}</td>
                    <td>${alerts.length ? `<span class="alert-count">${alerts.length}</span>` : "<span class=\"muted\">Sem alertas</span>"}</td>
                    <td><button class="ghost-button compact" type="button" data-application-edit="${app.id}">Editar</button></td>
                  </tr>
                `;
              }).join("") || tableEmpty(7, "Nenhuma candidatura encontrada.")}
            </tbody>
          </table>
        </div>
    `;
  }

  function renderPipelineKanban(applications) {
    return `
      <div class="kanban-board">
        ${pipelineGroups.map((group) => {
          const groupApplications = applications.filter((app) => group.statuses.includes(app.status));
          return `
            <section class="kanban-column">
              <div class="kanban-column-head">
                <strong>${group.title}</strong>
                <span>${groupApplications.length}</span>
              </div>
              <div class="kanban-cards">
                ${groupApplications.map(kanbanCard).join("") || emptyState("Sem candidaturas.")}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    `;
  }

  function kanbanCard(app) {
    const candidate = byId("candidates", app.candidateId);
    const position = byId("positions", app.positionId);
    const project = byId("projects", position.projectId);
    const person = candidate.importedPersonId ? byId("importedPeople", candidate.importedPersonId) : null;
    const careerLevel = person ? formatCareerLevel(person.resourceLevel) : "";

    return `
      <article class="kanban-card">
        <div class="kanban-card-head">
          <button class="kanban-name-link" type="button" data-candidate-goto="${escapeAttr(candidate.id)}">${escapeHtml(candidate.name)}</button>
          ${careerLevel ? `<span class="career-level-badge kanban-cl">${escapeHtml(careerLevel)}</span>` : ""}
        </div>
        <div class="kanban-divider"></div>
        <div class="kanban-card-chips">
          <span class="kanban-chip" title="${escapeAttr(project.name)}">${escapeHtml(project.name)}</span>
          <button class="kanban-chip kanban-chip--link" type="button" data-position-goto="${escapeAttr(position.id)}" title="${escapeAttr(position.name)}">${escapeHtml(position.name)}</button>
          ${position.externalRoleId ? `<span class="kanban-chip">${escapeHtml(position.externalRoleId)}</span>` : ""}
          ${statusPill(app.status)}
        </div>
        <div class="kanban-divider"></div>
        <div class="kanban-card-actions">
          <button class="ghost-button compact" type="button" data-application-edit="${escapeAttr(app.id)}">Editar</button>
        </div>
      </article>
    `;
  }

  function renderCalendar() {
    const events = getCalendarEvents();
    const filteredEvents = filterCalendarEvents(events);
    const upcoming = filteredEvents.filter((event) => event.date >= todayIso()).length;
    const alerts = filteredEvents.filter((event) => event.type === "alert").length;

    return `
      <section class="panel">
        <div class="panel-header toolbar-header">
          <div>
            <span class="eyebrow">Calendario</span>
            <h2>${calendarViewTitle()}</h2>
          </div>
          <div class="toolbar">
            <div class="segmented-control" role="group" aria-label="Visualizacao do calendario">
              <button type="button" data-calendar-view="month" aria-pressed="${state.calendarView === "month"}">Mes</button>
              <button type="button" data-calendar-view="agenda" aria-pressed="${state.calendarView === "agenda"}">Lista</button>
            </div>
            <div class="month-nav" aria-label="Navegar por meses">
              <button class="ghost-button compact" type="button" data-calendar-month="-1">Anterior</button>
              <button class="ghost-button compact" type="button" data-calendar-today>Hoje</button>
              <button class="ghost-button compact" type="button" data-calendar-month="1">Proximo</button>
            </div>
            <select data-project-filter aria-label="Filtrar calendario por projeto">
              <option value="all"${state.selectedProjectId === "all" ? " selected" : ""}>Todos os projetos</option>
              ${state.data.projects.map((project) => `
                <option value="${project.id}"${state.selectedProjectId === project.id ? " selected" : ""}>${escapeHtml(project.name)}</option>
              `).join("")}
            </select>
            <select data-calendar-type aria-label="Filtrar por tipo de evento">
              ${calendarTypeOptions().map((option) => `
                <option value="${option.value}"${state.calendarType === option.value ? " selected" : ""}>${option.label}</option>
              `).join("")}
            </select>
          </div>
        </div>

        ${renderCalendarBody(filteredEvents)}
      </section>
    `;
  }

  function renderCalendarBody(events) {
    if (state.calendarView === "month") return renderCalendarMonth(events);
    return renderCalendarAgenda(events);
  }

  function renderCalendarAgenda(events) {
    const visibleEvents = state.calendarSelectedDate
      ? events.filter((event) => event.date === state.calendarSelectedDate)
      : events;
    const grouped = groupEventsByDate(visibleEvents);
    return `
      ${state.calendarSelectedDate ? `
        <div class="calendar-selected-date">
          <span>Eventos de ${formatDate(state.calendarSelectedDate)}</span>
          <button class="ghost-button compact" type="button" data-calendar-clear-date>Ver todas as datas</button>
        </div>
      ` : ""}
      <div class="calendar-list">
        ${grouped.map((group) => `
          <section class="calendar-day">
            <div class="calendar-date">
              <strong>${formatDate(group.date)}</strong>
              <span>${weekdayLabel(group.date)}</span>
            </div>
            <div class="calendar-events">
              ${group.events.map(calendarEventCard).join("")}
            </div>
          </section>
        `).join("") || emptyState("Nenhum evento encontrado para a data selecionada.")}
      </div>
    `;
  }

  function renderCalendarMonth(events) {
    const days = monthGridDays(state.calendarMonth);
    const eventMap = eventsByDate(events);
    return `
      <div class="calendar-grid month-grid">
        ${weekdayShortLabels().map((label) => `<div class="calendar-grid-head">${label}</div>`).join("")}
        ${days.map((day) => {
          const dayEvents = eventMap.get(day.iso) || [];
          return `
            <button class="calendar-cell ${day.inCurrentMonth ? "" : "muted-cell"} ${day.iso === todayIso() ? "today-cell" : ""}" type="button" data-calendar-day="${day.iso}" aria-label="Abrir eventos de ${formatDate(day.iso)}">
              <div class="calendar-cell-date">
                <strong>${day.day}</strong>
                <span>${dayEvents.length}</span>
              </div>
              <div class="calendar-cell-events">
                ${dayEvents.slice(0, 3).map(calendarMiniEvent).join("")}
                ${dayEvents.length > 3 ? `<small>+${dayEvents.length - 3} eventos</small>` : ""}
              </div>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderImport() {
    return `
      <section class="import-layout">
        <article class="panel import-drop" data-import-drop="people" role="button" tabindex="0">
          <span class="drop-icon" aria-hidden="true">⇧</span>
          <h2>Importar pessoas</h2>
          <p>Arraste o people.xlsx aqui ou clique para selecionar.</p>
          <input class="visually-hidden" type="file" accept=".xlsx,.xls" data-people-import>
        </article>

        <article class="panel import-drop" data-import-drop="calendar" role="button" tabindex="0">
          <span class="drop-icon" aria-hidden="true">⇅</span>
          <h2>Importar calendarios</h2>
          <p>Arraste o individual_status_report.xlsx aqui ou clique para selecionar.</p>
          <input class="visually-hidden" type="file" accept=".xlsx,.xls" data-calendar-import>
        </article>

        <article class="panel import-drop" data-import-drop="demandroles" role="button" tabindex="0">
          <span class="drop-icon" aria-hidden="true">⬢</span>
          <h2>Importar status de roles</h2>
          <p>Arraste o Demand Candidate List Report.xlsx aqui ou clique para selecionar.</p>
          <input class="visually-hidden" type="file" accept=".xlsx,.xls" data-demandroles-import>
        </article>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Historico</span>
            <h2>Log de importacoes</h2>
          </div>
        </div>
        ${importLogTable()}
      </section>
    `;
  }

  function importLogTable() {
    const batches = state.data.importBatches || [];
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Arquivo</th>
              <th>Lidas</th>
              <th>Importadas</th>
              <th>Criadas</th>
              <th>Atualizadas</th>
              <th>Ignoradas</th>
              <th>Rejeitadas</th>
              <th>Observacao</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map((batch) => `
              <tr>
                <td>${formatDateTime(batch.importedAt)}</td>
                <td>${escapeHtml(importSourceLabel(batch.source))}</td>
                <td><strong>${escapeHtml(batch.fileName || "Arquivo nao informado")}</strong></td>
                <td>${batch.rowCount || 0}</td>
                <td>${batch.successCount || 0}</td>
                <td>${batch.createdCount || 0}</td>
                <td>${batch.updatedCount || 0}</td>
                <td>${batch.skippedCount || 0}</td>
                <td>${batch.errorCount || 0}</td>
                <td>${escapeHtml(batch.notes || "")}</td>
              </tr>
            `).join("") || tableEmpty(10, "Nenhuma importacao registrada.")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSkills() {
    const skills = filterItems(state.data.skills, ["name"]);
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Skills</span>
            <h2>Catalogo normalizado</h2>
          </div>
          <div class="toolbar">
            <button class="ghost-button compact btn-icon" type="button" data-skill-export title="Exportar Excel" aria-label="Exportar Excel">${iconExport()}</button>
            <label class="file-button compact btn-icon" title="Importar Excel" aria-label="Importar Excel">${iconImport()}<input type="file" accept=".xlsx,.xls" data-skill-import></label>
            <button class="primary-button compact" type="button" data-skill-new>Novo</button>
          </div>
        </div>
        ${skills.length ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th class="num-col">Posicoes</th>
                <th class="num-col">Candidatos</th>
                <th>Status</th>
                <th style="width:72px"></th>
              </tr>
            </thead>
            <tbody>
              ${skills.map((skill) => {
                const demand = state.data.positions.filter((p) => p.skills.includes(skill.id)).length;
                const supply = state.data.candidates.filter((c) => c.skills.includes(skill.id)).length;
                return `
                  <tr>
                    <td><strong>${escapeHtml(skill.name)}</strong></td>
                    <td class="num-col">${demand}</td>
                    <td class="num-col">${supply}</td>
                    <td>${statusPill(skill.active ? "ACTIVE" : "CLOSED", skill.active ? "Ativa" : "Inativa")}</td>
                    <td><button class="ghost-button compact" type="button" data-skill-edit="${escapeAttr(skill.id)}">Editar</button></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        ` : emptyState("Nenhuma skill encontrada.")}
      </section>
    `;
  }

  function renderCompanies() {
    const companies = filterItems(state.data.companies || [], ["name", "kind"]);
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Empresas</span>
            <h2>Empregadores e fornecedores</h2>
          </div>
          <button class="primary-button compact" type="button" data-company-new>Novo</button>
        </div>
        <div class="skill-cloud">
          ${companies.map((company) => {
            const candidates = state.data.candidates.filter((candidate) => candidate.companyId === company.id).length;
            return `
              <article class="skill-card">
                <div>
                  <strong>${escapeHtml(company.name)}</strong>
                  <span>${companyKindLabel(company.kind)} · ${candidates} candidato(s)</span>
                </div>
                <div class="skill-card-footer">
                  ${statusPill(company.active ? "ACTIVE" : "CLOSED", company.active ? "Ativa" : "Inativa")}
                  <button class="ghost-button compact" type="button" data-company-edit="${escapeAttr(company.id)}">Editar</button>
                </div>
              </article>
            `;
          }).join("") || emptyState("Nenhuma empresa encontrada.")}
        </div>
      </section>
    `;
  }

  function renderAlerts() {
    const alerts = getAlerts();
    const high = alerts.filter((alert) => alert.severity === "high").length;
    const medium = alerts.filter((alert) => alert.severity === "medium").length;
    const low = alerts.filter((alert) => alert.severity === "low").length;
    return `
      <section class="metric-grid compact-grid">
        ${metricCard("Alta prioridade", high, "Conflitos que podem bloquear confirmacao")}
        ${metricCard("Media prioridade", medium, "Pendencias que exigem revisao")}
        ${metricCard("Baixa prioridade", low, "Saneamento de cadastro")}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <span class="eyebrow">Alertas</span>
            <h2>Conflitos e pendencias</h2>
          </div>
          <button class="ghost-button" type="button" data-alert-action="refresh">Recalcular</button>
        </div>
        <div class="alert-list wide">
          ${alerts.map(alertCard).join("") || emptyState("Nenhum alerta ativo.")}
        </div>
      </section>
    `;
  }

  function renderReports() {
    const byProject = state.data.projects.map((project) => {
      const positions = state.data.positions.filter((position) => position.projectId === project.id);
      const apps = state.data.applications.filter((app) => positions.some((position) => position.id === app.positionId));
      return { project, positions, apps };
    });

    return `
      <section class="two-column">
        <article class="panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Relatorio</span>
              <h2>Pipeline por projeto</h2>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Posicoes</th>
                  <th>Candidaturas</th>
                  <th>Confirmadas</th>
                </tr>
              </thead>
              <tbody>
                ${byProject.map((row) => `
                  <tr>
                    <td><strong>${row.project.name}</strong></td>
                    <td>${row.positions.length}</td>
                    <td>${row.apps.length}</td>
                    <td>${row.apps.filter((app) => app.status === "CONFIRMED").length}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel">
          <div class="panel-header">
            <div>
              <span class="eyebrow">Relatorio</span>
              <h2>Skills mais demandadas</h2>
            </div>
          </div>
          ${skillDemandList()}
        </article>
      </section>
    `;
  }

  function positionsTable(positions) {
    const allIds = positions.map((p) => p.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => state.selectedPositionIds.has(id));
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:36px"><input type="checkbox" data-position-select-all ${allSelected ? "checked" : ""} aria-label="Selecionar todos"></th>
              <th>Posicao</th>
              <th>Projeto</th>
              <th>Role</th>
              <th>Status</th>
              <th>Inicio</th>
              <th>Fim</th>
              <th>Candidatos</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            ${positions.map((position) => {
              const project = byId("projects", position.projectId);
              const roleLabel = position.externalRoleId
                ? `<span class="mono-text">${escapeHtml(position.externalRoleId)}</span>`
                : `<span class="warning-text">Sem Role</span>`;
              const apps = state.data.applications.filter((app) => app.positionId === position.id);
              const selected = state.selectedPositionIds.has(position.id);
              return `
                <tr class="${selected ? "row-selected" : ""}">
                  <td><input type="checkbox" data-position-select="${escapeAttr(position.id)}" ${selected ? "checked" : ""} aria-label="Selecionar"></td>
                  <td><strong>${escapeHtml(position.name)}</strong></td>
                  <td>${escapeHtml(project ? project.name : "")}</td>
                  <td>${roleLabel}</td>
                  <td>${statusPill(position.status)}</td>
                  <td>${position.startDate ? formatDate(position.startDate) : `<span class="muted">—</span>`}</td>
                  <td>${position.endDate ? formatDate(position.endDate) : `<span class="muted">—</span>`}</td>
                  <td>${apps.length}</td>
                  <td><button class="ghost-button compact" type="button" data-position-edit="${escapeAttr(position.id)}">Editar</button></td>
                </tr>
              `;
            }).join("") || tableEmpty(9, "Nenhuma posicao encontrada.")}
          </tbody>
        </table>
      </div>
    `;
  }

  function candidatesTable(candidates) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidato</th>
              <th>Empresa</th>
              <th>Status</th>
              <th>Staffable</th>
              <th>UCR</th>
              <th>LCR</th>
              <th>Candidaturas</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            ${candidates.map((candidate) => {
              const apps = state.data.applications.filter((app) => app.candidateId === candidate.id);
              const availability = personAvailabilityLabel(calendarsForCandidate(candidate));
              const company = byId("companies", candidate.companyId);
              return `
                <tr>
                  <td><strong>${candidate.name}</strong><span>${candidate.email || candidate.externalPersonId || "Sem contato"}</span></td>
                  <td>${company ? company.name : "<span class=\"warning-text\">Empresa nao informada</span>"}</td>
                  <td>${statusPill(candidate.active ? "ACTIVE" : "CLOSED")}</td>
                  <td><span class="availability-chip${availability.available ? " availability-chip--free" : ""}">${escapeHtml(availability.label)}</span></td>
                  <td class="num-col">${candidate.ucrAmount ? `${formatMoney(candidate.ucrAmount, candidate.costCurrency)}<span>${periodLabel(candidate.costPeriod)}</span>` : `<span class="muted">—</span>`}</td>
                  <td class="num-col">${candidate.lcrAmount ? `${formatMoney(candidate.lcrAmount, candidate.costCurrency)}<span>${periodLabel(candidate.costPeriod)}</span>` : `<span class="muted">—</span>`}</td>
                  <td>${apps.length}</td>
                  <td><button class="ghost-button compact" type="button" data-candidate-edit="${candidate.id}">Editar</button></td>
                </tr>
              `;
            }).join("") || tableEmpty(8, "Nenhum candidato encontrado.")}
          </tbody>
        </table>
      </div>
    `;
  }

  function pipelineBars() {
    const counts = applicationSteps.map((step) => ({
      step,
      count: state.data.applications.filter((app) => app.status === step).length
    })).filter((item) => item.count > 0);

    const max = Math.max(...counts.map((item) => item.count), 1);

    return `
      <div class="pipeline-bars">
        ${counts.map((item) => `
          <div class="bar-row">
            <span>${labels[item.step]}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(item.count / max) * 100}%"></div></div>
            <strong>${item.count}</strong>
          </div>
        `).join("") || emptyState("Nenhuma candidatura no pipeline.")}
      </div>
    `;
  }

  function skillDemandList() {
    const demand = state.data.skills.map((skill) => ({
      skill,
      count: state.data.positions.filter((position) => position.skills.includes(skill.id)).length
    })).sort((a, b) => b.count - a.count);

    return `
      <div class="rank-list">
        ${demand.map((item) => `
          <div class="rank-row">
            <strong>${item.skill.name}</strong>
            <span>${item.count} posicoes</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function filterApplications() {
    return state.data.applications.filter((app) => {
      const candidate = byId("candidates", app.candidateId);
      const position = byId("positions", app.positionId);
      const project = byId("projects", position.projectId);
      const matchesProject = state.selectedProjectId === "all" || position.projectId === state.selectedProjectId;
      const matchesSearch = !state.search || [candidate.name, candidate.email, position.name, project.name, app.status]
        .join(" ")
        .toLowerCase()
        .includes(state.search);
      return matchesProject && matchesSearch;
    });
  }

  function getCalendarEvents() {
    const events = [];

    state.data.projects.forEach((project) => {
      events.push(calendarEvent("project", project.startDate, "Inicio do projeto", project.name, project.description, project.id));
      events.push(calendarEvent("project", project.endDate, "Fim do projeto", project.name, project.description, project.id));
    });

    state.data.positions.forEach((position) => {
      const project = byId("projects", position.projectId);
      events.push(calendarEvent("position", position.startDate, "Inicio da posicao", position.name, project.name, position.projectId, position.id));
      events.push(calendarEvent("position", position.endDate, "Fim da posicao", position.name, project.name, position.projectId, position.id));
    });

    state.data.applications.forEach((application) => {
      const candidate = byId("candidates", application.candidateId);
      const position = byId("positions", application.positionId);
      if (!candidate || !position) return;
      events.push(calendarEvent(
        "application",
        application.statusDate.slice(0, 10),
        labels[application.status] || "Atualizacao da candidatura",
        candidate.name,
        position.name,
        position.projectId,
        application.id
      ));
    });

    getAlerts().forEach((alert) => {
      const date = alertDate(alert);
      if (!date) return;
      events.push({
        ...calendarEvent("alert", date, alert.title, alert.body, alert.meta, alert.projectId || null, alert.targetId || null),
        severity: alert.severity
      });
    });

    return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
  }

  function calendarEvent(type, date, title, subject, detail, projectId, targetId) {
    return {
      id: `${type}-${date}-${targetId || subject}-${title}`,
      type,
      date,
      title,
      subject,
      detail,
      projectId,
      targetId,
      severity: "low"
    };
  }

  function filterCalendarEvents(events) {
    const start = state.calendarMonth;
    const end = monthEndIso(state.calendarMonth);
    return events.filter((event) => {
      const inRange = event.date >= start && event.date <= end;
      const matchesType = state.calendarType === "all" || event.type === state.calendarType;
      const matchesProject = state.selectedProjectId === "all" || event.projectId === state.selectedProjectId;
      return inRange && matchesType && matchesProject;
    });
  }

  function groupEventsByDate(events) {
    const groups = new Map();
    events.forEach((event) => {
      if (!groups.has(event.date)) groups.set(event.date, []);
      groups.get(event.date).push(event);
    });
    return Array.from(groups.entries()).map(([date, groupEvents]) => ({
      date,
      events: groupEvents
    }));
  }

  function calendarEventCard(event) {
    return `
      <article class="calendar-event ${event.type} ${event.severity}">
        <span>${calendarTypeLabel(event.type)}</span>
        <strong>${event.title}</strong>
        <p>${event.subject}</p>
        <small>${event.detail || ""}</small>
      </article>
    `;
  }

  function calendarMiniEvent(event) {
    return `
      <span class="calendar-mini-event ${event.type}">${event.title}</span>
    `;
  }

  function calendarViewTitle() {
    return {
      agenda: state.calendarSelectedDate ? `Lista de ${formatDate(state.calendarSelectedDate)}` : "Lista operacional",
      month: monthTitle(state.calendarMonth)
    }[state.calendarView];
  }

  function eventsByDate(events) {
    const map = new Map();
    events.forEach((event) => {
      if (!map.has(event.date)) map.set(event.date, []);
      map.get(event.date).push(event);
    });
    return map;
  }

  function monthGridDays(referenceIso) {
    const reference = new Date(`${referenceIso}T00:00:00`);
    const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        iso: date.toISOString().slice(0, 10),
        day: date.getDate(),
        inCurrentMonth: date.getMonth() === reference.getMonth()
      };
    });
  }

  function weekdayShortLabels() {
    return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  }

  function monthTitle(dateIso) {
    const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${dateIso}T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function calendarTypeOptions() {
    return [
      { value: "all", label: "Todos os eventos" },
      { value: "project", label: "Projetos" },
      { value: "position", label: "Posicoes" },
      { value: "role", label: "Roles" },
      { value: "application", label: "Candidaturas" },
      { value: "alert", label: "Alertas" }
    ];
  }

  function calendarTypeLabel(type) {
    return calendarTypeOptions().find((option) => option.value === type)?.label || type;
  }

  function alertDate(alert) {
    if (alert.action === "position" && alert.targetId) {
      const position = byId("positions", alert.targetId);
      return position ? position.startDate : todayIso();
    }

    if (alert.action === "application" && alert.targetId) {
      const application = byId("applications", alert.targetId);
      return application ? application.statusDate.slice(0, 10) : todayIso();
    }

    return todayIso();
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthStartIso(dateIso) {
    const date = new Date(`${dateIso}T00:00:00`);
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  }

  function monthEndIso(dateIso) {
    const date = new Date(`${dateIso}T00:00:00`);
    date.setMonth(date.getMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
  }

  function shiftMonthIso(dateIso, delta) {
    const date = new Date(`${dateIso}T00:00:00`);
    date.setMonth(date.getMonth() + delta, 1);
    return date.toISOString().slice(0, 10);
  }

  function weekdayLabel(dateIso) {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date(`${dateIso}T00:00:00`));
  }

  function uniqueCount(values) {
    return new Set(values).size;
  }

  function filterItems(items, fields) {
    if (!state.search) return items;
    return items.filter((item) => fields.some((field) => String(item[field] || "").toLowerCase().includes(state.search)));
  }

  function getAlerts() {
    const alerts = [];

    state.data.positions.forEach((position) => {
      const project = byId("projects", position.projectId);
      if (["DRAFT", "OPEN"].includes(position.status) && !position.skills.length) {
        alerts.push({
          severity: "low",
          title: "Posicao sem skills",
          body: `${position.name} ainda nao possui skills requeridas.`,
          meta: project.name,
          projectId: project.id,
          action: "position",
          targetId: position.id,
          actionLabel: "Editar posicao"
        });
      }

      if (project && (position.startDate < project.startDate || position.endDate > project.endDate)) {
        alerts.push({
          severity: "medium",
          title: "Datas fora do projeto",
          body: `${position.name} tem periodo fora das datas do projeto.`,
          meta: `${formatDate(project.startDate)} - ${formatDate(project.endDate)}`,
          projectId: project.id,
          action: "position",
          targetId: position.id,
          actionLabel: "Editar posicao"
        });
      }

    });

    state.data.applications.forEach((app) => {
      const candidate = byId("candidates", app.candidateId);
      const position = byId("positions", app.positionId);

      if (candidate && !candidate.active && app.status !== "REJECTED" && app.status !== "CANCELLED") {
        alerts.push({
          severity: "medium",
          title: "Candidatura com candidato inativo",
          body: `${candidate.name} esta inativo, mas continua no pipeline.`,
          meta: position ? position.name : "Candidatura",
          projectId: position ? position.projectId : null,
          action: "application",
          targetId: app.id,
          actionLabel: "Editar candidatura"
        });
      }

      getApplicationAlerts(app).forEach((alert) => alerts.push(alert));
    });

    const roleToProjectIds = new Map();
    state.data.positions.forEach((position) => {
      if (position.externalRoleId) {
        if (!roleToProjectIds.has(position.externalRoleId)) roleToProjectIds.set(position.externalRoleId, new Set());
        roleToProjectIds.get(position.externalRoleId).add(position.projectId);
      }
    });
    roleToProjectIds.forEach((projectIds, roleNumber) => {
      if (projectIds.size > 1) {
        const projectNames = [...projectIds]
          .map((id) => { const p = byId("projects", id); return p ? p.name : id; })
          .join(", ");
        alerts.push({
          severity: "medium",
          title: "Role em multiplos projetos",
          body: `A role ${roleNumber} esta vinculada a posicoes em mais de um projeto: ${projectNames}.`,
          meta: roleNumber,
          action: "roles",
          actionLabel: "Ver pool de roles"
        });
      }
    });

    state.data.candidates.forEach((candidate) => {
      if (candidate.active && !candidate.companyId) {
        alerts.push({
          severity: "low",
          title: "Candidato sem empresa",
          body: `${candidate.name} esta ativo, mas nao possui empresa cadastrada.`,
          meta: candidate.email || "Sem email",
          action: "candidate",
          targetId: candidate.id,
          actionLabel: "Editar candidato"
        });
      }

      if (candidate.active && !candidate.skills.length) {
        alerts.push({
          severity: "low",
          title: "Candidato sem skills",
          body: `${candidate.name} esta ativo, mas nao possui skills cadastradas.`,
          meta: candidate.email || "Sem email",
          action: "candidate",
          targetId: candidate.id,
          actionLabel: "Editar candidato"
        });
      }
    });

    return alerts.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
  }

  function getApplicationAlerts(app) {
    const candidate = byId("candidates", app.candidateId);
    const position = byId("positions", app.positionId);
    const alerts = [];

    if (!position || !candidate) return alerts;
    const positionRoles = position.externalRoleIds || [];
    if (!positionRoles.length) return alerts;
    if (app.status === "REJECTED" || app.status === "CANCELLED") return alerts;

    const calendarConflicts = (state.data.allocationCalendars || []).filter((item) => {
      if (!item.roleIdExternal) return false;
      if (positionRoles.includes(item.roleIdExternal)) return false;
      if (!item.calendarStartDate || !item.calendarEndDate) return false;
      if (!dateRangeIncludes(item.calendarStartDate, item.calendarEndDate, todayIso())) return false;
      return allocationCalendarMatchesCandidate(item, candidate);
    });

    calendarConflicts.forEach((item) => {
      alerts.push({
        severity: "high",
        title: "Candidato alocado em role nao associada",
        body: `${candidate.name} esta alocado na role ${item.roleIdExternal}, que nao esta entre as roles da posicao (${positionRoles.join(", ")}).`,
        meta: position.name,
        projectId: position.projectId,
        action: "application",
        targetId: app.id,
        actionLabel: "Editar candidatura"
      });
    });

    return alerts;
  }

  function handleAlertAction(action, targetId) {
    if (action === "refresh") {
      render();
      toast("Alertas recalculados.");
      return;
    }

    if (action === "position") {
      const position = byId("positions", targetId);
      if (position) openPositionForm(position);
      return;
    }

    if (action === "application") {
      const application = byId("applications", targetId);
      if (application) openApplicationForm(application);
      return;
    }

    if (action === "candidate") {
      const candidate = byId("candidates", targetId);
      if (candidate) openCandidateForm(candidate);
      return;
    }

    if (action === "roles") {
      state.view = "roles";
      render();
      return;
    }
  }

  function severityWeight(severity) {
    return { low: 1, medium: 2, high: 3 }[severity] || 0;
  }

  function byId(collection, id) {
    return (state.data[collection] || []).find((item) => item.id === id);
  }

  function companyName(companyId) {
    const company = byId("companies", companyId);
    return company ? company.name : "";
  }

  function companyKindLabel(kind) {
    return {
      CONSULTING: "Consultoria",
      CLIENT: "Cliente",
      PARTNER: "Parceira",
      VENDOR: "Fornecedor",
      OTHER: "Outra"
    }[kind] || "Outra";
  }

  function openProjectForm(project) {
    const isEditing = Boolean(project);
    const values = project || {
      id: createId(),
      name: "",
      description: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      status: "ACTIVE"
    };

    openModal(`
      <form class="modal-card" id="projectForm">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Projeto</span>
            <h2>${isEditing ? "Editar projeto" : "Novo projeto"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <div class="form-grid">
          <input name="id" type="hidden" value="${escapeAttr(values.id)}">

          <label>
            <span>Nome</span>
            <input name="name" value="${escapeAttr(values.name)}" required maxlength="120">
          </label>

          <label>
            <span>Status</span>
            <select name="status" required>
              ${["ACTIVE", "CLOSED", "CANCELLED"].map((status) => `
                <option value="${status}" ${values.status === status ? "selected" : ""}>${labels[status]}</option>
              `).join("")}
            </select>
          </label>

          <label>
            <span>Data de inicio</span>
            <input name="startDate" type="date" value="${escapeAttr(values.startDate)}" required>
          </label>

          <label>
            <span>Data fim</span>
            <input name="endDate" type="date" value="${escapeAttr(values.endDate)}" required>
          </label>

          <label class="span-2">
            <span>Descricao</span>
            <textarea name="description" rows="4">${escapeHtml(values.description || "")}</textarea>
          </label>
        </div>

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    `);

    document.querySelector("#projectForm").addEventListener("submit", saveProjectFromForm);
  }

  async function saveProjectFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const project = {
      id: String(formData.get("id")).trim(),
      name: String(formData.get("name")).trim(),
      description: String(formData.get("description")).trim(),
      startDate: String(formData.get("startDate")),
      endDate: String(formData.get("endDate")),
      status: String(formData.get("status"))
    };

    if (!project.name || !project.startDate || !project.endDate) {
      toast("Preencha os campos obrigatorios do projeto.");
      return;
    }

    if (project.startDate > project.endDate) {
      toast("A data de inicio nao pode ser posterior a data fim.");
      return;
    }

    try {
      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveProject(project);
      } else {
        const index = state.data.projects.findIndex((item) => item.id === project.id);
        if (index >= 0) state.data.projects[index] = project;
        else state.data.projects.push(project);
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      closeModal();
      render();
      toast("Projeto salvo. Use Salvar banco para exportar o staffing.db.");
    } catch (error) {
      toast("Nao foi possivel salvar o projeto.");
      console.error(error);
    }
  }

  async function exportProjectsToExcel() {
    if (!window.staffingExcel) {
      toast("Exportacao Excel nao esta disponivel.");
      return;
    }

    const rows = state.data.projects.map((project) => ({
      Id: project.id,
      Name: project.name,
      Description: project.description || "",
      StartDate: project.startDate,
      EndDate: project.endDate,
      Status: project.status
    }));

    try {
      await window.staffingExcel.exportSheet("staffing_projects.xlsx", "Projects", rows);
      toast("Projetos exportados para Excel.");
    } catch (error) {
      toast("Nao foi possivel exportar Projetos.");
      console.error(error);
    }
  }

  async function importProjectsFromExcel(file) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      const rows = await window.staffingExcel.readFirstSheet(file);
      const result = parseProjectImportRows(rows);

      if (result.errors.length) {
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Projetos", result.errors);
        return;
      }

      const confirmed = window.confirm(
        `Importar Projetos?\n\nNovos: ${result.created}\nAtualizados: ${result.updated}\n\nA importacao nao apaga registros.`
      );
      if (!confirmed) return;

      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveProjects(result.projects);
      } else {
        result.projects.forEach((project) => {
          const index = state.data.projects.findIndex((item) => item.id === project.id);
          if (index >= 0) state.data.projects[index] = project;
          else state.data.projects.push(project);
        });
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Projetos importados: ${result.created} novo(s), ${result.updated} atualizado(s).`);
    } catch (error) {
      toast("Nao foi possivel importar Projetos.");
      console.error(error);
    }
  }

  function parseProjectImportRows(rows) {
    const errors = [];
    const projects = [];
    let created = 0;
    let updated = 0;
    const existingIds = new Set(state.data.projects.map((project) => project.id));
    const seenIds = new Set();
    const validStatuses = new Set(["ACTIVE", "CLOSED", "CANCELLED"]);

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const id = cleanCell(row.id);
      const name = cleanCell(row.name);
      const description = cleanCell(row.description);
      const startDate = normalizeDateCell(row.startdate);
      const endDate = normalizeDateCell(row.enddate);
      const status = cleanCell(row.status).toUpperCase() || "ACTIVE";

      if (!name) errors.push(`Linha ${rowNumber}: Name e obrigatorio.`);
      if (!startDate) errors.push(`Linha ${rowNumber}: StartDate invalido ou vazio.`);
      if (!endDate) errors.push(`Linha ${rowNumber}: EndDate invalido ou vazio.`);
      if (startDate && endDate && startDate > endDate) errors.push(`Linha ${rowNumber}: StartDate nao pode ser maior que EndDate.`);
      if (!validStatuses.has(status)) errors.push(`Linha ${rowNumber}: Status deve ser ACTIVE, CLOSED ou CANCELLED.`);
      if (id && !existingIds.has(id)) errors.push(`Linha ${rowNumber}: Id informado nao existe no banco.`);
      if (id && seenIds.has(id)) errors.push(`Linha ${rowNumber}: Id duplicado no arquivo.`);

      const finalId = id || createId();
      seenIds.add(finalId);
      projects.push({
        id: finalId,
        name,
        description,
        startDate,
        endDate,
        status
      });

      if (id) updated += 1;
      else created += 1;
    });

    return { projects, errors, created, updated };
  }

  function showImportErrors(entityName, errors) {
    openModal(`
      <section class="modal-card">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Importacao</span>
            <h2>Erros em ${entityName}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>
        <div class="import-error-list">
          ${errors.map((error) => `<p>${escapeHtml(error)}</p>`).join("")}
        </div>
        <div class="modal-actions">
          <button class="primary-button" type="button" data-modal-close>Fechar</button>
        </div>
      </section>
    `);
  }

  async function exportSkillsToExcel() {
    if (!window.staffingExcel) {
      toast("Exportacao Excel nao esta disponivel.");
      return;
    }

    const rows = state.data.skills.map((skill) => ({
      Id: skill.id,
      Name: skill.name,
      Active: skill.active ? "TRUE" : "FALSE"
    }));

    try {
      await window.staffingExcel.exportSheet("staffing_skills.xlsx", "Skills", rows);
      toast("Skills exportadas para Excel.");
    } catch (error) {
      toast("Nao foi possivel exportar Skills.");
      console.error(error);
    }
  }

  async function importSkillsFromExcel(file) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      const rows = await window.staffingExcel.readFirstSheet(file);
      const result = parseSkillImportRows(rows);

      if (result.errors.length) {
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Skills", result.errors);
        return;
      }

      const confirmed = window.confirm(
        `Importar Skills?\n\nNovas: ${result.created}\nAtualizadas: ${result.updated}\n\nA importacao nao apaga registros.`
      );
      if (!confirmed) return;

      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveSkills(result.skills);
      } else {
        result.skills.forEach((skill) => {
          const index = state.data.skills.findIndex((item) => item.id === skill.id);
          if (index >= 0) state.data.skills[index] = skill;
          else state.data.skills.push(skill);
        });
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Skills importadas: ${result.created} nova(s), ${result.updated} atualizada(s).`);
    } catch (error) {
      toast("Nao foi possivel importar Skills.");
      console.error(error);
    }
  }

  function parseSkillImportRows(rows) {
    const errors = [];
    const skills = [];
    let created = 0;
    let updated = 0;
    const existingIds = new Set(state.data.skills.map((skill) => skill.id));
    const seenIds = new Set();
    const seenNames = new Map();

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const id = cleanCell(row.id);
      const existingSkill = id ? byId("skills", id) : null;
      const name = cleanCell(row.name);
      const active = parseBooleanCell(row.active, existingSkill ? existingSkill.active : true);

      if (!name) errors.push(`Linha ${rowNumber}: Name e obrigatorio.`);
      if (active === null) errors.push(`Linha ${rowNumber}: Active deve ser TRUE ou FALSE.`);
      if (id && !existingIds.has(id)) errors.push(`Linha ${rowNumber}: Id informado nao existe no banco.`);
      if (id && seenIds.has(id)) errors.push(`Linha ${rowNumber}: Id duplicado no arquivo.`);

      const normalizedName = name.toLowerCase();
      const existingByName = state.data.skills.find((skill) => skill.id !== id && skill.name.toLowerCase() === normalizedName);
      if (existingByName) errors.push(`Linha ${rowNumber}: ja existe outra skill com este Name.`);
      if (seenNames.has(normalizedName)) errors.push(`Linha ${rowNumber}: Name duplicado no arquivo; primeira ocorrencia na linha ${seenNames.get(normalizedName)}.`);
      else if (name) seenNames.set(normalizedName, rowNumber);

      const finalId = id || createId();
      seenIds.add(finalId);
      skills.push({ id: finalId, name, active: active ?? true });

      if (id) updated += 1;
      else created += 1;
    });

    return { skills, errors, created, updated };
  }

  async function exportCandidatesToExcel() {
    if (!window.staffingExcel) {
      toast("Exportacao Excel nao esta disponivel.");
      return;
    }

    const rows = state.data.candidates.map((candidate) => ({
      Id: candidate.id,
      ImportedPersonId: candidate.importedPersonId || "",
      CompanyId: candidate.companyId || "",
      CompanyName: companyName(candidate.companyId),
      ExternalPersonId: candidate.externalPersonId || "",
      Name: candidate.name,
      Email: candidate.email || "",
      UcrAmount: candidate.ucrAmount ?? 0,
      LcrAmount: candidate.lcrAmount ?? 0,
      CostCurrency: candidate.costCurrency,
      CostPeriod: candidate.costPeriod,
      Active: candidate.active ? "TRUE" : "FALSE",
      Skills: skillNamesWithLevels(candidate.skills, candidate.skillLevels).join(", ")
    }));

    try {
      await window.staffingExcel.exportSheet("staffing_candidates.xlsx", "Candidates", rows);
      toast("Candidatos exportados para Excel.");
    } catch (error) {
      toast("Nao foi possivel exportar Candidatos.");
      console.error(error);
    }
  }

  async function importCandidatesFromExcel(file) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      const rows = await window.staffingExcel.readFirstSheet(file);
      const result = parseCandidateImportRows(rows);

      if (result.errors.length) {
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Candidatos", result.errors);
        return;
      }

      const confirmed = window.confirm(
        `Importar Candidatos?\n\nNovos: ${result.created}\nAtualizados: ${result.updated}\n\nA importacao nao apaga registros.`
      );
      if (!confirmed) return;

      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveCandidates(result.candidates);
      } else {
        result.candidates.forEach((candidate) => {
          const index = state.data.candidates.findIndex((item) => item.id === candidate.id);
          if (index >= 0) state.data.candidates[index] = candidate;
          else state.data.candidates.push(candidate);
        });
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Candidatos importados: ${result.created} novo(s), ${result.updated} atualizado(s).`);
    } catch (error) {
      toast("Nao foi possivel importar Candidatos.");
      console.error(error);
    }
  }

  function parseCandidateImportRows(rows) {
    const errors = [];
    const candidates = [];
    let created = 0;
    let updated = 0;
    const existingIds = new Set(state.data.candidates.map((candidate) => candidate.id));
    const seenIds = new Set();
    const seenEmails = new Map();
    const seenExternalIds = new Map();
    const validCurrencies = new Set(["BRL", "USD", "EUR", "GBP"]);
    const validPeriods = new Set(["HOUR", "DAY", "MONTH"]);

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const id = cleanCell(row.id);
      const existingCandidate = id ? byId("candidates", id) : null;
      const importedPersonId = cleanCell(row.importedpersonid);
      const companyId = cleanCell(row.companyid);
      const externalPersonId = cleanCell(row.externalpersonid);
      const name = cleanCell(row.name);
      const email = cleanCell(row.email);
      const ucrAmount = parseNumberCell(row.ucramount);
      const lcrAmount = parseNumberCell(row.lcramount);
      const costCurrency = cleanCell(row.costcurrency).toUpperCase() || "BRL";
      const costPeriod = cleanCell(row.costperiod).toUpperCase() || "MONTH";
      const active = parseBooleanCell(row.active, existingCandidate ? existingCandidate.active : true);
      const skillEntries = parseSkillEntriesCell(row.skills, rowNumber, errors);
      const skills = skillEntries.map((entry) => entry.id);

      if (!name) errors.push(`Linha ${rowNumber}: Name e obrigatorio.`);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Linha ${rowNumber}: Email invalido.`);
      if (ucrAmount !== null && ucrAmount < 0) errors.push(`Linha ${rowNumber}: UcrAmount deve ser um numero maior ou igual a zero.`);
      if (lcrAmount !== null && lcrAmount < 0) errors.push(`Linha ${rowNumber}: LcrAmount deve ser um numero maior ou igual a zero.`);
      if (!validCurrencies.has(costCurrency)) errors.push(`Linha ${rowNumber}: CostCurrency deve ser BRL, USD, EUR ou GBP.`);
      if (!validPeriods.has(costPeriod)) errors.push(`Linha ${rowNumber}: CostPeriod deve ser HOUR, DAY ou MONTH.`);
      if (active === null) errors.push(`Linha ${rowNumber}: Active deve ser TRUE ou FALSE.`);
      if (id && !existingIds.has(id)) errors.push(`Linha ${rowNumber}: Id informado nao existe no banco.`);
      if (id && seenIds.has(id)) errors.push(`Linha ${rowNumber}: Id duplicado no arquivo.`);
      if (importedPersonId && !byId("importedPeople", importedPersonId)) errors.push(`Linha ${rowNumber}: ImportedPersonId nao existe na base de pessoas importadas.`);
      if (companyId && !byId("companies", companyId)) errors.push(`Linha ${rowNumber}: CompanyId nao existe no cadastro de empresas.`);

      const existingByEmail = email && state.data.candidates.find((candidate) => {
        return candidate.id !== id && candidate.email && candidate.email.toLowerCase() === email.toLowerCase();
      });
      if (existingByEmail) errors.push(`Linha ${rowNumber}: ja existe outro candidato com este Email.`);
      if (email) {
        const normalizedEmail = email.toLowerCase();
        if (seenEmails.has(normalizedEmail)) errors.push(`Linha ${rowNumber}: Email duplicado no arquivo; primeira ocorrencia na linha ${seenEmails.get(normalizedEmail)}.`);
        else seenEmails.set(normalizedEmail, rowNumber);
      }

      const existingByExternalId = externalPersonId && state.data.candidates.find((candidate) => {
        return candidate.id !== id && candidate.externalPersonId === externalPersonId;
      });
      if (existingByExternalId) errors.push(`Linha ${rowNumber}: ja existe outro candidato com este ExternalPersonId.`);
      if (externalPersonId) {
        if (seenExternalIds.has(externalPersonId)) errors.push(`Linha ${rowNumber}: ExternalPersonId duplicado no arquivo; primeira ocorrencia na linha ${seenExternalIds.get(externalPersonId)}.`);
        else seenExternalIds.set(externalPersonId, rowNumber);
      }

      const finalId = id || createId();
      seenIds.add(finalId);
      candidates.push({
        id: finalId,
        importedPersonId,
        companyId,
        externalPersonId,
        name,
        email,
        ucrAmount: ucrAmount ?? 0,
        lcrAmount: lcrAmount ?? 0,
        costCurrency,
        costPeriod,
        active: active ?? true,
        skills,
        skillLevels: skillLevelsFromEntries(skillEntries)
      });

      if (id) updated += 1;
      else created += 1;
    });

    return { candidates, errors, created, updated };
  }

  async function exportPositionsToExcel() {
    if (!window.staffingExcel) {
      toast("Exportacao Excel nao esta disponivel.");
      return;
    }

    const projectsById = Object.fromEntries(state.data.projects.map((p) => [p.id, p]));
    const rows = state.data.positions.map((position) => ({
      Id: position.id,
      ProjectId: position.projectId,
      ProjectName: (projectsById[position.projectId] || {}).name || "",
      Name: position.name,
      Description: position.description || "",
      ExternalRoleId: position.externalRoleId || "",
      StartDate: position.startDate || "",
      EndDate: position.endDate || "",
      Status: position.status,
      Skills: skillNamesWithLevels(position.skills, position.skillLevels).join(", ")
    }));

    try {
      await window.staffingExcel.exportSheet("staffing_positions.xlsx", "Positions", rows);
      toast("Posicoes exportadas para Excel.");
    } catch (error) {
      toast("Nao foi possivel exportar Posicoes.");
      console.error(error);
    }
  }

  async function importPositionsFromExcel(file) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      const rows = await window.staffingExcel.readFirstSheet(file);
      const result = parsePositionImportRows(rows);

      if (result.errors.length) {
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Posicoes", result.errors);
        return;
      }

      const confirmed = window.confirm(
        `Importar Posicoes?\n\nNovos: ${result.created}\nAtualizados: ${result.updated}\n\nA importacao nao apaga registros.`
      );
      if (!confirmed) return;

      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.savePositions(result.positions);
      } else {
        result.positions.forEach((position) => {
          const index = state.data.positions.findIndex((item) => item.id === position.id);
          if (index >= 0) state.data.positions[index] = position;
          else state.data.positions.push(position);
        });
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Posicoes importadas: ${result.created} nova(s), ${result.updated} atualizada(s).`);
    } catch (error) {
      toast("Nao foi possivel importar Posicoes.");
      console.error(error);
    }
  }

  function parsePositionImportRows(rows) {
    const errors = [];
    const positions = [];
    let created = 0;
    let updated = 0;
    const existingIds = new Set(state.data.positions.map((p) => p.id));
    const projectIds = new Set(state.data.projects.map((p) => p.id));
    const seenIds = new Set();
    const validStatuses = new Set(["DRAFT", "OPEN", "ON_HOLD", "FILLED", "CANCELLED", "CLOSED"]);

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const id = cleanCell(row.id);
      const projectId = cleanCell(row.projectid);
      const name = cleanCell(row.name);
      const description = cleanCell(row.description);
      const externalRoleId = cleanCell(row.externalroleid);
      const startDate = normalizeDateCell(row.startdate);
      const endDate = normalizeDateCell(row.enddate);
      const status = cleanCell(row.status).toUpperCase() || "DRAFT";
      const skillEntries = parseSkillEntriesCell(row.skills, rowNumber, errors);
      const skills = skillEntries.map((entry) => entry.id);

      if (!name) errors.push(`Linha ${rowNumber}: Name e obrigatorio.`);
      if (!projectId) errors.push(`Linha ${rowNumber}: ProjectId e obrigatorio.`);
      if (projectId && !projectIds.has(projectId)) errors.push(`Linha ${rowNumber}: ProjectId nao existe no cadastro de projetos.`);
      if (!validStatuses.has(status)) errors.push(`Linha ${rowNumber}: Status deve ser DRAFT, OPEN, ON_HOLD, FILLED, CANCELLED ou CLOSED.`);
      if (startDate && endDate && startDate > endDate) errors.push(`Linha ${rowNumber}: StartDate nao pode ser maior que EndDate.`);
      if (id && !existingIds.has(id)) errors.push(`Linha ${rowNumber}: Id informado nao existe no banco.`);
      if (id && seenIds.has(id)) errors.push(`Linha ${rowNumber}: Id duplicado no arquivo.`);

      const finalId = id || createId();
      seenIds.add(finalId);
      positions.push({
        id: finalId,
        projectId,
        name,
        description,
        externalRoleId,
        startDate: startDate || "",
        endDate: endDate || "",
        status,
        skills,
        skillLevels: skillLevelsFromEntries(skillEntries),
        externalRoleIds: externalRoleId ? [externalRoleId] : []
      });

      if (id) updated += 1;
      else created += 1;
    });

    return { positions, errors, created, updated };
  }

  async function exportProjectRolesToExcel() {
    if (!window.staffingExcel) {
      toast("Exportacao Excel nao esta disponivel.");
      return;
    }

    const demandByRoleId = new Map((state.data.demandRoles || []).map((dr) => [dr.roleIdExternal, dr]));
    const rows = (state.data.projectRoles || []).map((r) => {
      const dr = demandByRoleId.get(r.roleNumber) || {};
      return {
        Id: r.id,
        RoleNumber: r.roleNumber,
        RoleTitle: dr.roleTitle || "",
        Client: dr.client || "",
        RoleStatus: dr.roleStatus || ""
      };
    });

    try {
      await window.staffingExcel.exportSheet("staffing_project_roles.xlsx", "ProjectRoles", rows);
      toast("Roles de Projeto exportadas para Excel.");
    } catch (error) {
      toast("Nao foi possivel exportar Roles de Projeto.");
      console.error(error);
    }
  }

  async function importProjectRolesFromExcel(file) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      const rows = await window.staffingExcel.readFirstSheet(file);
      const result = parseProjectRoleImportRows(rows);

      if (result.errors.length) {
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Roles de Projeto", result.errors);
        return;
      }

      const confirmed = window.confirm(
        `Importar Roles de Projeto?\n\nNovos: ${result.created}\nAtualizados: ${result.updated}\n\nA importacao nao apaga registros.`
      );
      if (!confirmed) return;

      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveProjectRoles(result.projectRoles);
      } else {
        result.projectRoles.forEach((projectRole) => {
          state.data.projectRoles = state.data.projectRoles || [];
          const index = state.data.projectRoles.findIndex((item) => item.id === projectRole.id);
          if (index >= 0) state.data.projectRoles[index] = projectRole;
          else state.data.projectRoles.push(projectRole);
        });
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Roles de Projeto importadas: ${result.created} nova(s), ${result.updated} atualizada(s).`);
    } catch (error) {
      toast("Nao foi possivel importar Roles de Projeto.");
      console.error(error);
    }
  }

  function parseProjectRoleImportRows(rows) {
    const errors = [];
    const projectRoles = [];
    let created = 0;
    let updated = 0;
    const existingById = new Map((state.data.projectRoles || []).map((r) => [r.id, r]));
    const existingByRoleNumber = new Map((state.data.projectRoles || []).map((r) => [r.roleNumber, r.id]));
    const seenIds = new Set();
    const seenRoleNumbers = new Set();

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const id = cleanCell(row.id);
      const roleNumber = cleanCell(row.rolenumber);

      if (id && !existingById.has(id)) errors.push(`Linha ${rowNumber}: Id informado nao existe no banco.`);
      if (id && seenIds.has(id)) errors.push(`Linha ${rowNumber}: Id duplicado no arquivo.`);
      if (!roleNumber) errors.push(`Linha ${rowNumber}: RoleNumber e obrigatorio.`);

      const finalId = id || createId();
      const existingRoleId = existingByRoleNumber.get(roleNumber);
      if (existingRoleId && existingRoleId !== finalId) errors.push(`Linha ${rowNumber}: RoleNumber ${roleNumber} ja existe no pool.`);
      if (seenRoleNumbers.has(roleNumber)) errors.push(`Linha ${rowNumber}: RoleNumber ${roleNumber} duplicado no arquivo.`);

      seenIds.add(finalId);
      seenRoleNumbers.add(roleNumber);
      projectRoles.push({ id: finalId, roleNumber });

      if (id) updated += 1;
      else created += 1;
    });

    return { projectRoles, errors, created, updated };
  }

  async function importPeopleFromExcel(file, onProgress = () => {}) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      onProgress("Lendo arquivo...");
      await yieldToUI();
      const rows = await window.staffingExcel.readFirstTabularSheet(file);

      if (!rows.length) {
        toast("O arquivo foi lido mas nao contém linhas de dados. Verifique se a aba correta contém o relatorio de pessoas.");
        return;
      }

      onProgress(`Processando ${rows.length} linha(s)...`);
      await yieldToUI();
      const result = parsePeopleImportRows(rows);

      if (result.errors.length) {
        await recordImportBatch({
          source: "PEOPLE",
          fileName: file.name,
          rowCount: rows.length,
          successCount: 0,
          errorCount: rejectedRowCount(result.errors),
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          notes: `Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`
        });
        state.dbMode = "dirty";
        updateDbStatus("Banco alterado nao salvo");
        render();
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Pessoas", result.errors);
        return;
      }

      onProgress("Salvando no banco de dados...");
      await yieldToUI();
      if (window.staffingDatabase) {
        if (result.skills.length) state.data = await window.staffingDatabase.saveSkills(result.skills);
        state.data = await window.staffingDatabase.saveImportedPeople(result.people);
      } else {
        state.data = {
          ...state.data,
          skills: mergeById(state.data.skills, result.skills),
          importedPeople: mergeById(state.data.importedPeople, result.people)
        };
      }
      await recordImportBatch({
        source: "PEOPLE",
        fileName: file.name,
        rowCount: rows.length,
        successCount: result.people.length,
        errorCount: 0,
        createdCount: result.created,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        notes: `Skills novas: ${result.skillsCreated}.${result.skipped ? ` Ignoradas (sem chave ou duplicadas): ${result.skipped}.` : ""}`
      });

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      const skippedNote = result.skipped ? ` Ignoradas: ${result.skipped}.` : "";
      toast(`Pessoas importadas: ${result.created} nova(s), ${result.updated} atualizada(s). Skills novas: ${result.skillsCreated}.${skippedNote}`);
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      toast(`Nao foi possivel importar Pessoas: ${msg}`);
      console.error(error);
    }
  }

  function parsePeopleImportRows(rows) {
    const errors = [];
    const people = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const existingByPersonnel = new Map(state.data.importedPeople.filter((p) => p.personnelNumber).map((p) => [p.personnelNumber, p]));
    const existingByCorporateId = new Map(state.data.importedPeople.filter((p) => p.corporateId).map((p) => [p.corporateId.toLowerCase(), p]));
    const existingByEmail = new Map(state.data.importedPeople.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));
    const skillsByName = new Map(state.data.skills.map((skill) => [skill.name.toLowerCase(), skill]));
    const seenKeys = new Set();
    const importedSkills = new Map();

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const name = cleanCell(row.resourcename);
      const email = cleanCell(row.resourceemail);
      const corporateId = corporateIdFromEmail(email);
      const personnelNumber = cleanCell(row.personnelnum);
      const skillsText = cleanCell(row.skills);
      const key = personnelNumber || corporateId || email.toLowerCase();
      const existing = personnelNumber
        ? existingByPersonnel.get(personnelNumber)
        : (corporateId ? existingByCorporateId.get(corporateId) : existingByEmail.get(email.toLowerCase()));

      if (!key) { skipped += 1; return; }
      if (seenKeys.has(key)) { skipped += 1; return; }
      seenKeys.add(key);
      if (!name) errors.push(`Linha ${rowNumber}: Resource Name e obrigatorio.`);

      people.push({
        id: existing ? existing.id : createId(),
        name,
        email,
        corporateId,
        personnelNumber,
        marketUnit: cleanCell(row.marketunit),
        country: cleanCell(row.country),
        metroCity: cleanCell(row.metrocity),
        locationPath: cleanCell(row.locationpath),
        jobFamilyGroup: cleanCell(row.resourcejobfamilygroup),
        roleFamily: cleanCell(row.resourcerolefamily),
        resourceRole: cleanCell(row.resourcerole),
        levelGroup: cleanCell(row.resourcelevelgroup),
        resourceLevel: cleanCell(row.resourcelevel),
        specialization1: cleanCell(row.resourcespecialization1),
        specialization2: cleanCell(row.resourcespecialization2),
        specialization3: cleanCell(row.resourcespecialization3),
        specialization4: cleanCell(row.resourcespecialization4),
        deployedToEntity: cleanCell(row.resourcedeployedtoentity),
        firstStaffableDate: normalizeDateCell(row.firststaffabledate),
        percentStaffable: cleanCell(row.percentstaffable),
        currentCalendarType: cleanCell(row.currentcalendartype),
        currentCalendarStartDate: normalizeDateCell(row.currentcalendarstartdate),
        currentCalendarEndDate: normalizeDateCell(row.currentcalendarenddate),
        currentCalendarClient: cleanCell(row.currentcalendarclient),
        currentCalendarProject: cleanCell(row.currentcalendarproject),
        skillsText,
        certifications: cleanCell(row.certifications),
        languages: cleanCell(row.languages),
        cvLink: rowValue(row, ["Link to CV", "CV Link", "CV URL", "CV", "Curriculum Vitae", "cvlink", "linktocv"]),
        active: true
      });

      parseImportedSkills(skillsText).forEach((skill) => {
        const normalizedName = skill.name.toLowerCase();
        if (!skillsByName.has(normalizedName) && !importedSkills.has(normalizedName)) {
          importedSkills.set(normalizedName, {
            id: createId(),
            name: skill.name,
            active: true
          });
        }
      });

      if (existing) updated += 1;
      else created += 1;
    });

    const skills = Array.from(importedSkills.values());
    return { people, skills, errors, created, updated, skipped, skillsCreated: skills.length };
  }

  async function importAllocationCalendarsFromExcel(file, onProgress = () => {}) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      onProgress("Lendo arquivo...");
      await yieldToUI();
      const rows = await window.staffingExcel.readFirstTabularSheet(file);

      if (!rows.length) {
        toast("O arquivo foi lido mas nao contém linhas de dados. Verifique se a aba correta contém o calendario.");
        return;
      }

      onProgress(`Processando ${rows.length} linha(s)...`);
      await yieldToUI();
      const result = parseAllocationCalendarImportRows(rows);

      if (result.errors.length) {
        await recordImportBatch({
          source: "CALENDAR",
          fileName: file.name,
          rowCount: rows.length,
          successCount: 0,
          errorCount: rejectedRowCount(result.errors),
          createdCount: 0,
          updatedCount: 0,
          skippedCount: result.skipped,
          notes: `Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`
        });
        state.dbMode = "dirty";
        updateDbStatus("Banco alterado nao salvo");
        render();
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Calendarios", result.errors);
        return;
      }

      onProgress("Salvando no banco de dados...");
      await yieldToUI();
      const existingCalendarIds = new Set((state.data.allocationCalendars || []).map((item) => item.id));
      const createdCount = result.calendars.filter((item) => !existingCalendarIds.has(item.id)).length;
      const updatedCount = result.calendars.length - createdCount;
      state.data = window.staffingDatabase
        ? await window.staffingDatabase.saveAllocationCalendars(result.calendars)
        : { ...state.data, allocationCalendars: mergeById(state.data.allocationCalendars, result.calendars) };
      await recordImportBatch({
        source: "CALENDAR",
        fileName: file.name,
        rowCount: rows.length,
        successCount: result.calendars.length,
        errorCount: 0,
        createdCount,
        updatedCount,
        skippedCount: result.skipped,
        notes: result.skipped ? `${result.skipped} linha(s) ignorada(s) por duplicidade ou ausencia de periodo.` : "Importacao concluida."
      });

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Calendarios importados: ${result.calendars.length} registro(s). Ignorados: ${result.skipped}.`);
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      toast(`Nao foi possivel importar Calendarios: ${msg}`);
      console.error(error);
    }
  }

  function parseAllocationCalendarImportRows(rows) {
    const errors = [];
    const calendars = [];
    const peopleByPersonnel = new Map(state.data.importedPeople.filter((p) => p.personnelNumber).map((p) => [p.personnelNumber, p]));
    const seen = new Set();
    let skipped = 0;

    rows.forEach((rawRow, index) => {
      const rowNumber = index + 2;
      const row = normalizeRow(rawRow);
      const employeeName = rowValue(row, ["employeename", "resourcename", "name"]);
      const personnelNumber = rowValue(row, ["employeepersonnelnumber", "personnelnumber", "personnelnum"]);
      const calendarStartDate = normalizeDateCell(rowValue(row, ["calendarstartdate", "startdate"]));
      const calendarEndDate = normalizeDateCell(rowValue(row, ["calendarenddate", "enddate"]));
      const roleIdExternal = rowValue(row, ["roleid", "roleidexternal"]);
      const projectName = rowValue(row, ["project", "projectname", "currentcalendarproject"]);
      const person = peopleByPersonnel.get(personnelNumber);
      const id = stableId([
        "CAL",
        personnelNumber,
        calendarStartDate,
        calendarEndDate,
        rowValue(row, ["calendartype", "currentcalendartype"]),
        projectName,
        roleIdExternal,
        rowValue(row, ["commondemandid"]),
        rowValue(row, ["calendardescription"]),
        rowValue(row, ["calendarentrycomments", "calendarcomments"]),
        rowValue(row, ["candidatestatus"])
      ]);

      if (!personnelNumber) {
        skipped += 1;
        return;
      }
      if (!employeeName) errors.push(`Linha ${rowNumber}: Employee Name e obrigatorio.`);

      if (!calendarStartDate && !calendarEndDate) {
        skipped += 1;
        return;
      }

      if (!calendarStartDate) errors.push(`Linha ${rowNumber}: Calendar Start Date invalido ou vazio.`);
      if (!calendarEndDate) errors.push(`Linha ${rowNumber}: Calendar End Date invalido ou vazio.`);
      if (calendarStartDate && calendarEndDate && calendarStartDate > calendarEndDate) errors.push(`Linha ${rowNumber}: Calendar Start Date nao pode ser maior que Calendar End Date.`);
      if (seen.has(id)) {
        skipped += 1;
        return;
      }
      seen.add(id);

      calendars.push({
        id,
        importedPersonId: person ? person.id : null,
        employeeName,
        enterpriseId: rowValue(row, ["employeeenterpriseid", "enterpriseid", "eid"]),
        personnelNumber,
        staffableDetail: rowValue(row, ["staffabledetail"]),
        staffableCapacity: rowValue(row, ["staffablecapacity"]),
        percentStaffable: rowValue(row, ["percentstaffable", "staffable"]),
        calendarType: rowValue(row, ["calendartype", "currentcalendartype"]),
        calendarDescription: rowValue(row, ["calendardescription"]),
        calendarChargeable: rowValue(row, ["calendarchargeable"]),
        calendarComments: rowValue(row, ["calendarentrycomments", "calendarcomments"]),
        calendarStartDate,
        calendarEndDate,
        percentAllocated: rowValue(row, ["percentallocated"]),
        client: rowValue(row, ["client", "currentcalendarclient"]),
        projectIdExternal: rowValue(row, ["projectid", "projectidexternal"]),
        commonProjectId: rowValue(row, ["commonprojectid"]),
        projectName,
        roleIdExternal,
        roleTitle: rowValue(row, ["roletitle"]),
        roleDescription: rowValue(row, ["roledescription"]),
        roleRequestedStartDate: normalizeDateCell(rowValue(row, ["rolerequestedstartdate"])),
        roleEndDate: normalizeDateCell(rowValue(row, ["roleenddate"])),
        candidateStatus: rowValue(row, ["candidatestatus"]),
        candidateStatusUpdateDate: normalizeDateCell(rowValue(row, ["candidatestatusupdatedate"])),
        rolloffConfirmed: rowValue(row, ["rolloffconfirmed"]),
        rolloffConfirmationDate: normalizeDateCell(rowValue(row, ["rolloffconfirmationdate"])),
        lastCalendarUpdateDate: normalizeDateCell(rowValue(row, ["lastcalendarupdatedate"])),
        source: "IMPORT"
      });
    });

    return { calendars, errors, skipped };
  }

  async function importDemandRolesFromExcel(file, onProgress = () => {}) {
    if (!window.staffingExcel) {
      toast("Importacao Excel nao esta disponivel.");
      return;
    }

    try {
      onProgress("Lendo arquivo...");
      await yieldToUI();
      const rows = await window.staffingExcel.readFirstTabularSheet(file);

      if (!rows.length) {
        toast("O arquivo foi lido mas nao contém linhas de dados. Verifique se a aba correta contém as roles.");
        return;
      }

      onProgress(`Processando ${rows.length} linha(s)...`);
      await yieldToUI();
      const result = parseDemandRoleImportRows(rows);

      if (result.errors.length) {
        await recordImportBatch({
          source: "DEMAND_ROLES",
          fileName: file.name,
          rowCount: rows.length,
          successCount: 0,
          errorCount: rejectedRowCount(result.errors),
          createdCount: 0,
          updatedCount: 0,
          skippedCount: result.skipped,
          notes: `Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`
        });
        state.dbMode = "dirty";
        updateDbStatus("Banco alterado nao salvo");
        render();
        toast(`Importacao bloqueada: ${result.errors.length} erro(s) encontrados.`);
        showImportErrors("Roles (Demanda)", result.errors);
        return;
      }

      onProgress("Salvando no banco de dados...");
      await yieldToUI();
      const existingDemandRoleIds = new Set((state.data.demandRoles || []).map((item) => item.id));
      const createdCount = result.demandRoles.filter((item) => !existingDemandRoleIds.has(item.id)).length;
      const updatedCount = result.demandRoles.length - createdCount;
      state.data = window.staffingDatabase
        ? await window.staffingDatabase.saveDemandRoles(result.demandRoles)
        : { ...state.data, demandRoles: mergeById(state.data.demandRoles || [], result.demandRoles) };
      await recordImportBatch({
        source: "DEMAND_ROLES",
        fileName: file.name,
        rowCount: rows.length,
        successCount: result.demandRoles.length,
        errorCount: 0,
        createdCount,
        updatedCount,
        skippedCount: result.skipped,
        notes: result.skipped ? `${result.skipped} linha(s) ignorada(s) por duplicidade ou ausencia de Role ID.` : "Importacao concluida."
      });

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      render();
      toast(`Roles de demanda importadas: ${result.demandRoles.length} registro(s). Ignorados: ${result.skipped}.`);
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      toast(`Nao foi possivel importar Roles (Demanda): ${msg}`);
      console.error(error);
    }
  }

  function parseDemandRoleImportRows(rows) {
    const errors = [];
    const demandRoles = [];
    const seen = new Set();
    let skipped = 0;

    rows.forEach((rawRow) => {
      const row = normalizeRow(rawRow);
      const roleIdExternal = rowValue(row, ["roleid"]);

      if (!roleIdExternal) {
        skipped += 1;
        return;
      }

      const id = stableId(["DEMANDROLE", roleIdExternal]);
      if (seen.has(id)) {
        skipped += 1;
        return;
      }
      seen.add(id);

      demandRoles.push({
        id,
        roleIdExternal,
        roleTitle: rowValue(row, ["roletitle"]),
        roleStatus: rowValue(row, ["rolestatus"]),
        client: rowValue(row, ["client"]),
        projectName: rowValue(row, ["project"]),
        startDate: normalizeDateCell(rowValue(row, ["rolestartdate"])),
        endDate: normalizeDateCell(rowValue(row, ["roleenddate"])),
        fulfillmentChannel: rowValue(row, ["rolefulfillmentchannel"]),
        candidatesIdentifiedSelf: rowValue(row, ["candidatesidentifiedself"]),
        candidatesIdentified: rowValue(row, ["candidatesidentified"]),
        candidatesProposed: rowValue(row, ["candidatesproposed"]),
        candidatesConfirming: rowValue(row, ["candidatesconfirming"]),
        candidatesFilled: rowValue(row, ["candidatesfilled"]),
        candidatesNotSelected: rowValue(row, ["candidatesnotselected"]),
        contractorName: rowValue(row, ["rolecontractorname"]),
        joinerName: rowValue(row, ["rolejoinername"]),
        internalSchedulingStatus: rowValue(row, ["roleinternalschedulingstatus"]),
        internalSchedulingCancellationReason: rowValue(row, ["roleinternalschedulingcancellationreason"]),
        contractorStatus: rowValue(row, ["rolecontractorstatus"]),
        contractorCancellationReason: rowValue(row, ["rolecontractorcancellationreason"]),
        recruitingStatus: rowValue(row, ["rolerecruitingstatus"]),
        recruitingCancellationReason: rowValue(row, ["rolerecruitingcancellationreason"]),
        cancellationReason: rowValue(row, ["rolecancellationreason"]),
        filledDate: normalizeDateCell(rowValue(row, ["rolefilleddate"])),
        assignmentAudit: rowValue(row, ["assignmentaudit"]),
        source: "IMPORT"
      });
    });

    return { demandRoles, errors, skipped };
  }

  async function recordImportBatch(batch) {
    const importBatch = {
      id: createId(),
      source: batch.source,
      fileName: batch.fileName || "",
      importedAt: new Date().toISOString(),
      rowCount: batch.rowCount || 0,
      successCount: batch.successCount || 0,
      errorCount: batch.errorCount || 0,
      createdCount: batch.createdCount || 0,
      updatedCount: batch.updatedCount || 0,
      skippedCount: batch.skippedCount || 0,
      notes: batch.notes || ""
    };

    if (window.staffingDatabase) {
      state.data = await window.staffingDatabase.saveImportBatch(importBatch);
    } else {
      state.data = {
        ...state.data,
        importBatches: [importBatch, ...(state.data.importBatches || [])]
      };
    }
  }

  function rejectedRowCount(errors) {
    const rows = new Set();
    errors.forEach((error) => {
      const match = String(error).match(/Linha\s+(\d+)/i);
      if (match) rows.add(match[1]);
    });
    return rows.size || errors.length;
  }

  function importSourceLabel(source) {
    return {
      PEOPLE: "Pessoas",
      CALENDAR: "Calendarios",
      DEMAND_ROLES: "Roles (Demanda)"
    }[source] || source;
  }

  function openSkillForm(skill) {
    const isEditing = Boolean(skill);
    const values = skill || {
      id: createId(),
      name: "",
      active: true
    };

    openModal(`
      <form class="modal-card" id="skillForm">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Skill</span>
            <h2>${isEditing ? "Editar skill" : "Nova skill"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <div class="form-grid">
          <input name="id" type="hidden" value="${escapeAttr(values.id)}">

          <label class="span-2">
            <span>Nome</span>
            <input name="name" value="${escapeAttr(values.name)}" required maxlength="100">
          </label>

          <label class="checkbox-field span-2">
            <input name="active" type="checkbox" ${values.active ? "checked" : ""}>
            <span>Skill ativa</span>
          </label>
        </div>

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    `);

    document.querySelector("#skillForm").addEventListener("submit", saveSkillFromForm);
  }

  async function saveSkillFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const skill = {
      id: String(formData.get("id")).trim(),
      name: String(formData.get("name")).trim(),
      active: formData.get("active") === "on"
    };

    if (!skill.name) {
      toast("Informe o nome da skill.");
      return;
    }

    const duplicate = state.data.skills.find((item) => {
      return item.id !== skill.id && item.name.toLowerCase() === skill.name.toLowerCase();
    });

    if (duplicate) {
      toast("Ja existe uma skill com esse nome.");
      return;
    }

    try {
      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveSkill(skill);
      } else {
        const index = state.data.skills.findIndex((item) => item.id === skill.id);
        if (index >= 0) state.data.skills[index] = skill;
        else state.data.skills.push(skill);
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      closeModal();
      render();
      toast("Skill salva. Use Salvar banco para exportar o staffing.db.");
    } catch (error) {
      toast("Nao foi possivel salvar a skill.");
      console.error(error);
    }
  }

  function openCompanyForm(company) {
    const isEditing = Boolean(company);
    const values = company || {
      id: createId(),
      name: "",
      kind: "OTHER",
      active: true
    };

    openModal(`
      <form class="modal-card" id="companyForm">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Empresa</span>
            <h2>${isEditing ? "Editar empresa" : "Nova empresa"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <div class="form-grid">
          <input name="id" type="hidden" value="${escapeAttr(values.id)}">

          <label class="span-2">
            <span>Nome</span>
            <input name="name" value="${escapeAttr(values.name)}" required maxlength="140">
          </label>

          <label class="span-2">
            <span>Tipo</span>
            <select name="kind" required>
              ${["CONSULTING", "CLIENT", "PARTNER", "VENDOR", "OTHER"].map((kind) => `
                <option value="${kind}" ${values.kind === kind ? "selected" : ""}>${companyKindLabel(kind)}</option>
              `).join("")}
            </select>
          </label>

          <label class="checkbox-field span-2">
            <input name="active" type="checkbox" ${values.active ? "checked" : ""}>
            <span>Empresa ativa</span>
          </label>
        </div>

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    `);

    document.querySelector("#companyForm").addEventListener("submit", saveCompanyFromForm);
  }

  async function saveCompanyFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const company = {
      id: String(formData.get("id")).trim(),
      name: String(formData.get("name")).trim(),
      kind: String(formData.get("kind")),
      active: formData.get("active") === "on"
    };

    if (!company.name) {
      toast("Informe o nome da empresa.");
      return;
    }

    const duplicate = (state.data.companies || []).find((item) => {
      return item.id !== company.id && item.name.toLowerCase() === company.name.toLowerCase();
    });

    if (duplicate) {
      toast("Ja existe uma empresa com esse nome.");
      return;
    }

    try {
      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveCompany(company);
      } else {
        const index = state.data.companies.findIndex((item) => item.id === company.id);
        if (index >= 0) state.data.companies[index] = company;
        else state.data.companies.push(company);
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      closeModal();
      render();
      toast("Empresa salva. Use Salvar banco para exportar o staffing.db.");
    } catch (error) {
      toast("Nao foi possivel salvar a empresa.");
      console.error(error);
    }
  }

  function openCandidateForm(candidate) {
    const isEditing = Boolean(candidate);
    const candidateCalendars = candidate
      ? calendarsForCandidate(candidate).sort((a, b) => cleanCell(a.calendarStartDate).localeCompare(cleanCell(b.calendarStartDate)))
      : [];
    const values = candidate || {
      id: createId(),
      importedPersonId: "",
      companyId: "",
      externalPersonId: "",
      name: "",
      email: "",
      ucrAmount: 0,
      lcrAmount: 0,
      costCurrency: "BRL",
      costPeriod: "MONTH",
      active: true,
      skills: []
    };

    const initialSkillEntries = skillEntriesFromValues(values);

    openModal(`
      <form class="modal-card" id="candidateForm">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Candidato</span>
            <h2>${isEditing ? "Editar candidato" : "Novo candidato"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <input name="id" type="hidden" value="${escapeAttr(values.id)}">
        <input name="importedPersonId" type="hidden" value="${escapeAttr(values.importedPersonId || "")}">

        <div class="form-sections">
          <details class="collapsible-section" open>
            <summary><span>Identificacao</span></summary>
            <div class="form-grid">
              <label class="span-2">
                <span>Nome</span>
                <input name="name" value="${escapeAttr(values.name)}" required maxlength="140">
              </label>

              <label>
                <span>Email</span>
                <input name="email" type="email" value="${escapeAttr(values.email || "")}" maxlength="160">
              </label>

              <label>
                <span>ID corporativo</span>
                <input name="externalPersonId" value="${escapeAttr(values.externalPersonId || "")}" maxlength="80">
              </label>

              <label class="span-2">
                <span>Empresa</span>
                <select name="companyId">
                  <option value="">Selecione uma empresa</option>
                  ${(state.data.companies || []).map((company) => `
                    <option value="${escapeAttr(company.id)}" ${values.companyId === company.id ? "selected" : ""}>${escapeHtml(company.name)}</option>
                  `).join("")}
                </select>
              </label>

              <label class="checkbox-field span-2">
                <input name="active" type="checkbox" ${values.active ? "checked" : ""}>
                <span>Candidato ativo</span>
              </label>
            </div>
          </details>

          <details class="collapsible-section">
            <summary>
              <span>Custo</span>
              <small>${values.ucrAmount || values.lcrAmount ? `UCR ${escapeHtml(String(values.ucrAmount))} · LCR ${escapeHtml(String(values.lcrAmount))} ${escapeHtml(values.costCurrency)} / ${escapeHtml(periodLabel(values.costPeriod))}` : "Nao definido"}</small>
            </summary>
            <div class="form-grid">
              <label>
                <span>UCR (Unloaded Cost Rate)</span>
                <input name="ucrAmount" type="number" min="0" step="0.01" value="${escapeAttr(values.ucrAmount)}">
              </label>

              <label>
                <span>LCR (Loaded Cost Rate)</span>
                <input name="lcrAmount" type="number" min="0" step="0.01" value="${escapeAttr(values.lcrAmount)}">
              </label>

              <label>
                <span>Moeda</span>
                <select name="costCurrency">
                  ${["BRL", "USD", "EUR", "GBP"].map((currency) => `
                    <option value="${currency}" ${values.costCurrency === currency ? "selected" : ""}>${currency}</option>
                  `).join("")}
                </select>
              </label>

              <label>
                <span>Periodo</span>
                <select name="costPeriod">
                  ${["HOUR", "DAY", "MONTH"].map((period) => `
                    <option value="${period}" ${values.costPeriod === period ? "selected" : ""}>${periodLabel(period)}</option>
                  `).join("")}
                </select>
              </label>
            </div>
          </details>

          <details class="collapsible-section">
            <summary>
              <span>Skills</span>
              <small data-candidate-skills-summary>${initialSkillEntries.length ? `${initialSkillEntries.length} skill(s)` : "Nenhuma skill"}</small>
            </summary>
            <div class="skill-picker skill-picker--search">
              <input name="candidateSkillLookup" list="candidateFormSkillSuggestions" placeholder="Nome da skill" autocomplete="off">
              <datalist id="candidateFormSkillSuggestions">
                ${state.data.skills.map((skill) => `<option value="${escapeAttr(skill.name)}"></option>`).join("")}
              </datalist>
              <select name="candidateSkillLevel">
                <option value=""></option>
                ${skillLevelOptions().map((level) => {
                  const code = level.split("-")[0].trim();
                  return `<option value="${escapeAttr(level)}">${escapeHtml(code)}</option>`;
                }).join("")}
              </select>
              <button class="ghost-button skill-add-btn" type="button" data-candidate-form-skill-add>+</button>
            </div>
            <div class="skill-scroll">
              <div class="selected-skill-filters candidate-form-skills" data-candidate-form-skills></div>
            </div>
            <div class="skill-filter-legend" data-candidate-form-skill-legend></div>
          </details>

          <details class="collapsible-section">
            <summary>
              <span>Calendario</span>
              <small>${candidateCalendars.length ? `${candidateCalendars.length} evento(s)` : "Sem eventos"}</small>
            </summary>
            ${candidateCalendars.length ? allocationTimeline(candidateCalendars) : ""}
          </details>
        </div>

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    `);

    const form = document.querySelector("#candidateForm");
    form.dataset.selectedSkills = JSON.stringify(skillEntriesFromValues(values));
    renderCandidateFormSkills(form);
    form.addEventListener("submit", saveCandidateFromForm);
    form.querySelector("[data-candidate-form-skill-add]").addEventListener("click", () => addCandidateFormSkill(form));
    form.addEventListener("click", (event) => {
      const zoomButton = event.target.closest("[data-timeline-zoom]");
      if (zoomButton) {
        setTimelineZoom(zoomButton.closest("[data-allocation-timeline]"), zoomButton.dataset.timelineZoom);
        return;
      }
      const removeButton = event.target.closest("[data-remove-candidate-form-skill]");
      if (removeButton) removeCandidateFormSkill(form, removeButton.dataset.removeCandidateFormSkill);
    });
    form.addEventListener("mouseover", (event) => {
      const bar = event.target.closest("[data-bar-info]");
      if (!bar) return;
      const timeline = bar.closest("[data-allocation-timeline]");
      if (!timeline) return;
      const detail = timeline.querySelector("[data-timeline-detail]");
      if (!detail) return;
      detail.innerHTML = renderTimelineBarDetail(JSON.parse(bar.dataset.barInfo));
    });
    form.addEventListener("mouseout", (event) => {
      const timeline = event.target.closest("[data-allocation-timeline]");
      if (!timeline || timeline.contains(event.relatedTarget)) return;
      const detail = timeline.querySelector("[data-timeline-detail]");
      if (detail) detail.innerHTML = "<span class=\"timeline-detail-placeholder\">Passe o mouse sobre uma barra para ver os detalhes.</span>";
    });
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("[name='candidateSkillLookup']")) {
        event.preventDefault();
        addCandidateFormSkill(form);
      }
    });
  }

  function addCandidateFormSkill(form) {
    const lookup = form.querySelector("[name='candidateSkillLookup']");
    const levelSelect = form.querySelector("[name='candidateSkillLevel']");
    const skillName = cleanCell(lookup.value);
    if (!skillName) {
      toast("Digite uma skill para adicionar.");
      return;
    }

    const skill = state.data.skills.find((item) => item.name.toLowerCase() === skillName.toLowerCase())
      || state.data.skills.find((item) => item.name.toLowerCase().includes(skillName.toLowerCase()));

    if (!skill) {
      toast("Skill nao encontrada no catalogo.");
      return;
    }

    const selectedSkills = selectedCandidateFormSkills(form);
    const level = cleanCell(levelSelect.value);
    const existing = selectedSkills.find((item) => item.id === skill.id);
    if (existing) existing.level = level;
    else selectedSkills.push({ id: skill.id, level });
    form.dataset.selectedSkills = JSON.stringify(selectedSkills);
    lookup.value = "";
    levelSelect.value = "";
    renderCandidateFormSkills(form);
  }

  function removeCandidateFormSkill(form, skillId) {
    form.dataset.selectedSkills = JSON.stringify(selectedCandidateFormSkills(form).filter((item) => item.id !== skillId));
    renderCandidateFormSkills(form);
  }

  function selectedCandidateFormSkills(form) {
    try {
      return normalizeSkillEntries(JSON.parse(form.dataset.selectedSkills || "[]"));
    } catch {
      return [];
    }
  }

  function renderCandidateFormSkills(form) {
    const entries = selectedCandidateFormSkills(form);
    form.querySelector("[data-candidate-form-skills]").innerHTML = candidateFormSkillPills(entries);
    const legendEl = form.querySelector("[data-candidate-form-skill-legend]");
    if (legendEl) legendEl.innerHTML = candidateFormSkillLegend(entries);
    const summaryEl = form.querySelector("[data-candidate-skills-summary]");
    if (summaryEl) summaryEl.textContent = entries.length ? `${entries.length} skill(s)` : "Nenhuma skill";
  }

  function candidateFormSkillPills(skillEntries) {
    const pills = normalizeSkillEntries(skillEntries)
      .map((entry) => ({ entry, skill: byId("skills", entry.id) }))
      .filter((item) => item.skill)
      .map(({ entry, skill }) => {
        const levelCode = entry.level ? entry.level.split("-")[0].trim() : "";
        const label = levelCode ? `${skill.name} (${levelCode})` : skill.name;
        return `
          <span class="filter-chip candidate-skill-chip">
            ${escapeHtml(label)}
            <button type="button" data-remove-candidate-form-skill="${escapeAttr(skill.id)}" title="Remover skill">×</button>
            <input name="skills" type="hidden" value="${escapeAttr(skill.id)}">
            <input name="skillLevel:${escapeAttr(skill.id)}" type="hidden" value="${escapeAttr(entry.level || "")}">
          </span>
        `;
      }).join("");

    return pills || "<span class=\"muted\">Nenhuma skill selecionada.</span>";
  }

  function candidateFormSkillLegend(skillEntries) {
    const seen = new Map();
    normalizeSkillEntries(skillEntries).forEach((entry) => {
      if (!entry.level) return;
      const code = entry.level.split("-")[0].trim();
      const desc = entry.level.replace(/^[^-]+-\s*/, "").trim();
      if (code && !seen.has(code)) seen.set(code, desc);
    });
    if (!seen.size) return "";
    return [...seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, desc]) => `<span><strong>${escapeHtml(code)}</strong> ${escapeHtml(desc)}</span>`)
      .join("");
  }

  function skillEntriesFromValues(values) {
    return normalizeSkillEntries(values.skills || []).map((entry) => ({
      id: entry.id,
      level: entry.level || (values.skillLevels ? values.skillLevels[entry.id] || "" : "")
    }));
  }

  function normalizeSkillEntries(value) {
    return (value || []).map((item) => {
      if (typeof item === "string") return { id: item, level: "" };
      return { id: item.id, level: cleanCell(item.level) };
    }).filter((item) => item.id);
  }

  function skillLevelOptions() {
    const levels = new Set(importedExperienceLevels());
    ["P1 - Beginner", "P2 - Intermediate", "P3 - Advanced", "P4 - Expert", "P5 - Master"].forEach((level) => levels.add(level));
    return Array.from(levels).sort((a, b) => {
      const aRank = Number((a.match(/^P(\d+)/) || [])[1] || 99);
      const bRank = Number((b.match(/^P(\d+)/) || [])[1] || 99);
      return aRank - bRank || a.localeCompare(b);
    });
  }

  function skillLevelsFromEntries(entries) {
    return Object.fromEntries(normalizeSkillEntries(entries)
      .filter((entry) => entry.level)
      .map((entry) => [entry.id, entry.level]));
  }

  async function saveCandidateFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const skillEntries = selectedCandidateFormSkills(form);
    const candidate = {
      id: String(formData.get("id")).trim(),
      importedPersonId: String(formData.get("importedPersonId")).trim(),
      companyId: String(formData.get("companyId")).trim(),
      externalPersonId: String(formData.get("externalPersonId")).trim(),
      name: String(formData.get("name")).trim(),
      email: String(formData.get("email")).trim(),
      ucrAmount: Number(formData.get("ucrAmount")),
      lcrAmount: Number(formData.get("lcrAmount")),
      costCurrency: String(formData.get("costCurrency")),
      costPeriod: String(formData.get("costPeriod")),
      active: formData.get("active") === "on",
      skills: skillEntries.map((entry) => entry.id),
      skillLevels: skillLevelsFromEntries(skillEntries)
    };

    if (!candidate.name) {
      toast("Informe o nome do candidato.");
      return;
    }

    if (!Number.isFinite(candidate.ucrAmount) || candidate.ucrAmount < 0) {
      toast("Informe um UCR valido.");
      return;
    }
    if (!Number.isFinite(candidate.lcrAmount) || candidate.lcrAmount < 0) {
      toast("Informe um LCR valido.");
      return;
    }

    const duplicateEmail = candidate.email && state.data.candidates.find((item) => {
      return item.id !== candidate.id && item.email && item.email.toLowerCase() === candidate.email.toLowerCase();
    });

    if (duplicateEmail) {
      toast("Ja existe um candidato com esse email.");
      return;
    }

    const duplicateExternalId = candidate.externalPersonId && state.data.candidates.find((item) => {
      return item.id !== candidate.id && item.externalPersonId === candidate.externalPersonId;
    });

    if (duplicateExternalId) {
      toast("Ja existe um candidato com esse ID corporativo.");
      return;
    }

    try {
      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveCandidate(candidate);
      } else {
        const index = state.data.candidates.findIndex((item) => item.id === candidate.id);
        if (index >= 0) state.data.candidates[index] = candidate;
        else state.data.candidates.push(candidate);
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      closeModal();
      render();
      toast("Candidato salvo. Use Salvar banco para exportar o staffing.db.");
    } catch (error) {
      toast("Nao foi possivel salvar o candidato.");
      console.error(error);
    }
  }

  function roleFormInfoPanel(dr) {
    if (!dr) return `
      <div class="role-form-no-match">
        <span>Numero nao encontrado na importacao de Demanda — role sera cadastrada manualmente.</span>
      </div>
    `;

    const meta = [];
    if (dr.client) meta.push({ label: "Cliente", value: dr.client });
    if (dr.projectName && dr.projectName !== dr.client) meta.push({ label: "Projeto", value: dr.projectName });
    if (dr.startDate || dr.endDate) {
      const start = dr.startDate ? formatDate(dr.startDate) : "?";
      const end = dr.endDate ? formatDate(dr.endDate) : "?";
      meta.push({ label: "Periodo", value: `${start} → ${end}` });
    }

    const pipelineCounters = [
      { label: "Identificado", value: dr.candidatesIdentified, cls: "identified" },
      { label: "Proposto", value: dr.candidatesProposed, cls: "proposed" },
      { label: "Confirmando", value: dr.candidatesConfirming, cls: "confirming" },
      { label: "Preenchido", value: dr.candidatesFilled, cls: "filled" },
    ].filter((c) => c.value && String(c.value) !== "0");

    const assignee = dr.joinerName || dr.contractorName;

    return `
      <div class="role-form-info-panel">
        <div class="role-form-info-head">
          <div class="role-form-info-identity">
            <code class="role-form-info-id">${escapeHtml(dr.roleIdExternal)}</code>
            ${dr.roleTitle ? `<span class="role-form-info-title">${escapeHtml(dr.roleTitle)}</span>` : ""}
          </div>
          ${dr.roleStatus ? statusPill(dr.roleStatus, dr.roleStatus) : ""}
        </div>
        ${meta.length ? `
          <div class="role-form-info-meta">
            ${meta.map((m) => `
              <div class="role-form-info-field">
                <span class="role-form-info-field-label">${escapeHtml(m.label)}</span>
                <span class="role-form-info-field-value">${escapeHtml(m.value)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${pipelineCounters.length ? `
          <div class="demand-role-pipeline">
            ${pipelineCounters.map((c) => `<span class="pipeline-chip pipeline-chip--${c.cls}">${escapeHtml(String(c.value))} ${escapeHtml(c.label)}</span>`).join("")}
          </div>
        ` : ""}
        ${assignee ? `<div class="role-form-info-assignee">${escapeHtml(assignee)}</div>` : ""}
      </div>
    `;
  }

  function openProjectRoleForm(prefill = {}) {
    const { prefillRole = null, existingRole = null } = prefill;
    const isEdit = Boolean(existingRole);
    const initialRoleNumber = existingRole ? existingRole.roleNumber : (prefillRole ? prefillRole.roleIdExternal : "");
    const initialActive = existingRole ? existingRole.active !== false : true;
    const initialDr = initialRoleNumber
      ? (state.data.demandRoles || []).find((r) => r.roleIdExternal === initialRoleNumber) || null
      : null;

    openModal(`
      <section class="modal-card role-form-modal">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Pool de Roles</span>
            <h2>${isEdit ? "Editar Role" : "Adicionar Role"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>
        <form id="projectRoleForm" class="modal-body" autocomplete="off">

          <div class="role-form-number-row">
            <div class="role-form-number-field">
              <label class="form-field-label" for="roleNumber">Numero da Role</label>
              <input id="roleNumber" class="form-input" name="roleNumber"
                value="${escapeAttr(initialRoleNumber)}"
                placeholder="Ex: 123456" required autocomplete="off" autofocus>
            </div>
            <button class="ghost-button" type="button" id="roleFormSearchBtn" style="align-self:flex-end">Procurar role</button>
          </div>

          <div id="roleInfoPanel">
            ${initialRoleNumber ? roleFormInfoPanel(initialDr) : ""}
          </div>

          <label class="checkbox-label role-form-active-toggle">
            <input type="checkbox" name="active" ${initialActive ? "checked" : ""}>
            Role ativa
          </label>

          <div class="modal-footer">
            <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
            <button class="primary-button" type="submit">Salvar</button>
          </div>
        </form>
      </section>
    `);

    const roleInput = document.getElementById("roleNumber");
    const roleInfoPanel = document.getElementById("roleInfoPanel");

    function updateRoleInfo(roleIdExternal) {
      if (!roleIdExternal) { roleInfoPanel.innerHTML = ""; return; }
      const dr = (state.data.demandRoles || []).find((r) => r.roleIdExternal === roleIdExternal) || null;
      roleInfoPanel.innerHTML = roleFormInfoPanel(dr);
    }

    roleInput.addEventListener("input", () => updateRoleInfo(roleInput.value.trim()));

    document.getElementById("roleFormSearchBtn").addEventListener("click", () => {
      const currentRoleNumber = roleInput.value.trim();
      openDemandRoleSearchModal((dr) => openProjectRoleForm({
        prefillRole: dr,
        existingRole: existingRole,
      }));
    });

    document.getElementById("projectRoleForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const roleNumber = String(formData.get("roleNumber") || "").trim();
      if (!roleNumber) return;
      const active = formData.has("active");
      const projectRole = { id: existingRole ? existingRole.id : createId(), roleNumber, active };
      try {
        if (window.staffingDatabase) {
          state.data = await window.staffingDatabase.saveProjectRole(projectRole);
        } else {
          state.data.projectRoles = state.data.projectRoles || [];
          const idx = state.data.projectRoles.findIndex((r) => r.id === projectRole.id);
          if (idx >= 0) state.data.projectRoles[idx] = projectRole;
          else state.data.projectRoles.push(projectRole);
        }
        state.dbMode = "dirty";
        updateDbStatus("Banco alterado nao salvo");
        closeModal();
        render();
        toast(isEdit ? "Role atualizada." : "Role adicionada ao pool.");
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        toast(`Nao foi possivel salvar a role: ${msg}`);
        console.error(err);
      }
    });
  }

  function demandRoleCardBody(dr) {
    const meta = [];
    if (dr.client) meta.push(escapeHtml(dr.client));
    if (dr.projectName && dr.projectName !== dr.client) meta.push(escapeHtml(dr.projectName));
    if (dr.startDate || dr.endDate) {
      const start = dr.startDate ? formatDate(dr.startDate) : "?";
      const end = dr.endDate ? formatDate(dr.endDate) : "?";
      meta.push(`${start} → ${end}`);
    }

    const pipelineCounters = [
      { label: "Identificado", value: dr.candidatesIdentified, cls: "identified" },
      { label: "Proposto", value: dr.candidatesProposed, cls: "proposed" },
      { label: "Confirmando", value: dr.candidatesConfirming, cls: "confirming" },
      { label: "Preenchido", value: dr.candidatesFilled, cls: "filled" },
    ].filter((c) => c.value && String(c.value) !== "0");

    const assignee = dr.joinerName || dr.contractorName;

    return `
      <div class="demand-role-card-head">
        <div class="demand-role-card-identity">
          <strong>${escapeHtml(dr.roleIdExternal)}</strong>
          ${dr.roleTitle ? `<span class="demand-role-title">${escapeHtml(dr.roleTitle)}</span>` : ""}
        </div>
        ${dr.roleStatus ? `<div class="demand-role-status">${statusPill(dr.roleStatus, dr.roleStatus)}</div>` : ""}
      </div>
      ${meta.length ? `<div class="demand-role-meta">${meta.join(" · ")}</div>` : ""}
      ${pipelineCounters.length ? `
        <div class="demand-role-pipeline">
          ${pipelineCounters.map((c) => `<span class="pipeline-chip pipeline-chip--${c.cls}">${escapeHtml(String(c.value))} ${escapeHtml(c.label)}</span>`).join("")}
        </div>
      ` : ""}
      ${assignee ? `<div class="demand-role-assignee">${escapeHtml(assignee)}</div>` : ""}
    `;
  }

  function demandRolePreviewHtml(dr) {
    return `<div class="demand-role-card">${demandRoleCardBody(dr)}</div>`;
  }

  function openDemandRoleSearchModal(onSelect) {
    openModal(`
      <section class="modal-card wide-modal" id="demandRoleSearchModal">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Roles de Demanda</span>
            <h2>Procurar role</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>
        <div class="candidate-search-layout">
          <aside class="candidate-search-filters">
            <div class="search-section">
              <p class="search-section-label">Identificacao</p>
              <input class="filter-input" name="roleId" placeholder="Numero da role" autocomplete="off" aria-label="Numero da role">
              <input class="filter-input" name="roleTitle" placeholder="Titulo" autocomplete="off" aria-label="Titulo">
              <input class="filter-input" name="roleClient" placeholder="Cliente" autocomplete="off" aria-label="Cliente">
              <input class="filter-input" name="roleStatus" placeholder="Status" autocomplete="off" aria-label="Status">
            </div>
            <div class="modal-actions search-actions">
              <button class="ghost-button" type="button" data-role-search-clear>Limpar</button>
              <button class="primary-button" type="button" data-role-search-run>Pesquisar</button>
            </div>
          </aside>
          <div class="candidate-search-results-panel">
            <div class="search-results" data-role-search-results>
              ${emptyState("Informe o numero, titulo ou cliente para procurar roles.")}
            </div>
          </div>
        </div>
      </section>
    `);

    const modal = document.querySelector("#demandRoleSearchModal");

    function renderDemandRoleResults() {
      const roleId = cleanCell(modal.querySelector("[name='roleId']").value).toLowerCase();
      const roleTitle = cleanCell(modal.querySelector("[name='roleTitle']").value).toLowerCase();
      const roleClient = cleanCell(modal.querySelector("[name='roleClient']").value).toLowerCase();
      const roleStatus = cleanCell(modal.querySelector("[name='roleStatus']").value).toLowerCase();
      const container = modal.querySelector("[data-role-search-results]");

      if (!roleId && !roleTitle && !roleClient && !roleStatus) {
        container.innerHTML = emptyState("Informe o numero, titulo ou cliente para procurar roles.");
        return;
      }

      const usedRoleNumbers = new Set((state.data.projectRoles || []).map((r) => r.roleNumber));

      const matches = (state.data.demandRoles || []).filter((dr) => {
        const matchesId = !roleId || dr.roleIdExternal.toLowerCase().includes(roleId);
        const matchesTitle = !roleTitle || (dr.roleTitle || "").toLowerCase().includes(roleTitle);
        const matchesClient = !roleClient || (dr.client || "").toLowerCase().includes(roleClient);
        const matchesStatus = !roleStatus || (dr.roleStatus || "").toLowerCase().includes(roleStatus);
        return matchesId && matchesTitle && matchesClient && matchesStatus;
      }).slice(0, 50);

      container.innerHTML = matches.length
        ? matches.map((dr) => {
            const alreadyAdded = usedRoleNumbers.has(dr.roleIdExternal);
            return `
              <article class="record-card demand-role-result-card">
                ${demandRoleCardBody(dr)}
                <div class="record-actions">
                  <button class="primary-button compact" type="button" data-select-demand-role="${escapeAttr(dr.id)}" ${alreadyAdded ? "disabled" : ""}>
                    ${alreadyAdded ? "Ja adicionada" : "Selecionar"}
                  </button>
                </div>
              </article>
            `;
          }).join("")
        : emptyState("Nenhuma role encontrada para esses filtros.");
    }

    modal.querySelector("[data-role-search-run]").addEventListener("click", renderDemandRoleResults);
    modal.querySelector("[data-role-search-clear]").addEventListener("click", () => {
      modal.querySelectorAll("input").forEach((input) => { input.value = ""; });
      modal.querySelector("[data-role-search-results]").innerHTML = emptyState("Informe o numero, titulo ou cliente para procurar roles.");
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("input")) {
        event.preventDefault();
        renderDemandRoleResults();
      }
    });
    modal.addEventListener("click", (event) => {
      const button = event.target.closest("[data-select-demand-role]");
      if (!button) return;
      const dr = byId("demandRoles", button.dataset.selectDemandRole);
      if (!dr) return;
      closeModal();
      onSelect(dr);
    });
  }

  function openPositionForm(position) {
    if (!state.data.projects.length) {
      toast("Cadastre um projeto antes de criar posicoes.");
      return;
    }

    const isEditing = Boolean(position);
    const defaultProjectId = state.selectedProjectId !== "all"
      ? state.selectedProjectId
      : state.data.projects[0].id;
    const today = new Date().toISOString().slice(0, 10);
    const values = position || {
      id: createId(),
      projectId: defaultProjectId,
      externalRoleId: "",
      name: "",
      description: "",
      startDate: today,
      endDate: today,
      status: "DRAFT",
      skills: []
    };

    const initialPositionSkillEntries = skillEntriesFromValues(values);

    openModal(`
      <form class="modal-card" id="positionForm">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Posicao</span>
            <h2>${isEditing ? "Editar posicao" : "Nova posicao"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <input name="id" type="hidden" value="${escapeAttr(values.id)}">

        <div class="form-sections">
          <details class="collapsible-section" open>
            <summary><span>Identificacao</span></summary>
            <div class="form-grid">
              <label>
                <span>Projeto</span>
                <select name="projectId" required>
                  ${state.data.projects.map((project) => `
                    <option value="${project.id}" ${values.projectId === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>
                  `).join("")}
                </select>
              </label>

              <label>
                <span>Status</span>
                <select name="status" required>
                  ${["DRAFT", "OPEN", "ON_HOLD", "FILLED", "CANCELLED", "CLOSED"].map((status) => `
                    <option value="${status}" ${values.status === status ? "selected" : ""}>${labels[status]}</option>
                  `).join("")}
                </select>
              </label>

              <label class="span-2">
                <span>Nome</span>
                <input name="name" value="${escapeAttr(values.name)}" required maxlength="140">
              </label>

              <label class="span-2">
                <span>Role do pool</span>
                <select name="externalRoleId" id="positionRoleSelect">
                  <option value="">— Nenhuma —</option>
                  ${(state.data.projectRoles || []).map((r) => `
                    <option value="${escapeAttr(r.roleNumber)}" ${values.externalRoleId === r.roleNumber ? "selected" : ""}>${escapeHtml(r.roleNumber)}</option>
                  `).join("")}
                </select>
              </label>

              <label>
                <span>Inicio</span>
                <input name="startDate" type="date" value="${escapeAttr(values.startDate)}" required>
              </label>

              <label>
                <span>Fim</span>
                <input name="endDate" type="date" value="${escapeAttr(values.endDate)}" required>
              </label>
            </div>
          </details>

          <details class="collapsible-section">
            <summary>
              <span>Descricao</span>
              <small>${values.description ? "Preenchida" : "Nao preenchida"}</small>
            </summary>
            <div class="form-grid">
              <label class="span-2">
                <textarea name="description" rows="4">${escapeHtml(values.description || "")}</textarea>
              </label>
            </div>
          </details>

          <details class="collapsible-section">
            <summary>
              <span>Skills requeridas</span>
              <small data-position-skills-summary>${initialPositionSkillEntries.length ? `${initialPositionSkillEntries.length} skill(s)` : "Nenhuma skill"}</small>
            </summary>
            <div class="skill-picker skill-picker--search">
              <input name="positionSkillLookup" list="positionFormSkillSuggestions" placeholder="Nome da skill" autocomplete="off">
              <datalist id="positionFormSkillSuggestions">
                ${state.data.skills.map((skill) => `<option value="${escapeAttr(skill.name)}"></option>`).join("")}
              </datalist>
              <select name="positionSkillLevel">
                <option value=""></option>
                ${skillLevelOptions().map((level) => {
                  const code = level.split("-")[0].trim();
                  return `<option value="${escapeAttr(level)}">${escapeHtml(code)}</option>`;
                }).join("")}
              </select>
              <button class="ghost-button skill-add-btn" type="button" data-position-form-skill-add>+</button>
            </div>
            <div class="skill-scroll">
              <div class="selected-skill-filters candidate-form-skills" data-position-form-skills></div>
            </div>
            <div class="skill-filter-legend" data-position-form-skill-legend></div>
          </details>
        </div>

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    `);

    const form = document.querySelector("#positionForm");
    form.dataset.selectedSkills = JSON.stringify(skillEntriesFromValues(values));
    renderPositionFormSkills(form);
    form.addEventListener("submit", savePositionFromForm);

    form.querySelector("[data-position-form-skill-add]").addEventListener("click", () => addPositionFormSkill(form));
    form.addEventListener("click", (event) => {
      const removeSkill = event.target.closest("[data-remove-position-form-skill]");
      if (removeSkill) removePositionFormSkill(form, removeSkill.dataset.removePositionFormSkill);
    });
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("[name='positionSkillLookup']")) {
        event.preventDefault();
        addPositionFormSkill(form);
      }
    });
  }

  function addPositionFormSkill(form) {
    const lookup = form.querySelector("[name='positionSkillLookup']");
    const levelSelect = form.querySelector("[name='positionSkillLevel']");
    const skillName = cleanCell(lookup.value);
    if (!skillName) {
      toast("Digite uma skill para adicionar.");
      return;
    }

    const skill = state.data.skills.find((item) => item.name.toLowerCase() === skillName.toLowerCase())
      || state.data.skills.find((item) => item.name.toLowerCase().includes(skillName.toLowerCase()));

    if (!skill) {
      toast("Skill nao encontrada no catalogo.");
      return;
    }

    const selectedSkills = selectedPositionFormSkills(form);
    const level = cleanCell(levelSelect.value);
    const existing = selectedSkills.find((item) => item.id === skill.id);
    if (existing) existing.level = level;
    else selectedSkills.push({ id: skill.id, level });
    form.dataset.selectedSkills = JSON.stringify(selectedSkills);
    lookup.value = "";
    levelSelect.value = "";
    renderPositionFormSkills(form);
  }

  function removePositionFormSkill(form, skillId) {
    form.dataset.selectedSkills = JSON.stringify(selectedPositionFormSkills(form).filter((item) => item.id !== skillId));
    renderPositionFormSkills(form);
  }

  function selectedPositionFormSkills(form) {
    try {
      return normalizeSkillEntries(JSON.parse(form.dataset.selectedSkills || "[]"));
    } catch {
      return [];
    }
  }

  function renderPositionFormSkills(form) {
    const entries = selectedPositionFormSkills(form);
    form.querySelector("[data-position-form-skills]").innerHTML = positionFormSkillPills(entries);
    const legendEl = form.querySelector("[data-position-form-skill-legend]");
    if (legendEl) legendEl.innerHTML = positionFormSkillLegend(entries);
    const summaryEl = form.querySelector("[data-position-skills-summary]");
    if (summaryEl) summaryEl.textContent = entries.length ? `${entries.length} skill(s)` : "Nenhuma skill";
  }

  function positionFormSkillPills(skillEntries) {
    const pills = normalizeSkillEntries(skillEntries)
      .map((entry) => ({ entry, skill: byId("skills", entry.id) }))
      .filter((item) => item.skill)
      .map(({ entry, skill }) => {
        const levelCode = entry.level ? entry.level.split("-")[0].trim() : "";
        const label = levelCode ? `${skill.name} (${levelCode})` : skill.name;
        return `
          <span class="filter-chip candidate-skill-chip">
            ${escapeHtml(label)}
            <button type="button" data-remove-position-form-skill="${escapeAttr(skill.id)}" title="Remover skill">×</button>
            <input name="skills" type="hidden" value="${escapeAttr(skill.id)}">
            <input name="skillLevel:${escapeAttr(skill.id)}" type="hidden" value="${escapeAttr(entry.level || "")}">
          </span>
        `;
      }).join("");

    return pills || "<span class=\"muted\">Nenhuma skill selecionada.</span>";
  }

  function positionFormSkillLegend(skillEntries) {
    const seen = new Map();
    normalizeSkillEntries(skillEntries).forEach((entry) => {
      if (!entry.level) return;
      const code = entry.level.split("-")[0].trim();
      const desc = entry.level.replace(/^[^-]+-\s*/, "").trim();
      if (code && !seen.has(code)) seen.set(code, desc);
    });
    if (!seen.size) return "";
    return [...seen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, desc]) => `<span><strong>${escapeHtml(code)}</strong> ${escapeHtml(desc)}</span>`)
      .join("");
  }

  async function bulkCopyPositions() {
    const ids = [...state.selectedPositionIds];
    if (!ids.length) return;
    const positions = ids.map((id) => byId("positions", id)).filter(Boolean);
    try {
      for (const position of positions) {
        const copy = {
          ...position,
          id: createId(),
          name: `${position.name} (copia)`,
          skills: [...(position.skills || [])],
          skillLevels: { ...(position.skillLevels || {}) },
          externalRoleIds: [...(position.externalRoleIds || [])]
        };
        if (window.staffingDatabase) {
          state.data = await window.staffingDatabase.savePosition(copy);
        } else {
          state.data.positions.push(copy);
        }
      }
      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      state.selectedPositionIds.clear();
      render();
      toast(`${positions.length} posicao(oes) copiada(s).`);
    } catch (e) {
      toast("Nao foi possivel copiar as posicoes.");
      console.error(e);
    }
  }

  async function savePositionFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const skillEntries = selectedPositionFormSkills(form);
    const position = {
      id: String(formData.get("id")).trim(),
      projectId: String(formData.get("projectId")),
      externalRoleId: String(formData.get("externalRoleId") || "").trim(),
      name: String(formData.get("name")).trim(),
      description: String(formData.get("description")).trim(),
      startDate: String(formData.get("startDate")),
      endDate: String(formData.get("endDate")),
      status: String(formData.get("status")),
      skills: skillEntries.map((entry) => entry.id),
      skillLevels: skillLevelsFromEntries(skillEntries)
    };

    if (!position.projectId || !position.name || !position.description || !position.startDate || !position.endDate) {
      toast("Preencha os campos obrigatorios da posicao.");
      return;
    }

    if (position.startDate > position.endDate) {
      toast("A data de inicio nao pode ser posterior a data fim.");
      return;
    }

    try {
      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.savePosition(position);
      } else {
        const index = state.data.positions.findIndex((item) => item.id === position.id);
        if (index >= 0) state.data.positions[index] = position;
        else state.data.positions.push(position);
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");
      closeModal();
      render();
      toast("Posicao salva. Use Salvar banco para exportar o staffing.db.");
    } catch (error) {
      toast("Nao foi possivel salvar a posicao.");
      console.error(error);
    }
  }

  function openApplicationForm(application) {
    if (!state.data.positions.length || !state.data.candidates.length) {
      toast("Cadastre ao menos uma posicao e um candidato antes de criar candidaturas.");
      return;
    }

    const isEditing = Boolean(application);
    const existingPosition = application ? byId("positions", application.positionId) : null;
    const defaultProjectId = state.selectedProjectId !== "all"
      ? state.selectedProjectId
      : (existingPosition ? existingPosition.projectId : state.data.positions[0].projectId);
    const values = application || {
      id: createId(),
      positionId: "",
      candidateId: "",
      status: "IDENTIFIED",
      statusDate: new Date().toISOString().slice(0, 16),
      notes: ""
    };
    const selectedProjectId = existingPosition ? existingPosition.projectId : defaultProjectId;
    const selectedCandidate = values.candidateId ? byId("candidates", values.candidateId) : null;
    const selectedPosition = values.positionId ? byId("positions", values.positionId) : null;

    openModal(`
      <form class="modal-card" id="applicationForm">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Candidatura</span>
            <h2>${isEditing ? "Editar candidatura" : "Nova candidatura"}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        <div class="form-grid">
          <input name="id" type="hidden" value="${escapeAttr(values.id)}">

          <label class="span-2">
            <span>Projeto</span>
            <select name="projectId" required ${isEditing ? "disabled" : ""}>
              ${state.data.projects.map((project) => `
                <option value="${escapeAttr(project.id)}" ${selectedProjectId === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>
              `).join("")}
            </select>
          </label>

          <label>
            <span>Candidato</span>
            <input name="candidateLookup" list="applicationCandidateSuggestions" value="${escapeAttr(selectedCandidate ? applicationCandidateLabel(selectedCandidate) : "")}" placeholder="Digite nome, email ou ID" ${isEditing ? "disabled" : ""} autocomplete="off" required>
            <input name="candidateId" type="hidden" value="${escapeAttr(values.candidateId)}">
            <datalist id="applicationCandidateSuggestions">
              ${state.data.candidates.map((candidate) => `<option value="${escapeAttr(applicationCandidateLabel(candidate))}"></option>`).join("")}
            </datalist>
          </label>

          <label>
            <span>Posicao</span>
            <input name="positionLookup" list="applicationPositionSuggestions" value="${escapeAttr(selectedPosition ? applicationPositionLabel(selectedPosition) : "")}" placeholder="Digite parte da posicao" ${isEditing ? "disabled" : ""} autocomplete="off" required>
            <input name="positionId" type="hidden" value="${escapeAttr(values.positionId)}">
            <datalist id="applicationPositionSuggestions">
              ${applicationPositionSuggestions(selectedProjectId)}
            </datalist>
          </label>

          <label class="span-2">
            <span>Status</span>
            <select name="status" required>
              ${applicationSteps.map((status) => `
                <option value="${status}" ${values.status === status ? "selected" : ""}>${labels[status]}</option>
              `).join("")}
            </select>
          </label>

          <label class="span-2">
            <span>Data de atualizacao</span>
            <input name="statusDate" type="datetime-local" value="${escapeAttr(toDateTimeLocal(values.statusDate))}" required>
          </label>

          <label class="span-2">
            <span>Notas</span>
            <textarea name="notes" rows="4">${escapeHtml(values.notes || "")}</textarea>
          </label>
        </div>

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Cancelar</button>
          <button class="primary-button" type="submit">Salvar</button>
        </div>
      </form>
    `);

    const form = document.querySelector("#applicationForm");
    form.addEventListener("submit", saveApplicationFromForm);
    if (!isEditing) bindApplicationLookupFields(form);
  }

  function bindApplicationLookupFields(form) {
    form.querySelector("[name='projectId']").addEventListener("change", () => {
      form.querySelector("[name='positionLookup']").value = "";
      form.querySelector("[name='positionId']").value = "";
      renderApplicationPositionSuggestions(form);
    });

    form.querySelector("[name='candidateLookup']").addEventListener("input", () => {
      syncApplicationLookup(form, "candidate");
    });
    form.querySelector("[name='candidateLookup']").addEventListener("change", () => {
      syncApplicationLookup(form, "candidate");
    });
    form.querySelector("[name='positionLookup']").addEventListener("input", () => {
      syncApplicationLookup(form, "position");
    });
    form.querySelector("[name='positionLookup']").addEventListener("change", () => {
      syncApplicationLookup(form, "position");
    });
  }

  function renderApplicationPositionSuggestions(form) {
    const projectId = form.querySelector("[name='projectId']").value;
    form.querySelector("#applicationPositionSuggestions").innerHTML = applicationPositionSuggestions(projectId);
  }

  function syncApplicationLookup(form, type) {
    const lookup = form.querySelector(`[name='${type}Lookup']`);
    const hidden = form.querySelector(`[name='${type}Id']`);
    const value = cleanCell(lookup.value);
    const item = type === "candidate"
      ? state.data.candidates.find((candidate) => applicationCandidateLabel(candidate) === value)
      : applicationPositionsForProject(form.querySelector("[name='projectId']").value).find((position) => applicationPositionLabel(position) === value);
    hidden.value = item ? item.id : "";
  }

  function applicationPositionsForProject(projectId) {
    return state.data.positions.filter((position) => position.projectId === projectId);
  }

  function applicationPositionSuggestions(projectId) {
    return applicationPositionsForProject(projectId)
      .map((position) => `<option value="${escapeAttr(applicationPositionLabel(position))}"></option>`)
      .join("");
  }

  function applicationCandidateLabel(candidate) {
    const company = byId("companies", candidate.companyId);
    return [
      candidate.name,
      company ? company.name : "",
      candidate.email || "",
      candidate.externalPersonId || ""
    ].filter(Boolean).join(" · ");
  }

  function applicationPositionLabel(position) {
    const project = byId("projects", position.projectId);
    return [
      position.name,
      project ? project.name : "Sem projeto",
      labels[position.status] || position.status,
      ...(position.externalRoleIds || [])
    ].filter(Boolean).join(" · ");
  }

  async function saveApplicationFromForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.querySelector("[name='candidateLookup']").disabled) {
      syncApplicationLookup(form, "candidate");
      syncApplicationLookup(form, "position");
    }
    const formData = new FormData(form);
    const application = {
      id: String(formData.get("id")).trim(),
      positionId: String(formData.get("positionId")),
      candidateId: String(formData.get("candidateId")),
      status: String(formData.get("status")),
      statusDate: fromDateTimeLocal(String(formData.get("statusDate"))),
      notes: String(formData.get("notes")).trim(),
      historyId: createId()
    };

    if (!application.candidateId) {
      toast("Selecione um candidato valido na lista de sugestoes.");
      return;
    }

    if (!application.positionId) {
      toast("Selecione uma posicao valida do projeto informado.");
      return;
    }

    if (!application.status || !application.statusDate) {
      toast("Preencha status e data da candidatura.");
      return;
    }

    const duplicate = state.data.applications.find((item) => {
      return item.id !== application.id
        && item.positionId === application.positionId
        && item.candidateId === application.candidateId;
    });

    if (duplicate) {
      toast("Este candidato ja possui candidatura para esta posicao.");
      return;
    }

    const confirmedConflict = application.status === "CONFIRMED" && state.data.applications.find((item) => {
      return item.id !== application.id
        && item.positionId === application.positionId
        && item.status === "CONFIRMED";
    });

    if (confirmedConflict) {
      toast("Esta posicao ja possui uma candidatura confirmada.");
      return;
    }

    try {
      if (window.staffingDatabase) {
        state.data = await window.staffingDatabase.saveApplication(application);
      } else {
        const index = state.data.applications.findIndex((item) => item.id === application.id);
        if (index >= 0) state.data.applications[index] = application;
        else state.data.applications.push(application);
      }

      state.dbMode = "dirty";
      updateDbStatus("Banco alterado nao salvo");

      // Auto-add candidate's active calendar role to the position
      if (application.status !== "REJECTED" && application.status !== "CANCELLED") {
        const position = byId("positions", application.positionId);
        const candidate = byId("candidates", application.candidateId);
        if (position && candidate) {
          const today = todayIso();
          const activeRoleIds = (state.data.allocationCalendars || [])
            .filter((cal) =>
              allocationCalendarMatchesCandidate(cal, candidate) &&
              cal.roleIdExternal &&
              cal.calendarStartDate && cal.calendarEndDate &&
              dateRangeIncludes(cal.calendarStartDate, cal.calendarEndDate, today)
            )
            .map((cal) => cal.roleIdExternal);
          const newRoleIds = activeRoleIds.filter((r) => !(position.externalRoleIds || []).includes(r));
          if (newRoleIds.length) {
            try {
              if (window.staffingDatabase) {
                state.data = await window.staffingDatabase.addPositionRoles(position.id, newRoleIds);
              } else {
                const idx = state.data.positions.findIndex((p) => p.id === position.id);
                if (idx >= 0) state.data.positions[idx] = { ...position, externalRoleIds: [...new Set([...(position.externalRoleIds || []), ...newRoleIds])] };
              }
            } catch (e) {
              console.error("Nao foi possivel adicionar roles a posicao:", e);
            }
          }
        }
      }

      closeModal();
      render();

      const savedApplication = state.data.applications.find((item) => item.id === application.id);
      const alerts = savedApplication ? getApplicationAlerts(savedApplication) : [];
      toast(alerts.length
        ? `Candidatura salva com ${alerts.length} alerta(s) de alocacao.`
        : "Candidatura salva. Use Salvar banco para exportar o staffing.db.");
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      toast(`Nao foi possivel salvar a candidatura: ${msg}`);
      console.error(error);
    }
  }

  function openProjectPositionsModal(project) {
    const positions = state.data.positions.filter((p) => p.projectId === project.id);
    const totals = projectCostTotals(positions, project);
    const totalLine = totals.size
      ? [...totals.entries()].map(([cur, val]) => formatCurrency(val, cur)).join(" + ")
      : null;

    openModal(`
      <div class="modal-card wide-modal">
        <div class="modal-header">
          <div>
            <span class="eyebrow">Projeto</span>
            <h2>${escapeHtml(project.name)}</h2>
          </div>
          <button class="icon-button light" type="button" data-modal-close aria-label="Fechar">×</button>
        </div>

        ${positions.length ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Posicao</th>
                <th>Role</th>
                <th>Alocacao</th>
                <th>Candidato</th>
                <th>Custo acumulado</th>
              </tr>
            </thead>
            <tbody>
              ${positions.map((pos) => {
                const info = positionFillInfo(pos, project);
                const roleCell = pos.externalRoleId
                  ? `<span class="mono-text">${escapeHtml(pos.externalRoleId)}</span>`
                  : `<span class="muted">—</span>`;
                let candidateCell, allocationBadge;
                if (!info.filled) {
                  candidateCell = `<span class="muted">Sem candidatura</span>`;
                  allocationBadge = "";
                } else if (info.roleMatch) {
                  candidateCell = escapeHtml(info.candidate.name);
                  allocationBadge = `<span class="status-pill confirmed">Reservado</span>`;
                } else {
                  candidateCell = escapeHtml(info.candidate.name);
                  allocationBadge = `<span class="status-pill in-process">${escapeHtml(labels[info.application.status] || info.application.status)}</span>`;
                }
                const costCell = info.cost
                  ? `<strong>${formatCurrency(info.cost.value, info.cost.currency)}</strong>`
                  : `<span class="muted">—</span>`;
                return `
                  <tr>
                    <td><strong>${escapeHtml(pos.name)}</strong></td>
                    <td>${roleCell}</td>
                    <td>${allocationBadge}</td>
                    <td>${candidateCell}</td>
                    <td>${costCell}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
            ${totalLine ? `
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align:right; font-weight:700;">Total acumulado</td>
                  <td><strong>${escapeHtml(totalLine)}</strong></td>
                </tr>
              </tfoot>
            ` : ""}
          </table>
        ` : `<p class="muted" style="padding:16px 0">Nenhuma posicao cadastrada neste projeto.</p>`}

        <div class="modal-actions">
          <button class="ghost-button" type="button" data-modal-close>Fechar</button>
        </div>
      </div>
    `);
  }

  function openModal(content) {
    closeModal();
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.dataset.modal = "active";
    modal.innerHTML = content;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-modal-close]")) {
        closeModal();
      }
    });

    window.addEventListener("keydown", closeModalOnEscape);
    const firstInput = modal.querySelector("input:not([readonly]), select, textarea, button");
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    const modal = document.querySelector("[data-modal='active']");
    if (modal) modal.remove();
    window.removeEventListener("keydown", closeModalOnEscape);
  }

  function closeModalOnEscape(event) {
    if (event.key === "Escape") closeModal();
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeRow(row) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [
      normalizeHeader(key),
      value
    ]));
  }

  function normalizeHeader(value) {
    return String(value)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function rowValue(row, aliases) {
    for (const alias of aliases) {
      const value = row[normalizeHeader(alias)];
      if (cleanCell(value)) return cleanCell(value);
    }
    return "";
  }

  function cleanCell(value) {
    return String(value ?? "").trim();
  }

  function yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  function showImportProgress(dropArea, message) {
    dropArea.classList.add("import-busy");
    let overlay = dropArea.querySelector(".import-progress-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "import-progress-overlay";
      overlay.innerHTML = `<span class="import-spinner" aria-hidden="true"></span><span class="import-progress-msg"></span>`;
      dropArea.appendChild(overlay);
    }
    overlay.querySelector(".import-progress-msg").textContent = message;
  }

  function clearImportProgress(dropArea) {
    dropArea.classList.remove("import-busy");
    dropArea.querySelector(".import-progress-overlay")?.remove();
  }

  function corporateIdFromEmail(email) {
    const value = cleanCell(email).toLowerCase();
    if (!value.includes("@")) return "";
    return value.split("@")[0].trim();
  }

  function parseBooleanCell(value, defaultValue) {
    const text = cleanCell(value).toUpperCase();
    if (!text) return defaultValue;
    if (["TRUE", "YES", "Y", "SIM", "S", "1"].includes(text)) return true;
    if (["FALSE", "NO", "N", "NAO", "NÃO", "0"].includes(text)) return false;
    return null;
  }

  function parseNumberCell(value) {
    const text = cleanCell(value).replace(",", ".");
    if (!text) return 0;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseSkillEntriesCell(value, rowNumber, errors) {
    const names = cleanCell(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const skillEntries = [];
    const seen = new Set();

    names.forEach((rawName) => {
      const match = rawName.match(/^(.*)\(([^)]+)\)\s*$/);
      const name = cleanCell(match ? match[1] : rawName);
      const level = cleanCell(match ? match[2] : "");
      const skill = state.data.skills.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (!skill) {
        errors.push(`Linha ${rowNumber}: Skill "${name}" nao existe no catalogo.`);
        return;
      }
      if (!seen.has(skill.id)) {
        seen.add(skill.id);
        skillEntries.push({ id: skill.id, level });
      }
    });

    return skillEntries;
  }

  function parseSkillNamesCell(value, rowNumber, errors) {
    return parseSkillEntriesCell(value, rowNumber, errors).map((entry) => entry.id);
  }

  function skillNames(skillIds) {
    return skillIds
      .map((id) => byId("skills", id))
      .filter(Boolean)
      .map((skill) => skill.name);
  }

  function skillNamesWithLevels(skillIds, skillLevels = {}) {
    return skillIds
      .map((id) => {
        const skill = byId("skills", id);
        if (!skill) return null;
        return skillLevels[id] ? `${skill.name} (${skillLevels[id]})` : skill.name;
      })
      .filter(Boolean);
  }

  function mergeById(existingItems, incomingItems) {
    const map = new Map(existingItems.map((item) => [item.id, item]));
    incomingItems.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  }

  function stableId(parts) {
    return parts
      .map((part) => cleanCell(part).toLowerCase().replace(/[^a-z0-9]+/g, "-"))
      .filter(Boolean)
      .join("|")
      .slice(0, 180);
  }

  function normalizeDateCell(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

    const text = cleanCell(value);
    if (!text) return "";
    if (["blank", "null", "n/a", "na", "-"].includes(text.toLowerCase())) return "";

    const numericText = text.replace(",", ".");
    if (/^\d+(\.\d+)?$/.test(numericText)) {
      const serial = Number(numericText);
      if (serial > 0 && serial < 60000) return excelSerialDateToIso(serial);
    }

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const brMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (brMatch) {
      const year = normalizeYear(brMatch[3]);
      return `${year}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
    }

    const monthNameMatch = text.match(/^(\d{1,2})[-\s\/]([A-Za-zÀ-ÿ]{3,})[-\s\/](\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (monthNameMatch) {
      const month = monthNumber(monthNameMatch[2]);
      if (month) {
        return `${normalizeYear(monthNameMatch[3])}-${month}-${monthNameMatch[1].padStart(2, "0")}`;
      }
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

    return "";
  }

  function excelSerialDateToIso(serial) {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400 * 1000;
    return new Date(utcValue).toISOString().slice(0, 10);
  }

  function normalizeYear(year) {
    return year.length === 2 ? `20${year}` : year;
  }

  function monthNumber(monthName) {
    const key = monthName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3);
    return {
      jan: "01",
      fev: "02",
      feb: "02",
      mar: "03",
      abr: "04",
      apr: "04",
      mai: "05",
      may: "05",
      jun: "06",
      jul: "07",
      ago: "08",
      aug: "08",
      set: "09",
      sep: "09",
      out: "10",
      oct: "10",
      nov: "11",
      dez: "12",
      dec: "12"
    }[key];
  }

  function dateToTime(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function todayIso() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function dateRangeIncludes(startDate, endDate, targetDate) {
    const start = cleanCell(startDate);
    const end = cleanCell(endDate);
    const target = cleanCell(targetDate);
    if (!target) return false;
    return (!start || start <= target) && (!end || target <= end);
  }

  function personStaffability(person) {
    return staffabilityFromCalendar(person.percentStaffable, calendarsForPerson(person), todayIso());
  }

  function formatCareerLevel(rawLevel) {
    const s = cleanCell(rawLevel);
    if (!s) return "";
    if (/^cl\d/i.test(s)) return s.toUpperCase();
    if (/^\d/.test(s)) return `CL${s}`;
    return s;
  }

  function parseClNumber(resourceLevel) {
    const s = cleanCell(resourceLevel);
    const m = s.match(/cl(\d+)/i) || s.match(/^(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  }

  function personAvailabilityLabel(calendars) {
    const today = todayIso();
    const booked = calendars.filter((c) => {
      if (!c.calendarEndDate || c.calendarEndDate < today) return false;
      return calendarTypeClass(c.calendarType) === "booked";
    });
    if (!booked.length) return { label: "Livre", available: true };
    const lastEnd = booked.reduce((max, c) => c.calendarEndDate > max ? c.calendarEndDate : max, booked[0].calendarEndDate);
    return { label: `Apos ${formatDate(lastEnd)}`, available: false };
  }

  function candidateStaffability(candidate) {
    const importedPerson = candidate.importedPersonId ? byId("importedPeople", candidate.importedPersonId) : null;
    const importedByExternalId = !importedPerson && candidate.externalPersonId
      ? state.data.importedPeople.find((person) => {
        return person.corporateId && person.corporateId.toLowerCase() === candidate.externalPersonId.toLowerCase();
      })
      : null;
    const importedByEmail = !importedPerson && !importedByExternalId && candidate.email
      ? state.data.importedPeople.find((person) => person.email && person.email.toLowerCase() === candidate.email.toLowerCase())
      : null;
    const person = importedPerson || importedByExternalId || importedByEmail;
    return staffabilityFromCalendar(person ? person.percentStaffable : "", calendarsForCandidate(candidate), todayIso());
  }

  function staffabilityFromCalendar(basePercentStaffable, calendars, targetDate) {
    const activeCalendars = calendars.filter((item) => dateRangeIncludes(item.calendarStartDate, item.calendarEndDate, targetDate));
    if (!activeCalendars.length) {
      return {
        percent: parsePercentValue(basePercentStaffable),
        label: cleanCell(basePercentStaffable) ? `Staffable ${cleanCell(basePercentStaffable)}` : "Staffable N/D",
        source: "PEOPLE"
      };
    }

    const allocatedValues = activeCalendars
      .map((item) => parsePercentValue(item.percentAllocated))
      .filter((value) => value !== null);

    if (!allocatedValues.length) {
      return {
        percent: null,
        label: "Calendario ativo, % N/D",
        source: "CALENDAR"
      };
    }

    const allocated = Math.min(100, allocatedValues.reduce((sum, value) => sum + value, 0));
    const staffable = Math.max(0, 100 - allocated);
    return {
      percent: staffable,
      label: `Staffable ${formatPercent(staffable)} pelo calendario`,
      source: "CALENDAR"
    };
  }

  function parsePercentValue(value) {
    const text = cleanCell(value);
    if (!text) return null;
    const match = text.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function formatPercent(value) {
    return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function metricCard(label, value, detail) {
    return `
      <article class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${detail}</small>
      </article>
    `;
  }

  function alertCard(alert) {
    return `
      <article class="alert-card ${alert.severity}">
        <div class="alert-card-head">
          <span>${severityLabel(alert.severity)}</span>
          <small>${alert.meta}</small>
        </div>
        <strong>${alert.title}</strong>
        <p>${alert.body}</p>
        ${alert.action ? `
          <button class="ghost-button compact" type="button" data-alert-action="${alert.action}" data-alert-target="${alert.targetId || ""}">
            ${alert.actionLabel || "Abrir"}
          </button>
        ` : ""}
      </article>
    `;
  }

  function severityLabel(severity) {
    return {
      high: "Alta",
      medium: "Media",
      low: "Baixa"
    }[severity] || "Alerta";
  }

  function demandRoleInfoHtml(dr) {
    if (!dr) return "";

    const parts = [];

    if (dr.roleStatus) {
      const normalized = String(dr.roleStatus).toLowerCase().replaceAll("_", "-").replace(/[^a-z0-9-]/g, "");
      const isCancelled = /cancel/i.test(dr.roleStatus);
      const titleAttr = isCancelled && dr.cancellationReason ? ` title="${escapeAttr(dr.cancellationReason)}"` : "";
      parts.push(`<span class="status-pill ${normalized}"${titleAttr}>${escapeHtml(dr.roleStatus)}</span>`);
    }

    const funnel = [
      [dr.candidatesIdentified, "identificado(s)"],
      [dr.candidatesIdentifiedSelf, "identificado(s) (auto)"],
      [dr.candidatesProposed, "proposto(s)"],
      [dr.candidatesConfirming, "confirmando"],
      [dr.candidatesFilled, "preenchido(s)"],
      [dr.candidatesNotSelected, "nao selecionado(s)"]
    ]
      .map(([value, label]) => {
        const n = parseInt(value, 10);
        return Number.isFinite(n) && n > 0 ? `${n} ${label}` : null;
      })
      .filter(Boolean)
      .join(" · ");
    if (funnel) parts.push(`<div class="muted-text" style="font-size:12px">${escapeHtml(funnel)}</div>`);

    const candidateName = dr.joinerName || dr.contractorName;
    if (candidateName) parts.push(`<div class="muted-text" style="font-size:12px">Candidato: ${escapeHtml(candidateName)}</div>`);

    return parts.length ? `<div style="margin-top:4px">${parts.join("")}</div>` : "";
  }

  function statusPill(status, customLabel) {
    const normalized = String(status).toLowerCase().replaceAll("_", "-");
    return `<span class="status-pill ${normalized}">${customLabel || labels[status] || status}</span>`;
  }

  function iconExport() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8M5 7l3 3 3-3M2.5 13h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function iconImport() {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 13h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function skillBadges(skillIds, skillLevels = {}) {
    return skillIds.map((id) => {
      const skill = byId("skills", id);
      const level = skillLevels[id];
      return `<span class="skill-badge">${escapeHtml(skill ? skill.name : id)}${level ? ` · ${escapeHtml(level)}` : ""}</span>`;
    }).join("");
  }

  function skillSummaryBadges(skillIds, limit, skillLevels = {}) {
    const visibleSkills = skillIds.slice(0, limit);
    const remaining = skillIds.length - visibleSkills.length;
    const badges = skillBadges(visibleSkills, skillLevels);
    const remainingBadge = remaining > 0 ? `<span class="skill-badge skill-more">+${remaining}</span>` : "";
    return badges ? `${badges}${remainingBadge}` : "<span class=\"muted\">Sem skills</span>";
  }

  function emptyState(message) {
    return `<div class="empty-state">${message}</div>`;
  }

  function tableEmpty(colspan, message) {
    return `<tr><td colspan="${colspan}">${emptyState(message)}</td></tr>`;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function toDateTimeLocal(value) {
    if (!value) return new Date().toISOString().slice(0, 16);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  }

  function fromDateTimeLocal(value) {
    return new Date(value).toISOString().slice(0, 19);
  }

  function formatMoney(value, currency) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  }

  function periodLabel(period) {
    return { HOUR: "hora", DAY: "dia", MONTH: "mes" }[period] || period;
  }

  function formatCurrency(value, currency) {
    if (value === null || value === undefined) return "—";
    try {
      return Math.round(value).toLocaleString("pt-BR", { style: "currency", currency: currency || "BRL", maximumFractionDigits: 0 });
    } catch {
      return `${currency || ""} ${Math.round(value).toLocaleString("pt-BR")}`.trim();
    }
  }

  function calcDailyCost(candidate) {
    const amount = Number(candidate.lcrAmount) > 0 ? Number(candidate.lcrAmount) : Number(candidate.ucrAmount) || 0;
    if (!amount || !candidate.costPeriod) return 0;
    if (candidate.costPeriod === "MONTH") return amount / 30;
    if (candidate.costPeriod === "DAY")   return amount;
    if (candidate.costPeriod === "HOUR")  return amount * 8;
    return 0;
  }

  function positionFillInfo(position, project) {
    const positionRole = position.externalRoleId || "";

    // Any active application (not rejected or cancelled)
    const application = state.data.applications.find((app) =>
      app.positionId === position.id &&
      app.status !== "REJECTED" &&
      app.status !== "CANCELLED"
    );
    if (!application) return { filled: false };

    const candidate = byId("candidates", application.candidateId);
    if (!candidate) return { filled: false, application };

    // Without a defined role we can't verify calendar allocation
    if (!positionRole) return { filled: true, candidate, application, cost: null };

    const today = todayIso();
    const projectEnd = project.endDate < today ? project.endDate : today;

    // Calendar entries where the candidate is allocated in the position's role
    // and that period overlaps with the project window
    const matchingCalendars = (state.data.allocationCalendars || []).filter((cal) => {
      if (!allocationCalendarMatchesCandidate(cal, candidate)) return false;
      if (cal.roleIdExternal !== positionRole) return false;
      if (!cal.calendarStartDate || !cal.calendarEndDate) return false;
      return cal.calendarStartDate <= projectEnd && cal.calendarEndDate >= project.startDate;
    });

    // Candidate has application but no calendar match for this role → in process, no cost
    if (!matchingCalendars.length) return { filled: true, candidate, application, cost: null, roleMatch: false };

    // Sum cost over each overlap between calendar entry and project window
    const dailyRate = calcDailyCost(candidate);
    let totalDays = 0;
    matchingCalendars.forEach((cal) => {
      const overlapStart = cal.calendarStartDate > project.startDate ? cal.calendarStartDate : project.startDate;
      const overlapEnd   = cal.calendarEndDate   < projectEnd        ? cal.calendarEndDate   : projectEnd;
      const days = Math.round((new Date(overlapEnd) - new Date(overlapStart)) / 86400000) + 1;
      if (days > 0) totalDays += days;
    });

    const cost = dailyRate > 0 && totalDays > 0
      ? { value: totalDays * dailyRate, currency: candidate.costCurrency }
      : null;

    return { filled: true, candidate, application, cost, roleMatch: true };
  }

  function projectCostTotals(positions, project) {
    const totals = new Map();
    positions.forEach((pos) => {
      const info = positionFillInfo(pos, project);
      if (info.roleMatch && info.cost && info.cost.value) {
        const cur = info.cost.currency || "BRL";
        totals.set(cur, (totals.get(cur) || 0) + info.cost.value);
      }
    });
    return totals;
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.toast.classList.remove("visible"), 6000);
  }

  init();
})();
