import { useEffect, useState, useRef, useMemo } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Shirt,
  Settings,
  BookOpen,
  Upload,
  AlertCircle,
  CheckCircle,
  Layers,
  ToggleLeft,
  ToggleRight,
  Copy,
  Package,
} from "lucide-react";
import { db } from "../../services/firebase";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { normalizeText } from "../../utils/text";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function Models() {
  const { selectedCompanyId } = useAuth();
  const [models, setModels] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showProcesses, setShowProcesses] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", copyFrom: "" });
  const [loading, setLoading] = useState(false);
  
  // ✅ NUEVO: Estado para buscar modelos
  const [modelSearch, setModelSearch] = useState("");

  useEffect(() => {
    const loadModels = async () => {
      if (!selectedCompanyId) return;

      try {
        const q = query(
          collection(db, "models"),
          where("companyId", "==", selectedCompanyId),
        );
        const snap = await getDocs(q);
        const modelsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        modelsData.sort((a, b) => a.name.localeCompare(b.name));

        const modelsWithCount = await Promise.all(
          modelsData.map(async (model) => {
            try {
              const procsSnap = await getDocs(
                collection(db, "models", model.id, "processes"),
              );
              const activeCount = procsSnap.docs.filter(
                (d) => d.data().active !== false,
              ).length;
              return {
                ...model,
                processCount: activeCount,
                totalProcesses: procsSnap.size,
              };
            } catch {
              return { ...model, processCount: 0, totalProcesses: 0 };
            }
          }),
        );

        setModels(modelsWithCount);
      } catch (error) {
        console.error("Error cargando modelos:", error);
      }
    };
    loadModels();
  }, [selectedCompanyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setLoading(true);
    try {
      const data = {
        name: form.name.trim(),
        companyId: selectedCompanyId,
        createdAt: new Date(),
      };

      if (editing) {
        await updateDoc(doc(db, "models", editing.id), data);
        toast.success("Modelo actualizado");
      } else {
        const newModelRef = await addDoc(collection(db, "models"), data);

        if (form.copyFrom) {
          const sourceModel = models.find((m) => m.id === form.copyFrom);
          if (sourceModel) {
            const procsSnap = await getDocs(
              collection(db, "models", sourceModel.id, "processes"),
            );

            const activeProcs = procsSnap.docs.filter(
              (d) => d.data().active !== false,
            );

            if (activeProcs.length > 0) {
              const copyPromises = activeProcs.map(async (procDoc) => {
                const procData = procDoc.data();
                await addDoc(
                  collection(db, "models", newModelRef.id, "processes"),
                  {
                    name: procData.name,
                    price: procData.price,
                    clientPrice: procData.clientPrice || null,
                    observation: procData.observation || null,
                    active: true,
                    createdAt: new Date(),
                  },
                );
              });

              await Promise.all(copyPromises);
              toast.success(
                `Modelo creado con ${activeProcs.length} procesos copiados`,
              );
            } else {
              toast.success("Modelo creado");
            }
          } else {
            toast.success("Modelo creado");
          }
        } else {
          toast.success("Modelo creado");
        }
      }

      closeModal();
      await reloadModels();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (model) => {
    if (!confirm(`¿Eliminar "${model.name}" y todos sus procesos?`)) return;
    try {
      const procsSnap = await getDocs(
        collection(db, "models", model.id, "processes"),
      );
      await Promise.all(procsSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "models", model.id));
      toast.success("Modelo eliminado");
      await reloadModels();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const openEdit = (model) => {
    setEditing(model);
    setForm({ name: model.name, copyFrom: "" });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ name: "", copyFrom: "" });
  };

  const reloadModels = async () => {
    if (!selectedCompanyId) return;

    try {
      const q = query(
        collection(db, "models"),
        where("companyId", "==", selectedCompanyId),
      );
      const snap = await getDocs(q);
      const modelsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      modelsData.sort((a, b) => a.name.localeCompare(b.name));

      const modelsWithCount = await Promise.all(
        modelsData.map(async (model) => {
          try {
            const procsSnap = await getDocs(
              collection(db, "models", model.id, "processes"),
            );
            const activeCount = procsSnap.docs.filter(
              (d) => d.data().active !== false,
            ).length;
            return {
              ...model,
              processCount: activeCount,
              totalProcesses: procsSnap.size,
            };
          } catch {
            return { ...model, processCount: 0, totalProcesses: 0 };
          }
        }),
      );

      setModels(modelsWithCount);
    } catch (error) {
      console.error("Error recargando modelos:", error);
    }
  };

  // ✅ NUEVO: Filtrar modelos según búsqueda
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return models;
    
    const search = modelSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return models.filter((model) => {
      const name = model.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return name.includes(search);
    });
  }, [models, modelSearch]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Modelos</h2>
          <p className="text-gray-500 text-sm">
            {filteredModels.length} de {models.length} modelos
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo
        </Button>
      </div>

      {/* ✅ NUEVO: Buscador de modelos */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Buscar modelo..."
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {modelSearch && (
            <button
              onClick={() => setModelSearch("")}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {filteredModels.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Shirt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            {modelSearch
              ? "No se encontraron modelos"
              : "Aún no hay modelos"}
          </p>
          {modelSearch && (
            <button
              onClick={() => setModelSearch("")}
              className="mt-2 text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        // ✅ CAMBIO: Grid más compacto (5 columnas en pantallas grandes)
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition flex flex-col"
            >
              {/* ✅ CAMBIO: Aspect ratio más pequeño (3/4 en lugar de 4/5) */}
              <div className="aspect-[3/4] bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center relative">
                <Shirt className="w-12 h-12 md:w-16 md:h-16 text-primary-500" />

                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 flex items-center gap-1 shadow-sm">
                  <Layers className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary-600" />
                  <span className="text-xs font-bold text-primary-700">
                    {model.processCount || 0}
                  </span>
                </div>
              </div>
              
              {/* ✅ CAMBIO: Padding más pequeño */}
              <div className="p-2 md:p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-gray-900 truncate text-sm md:text-base">
                  {model.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 flex-1">
                  {model.processCount || 0} de {model.totalProcesses || 0} procesos
                </p>

                <div className="mt-2 md:mt-3 space-y-1 md:space-y-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full justify-center text-xs"
                    onClick={() => setShowProcesses(model)}
                  >
                    <Settings className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    Procesos
                  </Button>
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(model)}
                      className="justify-center text-xs"
                    >
                      <Edit2 className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(model)}
                      className="justify-center text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                    >
                      <Trash2 className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editing ? "Editar Modelo" : "Nuevo Modelo"}
              </h3>
              <button onClick={closeModal}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Nombre del modelo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Ej: Buso Mika"
              />

              {!editing && models.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 items-center gap-1.5">
                    <Copy className="w-4 h-4 text-primary-600" />
                    Copiar procesos de (opcional)
                  </label>
                  <select
                    value={form.copyFrom}
                    onChange={(e) =>
                      setForm({ ...form, copyFrom: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    <option value="">-- Sin copiar (crear vacío) --</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.processCount || 0} procesos)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Se copiarán todos los procesos activos del modelo
                    seleccionado
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProcesses && (
        <ProcessesModal
          model={showProcesses}
          allModels={models}
          onClose={() => {
            setShowProcesses(null);
            reloadModels();
          }}
        />
      )}
    </div>
  );
}

// ============ MODAL DE PROCESOS CON 2 COLUMNAS SIEMPRE VISIBLES ============

function ProcessesModal({ model, allModels, onClose }) {
  const [processes, setProcesses] = useState([]);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState({
    name: "",
    price: "",
    clientPrice: "",
    observation: "",
  });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const searchTimeout = useRef(null);

  // ✅ NUEVO: Estado para buscar/filtrar procesos en la lista
  const [processSearch, setProcessSearch] = useState("");

  // ✅ Estado para móvil: mostrar formulario o lista
  const [mobileView, setMobileView] = useState("list"); // "list" o "form"

  const sortProcesses = (processesData) => {
    return processesData.sort((a, b) => {
      const nameA = a.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const nameB = b.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    });
  };

  useEffect(() => {
    const loadProcesses = async () => {
      try {
        const snap = await getDocs(
          collection(db, "models", model.id, "processes"),
        );
        const processesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        sortProcesses(processesData);
        setProcesses(processesData);
      } catch {
        toast.error("Error al cargar procesos");
      }
    };
    loadProcesses();
  }, [model.id]);

  const toggleActive = async (proc) => {
    try {
      const newStatus = proc.active !== false;
      await updateDoc(doc(db, "models", model.id, "processes", proc.id), {
        active: !newStatus,
        updatedAt: new Date(),
      });
      toast.success(`Proceso ${!newStatus ? "activado" : "desactivado"}`);

      const snap = await getDocs(
        collection(db, "models", model.id, "processes"),
      );
      const processesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sortProcesses(processesData);
      setProcesses(processesData);
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const searchUnified = (searchTerm) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!searchTerm || searchTerm.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const groupResults = [];
        const processResults = [];
        const existingNames = new Set(
          processes.map((p) => p.name.toLowerCase()),
        );
        const seenProcessKeys = new Set();

        // 1. Buscar GRUPOS de procesos
        try {
          for (const m of allModels) {
            const procsSnap = await getDocs(
              collection(db, "models", m.id, "processes"),
            );
            const procs = procsSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((p) => p.active !== false);

            const grouped = {};
            procs.forEach((p) => {
              if (p.observation?.trim()) {
                const obs = p.observation.trim();
                if (!grouped[obs]) {
                  grouped[obs] = [];
                }
                grouped[obs].push(p);
              }
            });

            Object.keys(grouped).forEach((obs) => {
              if (obs.toLowerCase().includes(searchTerm.toLowerCase())) {
                const groupProcesses = grouped[obs];
                const newProcesses = groupProcesses.filter(
                  (p) => !existingNames.has(p.name.toLowerCase()),
                );

                if (newProcesses.length > 0) {
                  const totalFabrica = newProcesses.reduce(
                    (sum, p) => sum + (p.clientPrice || 0),
                    0,
                  );
                  const totalOperario = newProcesses.reduce(
                    (sum, p) => sum + (p.price || 0),
                    0,
                  );
                  const ganancia = totalFabrica - totalOperario;

                  groupResults.push({
                    type: "group",
                    observation: obs,
                    modelName: m.name,
                    processes: newProcesses,
                    totalProcesses: groupProcesses.length,
                    totalFabrica,
                    totalOperario,
                    ganancia,
                  });
                }
              }
            });
          }
        } catch (error) {
          console.error("Error buscando grupos:", error);
        }

        // 2. Buscar procesos INDIVIDUALES
        try {
          for (const m of allModels) {
            if (m.id === model.id) continue;

            const procsSnap = await getDocs(
              collection(db, "models", m.id, "processes"),
            );
            const procs = procsSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((p) => p.active !== false);

            procs.forEach((p) => {
              if (
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !existingNames.has(p.name.toLowerCase())
              ) {
                const key = `${p.name.toLowerCase()}_${p.price || 0}_${p.clientPrice || 0}`;

                if (!seenProcessKeys.has(key)) {
                  seenProcessKeys.add(key);
                  processResults.push({
                    type: "process",
                    name: p.name,
                    price: p.price || 0,
                    clientPrice: p.clientPrice || 0,
                    ganancia: (p.clientPrice || 0) - (p.price || 0),
                    modelName: m.name,
                  });
                }
              }
            });
          }
        } catch (error) {
          console.error("Error buscando procesos individuales:", error);
        }

        const allResults = [...groupResults, ...processResults];
        const total = allResults.length;
        // ✅ CAMBIO 1: Aumentar de 2 a 10 resultados máximos
        const limited = allResults.slice(0, 10);

        setTotalResults(total);
        setSuggestions(limited);
        setShowSuggestions(limited.length > 0);
      } catch (error) {
        console.error("Error en búsqueda unificada:", error);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setForm({ ...form, name: value });
    searchUnified(value);
  };

  const handleSelectSuggestion = (suggestion) => {
    const processName = suggestion.name.toLowerCase();
    const exists = processes.some((p) => p.name.toLowerCase() === processName);

    if (exists) {
      toast.error(
        `❌ El proceso "${suggestion.name}" ya existe en este modelo`,
      );
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    setForm({
      ...form,
      name: suggestion.name,
      price: suggestion.price?.toString() || "",
      clientPrice: suggestion.clientPrice?.toString() || "",
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSelectNew = (suggestion) => {
    const processName = suggestion.name.toLowerCase();
    const exists = processes.some((p) => p.name.toLowerCase() === processName);

    if (exists) {
      toast.error(
        `❌ El proceso "${suggestion.name}" ya existe en este modelo`,
      );
      setShowSuggestions(false);
      setSuggestions([]);
      return;
    }

    setForm({
      ...form,
      name: suggestion.name,
      price: "",
      clientPrice: "",
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSelectGroup = async (group) => {
    const existingInGroup = group.processes.filter((proc) =>
      processes.some((p) => p.name.toLowerCase() === proc.name.toLowerCase()),
    );

    if (existingInGroup.length > 0) {
      toast.error(
        ` Algunos procesos del grupo ya existen: ${existingInGroup.map((p) => p.name).join(", ")}`,
      );
      return;
    }

    setSaving(true);
    try {
      const promises = group.processes.map(async (proc) => {
        await addDoc(collection(db, "models", model.id, "processes"), {
          name: proc.name,
          price: proc.price || 0,
          clientPrice: proc.clientPrice || null,
          observation: proc.observation || null,
          active: true,
          createdAt: new Date(),
        });
      });

      await Promise.all(promises);

      toast.success(
        `✓ ${group.processes.length} procesos agregados del grupo "${group.observation}"`,
      );

      const snap = await getDocs(
        collection(db, "models", model.id, "processes"),
      );
      const processesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sortProcesses(processesData);
      setProcesses(processesData);

      setShowSuggestions(false);
      setSuggestions([]);
      resetForm();
    } catch (error) {
      console.error("Error creando grupo:", error);
      toast.error("Error al agregar los procesos del grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      toast.error("Completa todos los campos");
      return;
    }

    const processName = normalizeText(form.name.trim());

    const exists = processes.some(
      (p) =>
        p.name.toLowerCase() === processName.toLowerCase() &&
        p.id !== editing?.id,
    );

    if (exists && !editing) {
      toast.error(`❌ El proceso "${processName}" ya existe en este modelo`);
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: processName,
        price: parseFloat(form.price),
        clientPrice: form.clientPrice ? parseFloat(form.clientPrice) : null,
        observation: form.observation?.trim() || null,
        active: true,
      };

      if (editing) {
        await updateDoc(
          doc(db, "models", model.id, "processes", editing.id),
          data,
        );
        toast.success("Proceso actualizado");
      } else {
        await addDoc(collection(db, "models", model.id, "processes"), data);
        toast.success("Proceso agregado");

        const libraryQuery = query(
          collection(db, "globalProcesses"),
          where("name", "==", processName),
        );
        const librarySnap = await getDocs(libraryQuery);

        if (librarySnap.empty) {
          await addDoc(collection(db, "globalProcesses"), {
            name: processName,
            createdAt: new Date(),
          });
          toast.success("Agregado a biblioteca global");
        }
      }

      resetForm();

      const snap = await getDocs(
        collection(db, "models", model.id, "processes"),
      );
      const processesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sortProcesses(processesData);
      setProcesses(processesData);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proc) => {
    if (
      !confirm(
        `¿Eliminar permanentemente "${proc.name}"?\n\nEsta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "models", model.id, "processes", proc.id));
      toast.success("Proceso eliminado permanentemente");

      const snap = await getDocs(
        collection(db, "models", model.id, "processes"),
      );
      const processesData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sortProcesses(processesData);
      setProcesses(processesData);
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const resetForm = () => {
    setForm({ name: "", price: "", clientPrice: "", observation: "" });
    setEditing(null);
    setShowSuggestions(false);
    setSuggestions([]);
    setMobileView("list");
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value || 0);
  };

  const visibleProcesses = showInactive
    ? processes
    : processes.filter((p) => p.active !== false);

  // ✅ CAMBIO 2: Filtrar procesos según búsqueda
  const filteredProcesses = useMemo(() => {
    if (!processSearch.trim()) return visibleProcesses;
    
    const search = processSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    return visibleProcesses.filter((p) => {
      const name = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const observation = (p.observation || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      return name.includes(search) || observation.includes(search);
    });
  }, [visibleProcesses, processSearch]);

  const totalOperario = useMemo(() => {
    return filteredProcesses.reduce((sum, p) => sum + (p.price || 0), 0);
  }, [filteredProcesses]);

  const totalFabrica = useMemo(() => {
    return filteredProcesses.reduce((sum, p) => sum + (p.clientPrice || 0), 0);
  }, [filteredProcesses]);

  const ganancia = totalFabrica - totalOperario;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-2">
      {/* ✅ MODAL MÁS GRANDE EN DESKTOP */}
      <div className="bg-white w-full md:w-[98vw] md:max-w-7xl rounded-t-2xl md:rounded-2xl flex flex-col h-[95vh] md:h-[95vh] animate-fade-in">
        {/* HEADER FIJO */}
        <div className="flex-shrink-0 border-b border-gray-200 p-4 md:p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold">Procesos</h3>
              <p className="text-sm text-gray-500">{model.name}</p>
            </div>
            <button onClick={onClose}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium">
                Total fábrica
              </p>
              <p className="text-lg font-bold text-green-700">
                {formatCurrency(totalFabrica)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600 font-medium">
                Total operario
              </p>
              <p className="text-lg font-bold text-blue-700">
                {formatCurrency(totalOperario)}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-purple-600 font-medium">Ganancia</p>
              <p className="text-lg font-bold text-purple-700">
                {formatCurrency(ganancia)}
              </p>
            </div>
          </div>

          {/* Botones de acción y contador */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredProcesses.length} procesos{" "}
              {showInactive ? "(incluyendo inactivos)" : "activos"}
              {processSearch && ` (filtrados de ${visibleProcesses.length})`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
              </button>
              <Button
                onClick={() => setShowBulkImport(true)}
                size="sm"
                variant="secondary"
              >
                <Upload className="w-4 h-4 mr-1" />
                Importar
              </Button>
            </div>
          </div>

          {/* ✅ BOTÓN PARA MÓVIL: Cambiar entre formulario y lista */}
          <div className="md:hidden mt-3">
            <Button
              onClick={() =>
                setMobileView(mobileView === "list" ? "form" : "list")
              }
              className="w-full"
              variant="secondary"
            >
              {mobileView === "list" ? (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar nuevo proceso
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-2" />
                  Ver lista de procesos
                </>
              )}
            </Button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-hidden">
          {showBulkImport ? (
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <BulkImportModal
                model={model}
                existingProcesses={processes}
                onClose={() => setShowBulkImport(false)}
                onImportComplete={() => {
                  setShowBulkImport(false);
                  const loadProcesses = async () => {
                    const snap = await getDocs(
                      collection(db, "models", model.id, "processes"),
                    );
                    const processesData = snap.docs.map((d) => ({
                      id: d.id,
                      ...d.data(),
                    }));
                    sortProcesses(processesData);
                    setProcesses(processesData);
                  };
                  loadProcesses();
                }}
              />
            </div>
          ) : (
            <>
              {/* ✅ DESKTOP: 2 COLUMNAS SIEMPRE VISIBLES */}
              <div className="hidden md:flex h-full">
                {/* COLUMNA IZQUIERDA: FORMULARIO */}
                <div className="w-2/5 border-r border-gray-200 p-6 overflow-y-auto bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-900">
                      {editing ? "Editar Proceso" : "Nuevo Proceso"}
                    </h4>
                    {editing && (
                      <button
                        onClick={resetForm}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nombre del proceso
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Pegado de capucha"
                        value={form.name}
                        onChange={handleNameChange}
                        onBlur={() =>
                          setTimeout(() => setShowSuggestions(false), 200)
                        }
                        onFocus={() =>
                          suggestions.length > 0 && setShowSuggestions(true)
                        }
                        required
                        disabled={!!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        autoFocus
                      />

                      {/* DROPDOWN DE SUGERENCIAS */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                          {suggestions.filter((s) => s.type === "process")
                            .length > 0 && (
                            <>
                              <div className="p-2 bg-orange-50 border-b border-orange-200 sticky top-0">
                                <p className="text-xs text-orange-700 font-medium flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  Procesos existentes
                                </p>
                              </div>
                              {suggestions
                                .filter((s) => s.type === "process")
                                .map((s, idx) => (
                                  <div
                                    key={`proc-${idx}`}
                                    className="border-b border-gray-100"
                                  >
                                    <div className="px-3 py-2 bg-gray-50">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-medium text-gray-900">
                                          {s.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          De: {s.modelName}
                                        </p>
                                      </div>
                                      <div className="flex gap-3 text-xs">
                                        {s.clientPrice > 0 && (
                                          <span className="text-green-700 font-semibold">
                                            Fábrica:{" "}
                                            {formatCurrency(s.clientPrice)}
                                          </span>
                                        )}
                                        <span className="text-blue-700 font-semibold">
                                          Operario: {formatCurrency(s.price)}
                                        </span>
                                        {s.clientPrice > 0 && (
                                          <span className="text-purple-700 font-semibold">
                                            +{formatCurrency(s.ganancia)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2 p-2">
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectSuggestion(s);
                                        }}
                                        className="flex-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition"
                                      >
                                        Usar precios
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectNew(s);
                                        }}
                                        className="flex-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-xs font-medium transition"
                                      >
                                        Nuevo precio
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </>
                          )}

                          {suggestions.filter((s) => s.type === "group")
                            .length > 0 && (
                            <>
                              <div className="p-2 bg-purple-50 border-b border-purple-200 sticky top-0">
                                <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  Grupos de procesos
                                </p>
                              </div>
                              {suggestions
                                .filter((s) => s.type === "group")
                                .map((s, idx) => (
                                  <div
                                    key={`group-${idx}`}
                                    className="border-b border-gray-100"
                                  >
                                    <div className="px-3 py-2 bg-gray-50">
                                      <div className="flex items-start justify-between mb-1">
                                        <p className="text-sm font-bold text-purple-900 flex items-center gap-1">
                                          <Package className="w-3 h-3" />
                                          {s.observation}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          De: {s.modelName}
                                        </p>
                                      </div>
                                      <p className="text-xs text-gray-500 mb-2">
                                        {s.processes.length} procesos nuevos
                                        {s.totalProcesses >
                                          s.processes.length && (
                                          <span className="text-orange-600">
                                            {" "}
                                            (
                                            {s.totalProcesses -
                                              s.processes.length}{" "}
                                            ya existen)
                                          </span>
                                        )}
                                      </p>
                                      <div className="flex gap-3 text-xs mb-2 p-2 bg-white rounded">
                                        {s.totalFabrica > 0 && (
                                          <span className="text-green-700 font-semibold">
                                            Fábrica:{" "}
                                            {formatCurrency(s.totalFabrica)}
                                          </span>
                                        )}
                                        <span className="text-blue-700 font-semibold">
                                          Operario:{" "}
                                          {formatCurrency(s.totalOperario)}
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        {s.processes.map((proc, pIdx) => (
                                          <div
                                            key={pIdx}
                                            className="flex items-center justify-between text-xs bg-white rounded px-2 py-1"
                                          >
                                            <span className="text-gray-700">
                                              ▸ {proc.name}
                                            </span>
                                            <div className="flex gap-2">
                                              {proc.clientPrice && (
                                                <span className="text-green-600 font-medium">
                                                  {formatCurrency(
                                                    proc.clientPrice,
                                                  )}
                                                </span>
                                              )}
                                              <span className="text-blue-600 font-medium">
                                                {formatCurrency(proc.price)}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex gap-2 p-2">
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectGroup(s);
                                        }}
                                        disabled={saving}
                                        className="flex-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-xs font-medium transition disabled:opacity-50"
                                      >
                                        Crear grupo
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </>
                          )}

                          {totalResults > 10 && (
                            <div className="p-2 bg-yellow-50 border-t border-yellow-200 text-center">
                              <p className="text-xs text-yellow-700">
                                Mostrando 10 de {totalResults} resultados. Refina tu búsqueda.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {searching && (
                        <p className="text-xs text-gray-400 mt-1">
                          Buscando...
                        </p>
                      )}

                      {!searching &&
                        form.name &&
                        suggestions.length === 0 &&
                        !editing && (
                          <p className="text-xs text-gray-400 mt-1">
                            Se creará como nuevo proceso
                          </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                           Precio fábrica
                          <span className="text-xs text-gray-500 ml-1">
                            (opcional)
                          </span>
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          value={form.clientPrice}
                          onChange={(e) =>
                            setForm({ ...form, clientPrice: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          👷 Precio operario
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          value={form.price}
                          onChange={(e) =>
                            setForm({ ...form, price: e.target.value })
                          }
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Observación{" "}
                        <span className="text-xs text-gray-500">
                          (opcional)
                        </span>
                      </label>
                      <textarea
                        placeholder="Nota interna para recordar detalles del proceso"
                        value={form.observation}
                        onChange={(e) =>
                          setForm({ ...form, observation: e.target.value })
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={resetForm}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" disabled={saving}>
                        {saving
                          ? "Guardando..."
                          : editing
                            ? "Actualizar"
                            : "Agregar"}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* COLUMNA DERECHA: LISTA DE PROCESOS CON BUSCADOR */}
                <div className="w-3/5 flex flex-col h-full">
                  {/* ✅ CAMBIO 2: Buscador encima de la lista */}
                  <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="🔍 Buscar proceso en la lista..."
                        value={processSearch}
                        onChange={(e) => setProcessSearch(e.target.value)}
                        className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                      />
                      <svg
                        className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                      {processSearch && (
                        <button
                          onClick={() => setProcessSearch("")}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {processSearch && (
                      <p className="text-xs text-gray-500 mt-1">
                        Mostrando {filteredProcesses.length} de{" "}
                        {visibleProcesses.length} procesos
                      </p>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6">
                    <ProcessList
                      processes={filteredProcesses}
                      formatCurrency={formatCurrency}
                      onEdit={(p) => {
                        setEditing(p);
                        setForm({
                          name: p.name,
                          price: p.price?.toString() || "",
                          clientPrice: p.clientPrice?.toString() || "",
                          observation: p.observation || "",
                        });
                      }}
                      onToggle={toggleActive}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              </div>

              {/* ✅ MÓVIL: VISTA ÚNICA CON CAMBIO */}
              <div className="md:hidden h-full overflow-y-auto">
                {mobileView === "form" ? (
                  <div className="p-4 bg-gray-50 min-h-full">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-gray-900">
                        {editing ? "Editar Proceso" : "Nuevo Proceso"}
                      </h4>
                      {editing && (
                        <button
                          onClick={resetForm}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Nombre del proceso
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Pegado de capucha"
                          value={form.name}
                          onChange={handleNameChange}
                          onBlur={() =>
                            setTimeout(() => setShowSuggestions(false), 200)
                          }
                          onFocus={() =>
                            suggestions.length > 0 && setShowSuggestions(true)
                          }
                          required
                          disabled={!!editing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                          autoFocus
                        />

                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                            {suggestions.filter((s) => s.type === "process")
                              .length > 0 && (
                              <>
                                <div className="p-2 bg-orange-50 border-b border-orange-200 sticky top-0">
                                  <p className="text-xs text-orange-700 font-medium flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" />
                                    Procesos existentes
                                  </p>
                                </div>
                                {suggestions
                                  .filter((s) => s.type === "process")
                                  .map((s, idx) => (
                                    <div
                                      key={`proc-${idx}`}
                                      className="border-b border-gray-100"
                                    >
                                      <div className="px-3 py-2 bg-gray-50">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-sm font-medium text-gray-900">
                                            {s.name}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            De: {s.modelName}
                                          </p>
                                        </div>
                                        <div className="flex gap-3 text-xs">
                                          {s.clientPrice > 0 && (
                                            <span className="text-green-700 font-semibold">
                                              Fábrica:{" "}
                                              {formatCurrency(s.clientPrice)}
                                            </span>
                                          )}
                                          <span className="text-blue-700 font-semibold">
                                            Operario: {formatCurrency(s.price)}
                                          </span>
                                          {s.clientPrice > 0 && (
                                            <span className="text-purple-700 font-semibold">
                                              +{formatCurrency(s.ganancia)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex gap-2 p-2">
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectSuggestion(s);
                                          }}
                                          className="flex-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition"
                                        >
                                          Usar precios
                                        </button>
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectNew(s);
                                          }}
                                          className="flex-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-xs font-medium transition"
                                        >
                                          Nuevo precio
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </>
                            )}

                            {suggestions.filter((s) => s.type === "group")
                              .length > 0 && (
                              <>
                                <div className="p-2 bg-purple-50 border-b border-purple-200 sticky top-0">
                                  <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
                                    <Package className="w-3 h-3" />
                                    Grupos de procesos
                                  </p>
                                </div>
                                {suggestions
                                  .filter((s) => s.type === "group")
                                  .map((s, idx) => (
                                    <div
                                      key={`group-${idx}`}
                                      className="border-b border-gray-100"
                                    >
                                      <div className="px-3 py-2 bg-gray-50">
                                        <div className="flex items-start justify-between mb-1">
                                          <p className="text-sm font-bold text-purple-900 flex items-center gap-1">
                                            <Package className="w-3 h-3" />
                                            {s.observation}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            De: {s.modelName}
                                          </p>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">
                                          {s.processes.length} procesos nuevos
                                        </p>
                                        <div className="flex gap-3 text-xs mb-2 p-2 bg-white rounded">
                                          {s.totalFabrica > 0 && (
                                            <span className="text-green-700 font-semibold">
                                              Fábrica:{" "}
                                              {formatCurrency(s.totalFabrica)}
                                            </span>
                                          )}
                                          <span className="text-blue-700 font-semibold">
                                            Operario:{" "}
                                            {formatCurrency(s.totalOperario)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 p-2">
                                        <button
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectGroup(s);
                                          }}
                                          disabled={saving}
                                          className="flex-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-xs font-medium transition disabled:opacity-50"
                                        >
                                          Crear grupo
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </>
                            )}
                          </div>
                        )}

                        {searching && (
                          <p className="text-xs text-gray-400 mt-1">
                            Buscando...
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            🏭 Precio fábrica
                            <span className="text-xs text-gray-500 ml-1">
                              (opcional)
                            </span>
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={form.clientPrice}
                            onChange={(e) =>
                              setForm({ ...form, clientPrice: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                             Precio operario
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            placeholder="0.000"
                            value={form.price}
                            onChange={(e) =>
                              setForm({ ...form, price: e.target.value })
                            }
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Observación{" "}
                          <span className="text-xs text-gray-500">
                            (opcional)
                          </span>
                        </label>
                        <textarea
                          placeholder="Nota interna para recordar detalles del proceso"
                          value={form.observation}
                          onChange={(e) =>
                            setForm({ ...form, observation: e.target.value })
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={resetForm}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm" disabled={saving}>
                          {saving
                            ? "Guardando..."
                            : editing
                              ? "Actualizar"
                              : "Agregar"}
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* ✅ CAMBIO 2: Buscador en móvil también */}
                    <div className="mb-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="🔍 Buscar proceso..."
                          value={processSearch}
                          onChange={(e) => setProcessSearch(e.target.value)}
                          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        />
                        <svg
                          className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {processSearch && (
                          <button
                            onClick={() => setProcessSearch("")}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {processSearch && (
                        <p className="text-xs text-gray-500 mt-1">
                          Mostrando {filteredProcesses.length} de{" "}
                          {visibleProcesses.length} procesos
                        </p>
                      )}
                    </div>
                    
                    <ProcessList
                      processes={filteredProcesses}
                      formatCurrency={formatCurrency}
                      onEdit={(p) => {
                        setEditing(p);
                        setForm({
                          name: p.name,
                          price: p.price?.toString() || "",
                          clientPrice: p.clientPrice?.toString() || "",
                          observation: p.observation || "",
                        });
                        setMobileView("form");
                      }}
                      onToggle={toggleActive}
                      onDelete={handleDelete}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ COMPONENTE: LISTA DE PROCESOS CON ORDEN ALFABÉTICO UNIFICADO ============

function ProcessList({
  processes,
  formatCurrency,
  onEdit,
  onToggle,
  onDelete,
}) {
  if (processes.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">Sin procesos activos</div>
    );
  }

  // ✅ CREAR LISTA UNIFICADA: grupos e individuales mezclados
  const unifiedList = [];
  const processedGroups = new Set();

  processes.forEach((p) => {
    if (p.observation?.trim()) {
      const obs = p.observation.trim();

      // Solo agregar el grupo una vez
      if (!processedGroups.has(obs)) {
        processedGroups.add(obs);

        // Obtener todos los procesos de este grupo
        const groupProcesses = processes.filter(
          (proc) => proc.observation?.trim() === obs,
        );

        const totalOperario = groupProcesses.reduce(
          (sum, proc) => sum + (proc.price || 0),
          0,
        );
        const totalFabrica = groupProcesses.reduce(
          (sum, proc) => sum + (proc.clientPrice || 0),
          0,
        );
        const gananciaGrupo = totalFabrica - totalOperario;

        // ✅ Agregar grupo a la lista unificada
        unifiedList.push({
          type: "group",
          sortKey: obs
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
          observation: obs,
          processes: groupProcesses,
          totalOperario,
          totalFabrica,
          gananciaGrupo,
        });
      }
    } else {
      // ✅ Agregar proceso individual a la lista unificada
      unifiedList.push({
        type: "individual",
        sortKey: p.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
        process: p,
      });
    }
  });

  // ✅ ORDENAR TODO ALFABÉTICAMENTE
  unifiedList.sort((a, b) =>
    a.sortKey.localeCompare(b.sortKey, "es", { sensitivity: "base" }),
  );

  return (
    <div className="space-y-3">
      {unifiedList.map((item, index) => {
        if (item.type === "group") {
          // ✅ RENDERIZAR GRUPO
          return (
            <div
              key={`group-${item.observation}`}
              className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 overflow-hidden"
            >
              <div className="bg-orange-100/50 border-b border-orange-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-bold text-orange-900">
                    {item.observation}
                  </p>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                    {item.processes.length}{" "}
                    {item.processes.length === 1 ? "proceso" : "procesos"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  {item.totalFabrica > 0 && (
                    <>
                      <span className="text-green-700 font-semibold">
                        Fábrica: {formatCurrency(item.totalFabrica)}
                      </span>
                      <span className="text-orange-400">|</span>
                    </>
                  )}
                  <span className="text-blue-700 font-semibold">
                    Operario: {formatCurrency(item.totalOperario)}
                  </span>
                  {item.totalFabrica > 0 && (
                    <>
                      <span className="text-orange-400">|</span>
                      <span className="text-purple-700 font-semibold">
                        Ganancia: {formatCurrency(item.gananciaGrupo)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="divide-y divide-orange-100">
                {item.processes.map((p) => {
                  const isActive = p.active !== false;
                  const gananciaProc = (p.clientPrice || 0) - (p.price || 0);

                  return (
                    <div
                      key={p.id}
                      className={`p-3 flex items-center justify-between transition ${
                        isActive ? "hover:bg-orange-50/50" : "opacity-60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-400 text-xs"></span>
                          <p
                            className={`font-medium text-sm truncate ${isActive ? "text-gray-900" : "text-gray-500 line-through"}`}
                          >
                            {p.name}
                          </p>
                          {!isActive && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                          {p.clientPrice && (
                            <>
                              <span className="text-green-600 font-medium">
                                Fábrica: {formatCurrency(p.clientPrice)}
                              </span>
                              <span className="text-gray-400">|</span>
                            </>
                          )}
                          <span className="text-blue-600 font-medium">
                            Operario: {formatCurrency(p.price)}
                          </span>
                          {p.clientPrice && (
                            <>
                              <span className="text-gray-400">|</span>
                              <span className="text-purple-600 font-medium">
                                +{formatCurrency(gananciaProc)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => onEdit(p)}
                          className="p-2 hover:bg-orange-100 rounded text-gray-600"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onToggle(p)}
                          className={`p-2 rounded ${
                            isActive
                              ? "hover:bg-orange-200 text-orange-600"
                              : "hover:bg-green-100 text-green-600"
                          }`}
                          title={isActive ? "Desactivar" : "Activar"}
                        >
                          {isActive ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => onDelete(p)}
                          className="p-2 hover:bg-red-100 rounded text-red-500"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        } else {
          // ✅ RENDERIZAR PROCESO INDIVIDUAL
          const p = item.process;
          const isActive = p.active !== false;
          const isEven = index % 2 === 0;
          const gananciaProc = (p.clientPrice || 0) - (p.price || 0);

          return (
            <div
              key={p.id}
              className={`flex items-start justify-between p-3 rounded-lg border transition ${
                isActive
                  ? isEven
                    ? "bg-white border-gray-200 hover:bg-gray-50"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  : "bg-gray-100 border-gray-200 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`font-medium text-sm truncate ${isActive ? "text-gray-900" : "text-gray-500 line-through"}`}
                  >
                    {p.name}
                  </p>
                  {!isActive && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded flex-shrink-0">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {p.clientPrice && (
                    <>
                      <p className="text-xs font-semibold text-green-600">
                        Fábrica: {formatCurrency(p.clientPrice)}
                      </p>
                      <span className="text-gray-300">|</span>
                    </>
                  )}
                  <p
                    className={`text-xs font-semibold ${isActive ? "text-blue-600" : "text-gray-400"}`}
                  >
                    Operario: {formatCurrency(p.price)}
                  </p>
                  {p.clientPrice && (
                    <>
                      <span className="text-gray-300">|</span>
                      <p className="text-xs font-semibold text-purple-600">
                        Ganancia: {formatCurrency(gananciaProc)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button
                  onClick={() => onEdit(p)}
                  className="p-2 hover:bg-gray-200 rounded text-gray-600"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onToggle(p)}
                  className={`p-2 rounded ${
                    isActive
                      ? "hover:bg-orange-100 text-orange-600"
                      : "hover:bg-green-100 text-green-600"
                  }`}
                  title={isActive ? "Desactivar" : "Activar"}
                >
                  {isActive ? (
                    <ToggleRight className="w-4 h-4" />
                  ) : (
                    <ToggleLeft className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onDelete(p)}
                  className="p-2 hover:bg-red-100 rounded text-red-500"
                  title="Eliminar permanentemente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}

// ============ MODAL DE IMPORTACIÓN MASIVA ============

function BulkImportModal({
  model,
  existingProcesses,
  onClose,
  onImportComplete,
}) {
  const [inputText, setInputText] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [librarySuggestions, setLibrarySuggestions] = useState({});
  const [selectedSuggestions, setSelectedSuggestions] = useState({});

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(value || 0);
  };

  const calculateSimilarity = (str1, str2) => {
    const normalize = (s) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    const s1 = normalize(str1);
    const s2 = normalize(str2);

    if (s1 === s2) return 100;
    if (s1.length === 0 || s2.length === 0) return 0;

    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  };

  const findLibrarySuggestions = async (processName) => {
    try {
      const q = query(collection(db, "globalProcesses"));
      const snap = await getDocs(q);
      const library = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const suggestions = library
        .map((lib) => ({
          ...lib,
          similarity: calculateSimilarity(processName, lib.name),
        }))
        .filter(
          (lib) =>
            lib.similarity >= 75 &&
            lib.name.toLowerCase() !== processName.toLowerCase(),
        )
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      return suggestions;
    } catch (error) {
      console.error("Error buscando sugerencias:", error);
      return [];
    }
  };

  const parseData = async (text) => {
    const lines = text.trim().split("\n");
    const existingMap = new Map(
      existingProcesses.map((p) => [p.name.toLowerCase(), p]),
    );

    const result = {
      existing: [],
      new: [],
      errors: [],
    };

    const suggestions = {};

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line.trim()) continue;

      let parts = line
        .split(/\t|,|;|\|/)
        .map((p) => p.trim())
        .filter((p) => p);

      if (parts.length < 2) {
        parts = line
          .split(/\s{2,}/)
          .map((p) => p.trim())
          .filter((p) => p);
      }

      if (parts.length < 2) {
        result.errors.push({
          line: index + 1,
          text: line,
          reason: "Formato inválido (mínimo: nombre + precio fábrica)",
        });
        continue;
      }

      let name, priceFabrica, priceOperario, observation;

      if (parts.length === 2) {
        name = parts[0];
        priceFabrica = parts[1];
        priceOperario = null;
        observation = null;
      } else if (parts.length === 3) {
        name = parts[0];
        priceFabrica = parts[1];
        priceOperario = parts[2];
        observation = null;
      } else {
        name = parts[0];
        priceFabrica = parts[1];
        priceOperario = parts[2];
        observation = parts.slice(3).join(" ").trim() || null;
      }

      name = normalizeText(name);

      const priceFab = priceFabrica
        ? parseFloat(priceFabrica.replace(",", "."))
        : null;
      const priceOp = priceOperario
        ? parseFloat(priceOperario.replace(",", "."))
        : null;

      if (priceFab !== null && (isNaN(priceFab) || priceFab < 0)) {
        result.errors.push({
          line: index + 1,
          text: line,
          reason: "Precio fábrica inválido",
        });
        continue;
      }

      if (priceOp !== null && (isNaN(priceOp) || priceOp < 0)) {
        result.errors.push({
          line: index + 1,
          text: line,
          reason: "Precio operario inválido",
        });
        continue;
      }

      if (!name) {
        result.errors.push({
          line: index + 1,
          text: line,
          reason: "Nombre vacío",
        });
        continue;
      }

      const existing = existingMap.get(name);

      if (existing) {
        result.existing.push({
          id: existing.id,
          name,
          oldPriceOperario: existing.price,
          newPriceOperario: priceOp,
          oldPriceFabrica: existing.clientPrice || 0,
          newPriceFabrica: priceFab || 0,
          observation,
        });
      } else {
        const librarySuggestions = await findLibrarySuggestions(name);
        if (librarySuggestions.length > 0) {
          suggestions[index] = librarySuggestions;
        }

        result.new.push({
          name,
          priceFabrica: priceFab,
          priceOperario: priceOp,
          observation,
          lineIndex: index,
        });
      }
    }

    return { result, suggestions };
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast.error("Pega los datos primero");
      return;
    }

    setAnalyzing(true);

    try {
      const { result, suggestions } = await parseData(inputText);
      setParsedData(result);
      setLibrarySuggestions(suggestions);
      setSelectedSuggestions({});

      if (
        result.errors.length === 0 &&
        result.existing.length === 0 &&
        result.new.length === 0
      ) {
        toast.warning("No se encontraron datos válidos");
      }
    } catch (error) {
      console.error("Error analizando datos:", error);
      toast.error("Error al analizar los datos");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectSuggestion = (lineIndex, suggestionName) => {
    setSelectedSuggestions((prev) => ({
      ...prev,
      [lineIndex]: suggestionName,
    }));
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setSaving(true);
    try {
      for (const proc of parsedData.existing) {
        const updateData = {
          price: proc.newPriceOperario || proc.oldPriceOperario,
          clientPrice: proc.newPriceFabrica || null,
          active: true,
        };
        if (proc.observation) {
          updateData.observation = proc.observation;
        }
        await updateDoc(
          doc(db, "models", model.id, "processes", proc.id),
          updateData,
        );
      }

      for (const proc of parsedData.new) {
        const finalName = selectedSuggestions[proc.lineIndex] || proc.name;

        const newData = {
          name: finalName,
          price: proc.priceOperario || 0,
          clientPrice: proc.priceFabrica || null,
          observation: proc.observation || null,
          active: true,
        };

        await addDoc(collection(db, "models", model.id, "processes"), newData);

        const libraryQuery = query(
          collection(db, "globalProcesses"),
          where("name", "==", finalName),
        );
        const librarySnap = await getDocs(libraryQuery);

        if (librarySnap.empty) {
          await addDoc(collection(db, "globalProcesses"), {
            name: finalName,
            createdAt: new Date(),
          });
        }
      }

      const total = parsedData.existing.length + parsedData.new.length;
      toast.success(
        `${total} procesos ${total === 1 ? "importado" : "importados"} correctamente`,
      );

      onImportComplete();
    } catch (error) {
      console.error("Error importando:", error);
      toast.error("Error al importar procesos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-600" />
            Importar procesos masivamente
          </h3>
          <p className="text-sm text-gray-500">{model.name}</p>
        </div>
        <button onClick={onClose}>
          <X className="w-6 h-6" />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pega aquí los datos desde Excel:
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`NOMBRE\tFÁBRICA\tOPERARIO\tOBSERVACIÓN (opcional)
pegado etiqueta azul\t0.020\t0.010\tpegado etiqueta
pegado etiqueta cielo\t0.020\t0.010\tpegado etiqueta
acentado reata\t0.030\t0.015\tacentado reata - pegado reata
pegado reata\t0.030\t0.015\tacentado reata - pegado reata`}
          rows={8}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none font-mono text-sm"
        />
        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800 font-semibold mb-1">
            📋 Formato esperado (separado por tabulación, coma o |):
          </p>
          <ul className="text-xs text-blue-700 space-y-0.5 ml-4 list-disc">
            <li>
              <strong>Mínimo:</strong> Nombre + Precio fábrica
            </li>
            <li>
              <strong>Recomendado:</strong> Nombre + Fábrica + Operario
            </li>
            <li>
              <strong>Completo:</strong> Nombre + Fábrica + Operario +
              Observación
            </li>
          </ul>
          <p className="text-xs text-blue-600 mt-2 italic">
            💡 Los precios pueden tener hasta 3 decimales (ej: 0.025)
          </p>
        </div>
      </div>

      {!parsedData && (
        <Button onClick={handleAnalyze} className="w-full" disabled={analyzing}>
          {analyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            <>🔍 Analizar datos</>
          )}
        </Button>
      )}

      {parsedData && (
        <div className="space-y-3 animate-fade-in">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3">
              Resultado del análisis:
            </h4>

            {parsedData.existing.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-blue-700 flex items-center gap-1 mb-2">
                  <CheckCircle className="w-4 h-4" />
                  Existentes ({parsedData.existing.length}) - Se actualizarán
                  precios:
                </p>
                <div className="space-y-1 ml-5">
                  {parsedData.existing.map((p, i) => (
                    <div key={i} className="text-xs text-gray-600">
                      <p className="font-medium">• {p.name}</p>
                      <p className="ml-4 text-gray-500">
                        Fábrica: {formatCurrency(p.oldPriceFabrica)} →{" "}
                        {formatCurrency(p.newPriceFabrica)}
                      </p>
                      <p className="ml-4 text-gray-500">
                        Operario: {formatCurrency(p.oldPriceOperario)} →{" "}
                        {formatCurrency(p.newPriceOperario)}
                      </p>
                      {p.observation && (
                        <p className="ml-4 text-orange-600 italic">
                          Obs: {p.observation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedData.new.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-green-700 flex items-center gap-1 mb-2">
                  <Plus className="w-4 h-4" />
                  Nuevos ({parsedData.new.length}) - Se crearán:
                </p>
                <div className="space-y-2 ml-5">
                  {parsedData.new.map((p, i) => {
                    const suggestions = librarySuggestions[p.lineIndex] || [];
                    const selectedName =
                      selectedSuggestions[p.lineIndex] || p.name;

                    return (
                      <div
                        key={i}
                        className="bg-white rounded p-2 border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-600 font-medium">
                            • {selectedName}
                          </p>
                          {selectedSuggestions[p.lineIndex] && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                              Sugerencia aplicada
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 text-xs ml-4">
                          {p.priceFabrica && (
                            <span className="text-green-600">
                              Fábrica: {formatCurrency(p.priceFabrica)}
                            </span>
                          )}
                          <span className="text-blue-600">
                            Operario: {formatCurrency(p.priceOperario)}
                          </span>
                        </div>
                        {p.observation && (
                          <p className="text-xs text-orange-600 italic ml-4 mt-1">
                            💬 {p.observation}
                          </p>
                        )}

                        {suggestions.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-orange-600 font-medium mb-1">
                              💡 Sugerencias de la biblioteca:
                            </p>
                            <div className="space-y-1">
                              {suggestions.map((s, idx) => (
                                <button
                                  key={idx}
                                  onClick={() =>
                                    handleSelectSuggestion(p.lineIndex, s.name)
                                  }
                                  className={`w-full text-left px-2 py-1 rounded text-xs transition ${
                                    selectedSuggestions[p.lineIndex] === s.name
                                      ? "bg-primary-100 text-primary-700"
                                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                  }`}
                                >
                                  <span className="font-medium">{s.name}</span>
                                  <span className="text-gray-400 ml-2">
                                    ({s.similarity}% similar)
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {parsedData.errors.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-red-700 flex items-center gap-1 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  Con errores ({parsedData.errors.length}) - Se ignorarán:
                </p>
                <div className="space-y-1 ml-5">
                  {parsedData.errors.map((e, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      • Línea {e.line}: {e.reason} - "{e.text}"
                    </p>
                  ))}
                </div>
              </div>
            )}

            {parsedData.existing.length === 0 &&
              parsedData.new.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  No hay datos válidos para importar
                </p>
              )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setParsedData(null);
                setLibrarySuggestions({});
                setSelectedSuggestions({});
              }}
            >
              ← Volver
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={
                saving ||
                (parsedData.existing.length === 0 &&
                  parsedData.new.length === 0)
              }
            >
              {saving ? "Importando..." : "✓ Confirmar importación"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}