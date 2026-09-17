import { useEffect, useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, X, LogOut, Building2 } from 'lucide-react';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';

export default function CompanyDashboard() {
  const { userData, selectCompany, clearCompany } = useAuth();
  const navigate = useNavigate();
  
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1' });
  const [saving, setSaving] = useState(false);

  // ✅ Detectar si es admin
  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error cargando empresas:', error);
        toast.error('Error al cargar empresas');
      } finally {
        setLoading(false);
      }
    };
    loadCompanies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const data = { 
        name: form.name.trim(),
        color: form.color,
        active: true
      };

      if (editing) {
        await updateDoc(doc(db, 'companies', editing.id), data);
        toast.success('Empresa actualizada');
      } else {
        await addDoc(collection(db, 'companies'), data);
        toast.success('Empresa creada');
      }

      closeModal();
      await reloadCompanies();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company) => {
    if (!confirm(`¿Eliminar "${company.name}"?\n\nNota: Esto no eliminará los modelos ni órdenes asociados.`)) return;
    try {
      await deleteDoc(doc(db, 'companies', company.id));
      toast.success('Empresa eliminada');
      await reloadCompanies();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openEdit = (company) => {
    setEditing(company);
    setForm({ name: company.name, color: company.color || '#6366f1' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', color: '#6366f1' });
  };

  const reloadCompanies = async () => {
    const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // ✅ Redirigir según el rol
  const handleSelectCompany = (companyId) => {
    selectCompany(companyId);
    
    if (userData?.role === 'operario') {
      navigate('/operario/dashboard');
    } else {
      navigate('/admin/dashboard');
    }
  };

  const handleLogout = async () => {
    if (!confirm('¿Cerrar sesión?')) return;
    try {
      await signOut(auth);
      clearCompany();
      toast.success('Sesión cerrada');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Hola, {userData?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 mt-1">
              {isAdmin 
                ? 'Selecciona una empresa para comenzar a trabajar'
                : 'Elige la empresa para la que trabajarás ahora'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>

        {/* Grid de Empresas */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando empresas...</div>
        ) : companies.length === 0 ? (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Aún no hay empresas registradas</p>
            {isAdmin && (
              <>
                <p className="text-sm text-gray-400 mt-1">Crea la primera empresa para comenzar</p>
                <Button onClick={() => setShowModal(true)} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />Nueva Empresa
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {companies.map(company => (
              <div 
                key={company.id} 
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition group"
              >
                {/* Franja de color */}
                <div 
                  className="h-2 w-full" 
                  style={{ backgroundColor: company.color || '#6366f1' }}
                />
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: company.color || '#6366f1' }}
                    >
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                    {/* ✅ Solo admin puede editar/eliminar */}
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button 
                          onClick={() => openEdit(company)}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button 
                          onClick={() => handleDelete(company)}
                          className="p-2 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{company.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {isAdmin ? 'Haz clic para entrar' : 'Haz clic para seleccionar'}
                  </p>
                  
                  <Button 
                    onClick={() => handleSelectCompany(company.id)}
                    className="w-full justify-center"
                    style={{ 
                      backgroundColor: company.color || '#6366f1',
                      borderColor: company.color || '#6366f1'
                    }}
                  >
                    {isAdmin ? 'Ingresar' : 'Seleccionar'}
                  </Button>
                </div>
              </div>
            ))}
            
            {/* ✅ Solo admin puede crear nueva empresa */}
            {isAdmin && (
              <button
                onClick={() => setShowModal(true)}
                className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 hover:text-primary-600 transition min-h-[200px]"
              >
                <Plus className="w-8 h-8 mb-2" />
                <span className="font-medium">Nueva Empresa</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ✅ Modal solo para admin */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editing ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
              <button onClick={closeModal}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input 
                label="Nombre de la empresa" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                required 
                placeholder="Ej: Nike, Adidas..." 
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Color distintivo
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="#6366f1"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeModal} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}