import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Package, Calendar, Palette, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ActiveOrders() {
  const { selectedCompanyId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [allProduction, setAllProduction] = useState([]);
  const [modelProcesses, setModelProcesses] = useState({});
  // ✅ CORREGIDO: Inicializar loading basado en selectedCompanyId
  const [loading, setLoading] = useState(!selectedCompanyId);

  // ✅ LISTENER: Órdenes activas
  useEffect(() => {
    if (!selectedCompanyId) return;  // ✅ Sin setState aquí

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'orders'),
        where('companyId', '==', selectedCompanyId),
        where('status', '==', 'activa')
      ),
      (snapshot) => {
        const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        ordersData.sort((a, b) => {
          const numA = parseInt(a.orderNumber) || 0;
          const numB = parseInt(b.orderNumber) || 0;
          return numA - numB;
        });
        setOrders(ordersData);
        setLoading(false);  // ✅ Esto SÍ está bien (dentro del callback)
      },
      (error) => {
        console.error('Error cargando órdenes:', error);
        setLoading(false);  // ✅ Esto SÍ está bien (dentro del callback)
      }
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // ✅ LISTENER: Producción
  useEffect(() => {
    if (!selectedCompanyId) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'production'),
        where('companyId', '==', selectedCompanyId)
      ),
      (snapshot) => {
        setAllProduction(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // Cargar procesos de cada modelo
  useEffect(() => {
    const loadModelProcesses = async () => {
      const processes = {};
      for (const order of orders) {
        if (!processes[order.modelId]) {
          try {
            const snap = await getDocs(
              collection(db, 'models', order.modelId, 'processes')
            );
            processes[order.modelId] = snap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(p => p.active !== false);
          } catch {
            processes[order.modelId] = [];
          }
        }
      }
      setModelProcesses(processes);
    };

    if (orders.length > 0) {
      loadModelProcesses();
    }
  }, [orders]);

  // ✅ Calcular progreso de cada orden
  const orderProgress = useMemo(() => {
    const progress = {};
    
    orders.forEach(order => {
      const processes = modelProcesses[order.modelId] || [];
      const totalProcesses = processes.length;
      
      const orderProduction = allProduction.filter(p => p.orderId === order.id);
      
      const processProduction = {};
      orderProduction.forEach(p => {
        if (!processProduction[p.processId]) {
          processProduction[p.processId] = 0;
        }
        processProduction[p.processId] += p.quantity;
      });
      
      const completedProcesses = Object.values(processProduction).filter(
        produced => produced >= order.quantity
      ).length;
      
      const percentage = totalProcesses > 0
        ? Math.round((completedProcesses / totalProcesses) * 100)
        : 0;
      
      progress[order.id] = {
        percentage,
        completedProcesses,
        totalProcesses
      };
    });
    
    return progress;
  }, [orders, allProduction, modelProcesses]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Órdenes Activas</h2>
        <p className="text-gray-500 text-sm">Modelos disponibles para producción</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No hay órdenes activas</p>
          <p className="text-sm text-gray-400 mt-1">La administradora creará órdenes pronto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const prog = orderProgress[order.id] || { percentage: 0, completedProcesses: 0, totalProcesses: 0 };
            
            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-20 bg-gradient-to-br from-primary-50 to-accent-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-primary-500" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Orden #{order.orderNumber}</p>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          {order.modelName}
                          {order.color && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              <Palette className="w-3 h-3" />
                              {order.color}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Cantidad: <span className="font-semibold">{order.quantity}</span>
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Activa
                      </span>
                    </div>
                    
                    {/* ✅ BARRA DE PROGRESO */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Progreso: {prog.percentage}%
                        </span>
                        <span className="text-xs text-gray-500">
                          {prog.completedProcesses}/{prog.totalProcesses} procesos
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            prog.percentage === 100
                              ? 'bg-gradient-to-r from-green-500 to-green-600'
                              : prog.percentage >= 50
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                : 'bg-gradient-to-r from-orange-500 to-orange-600'
                          }`}
                          style={{ width: `${prog.percentage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Entrega: {format(order.deliveryDate.toDate(), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}