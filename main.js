const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwfa1aM0Knqs4zwP6dtobne_HBsdL8SQQ6HHHuAAdPBMN74n3KBhwiv8M_sOiUZm9Yc/exec
";
const MENU_LINK = "https://menu-general.vercel.app/"; // URL del menú principal

const form = document.getElementById("inventory-form");
const statusEl = document.getElementById("status");
const rowsContainer = document.getElementById("rows");
const addRowBtn = document.getElementById("add-row");
const menuLinkEl = document.getElementById("menu-link");
const datalistEl = document.getElementById("ingredientes-list");
const responsableEl = document.getElementById("responsable");
const confirmModalEl = document.getElementById("confirm-modal");
const confirmModalItemsEl = document.getElementById("confirm-modal-items");
const modalCloseEl = document.getElementById("modal-close");
const modalBackEl = document.getElementById("modal-back");
const modalConfirmEl = document.getElementById("modal-confirm");
const modalAgreeEl = document.getElementById("modal-agree");
const modalResponsableNameEl = document.getElementById("modal-responsable-name");

menuLinkEl.href = MENU_LINK;

const setStatus = (message, type) => {
  statusEl.textContent = message;
  statusEl.className = `status ${type || ""}`.trim();
};

const RESPONSABLE_STORAGE_KEY = "maestroInventario.responsable";

const getResponsable = () => (responsableEl ? (responsableEl.value || "").trim() : "");

