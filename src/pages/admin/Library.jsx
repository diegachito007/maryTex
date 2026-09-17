import { useEffect, useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { Plus, Edit2, Trash2, BookOpen, Search } from 'lucide-react';
import { db } from '../../services/firebase';
import { Button } from '../../components/ui/Button';
import { normalizeText } from '../../utils/text';
import toast from 'react-hot-toast';

export default function Library() {
  const [processes, setProcesses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Cargar procesos globales
  useEffect(() => {
    const loadProcesses = async () => {
      try {
        const q = query(collection(db, 'globalProcesses'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        setProcesses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        toast.error('Error al cargar biblioteca');
      } finally {
        setLoading(false);
      }
    };
    loadProcesses();
  }, []);

  // Filtrar por búsqueda
  const filteredProcesses = processes.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    // Normalizar el nombre: minúsculas y sin tildes
    const normalizedName = normalizeText(form.name);

    // Validar duplicados (comparando nombres normalizados)
    const exists = processes.some(
      p => p.name === normalizedName && p.id !== editing?.id
    );
    if (exists) {
      toast.error('Este proceso ya existe en la biblioteca');
      return;
    }

    setSaving(true);
    try {
      const data = { name: normalizedName };

      if (editing) {
        await updateDoc(doc(db, 'globalProcesses', editing.id), data);
        toast.success('Proceso actualizado');
      } else {
        data.createdAt = new Date();
        await addDoc(collection(db, 'globalProcesses'), data);
        toast.success('Proceso agregado a la biblioteca');
      }

      resetForm();
      
      // Recargar
      const q = query(collection(db, 'globalProcesses'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setProcesses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proc) => {
    if (!confirm(`¿Eliminar "${proc.name}" de la biblioteca?`)) return;
    try {
      await deleteDoc(doc(db, 'globalProcesses', proc.id));
      toast.success('Proceso eliminado');
      
      const q = query(collection(db, 'globalProcesses'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setProcesses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openEdit = (proc) => {
    setEditing(proc);
    setForm({ name: proc.name });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ name: '' });
    setEditing(null);
    setShowForm(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Biblioteca de Procesos</h2>
          <p className="text-gray-500 text-sm">
            {processes.length} procesos estándar registrados
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />Nuevo
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {editing ? 'Editar proceso' : 'Nuevo proceso estándar'}
              </label>
              <input
                type="text"
                placeholder="Ej: Unión de hombros"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                El nombre se guardará en minúsculas y sin tildes
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Agregar'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Búsqueda */}
      {processes.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar proceso..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          />
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : filteredProcesses.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            {searchTerm ? 'No se encontraron procesos' : 'Aún no hay procesos en la biblioteca'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {searchTerm 
              ? 'Intenta con otro término' 
              : 'Agrega procesos estándar para reutilizarlos en cualquier modelo'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProcesses.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                </div>
                <p className="font-medium text-gray-900">{p.name}</p>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => openEdit(p)} 
                  className="p-2 hover:bg-gray-100 rounded transition"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
                <button 
                  onClick={() => handleDelete(p)} 
                  className="p-2 hover:bg-red-50 rounded transition"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Los procesos que agregues aquí aparecerán como sugerencias 
          cuando crees procesos en cualquier modelo. Solo escribe y el sistema los encontrará automáticamente.
          Todos los nombres se normalizan (minúsculas y sin tildes) para evitar duplicados.
        </p>
      </div>
    </div>
  );
}