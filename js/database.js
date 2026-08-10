(function () {
  const LOCAL_SQL_JS = "lib/sql-wasm.js";
  const LOCAL_WASM_DIR = "lib/";
  const CDN_SQL_JS = "https://sql.js.org/dist/sql-wasm.js";
  const CDN_WASM_DIR = "https://sql.js.org/dist/";

  let SQL = null;
  let db = null;
  let sourceName = null;

  const schemaSql = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS project (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CLOSED', 'CANCELLED')),
      CHECK (date(start_date) <= date(end_date))
    );

    CREATE TABLE IF NOT EXISTS skill (
      skill_id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS company (
      company_id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      kind TEXT NOT NULL DEFAULT 'OTHER' CHECK (kind IN ('CONSULTING', 'CLIENT', 'PARTNER', 'VENDOR', 'OTHER')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS import_batch (
      import_batch_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_file_name TEXT,
      imported_at TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
      success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
      error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
      created_count INTEGER NOT NULL DEFAULT 0 CHECK (created_count >= 0),
      updated_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_count >= 0),
      skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS position (
      position_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      external_role_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('DRAFT', 'OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED', 'CLOSED')),
      CHECK (date(start_date) <= date(end_date)),
      FOREIGN KEY (project_id) REFERENCES project(project_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS position_role (
      position_id TEXT NOT NULL REFERENCES position(position_id) ON DELETE CASCADE,
      external_role_id TEXT NOT NULL,
      PRIMARY KEY (position_id, external_role_id)
    );

    CREATE TABLE IF NOT EXISTS project_role (
      project_role_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      role_number TEXT NOT NULL,
      UNIQUE (project_id, role_number),
      FOREIGN KEY (project_id) REFERENCES project(project_id) ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS candidate (
      candidate_id TEXT PRIMARY KEY,
      imported_person_id TEXT,
      company_id TEXT,
      external_person_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT COLLATE NOCASE UNIQUE,
      cost_amount NUMERIC NOT NULL DEFAULT 0 CHECK (cost_amount >= 0),
      cost_currency TEXT NOT NULL DEFAULT 'BRL' CHECK (cost_currency IN ('BRL', 'USD', 'EUR', 'GBP')),
      cost_period TEXT NOT NULL DEFAULT 'MONTH' CHECK (cost_period IN ('HOUR', 'DAY', 'MONTH')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      FOREIGN KEY (company_id) REFERENCES company(company_id) ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS imported_person (
      imported_person_id TEXT PRIMARY KEY,
      resource_name TEXT NOT NULL,
      resource_email TEXT COLLATE NOCASE,
      corporate_id TEXT,
      personnel_number TEXT,
      market_unit TEXT,
      country TEXT,
      metro_city TEXT,
      location_path TEXT,
      job_family_group TEXT,
      role_family TEXT,
      resource_role TEXT,
      level_group TEXT,
      resource_level TEXT,
      specialization_1 TEXT,
      specialization_2 TEXT,
      specialization_3 TEXT,
      specialization_4 TEXT,
      deployed_to_entity TEXT,
      first_staffable_date TEXT,
      percent_staffable TEXT,
      current_calendar_type TEXT,
      current_calendar_start_date TEXT,
      current_calendar_end_date TEXT,
      current_calendar_client TEXT,
      current_calendar_project TEXT,
      skills_text TEXT,
      certifications TEXT,
      languages TEXT,
      cv_link TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      last_imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (personnel_number),
      UNIQUE (resource_email)
    );

    CREATE TABLE IF NOT EXISTS allocation_calendar (
      allocation_calendar_id TEXT PRIMARY KEY,
      imported_person_id TEXT,
      employee_name TEXT NOT NULL,
      enterprise_id TEXT,
      personnel_number TEXT,
      staffable_detail TEXT,
      staffable_capacity TEXT,
      percent_staffable TEXT,
      calendar_type TEXT,
      calendar_description TEXT,
      calendar_chargeable TEXT,
      calendar_comments TEXT,
      calendar_start_date TEXT,
      calendar_end_date TEXT,
      percent_allocated TEXT,
      client TEXT,
      project_id_external TEXT,
      common_project_id TEXT,
      project_name TEXT,
      role_id_external TEXT,
      role_title TEXT,
      role_description TEXT,
      role_requested_start_date TEXT,
      role_end_date TEXT,
      candidate_status TEXT,
      candidate_status_update_date TEXT,
      rolloff_confirmed TEXT,
      rolloff_confirmation_date TEXT,
      last_calendar_update_date TEXT,
      source TEXT NOT NULL DEFAULT 'IMPORT',
      last_imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (imported_person_id) REFERENCES imported_person(imported_person_id) ON UPDATE CASCADE ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS position_skill (
      position_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
      level TEXT,
      PRIMARY KEY (position_id, skill_id),
      FOREIGN KEY (position_id) REFERENCES position(position_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skill(skill_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS candidate_skill (
      candidate_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      level TEXT,
      PRIMARY KEY (candidate_id, skill_id),
      FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skill(skill_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS application (
      application_id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN (
        'IDENTIFIED',
        'CV_INTERNAL_REVIEW',
        'INTERNAL_INTERVIEW_SCHEDULED',
        'INTERNAL_INTERVIEW_COMPLETED',
        'INTERNAL_INTERVIEW_APPROVED',
        'CV_LOCAL_REVIEW',
        'LOCAL_INTERVIEW_SCHEDULED',
        'LOCAL_INTERVIEW_COMPLETED',
        'LOCAL_INTERVIEW_APPROVED',
        'GLOBAL_INTERVIEW_SCHEDULED',
        'GLOBAL_INTERVIEW_COMPLETED',
        'GLOBAL_INTERVIEW_APPROVED',
        'CONFIRMED',
        'CANCELLED',
        'REJECTED'
      )),
      status_date TEXT NOT NULL,
      notes TEXT,
      UNIQUE (candidate_id, position_id),
      FOREIGN KEY (position_id) REFERENCES position(position_id) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_application_one_confirmed_per_position
      ON application(position_id)
      WHERE status = 'CONFIRMED';

    CREATE TABLE IF NOT EXISTS application_history (
      application_history_id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT,
      notes TEXT,
      FOREIGN KEY (application_id) REFERENCES application(application_id) ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_position_project ON position(project_id);
    CREATE INDEX IF NOT EXISTS idx_candidate_company ON candidate(company_id);
    CREATE INDEX IF NOT EXISTS idx_application_position ON application(position_id);
    CREATE INDEX IF NOT EXISTS idx_application_candidate ON application(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_imported_person_email ON imported_person(resource_email);
    CREATE INDEX IF NOT EXISTS idx_imported_person_personnel ON imported_person(personnel_number);
    CREATE INDEX IF NOT EXISTS idx_allocation_calendar_personnel ON allocation_calendar(personnel_number);
    CREATE INDEX IF NOT EXISTS idx_allocation_calendar_dates ON allocation_calendar(calendar_start_date, calendar_end_date);
  `;

  const migrationSql = [
    "ALTER TABLE candidate ADD COLUMN imported_person_id TEXT",
    "ALTER TABLE imported_person ADD COLUMN corporate_id TEXT",
    "ALTER TABLE import_batch ADD COLUMN created_count INTEGER NOT NULL DEFAULT 0 CHECK (created_count >= 0)",
    "ALTER TABLE import_batch ADD COLUMN updated_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_count >= 0)",
    "ALTER TABLE import_batch ADD COLUMN skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0)",
    "ALTER TABLE import_batch ADD COLUMN notes TEXT",
    "ALTER TABLE position_skill ADD COLUMN level TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_imported_person_corporate ON imported_person(corporate_id) WHERE corporate_id IS NOT NULL AND corporate_id <> ''",
    "ALTER TABLE position ADD COLUMN external_role_id TEXT",
    "CREATE TABLE IF NOT EXISTS position_role (position_id TEXT NOT NULL REFERENCES position(position_id) ON DELETE CASCADE, external_role_id TEXT NOT NULL, PRIMARY KEY (position_id, external_role_id))",
    "INSERT OR IGNORE INTO position_role (position_id, external_role_id) SELECT position_id, external_role_id FROM position WHERE external_role_id IS NOT NULL AND external_role_id <> ''",
    "CREATE TABLE IF NOT EXISTS project_role (project_role_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, role_number TEXT NOT NULL, UNIQUE (project_id, role_number), FOREIGN KEY (project_id) REFERENCES project(project_id) ON UPDATE CASCADE ON DELETE CASCADE)",
    `PRAGMA foreign_keys=OFF;
     CREATE TABLE IF NOT EXISTS _application_new (
       application_id TEXT PRIMARY KEY,
       position_id TEXT NOT NULL,
       candidate_id TEXT NOT NULL,
       status TEXT NOT NULL CHECK (status IN ('IDENTIFIED','CV_INTERNAL_REVIEW','INTERNAL_INTERVIEW_SCHEDULED','INTERNAL_INTERVIEW_COMPLETED','INTERNAL_INTERVIEW_APPROVED','CV_LOCAL_REVIEW','LOCAL_INTERVIEW_SCHEDULED','LOCAL_INTERVIEW_COMPLETED','LOCAL_INTERVIEW_APPROVED','GLOBAL_INTERVIEW_SCHEDULED','GLOBAL_INTERVIEW_COMPLETED','GLOBAL_INTERVIEW_APPROVED','CONFIRMED','CANCELLED','REJECTED')),
       status_date TEXT NOT NULL,
       notes TEXT,
       UNIQUE (candidate_id, position_id),
       FOREIGN KEY (position_id) REFERENCES position(position_id) ON UPDATE CASCADE ON DELETE CASCADE,
       FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id) ON UPDATE CASCADE ON DELETE RESTRICT
     );
     INSERT OR IGNORE INTO _application_new SELECT * FROM application;
     DROP TABLE IF EXISTS _application_old;
     ALTER TABLE application RENAME TO _application_old;
     ALTER TABLE _application_new RENAME TO application;
     DROP TABLE IF EXISTS _application_old;
     CREATE UNIQUE INDEX IF NOT EXISTS ux_application_one_confirmed_per_position ON application(position_id) WHERE status = 'CONFIRMED';
     CREATE INDEX IF NOT EXISTS idx_application_position ON application(position_id);
     CREATE INDEX IF NOT EXISTS idx_application_candidate ON application(candidate_id);
     PRAGMA foreign_keys=ON`
  ];

  async function init() {
    if (SQL) return true;
    await loadSqlJsScript();
    SQL = await window.initSqlJs({
      locateFile: (file) => sourceName === "local" ? `${LOCAL_WASM_DIR}${file}` : `${CDN_WASM_DIR}${file}`
    });
    return true;
  }

  async function createFromData(data) {
    await init();
    db = new SQL.Database();
    db.run(schemaSql);
    runMigrations();
    insertData(data);
    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function createEmpty() {
    await init();
    db = new SQL.Database();
    db.run(schemaSql);
    runMigrations();
    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function loadFile(file) {
    await init();
    const bytes = new Uint8Array(await file.arrayBuffer());
    db = new SQL.Database(bytes);
    db.run("PRAGMA foreign_keys = ON;");
    db.run(schemaSql);
    runMigrations();
    sourceName = file.name;
    return readAll();
  }

  async function exportFile(fileName) {
    if (!db) {
      await createEmpty();
    }
    const bytes = db.export();
    const blob = new Blob([bytes], { type: "application/vnd.sqlite3" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "staffing.db";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function runMigrations() {
    migrationSql.forEach((sql) => {
      try {
        db.run(sql);
      } catch (error) {
        if (!String(error.message || error).includes("duplicate column name")) {
          throw error;
        }
      }
    });
  }

  async function saveProject(project) {
    if (!db) {
      await createEmpty();
    }

    run(
      `INSERT INTO project (project_id, name, description, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         status = excluded.status`,
      [
        project.id,
        project.name,
        project.description || null,
        project.startDate,
        project.endDate,
        project.status
      ]
    );

    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function saveProjects(projects) {
    if (!db) {
      await createEmpty();
    }

    db.run("BEGIN TRANSACTION;");
    try {
      projects.forEach((project) => run(
        `INSERT INTO project (project_id, name, description, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           start_date = excluded.start_date,
           end_date = excluded.end_date,
           status = excluded.status`,
        [
          project.id,
          project.name,
          project.description || null,
          project.startDate,
          project.endDate,
          project.status
        ]
      ));

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveSkill(skill) {
    if (!db) {
      await createEmpty();
    }

    run(
      `INSERT INTO skill (skill_id, name, active)
       VALUES (?, ?, ?)
       ON CONFLICT(skill_id) DO UPDATE SET
         name = excluded.name,
         active = excluded.active`,
      [
        skill.id,
        skill.name,
        skill.active ? 1 : 0
      ]
    );

    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function saveSkills(skills) {
    if (!db) {
      await createEmpty();
    }

    db.run("BEGIN TRANSACTION;");
    try {
      skills.forEach((skill) => run(
        `INSERT INTO skill (skill_id, name, active)
         VALUES (?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET
           name = excluded.name,
           active = excluded.active`,
        [skill.id, skill.name, skill.active ? 1 : 0]
      ));

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveCompany(company) {
    if (!db) {
      await createEmpty();
    }

    run(
      `INSERT INTO company (company_id, name, kind, active)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(company_id) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         active = excluded.active`,
      [
        company.id,
        company.name,
        company.kind,
        company.active ? 1 : 0
      ]
    );

    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function saveCandidate(candidate) {
    if (!db) {
      await createEmpty();
    }

    db.run("BEGIN TRANSACTION;");
    try {
      run(
        `INSERT INTO candidate (
          candidate_id,
          imported_person_id,
          company_id,
          external_person_id,
          name,
          email,
          cost_amount,
          cost_currency,
          cost_period,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(candidate_id) DO UPDATE SET
          imported_person_id = excluded.imported_person_id,
          company_id = excluded.company_id,
          external_person_id = excluded.external_person_id,
          name = excluded.name,
          email = excluded.email,
          cost_amount = excluded.cost_amount,
          cost_currency = excluded.cost_currency,
          cost_period = excluded.cost_period,
          active = excluded.active`,
        [
          candidate.id,
          candidate.importedPersonId || null,
          candidate.companyId || null,
          candidate.externalPersonId || null,
          candidate.name,
          candidate.email || null,
          candidate.costAmount,
          candidate.costCurrency,
          candidate.costPeriod,
          candidate.active ? 1 : 0
        ]
      );

      run("DELETE FROM candidate_skill WHERE candidate_id = ?", [candidate.id]);
      candidate.skills.forEach((skillId) => run(
        "INSERT INTO candidate_skill (candidate_id, skill_id, level) VALUES (?, ?, ?)",
        [candidate.id, skillId, candidate.skillLevels ? candidate.skillLevels[skillId] || null : null]
      ));

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveCandidates(candidates) {
    if (!db) {
      await createEmpty();
    }

    db.run("BEGIN TRANSACTION;");
    try {
      candidates.forEach((candidate) => {
        run(
          `INSERT INTO candidate (
            candidate_id,
            imported_person_id,
            company_id,
            external_person_id,
            name,
            email,
            cost_amount,
            cost_currency,
            cost_period,
            active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(candidate_id) DO UPDATE SET
            imported_person_id = excluded.imported_person_id,
            company_id = excluded.company_id,
            external_person_id = excluded.external_person_id,
            name = excluded.name,
            email = excluded.email,
            cost_amount = excluded.cost_amount,
            cost_currency = excluded.cost_currency,
            cost_period = excluded.cost_period,
            active = excluded.active`,
          [
            candidate.id,
            candidate.importedPersonId || null,
            candidate.companyId || null,
            candidate.externalPersonId || null,
            candidate.name,
            candidate.email || null,
            candidate.costAmount,
            candidate.costCurrency,
            candidate.costPeriod,
            candidate.active ? 1 : 0
          ]
        );

        run("DELETE FROM candidate_skill WHERE candidate_id = ?", [candidate.id]);
        candidate.skills.forEach((skillId) => run(
          "INSERT INTO candidate_skill (candidate_id, skill_id, level) VALUES (?, ?, ?)",
          [candidate.id, skillId, candidate.skillLevels ? candidate.skillLevels[skillId] || null : null]
        ));
      });

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveImportedPeople(people) {
    if (!db) {
      await createEmpty();
    }

    db.run("BEGIN TRANSACTION;");
    try {
      people.forEach((person) => {
        // Remove stale rows that share the same email or personnel_number but have a different ID.
        // This handles the case where a person's key fields changed between exports.
        if (person.email) run(
          "DELETE FROM imported_person WHERE resource_email = ? AND imported_person_id != ?",
          [person.email, person.id]
        );
        if (person.personnelNumber) run(
          "DELETE FROM imported_person WHERE personnel_number = ? AND imported_person_id != ?",
          [person.personnelNumber, person.id]
        );
        run(
        `INSERT INTO imported_person (
          imported_person_id, resource_name, resource_email, corporate_id, personnel_number, market_unit,
          country, metro_city, location_path, job_family_group, role_family,
          resource_role, level_group, resource_level, specialization_1,
          specialization_2, specialization_3, specialization_4, deployed_to_entity,
          first_staffable_date, percent_staffable, current_calendar_type,
          current_calendar_start_date, current_calendar_end_date,
          current_calendar_client, current_calendar_project, skills_text,
          certifications, languages, cv_link, active, last_imported_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(imported_person_id) DO UPDATE SET
          resource_name = excluded.resource_name,
          resource_email = excluded.resource_email,
          corporate_id = excluded.corporate_id,
          personnel_number = excluded.personnel_number,
          market_unit = excluded.market_unit,
          country = excluded.country,
          metro_city = excluded.metro_city,
          location_path = excluded.location_path,
          job_family_group = excluded.job_family_group,
          role_family = excluded.role_family,
          resource_role = excluded.resource_role,
          level_group = excluded.level_group,
          resource_level = excluded.resource_level,
          specialization_1 = excluded.specialization_1,
          specialization_2 = excluded.specialization_2,
          specialization_3 = excluded.specialization_3,
          specialization_4 = excluded.specialization_4,
          deployed_to_entity = excluded.deployed_to_entity,
          first_staffable_date = excluded.first_staffable_date,
          percent_staffable = excluded.percent_staffable,
          current_calendar_type = excluded.current_calendar_type,
          current_calendar_start_date = excluded.current_calendar_start_date,
          current_calendar_end_date = excluded.current_calendar_end_date,
          current_calendar_client = excluded.current_calendar_client,
          current_calendar_project = excluded.current_calendar_project,
          skills_text = excluded.skills_text,
          certifications = excluded.certifications,
          languages = excluded.languages,
          cv_link = excluded.cv_link,
          active = excluded.active,
          last_imported_at = CURRENT_TIMESTAMP`,
        [
          person.id, person.name, person.email || null, person.corporateId || null, person.personnelNumber || null,
          person.marketUnit || null, person.country || null, person.metroCity || null,
          person.locationPath || null, person.jobFamilyGroup || null, person.roleFamily || null,
          person.resourceRole || null, person.levelGroup || null, person.resourceLevel || null,
          person.specialization1 || null, person.specialization2 || null, person.specialization3 || null,
          person.specialization4 || null, person.deployedToEntity || null, person.firstStaffableDate || null,
          person.percentStaffable || null, person.currentCalendarType || null,
          person.currentCalendarStartDate || null, person.currentCalendarEndDate || null,
          person.currentCalendarClient || null, person.currentCalendarProject || null,
          person.skillsText || null, person.certifications || null, person.languages || null,
          person.cvLink || null, person.active ? 1 : 0
        ]
        );
      });

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveAllocationCalendars(calendars) {
    if (!db) {
      await createEmpty();
    }

    // FK checks disabled during bulk import — imported_person_id may reference
    // a person not yet in the DB (e.g. calendar imported before people file).
    db.run("PRAGMA foreign_keys = OFF");
    db.run("BEGIN TRANSACTION;");
    try {
      calendars.forEach((item) => run(
        `INSERT INTO allocation_calendar (
          allocation_calendar_id, imported_person_id, employee_name, enterprise_id,
          personnel_number, staffable_detail, staffable_capacity, percent_staffable,
          calendar_type, calendar_description, calendar_chargeable, calendar_comments,
          calendar_start_date, calendar_end_date, percent_allocated, client,
          project_id_external, common_project_id, project_name, role_id_external,
          role_title, role_description, role_requested_start_date, role_end_date,
          candidate_status, candidate_status_update_date, rolloff_confirmed,
          rolloff_confirmation_date, last_calendar_update_date, source, last_imported_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(allocation_calendar_id) DO UPDATE SET
          imported_person_id = excluded.imported_person_id,
          employee_name = excluded.employee_name,
          enterprise_id = excluded.enterprise_id,
          personnel_number = excluded.personnel_number,
          staffable_detail = excluded.staffable_detail,
          staffable_capacity = excluded.staffable_capacity,
          percent_staffable = excluded.percent_staffable,
          calendar_type = excluded.calendar_type,
          calendar_description = excluded.calendar_description,
          calendar_chargeable = excluded.calendar_chargeable,
          calendar_comments = excluded.calendar_comments,
          calendar_start_date = excluded.calendar_start_date,
          calendar_end_date = excluded.calendar_end_date,
          percent_allocated = excluded.percent_allocated,
          client = excluded.client,
          project_id_external = excluded.project_id_external,
          common_project_id = excluded.common_project_id,
          project_name = excluded.project_name,
          role_id_external = excluded.role_id_external,
          role_title = excluded.role_title,
          role_description = excluded.role_description,
          role_requested_start_date = excluded.role_requested_start_date,
          role_end_date = excluded.role_end_date,
          candidate_status = excluded.candidate_status,
          candidate_status_update_date = excluded.candidate_status_update_date,
          rolloff_confirmed = excluded.rolloff_confirmed,
          rolloff_confirmation_date = excluded.rolloff_confirmation_date,
          last_calendar_update_date = excluded.last_calendar_update_date,
          source = excluded.source,
          last_imported_at = CURRENT_TIMESTAMP`,
        [
          item.id, item.importedPersonId || null, item.employeeName, item.enterpriseId || null,
          item.personnelNumber || null, item.staffableDetail || null, item.staffableCapacity || null,
          item.percentStaffable || null, item.calendarType || null, item.calendarDescription || null,
          item.calendarChargeable || null, item.calendarComments || null, item.calendarStartDate || null,
          item.calendarEndDate || null, item.percentAllocated || null, item.client || null,
          item.projectIdExternal || null, item.commonProjectId || null, item.projectName || null,
          item.roleIdExternal || null, item.roleTitle || null, item.roleDescription || null,
          item.roleRequestedStartDate || null, item.roleEndDate || null, item.candidateStatus || null,
          item.candidateStatusUpdateDate || null, item.rolloffConfirmed || null,
          item.rolloffConfirmationDate || null, item.lastCalendarUpdateDate || null, item.source || "IMPORT"
        ]
      ));

      db.run("COMMIT;");
      db.run("PRAGMA foreign_keys = ON");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      db.run("PRAGMA foreign_keys = ON");
      throw error;
    }
  }

  async function savePosition(position) {
    if (!db) {
      await createEmpty();
    }

    db.run("BEGIN TRANSACTION;");
    try {
      run(
        `INSERT INTO position (
          position_id,
          project_id,
          external_role_id,
          name,
          description,
          start_date,
          end_date,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(position_id) DO UPDATE SET
          project_id = excluded.project_id,
          external_role_id = excluded.external_role_id,
          name = excluded.name,
          description = excluded.description,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          status = excluded.status`,
        [
          position.id,
          position.projectId,
          position.externalRoleId || null,
          position.name,
          position.description,
          position.startDate,
          position.endDate,
          position.status
        ]
      );

      run("DELETE FROM position_skill WHERE position_id = ?", [position.id]);
      position.skills.forEach((skillId) => run(
        "INSERT INTO position_skill (position_id, skill_id, required, level) VALUES (?, ?, 1, ?)",
        [position.id, skillId, position.skillLevels ? position.skillLevels[skillId] || null : null]
      ));

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveProjectRole(projectRole) {
    if (!db) await createEmpty();
    run(
      `INSERT INTO project_role (project_role_id, project_id, role_number)
       VALUES (?, ?, ?)
       ON CONFLICT(project_role_id) DO UPDATE SET
         project_id = excluded.project_id,
         role_number = excluded.role_number`,
      [projectRole.id, projectRole.projectId, projectRole.roleNumber]
    );
    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function deleteProjectRole(id) {
    if (!db) await createEmpty();
    run("DELETE FROM project_role WHERE project_role_id = ?", [id]);
    db.run("PRAGMA optimize;");
    return readAll();
  }

  async function savePositions(positions) {
    if (!db) await createEmpty();
    db.run("BEGIN TRANSACTION;");
    try {
      positions.forEach((position) => {
        run(
          `INSERT INTO position (
            position_id,
            project_id,
            external_role_id,
            name,
            description,
            start_date,
            end_date,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(position_id) DO UPDATE SET
            project_id = excluded.project_id,
            external_role_id = excluded.external_role_id,
            name = excluded.name,
            description = excluded.description,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            status = excluded.status`,
          [
            position.id,
            position.projectId,
            position.externalRoleId || null,
            position.name,
            position.description || null,
            position.startDate || null,
            position.endDate || null,
            position.status
          ]
        );

        run("DELETE FROM position_skill WHERE position_id = ?", [position.id]);
        (position.skills || []).forEach((skillId) => run(
          "INSERT INTO position_skill (position_id, skill_id, required, level) VALUES (?, ?, 1, ?)",
          [position.id, skillId, position.skillLevels ? position.skillLevels[skillId] || null : null]
        ));
      });

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function addPositionRoles(positionId, roleIds) {
    if (!db) await createEmpty();
    const toAdd = roleIds.filter(Boolean);
    if (!toAdd.length) return readAll();
    db.run("BEGIN TRANSACTION;");
    try {
      toAdd.forEach((roleId) => run(
        "INSERT OR IGNORE INTO position_role (position_id, external_role_id) VALUES (?, ?)",
        [positionId, roleId]
      ));
      db.run("COMMIT;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveApplication(application) {
    if (!db) {
      await createEmpty();
    }

    const existingRows = rows(
      "SELECT status FROM application WHERE application_id = ?",
      [application.id]
    );
    const fromStatus = existingRows.length ? existingRows[0].status : null;
    const statusChanged = fromStatus !== application.status;

    db.run("BEGIN TRANSACTION;");
    try {
      run(
        `INSERT INTO application (
          application_id,
          position_id,
          candidate_id,
          status,
          status_date,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(application_id) DO UPDATE SET
          position_id = excluded.position_id,
          candidate_id = excluded.candidate_id,
          status = excluded.status,
          status_date = excluded.status_date,
          notes = excluded.notes`,
        [
          application.id,
          application.positionId,
          application.candidateId,
          application.status,
          application.statusDate,
          application.notes || null
        ]
      );

      if (statusChanged) {
        run(
          `INSERT INTO application_history (
            application_history_id,
            application_id,
            from_status,
            to_status,
            changed_at,
            changed_by,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            application.historyId,
            application.id,
            fromStatus,
            application.status,
            application.statusDate,
            null,
            application.notes || null
          ]
        );
      }

      db.run("COMMIT;");
      db.run("PRAGMA optimize;");
      return readAll();
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  async function saveImportBatch(batch) {
    if (!db) {
      await createEmpty();
    }

    run(
      `INSERT INTO import_batch (
        import_batch_id, source, source_file_name, imported_at,
        row_count, success_count, error_count, created_count,
        updated_count, skipped_count, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(import_batch_id) DO UPDATE SET
        source = excluded.source,
        source_file_name = excluded.source_file_name,
        imported_at = excluded.imported_at,
        row_count = excluded.row_count,
        success_count = excluded.success_count,
        error_count = excluded.error_count,
        created_count = excluded.created_count,
        updated_count = excluded.updated_count,
        skipped_count = excluded.skipped_count,
        notes = excluded.notes`,
      [
        batch.id,
        batch.source,
        batch.fileName || null,
        batch.importedAt,
        batch.rowCount || 0,
        batch.successCount || 0,
        batch.errorCount || 0,
        batch.createdCount || 0,
        batch.updatedCount || 0,
        batch.skippedCount || 0,
        batch.notes || null
      ]
    );
    db.run("PRAGMA optimize;");
    return readAll();
  }

  function insertData(data) {
    db.run("BEGIN TRANSACTION;");
    try {
      data.projects.forEach((item) => run(
        "INSERT INTO project (project_id, name, description, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.description, item.startDate, item.endDate, item.status]
      ));

      data.skills.forEach((item) => run(
        "INSERT INTO skill (skill_id, name, active) VALUES (?, ?, ?)",
        [item.id, item.name, item.active ? 1 : 0]
      ));

      (data.companies || []).forEach((item) => run(
        "INSERT INTO company (company_id, name, kind, active) VALUES (?, ?, ?, ?)",
        [item.id, item.name, item.kind || "OTHER", item.active ? 1 : 0]
      ));

      (data.importBatches || []).forEach((item) => run(
        `INSERT INTO import_batch (
          import_batch_id, source, source_file_name, imported_at,
          row_count, success_count, error_count, created_count,
          updated_count, skipped_count, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.source, item.fileName, item.importedAt,
          item.rowCount || 0, item.successCount || 0, item.errorCount || 0,
          item.createdCount || 0, item.updatedCount || 0, item.skippedCount || 0,
          item.notes || null
        ]
      ));

      data.positions.forEach((item) => {
        run(
          "INSERT INTO position (position_id, project_id, name, description, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.projectId, item.name, item.description, item.startDate, item.endDate, item.status]
        );
        item.skills.forEach((skillId) => run(
          "INSERT INTO position_skill (position_id, skill_id, required, level) VALUES (?, ?, 1, ?)",
          [item.id, skillId, item.skillLevels ? item.skillLevels[skillId] || null : null]
        ));
        (item.externalRoleIds || []).filter(Boolean).forEach((roleId) => run(
          "INSERT OR IGNORE INTO position_role (position_id, external_role_id) VALUES (?, ?)",
          [item.id, roleId]
        ));
      });

      data.candidates.forEach((item) => {
        run(
          "INSERT INTO candidate (candidate_id, imported_person_id, company_id, external_person_id, name, email, cost_amount, cost_currency, cost_period, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [item.id, item.importedPersonId || null, item.companyId || null, item.externalPersonId, item.name, item.email, item.costAmount, item.costCurrency, item.costPeriod, item.active ? 1 : 0]
        );
        item.skills.forEach((skillId) => run(
          "INSERT INTO candidate_skill (candidate_id, skill_id, level) VALUES (?, ?, ?)",
          [item.id, skillId, item.skillLevels ? item.skillLevels[skillId] || null : null]
        ));
      });

      (data.importedPeople || []).forEach((item) => run(
        `INSERT INTO imported_person (
          imported_person_id, resource_name, resource_email, corporate_id, personnel_number, market_unit,
          country, metro_city, resource_role, resource_level, skills_text, cv_link,
          percent_staffable, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.name, item.email || null, item.corporateId || null, item.personnelNumber || null, item.marketUnit || null,
          item.country || null, item.metroCity || null, item.resourceRole || null, item.resourceLevel || null,
          item.skillsText || null, item.cvLink || null, item.percentStaffable || null, item.active ? 1 : 0]
      ));

      (data.allocationCalendars || []).forEach((item) => run(
        `INSERT INTO allocation_calendar (
          allocation_calendar_id, imported_person_id, employee_name, personnel_number,
          calendar_type, calendar_start_date, calendar_end_date, percent_allocated,
          client, project_name, role_id_external, role_title, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.importedPersonId || null, item.employeeName, item.personnelNumber || null,
          item.calendarType || null, item.calendarStartDate || null, item.calendarEndDate || null,
          item.percentAllocated || null, item.client || null, item.projectName || null,
          item.roleIdExternal || null, item.roleTitle || null, item.source || "IMPORT"]
      ));

      data.applications.forEach((item) => run(
        "INSERT INTO application (application_id, position_id, candidate_id, status, status_date, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.positionId, item.candidateId, item.status, item.statusDate, item.notes]
      ));

      db.run("COMMIT;");
    } catch (error) {
      db.run("ROLLBACK;");
      throw error;
    }
  }

  function readAll() {
    if (!db) return emptyData();

    return {
      projects: rows("SELECT project_id AS id, name, description, start_date AS startDate, end_date AS endDate, status FROM project ORDER BY name"),
      projectRoles: rows("SELECT project_role_id AS id, project_id AS projectId, role_number AS roleNumber FROM project_role ORDER BY project_id, role_number"),
      skills: rows("SELECT skill_id AS id, name, active FROM skill ORDER BY name").map((item) => ({ ...item, active: Boolean(item.active) })),
      companies: rows("SELECT company_id AS id, name, kind, active FROM company ORDER BY name").map((item) => ({ ...item, active: Boolean(item.active) })),
      positions: rows("SELECT position_id AS id, project_id AS projectId, external_role_id AS externalRoleId, name, description, start_date AS startDate, end_date AS endDate, status FROM position ORDER BY name")
        .map((item) => {
          const candidateRoles = rows("SELECT external_role_id AS roleId FROM position_role WHERE position_id = ? ORDER BY external_role_id", [item.id]).map((r) => r.roleId);
          const allRoles = [...new Set([item.externalRoleId, ...candidateRoles].filter(Boolean))];
          return { ...item, skills: idsFor("position_skill", "position_id", item.id), skillLevels: levelsFor("position_skill", "position_id", item.id), externalRoleIds: allRoles };
        }),
      candidates: rows("SELECT candidate_id AS id, imported_person_id AS importedPersonId, company_id AS companyId, external_person_id AS externalPersonId, name, email, cost_amount AS costAmount, cost_currency AS costCurrency, cost_period AS costPeriod, active FROM candidate ORDER BY name")
        .map((item) => ({ ...item, active: Boolean(item.active), skills: idsFor("candidate_skill", "candidate_id", item.id), skillLevels: levelsFor("candidate_skill", "candidate_id", item.id) })),
      importedPeople: rows("SELECT imported_person_id AS id, resource_name AS name, resource_email AS email, corporate_id AS corporateId, personnel_number AS personnelNumber, market_unit AS marketUnit, country, metro_city AS metroCity, location_path AS locationPath, job_family_group AS jobFamilyGroup, role_family AS roleFamily, resource_role AS resourceRole, level_group AS levelGroup, resource_level AS resourceLevel, specialization_1 AS specialization1, specialization_2 AS specialization2, specialization_3 AS specialization3, specialization_4 AS specialization4, deployed_to_entity AS deployedToEntity, first_staffable_date AS firstStaffableDate, percent_staffable AS percentStaffable, current_calendar_type AS currentCalendarType, current_calendar_start_date AS currentCalendarStartDate, current_calendar_end_date AS currentCalendarEndDate, current_calendar_client AS currentCalendarClient, current_calendar_project AS currentCalendarProject, skills_text AS skillsText, certifications, languages, cv_link AS cvLink, active FROM imported_person ORDER BY resource_name")
        .map((item) => ({ ...item, active: Boolean(item.active) })),
      allocationCalendars: rows("SELECT allocation_calendar_id AS id, imported_person_id AS importedPersonId, employee_name AS employeeName, enterprise_id AS enterpriseId, personnel_number AS personnelNumber, staffable_detail AS staffableDetail, staffable_capacity AS staffableCapacity, percent_staffable AS percentStaffable, calendar_type AS calendarType, calendar_description AS calendarDescription, calendar_chargeable AS calendarChargeable, calendar_comments AS calendarComments, calendar_start_date AS calendarStartDate, calendar_end_date AS calendarEndDate, percent_allocated AS percentAllocated, client, project_id_external AS projectIdExternal, common_project_id AS commonProjectId, project_name AS projectName, role_id_external AS roleIdExternal, role_title AS roleTitle, role_description AS roleDescription, role_requested_start_date AS roleRequestedStartDate, role_end_date AS roleEndDate, candidate_status AS candidateStatus, candidate_status_update_date AS candidateStatusUpdateDate, rolloff_confirmed AS rolloffConfirmed, rolloff_confirmation_date AS rolloffConfirmationDate, last_calendar_update_date AS lastCalendarUpdateDate, source FROM allocation_calendar ORDER BY calendar_start_date DESC"),
      applications: rows("SELECT application_id AS id, position_id AS positionId, candidate_id AS candidateId, status, status_date AS statusDate, notes FROM application ORDER BY status_date DESC"),
      importBatches: rows("SELECT import_batch_id AS id, source, source_file_name AS fileName, imported_at AS importedAt, row_count AS rowCount, success_count AS successCount, error_count AS errorCount, created_count AS createdCount, updated_count AS updatedCount, skipped_count AS skippedCount, notes FROM import_batch ORDER BY imported_at DESC")
    };
  }

  function rows(sql, params) {
    const stmt = db.prepare(sql);
    const result = [];
    try {
      if (params) stmt.bind(params);
      while (stmt.step()) result.push(stmt.getAsObject());
    } finally {
      stmt.free();
    }
    return result;
  }

  function idsFor(table, ownerColumn, ownerId) {
    return rows(`SELECT skill_id AS id FROM ${table} WHERE ${ownerColumn} = ? ORDER BY skill_id`, [ownerId])
      .map((item) => item.id);
  }

  function levelsFor(table, ownerColumn, ownerId) {
    return Object.fromEntries(rows(`SELECT skill_id AS id, level FROM ${table} WHERE ${ownerColumn} = ? AND level IS NOT NULL AND level <> ''`, [ownerId])
      .map((item) => [item.id, item.level]));
  }

  function run(sql, params) {
    db.run(sql, params);
  }

  function emptyData() {
    return {
      projects: [],
      projectRoles: [],
      skills: [],
      companies: [],
      positions: [],
      candidates: [],
      importedPeople: [],
      allocationCalendars: [],
      applications: [],
      importBatches: []
    };
  }

  function loadSqlJsScript() {
    if (window.initSqlJs) return Promise.resolve();
    return loadScript(LOCAL_SQL_JS)
      .then(() => {
        sourceName = "local";
      })
      .catch(() => loadScript(CDN_SQL_JS).then(() => {
        sourceName = "cdn";
      }));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window.staffingDatabase = {
    init,
    createFromData,
    createEmpty,
    loadFile,
    exportFile,
    saveProject,
    saveProjects,
    saveSkill,
    saveSkills,
    saveCompany,
    saveCandidate,
    saveCandidates,
    saveImportedPeople,
    saveAllocationCalendars,
    saveImportBatch,
    saveProjectRole,
    deleteProjectRole,
    savePosition,
    savePositions,
    addPositionRoles,
    saveApplication,
    readAll,
    hasDatabase: () => Boolean(db),
    getSourceName: () => sourceName
  };
})();