const findOptionMatch = (rawValue) => {
  const val = (rawValue || "").trim().toLowerCase();
  if (!val) return null;
  return (
    cachedOptions.find((opt) => {
      const code = opt.code.toLowerCase();
      const name = opt.name.toLowerCase();
      return (
        code === val ||
        name === val ||
        `${name} · ${code}` === val ||
        `${code} · ${name}` === val
      );
    }) || null
  );
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const setInvalid = (el, invalid) => {
  if (!el) return;
  el.classList.toggle("is-invalid", Boolean(invalid));
};

const getLocalISODate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const getDefaultDateForNewRow = () => {
  const firstDate = rowsContainer.querySelector('input[name="fecha"]');
  return (firstDate && firstDate.value) || getLocalISODate();
};

const createRow = () => {
  const row = document.createElement("div");
  row.className = "item-row";

  const inputFecha = document.createElement("input");
  inputFecha.name = "fecha";
  inputFecha.type = "date";
  inputFecha.required = true;
  inputFecha.className = "input";
  inputFecha.value = getDefaultDateForNewRow();

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

  row.append(inputFecha, inputIngrediente, inputCodigo, input, remove);
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
  const ingredienteEl = row.querySelector('input[name="ingrediente"]');
  const codigoEl = row.querySelector('input[name="codigo"]');
  const match = findOptionMatch(ingredienteEl.value || "");
  if (match) {
    codigoEl.value = match.code;
    ingredienteEl.value = match.name;
  } else {
    codigoEl.value = "";
  }
};

const buildPayloadFromRows = () => {
  return Array.from(rowsContainer.children).map((row) => {
    const fechaEl = row.querySelector('input[name="fecha"]');
    const ingredienteEl = row.querySelector('input[name="ingrediente"]');
    const codigoEl = row.querySelector('input[name="codigo"]');
    const stockEl = row.querySelector('input[name="stock"]');

    const fecha = (fechaEl && fechaEl.value) || "";
    const raw = (ingredienteEl.value || "").trim();
    const match = findOptionMatch(raw);

    return {
      fecha,
      codigo: codigoEl.value || (match ? match.code : raw),
      articulo: match ? match.name : "",
      unidad: (match && match.unit) || "-",
      stockInicial: Number((stockEl.value || "").trim()),
      matched: Boolean(match),
    };
  });
};

let pendingSubmission = null;
let isSubmitting = false;

const renderConfirmItems = (items) => {
  if (!confirmModalItemsEl) return;
  if (!items.length) {
    confirmModalItemsEl.innerHTML = '<div class="modal-table__empty">No hay productos para confirmar.</div>';
    return;
  }
  confirmModalItemsEl.innerHTML = items
    .map(
      (item) => `
      <div class="modal-table__row">
        <span>${escapeHtml(item.codigo)}</span>
        <span>${escapeHtml(item.articulo)}</span>
        <span>${escapeHtml(item.unidad)}</span>
        <span>${escapeHtml(item.stockInicial)}</span>
      </div>`
    )
    .join("");
};

const closeConfirmModal = () => {
  if (!confirmModalEl) return;
  confirmModalEl.classList.remove("is-open");
  confirmModalEl.setAttribute("aria-hidden", "true");
  pendingSubmission = null;
  if (modalAgreeEl) modalAgreeEl.checked = false;
  if (modalConfirmEl) modalConfirmEl.disabled = true;
  document.body.style.overflow = "";
};

const openConfirmModal = (responsable, items) => {
  if (!confirmModalEl) return;
  pendingSubmission = { responsable, items };
  renderConfirmItems(items);
  if (modalResponsableNameEl) {
    modalResponsableNameEl.textContent = responsable || "responsable";
  }
  if (modalAgreeEl) modalAgreeEl.checked = false;
  if (modalConfirmEl) modalConfirmEl.disabled = true;
  confirmModalEl.classList.add("is-open");
  confirmModalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const sendPayload = async ({ responsable, items }) => {
  if (isSubmitting) return;
  isSubmitting = true;
  if (modalConfirmEl) modalConfirmEl.disabled = true;
  setStatus("Enviando...", "pending");

  try {
    const response = await fetch(GAS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        responsable,
        items: items.map(({ fecha, codigo, articulo, stockInicial }) => ({ fecha, codigo, articulo, stockInicial })),
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
    closeConfirmModal();
    form.reset();
  } catch (error) {
    console.error(error);
    setStatus("No se pudo guardar. Revisa la conexion o el endpoint.", "error");
    if (modalConfirmEl) modalConfirmEl.disabled = !(modalAgreeEl && modalAgreeEl.checked);
  } finally {
    isSubmitting = false;
  }
};

if (confirmModalEl) {
  confirmModalEl.addEventListener("click", (event) => {
    if (event.target && event.target.dataset && event.target.dataset.closeModal === "true") {
      closeConfirmModal();
    }
  });
}

if (modalCloseEl) modalCloseEl.addEventListener("click", closeConfirmModal);
if (modalBackEl) modalBackEl.addEventListener("click", closeConfirmModal);

if (modalAgreeEl && modalConfirmEl) {
  modalAgreeEl.addEventListener("change", () => {
    modalConfirmEl.disabled = !modalAgreeEl.checked || isSubmitting;
  });
}

if (modalConfirmEl) {
  modalConfirmEl.addEventListener("click", async () => {
    if (!pendingSubmission || !modalAgreeEl || !modalAgreeEl.checked) return;
    await sendPayload(pendingSubmission);
  });
}

const ensureRows = (count = 1) => {
  if (!rowsContainer.children.length) {
    rowsContainer.appendChild(createRow());
  }
  while (rowsContainer.children.length < count) {
    rowsContainer.appendChild(createRow());
  }
};

addRowBtn.addEventListener("click", () => {
  rowsContainer.appendChild(createRow());
});

form.addEventListener("reset", () => {
  setTimeout(() => {
    closeConfirmModal();
    rowsContainer.innerHTML = "";
    ensureRows(1);
    setStatus("", "");
  }, 0);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const responsable = getResponsable();
  if (!responsable) {
    setInvalid(responsableEl, true);
    setStatus("El campo Responsable es obligatorio.", "error");
    responsableEl && responsableEl.focus();
    return;
  }
  setInvalid(responsableEl, false);

  const payload = buildPayloadFromRows();

  const hasInvalidDate = payload.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.fecha || ""));

  const hasInvalid = payload.some(
    (item) => !item.codigo || Number.isNaN(item.stockInicial) || item.stockInicial < 0 || !item.matched
  );

  if (!payload.length || hasInvalid || hasInvalidDate) {
    setStatus("Selecciona una fecha valida, un codigo/nombre valido y stock (>= 0) en cada fila.", "error");
    return;
  }

  setStatus("Revisa los datos en la ventana de confirmacion.", "pending");
  openConfirmModal(responsable, payload);
});

if (responsableEl) {
  const saved = localStorage.getItem(RESPONSABLE_STORAGE_KEY);
  if (saved) responsableEl.value = saved;
  responsableEl.addEventListener("input", () => {
    setInvalid(responsableEl, false);
    localStorage.setItem(RESPONSABLE_STORAGE_KEY, getResponsable());
  });
}

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
