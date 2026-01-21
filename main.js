const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzT3vZdDP0iGsU9xmoDS8h_i3o4qZ5JxG1c3aFvUMcDP-bn_cbvGjQswSkAEZC-4Qga/exec";
const MENU_LINK = "http://menu-almacen.vercel.app/"; // URL del menú principal

const form = document.getElementById("inventory-form");
const statusEl = document.getElementById("status");
const rowsContainer = document.getElementById("rows");
const addRowBtn = document.getElementById("add-row");
const menuLinkEl = document.getElementById("menu-link");
const datalistEl = document.getElementById("ingredientes-list");

menuLinkEl.href = MENU_LINK;

const setStatus = (message, type) => {
  statusEl.textContent = message;
  statusEl.className = `status ${type || ""}`.trim();
};

const createRow = (options = []) => {
  const row = document.createElement("div");
  row.className = "item-row";

  const inputIngrediente = document.createElement("input");
  inputIngrediente.name = "ingrediente";
  inputIngrediente.type = "text";
  inputIngrediente.required = true;
  inputIngrediente.placeholder = "Nombre o codigo";
  inputIngrediente.className = "input";
  inputIngrediente.setAttribute("list", "ingredientes-list");

  const inputCodigo = document.createElement("input");
  inputCodigo.name = "codigo";
  inputCodigo.type = "text";
  inputCodigo.placeholder = "Código";
  inputCodigo.className = "input";
  inputCodigo.readOnly = true;
  inputCodigo.tabIndex = -1;

  const input = document.createElement("input");
  input.name = "stock";
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.required = true;
  input.placeholder = "0.00";
  input.className = "input";
  input.inputMode = "decimal";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "✕";
  remove.title = "Eliminar fila";
  remove.addEventListener("click", () => {
    if (rowsContainer.children.length > 1) {
      row.remove();
    }
  });

  inputIngrediente.addEventListener("change", () => syncCodigo(row));
  inputIngrediente.addEventListener("input", () => syncCodigo(row));

  row.append(inputIngrediente, inputCodigo, input, remove);
  return row;
};

const getOptionsFromSheet = async () => {
  try {
    const res = await fetch(`${GAS_ENDPOINT}?mode=ingredientes`);
    if (!res.ok) throw new Error("No se pudo obtener la lista.");
    const data = await res.json();
    if (!Array.isArray(data.items)) throw new Error("Respuesta inesperada.");
    return data.items;
  } catch (err) {
    console.error(err);
    setStatus("No se pudo cargar la lista de ingredientes.", "error");
    return [];
  }
};

let cachedOptions = [];

const renderDatalist = (options) => {
  const unique = [];
  const seen = new Set();
  options.forEach((opt) => {
    if (!opt.code || seen.has(opt.code)) return;
    seen.add(opt.code);
    unique.push(opt);
  });
  datalistEl.innerHTML = unique
    .map((opt) => `<option value="${opt.code}" label="${opt.name} · ${opt.code}"></option>`)
    .join("");
};

const syncCodigo = (row) => {
  const [ingredienteEl, codigoEl] = row.querySelectorAll("input");
  const val = (ingredienteEl.value || "").trim().toLowerCase();
  const match = cachedOptions.find((opt) => {
    const code = opt.code.toLowerCase();
    const name = opt.name.toLowerCase();
    return (
      code === val ||
      name === val ||
      `${name} · ${code}` === val ||
      `${code} · ${name}` === val
    );
  });
  if (match) {
    codigoEl.value = match.code;
    ingredienteEl.value = match.name;
  } else {
    codigoEl.value = "";
  }
};

const ensureRows = (count = 1) => {
  if (!rowsContainer.children.length) {
    rowsContainer.appendChild(createRow(cachedOptions));
  }
  while (rowsContainer.children.length < count) {
    rowsContainer.appendChild(createRow(cachedOptions));
  }
};

addRowBtn.addEventListener("click", () => {
  rowsContainer.appendChild(createRow(cachedOptions));
});

form.addEventListener("reset", () => {
  setTimeout(() => {
    rowsContainer.innerHTML = "";
    ensureRows(1);
    setStatus("", "");
  }, 0);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = Array.from(rowsContainer.children).map((row) => {
    const [ingredienteEl, codigoEl, stockEl] = row.querySelectorAll("input");
    const raw = (ingredienteEl.value || "").trim();
    const val = raw.toLowerCase();
    const match = cachedOptions.find((opt) => {
      const code = opt.code.toLowerCase();
      const name = opt.name.toLowerCase();
      return (
        code === val ||
        name === val ||
        `${name} · ${code}` === val ||
        `${code} · ${name}` === val
      );
    });

    return {
      codigo: codigoEl.value || (match ? match.code : raw),
      articulo: match ? match.name : "",
      stockInicial: Number((stockEl.value || "").trim()),
      matched: Boolean(match),
    };
  });

  const hasInvalid = payload.some(
    (item) => !item.codigo || Number.isNaN(item.stockInicial) || item.stockInicial < 0 || !item.matched
  );

  if (!payload.length || hasInvalid) {
    setStatus("Selecciona un codigo/nombre valido y stock (>= 0) en cada fila.", "error");
    return;
  }

  setStatus("Enviando...", "pending");

  try {
    const response = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        items: payload.map(({ codigo, articulo, stockInicial }) => ({ codigo, articulo, stockInicial })),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    if (data.status && data.status !== "ok") {
      throw new Error(data.message || "No se pudo guardar");
    }

    setStatus(data.message || "Guardado con exito.", "success");
    form.reset();
  } catch (error) {
    console.error(error);
    setStatus("No se pudo guardar. Revisa la conexion o el endpoint.", "error");
  }
});

(async () => {
  setStatus("Cargando ingredientes...", "pending");
  cachedOptions = await getOptionsFromSheet();
  cachedOptions = cachedOptions.filter((opt) => {
    const code = (opt.code || "").trim();
    const name = (opt.name || "").trim();
    if (!code || !name) return false;
    const upperCode = code.toUpperCase();
    const upperName = name.toUpperCase();
    if (upperCode === "CODIGO" || upperName === "ARTICULO") return false;
    return true;
  });
  renderDatalist(cachedOptions);
  ensureRows(1);
  if (cachedOptions.length) {
    setStatus("Lista cargada. Puedes registrar.", "success");
  }
})();
