import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, getDoc, deleteDoc, query, where, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Shirt, ClipboardList, Users, BarChart3, BookOpen, PlusCircle, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { selectedCompanyId } = useAuth();
  const [stats, setStats] = useState({ 
    models: 0, 
    activeOrders: 0, 
    workers: 0,
    library: 0
  });
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Cargar nombre de la empresa
  useEffect(() => {
    const loadCompany = async () => {
      if (selectedCompanyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', selectedCompanyId));
          if (companyDoc.exists()) {
            setCompanyName(companyDoc.data().name);
          }
        } catch (error) {
          console.error('Error cargando empresa:', error);
        }
      }
    };
    loadCompany();
  }, [selectedCompanyId]);

  useEffect(() => {
    const loadStats = async () => {
      if (!selectedCompanyId) return;
      
      try {
        const modelsQuery = query(collection(db, 'models'), where('companyId', '==', selectedCompanyId));
        const ordersQuery = query(collection(db, 'orders'), where('companyId', '==', selectedCompanyId), where('status', '==', 'activa'));
        const productionQuery = query(collection(db, 'production'), where('companyId', '==', selectedCompanyId));
        
        const [models, orders, workers, library] = await Promise.all([
          getDocs(modelsQuery),
          getDocs(ordersQuery),
          getDocs(query(collection(db, 'users'), where('role', '==', 'operario'))),
          getDocs(collection(db, 'globalProcesses')),
          getDocs(productionQuery)
        ]);
        
        setStats({ 
          models: models.size, 
          activeOrders: orders.size, 
          workers: workers.size,
          library: library.size
        });
      } catch (error) {
        console.error('Error cargando estadísticas:', error);
      }
    };
    
    loadStats();
  }, [selectedCompanyId]);

  const menu = [
    { 
      to: '/admin/models', 
      icon: Shirt, 
      label: 'Modelos', 
      desc: 'Gestionar prendas y procesos', 
      color: 'bg-blue-500',
      count: stats.models 
    },
    { 
      to: '/admin/library', 
      icon: BookOpen, 
      label: 'Biblioteca', 
      desc: 'Procesos estándar del taller', 
      color: 'bg-orange-500',
      count: stats.library 
    },
    { 
      to: '/admin/orders', 
      icon: ClipboardList, 
      label: 'Órdenes', 
      desc: 'Órdenes de producción', 
      color: 'bg-green-600',
      count: stats.activeOrders 
    },
    { 
      to: '/admin/users', 
      icon: Users, 
      label: 'Usuarios', 
      desc: 'Operarios y administradores', 
      color: 'bg-purple-500',
      count: stats.workers 
    },
    { 
      to: '/admin/register', 
      icon: PlusCircle, 
      label: 'Registrar Producción', 
      desc: 'Registrar tu trabajo del día', 
      color: 'bg-green-500'
    },
    { 
      to: '/admin/reports', 
      icon: BarChart3, 
      label: 'Reportes', 
      desc: 'Pagos y producción', 
      color: 'bg-pink-500' 
    }
  ];

  // ✅ Función para resetear datos (MANTENER USUARIOS Y MODELOS)
  const handleResetData = async () => {
    if (confirmText !== 'BORRAR') {
      toast.error('Debes escribir "BORRAR" para confirmar');
      return;
    }

    if (!selectedCompanyId) {
      toast.error('No hay empresa seleccionada');
      return;
    }

    setResetting(true);
    try {
      let totalDeleted = 0;

      // ❌ NO BORRAR MODELOS NI SUS PROCESOS (se mantienen)

      // 1. Borrar órdenes (solo de esta empresa)
      const ordersQuery = query(collection(db, 'orders'), where('companyId', '==', selectedCompanyId));
      const ordersSnap = await getDocs(ordersQuery);
      for (const orderDoc of ordersSnap.docs) {
        await deleteDoc(orderDoc.ref);
        totalDeleted++;
      }

      // 2. Borrar producción (solo de esta empresa)
      const productionQuery = query(collection(db, 'production'), where('companyId', '==', selectedCompanyId));
      const productionSnap = await getDocs(productionQuery);
      for (const prodDoc of productionSnap.docs) {
        await deleteDoc(prodDoc.ref);
        totalDeleted++;
      }

      // 3. Borrar pagos (solo de esta empresa)
      const paymentsQuery = query(collection(db, 'payments'), where('companyId', '==', selectedCompanyId));
      const paymentsSnap = await getDocs(paymentsQuery);
      for (const payDoc of paymentsSnap.docs) {
        await deleteDoc(payDoc.ref);
        totalDeleted++;
      }

      // 4. Borrar contadores (solo de esta empresa)
      const countersQuery = query(collection(db, 'counters'), where('companyId', '==', selectedCompanyId));
      const countersSnap = await getDocs(countersQuery);
      for (const counterDoc of countersSnap.docs) {
        await deleteDoc(counterDoc.ref);
        totalDeleted++;
      }

      toast.success(`✓ Datos de "${companyName}" reseteados. ${totalDeleted} registros eliminados.\n\nSe conservaron: usuarios y modelos.`);
      setShowResetConfirm(false);
      setConfirmText('');
      
      // Recargar estadísticas
      const [models, orders] = await Promise.all([
        getDocs(query(collection(db, 'models'), where('companyId', '==', selectedCompanyId))),
        getDocs(query(collection(db, 'orders'), where('companyId', '==', selectedCompanyId), where('status', '==', 'activa')))
      ]);
      
      setStats({ 
        ...stats,
        models: models.size, 
        activeOrders: orders.size
      });
    } catch (error) {
      console.error('Error reseteando datos:', error);
      toast.error('Error al resetear los datos');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Tarjetas de menú */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {menu.map(item => (
          <Link 
            key={item.to} 
            to={item.to}
            className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-primary-300 transition-all active:scale-98"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center shadow-md`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {item.count}
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-lg">{item.label}</h3>
            <p className="text-gray-500 text-sm mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Zona de peligro - Resetear datos */}
      <div className="mt-8 border-2 border-red-200 rounded-xl p-5 bg-red-50">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900">Zona de peligro</h3>
            <p className="text-sm text-red-700 mt-1">
              Esta acción eliminará <strong>órdenes, producción, pagos y contadores</strong> de {companyName}.
              <br />
              <span className="text-green-700 font-semibold">Se conservarán: usuarios y modelos (con sus procesos).</span>
            </p>
          </div>
        </div>

        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Trash2 className="w-4 h-4" />
            Resetear datos de producción
          </button>
        ) : (
          <div className="bg-white rounded-lg p-4 border-2 border-red-300 animate-fade-in">
            <p className="text-sm font-semibold text-red-900 mb-2">
              ⚠️ Escribe <span className="bg-red-100 px-2 py-0.5 rounded font-mono">BORRAR</span> para confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Escribe BORRAR aquí..."
              className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none mb-3 font-mono"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowResetConfirm(false); setConfirmText(''); }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetData}
                disabled={resetting || confirmText !== 'BORRAR'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
              >
                {resetting ? 'Eliminando...' : '✓ Confirmar eliminación'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}