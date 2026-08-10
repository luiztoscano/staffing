(function () {
  const LOCAL_XLSX = "lib/xlsx.full.min.js";
  const CDN_XLSX = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";

  async function ensureXlsx() {
    if (window.XLSX) return window.XLSX;
    await loadScript(LOCAL_XLSX).catch(() => loadScript(CDN_XLSX));
    if (!window.XLSX) throw new Error("SheetJS nao foi carregado.");
    return window.XLSX;
  }

  async function exportSheet(fileName, sheetName, rows) {
    const XLSX = await ensureXlsx();
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  }

  function checkEncrypted(error) {
    const msg = error && error.message ? error.message : String(error);
    if (msg.includes("ECMA-376") || msg.includes("EncryptionInfo")) {
      throw new Error(
        "O arquivo esta protegido por senha (ECMA-376). Abra-o no Excel, va em Arquivo > Informacoes > Proteger Pasta de Trabalho > Criptografar com Senha e remova a senha antes de importar."
      );
    }
    throw error;
  }

  async function readFirstSheet(file) {
    const XLSX = await ensureXlsx();
    const buffer = await file.arrayBuffer();
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    } catch (e) {
      checkEncrypted(e);
    }
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
      defval: "",
      raw: false
    });
  }

  async function readFirstTabularSheet(file) {
    const XLSX = await ensureXlsx();
    const buffer = await file.arrayBuffer();
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    } catch (e) {
      checkEncrypted(e);
    }
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false
    });
    const headerIndex = matrix.findIndex((row) => row.filter((cell) => String(cell).trim()).length >= 2);
    if (headerIndex < 0) throw new Error(
      `Nenhuma linha de cabecalho encontrada na aba "${firstSheetName}". O arquivo pode estar vazio ou ter um formato inesperado.`
    );
    const headers = matrix[headerIndex].map((cell) => String(cell).trim());

    // Build hyperlink overlay: cells with Excel hyperlinks store the URL in cell.l.Target,
    // which sheet_to_json ignores (it returns display text instead).
    const hyperlinks = {};
    const ref = worksheet["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.l && cell.l.Target) {
            const matrixRow = r - range.s.r;
            if (!hyperlinks[matrixRow]) hyperlinks[matrixRow] = {};
            hyperlinks[matrixRow][c - range.s.c] = cell.l.Target;
          }
        }
      }
    }

    return matrix.slice(headerIndex + 1)
      .filter((row) => row.some((cell) => String(cell).trim()))
      .map((row, dataIndex) => {
        const matrixRow = headerIndex + 1 + dataIndex;
        const hlRow = hyperlinks[matrixRow] || {};
        return Object.fromEntries(headers.map((header, col) => [header, hlRow[col] || row[col] || ""]));
      });
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

  window.staffingExcel = {
    exportSheet,
    readFirstSheet,
    readFirstTabularSheet
  };
})();
