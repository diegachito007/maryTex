import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { BarChart3, Package, DollarSign, Users, Calendar, TrendingUp, CheckCircle, Clock, AlertCircle, Award, CreditCard, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { format, isWithinInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('produccion');
  const [allProduction, setAllProduction] = useState([]);
  const [orders, setOrders] = useState([]);
  const [models, setModels] = useState([]);
  const [modelProcesses, setModelProcesses] = useState({});
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros de fecha
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // LISTENER: Producción
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'production'),
      (snapshot) => {
        setAllProduction(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // LISTENER: Órdenes
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'orders'), orderBy('orderNumber', 'desc')),
      (snapshot) => {
        setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, []);

  // LISTENER: Modelos
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'models'), orderBy('name', 'asc')),
      (snapshot) => {
        setModels(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, []);

  // LISTENER: Usuarios
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, []);

  // LISTENER: Pagos
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'payments'), orderBy('date', 'desc')),
      (snapshot) => {
        setPayments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubscribe();
  }, []);

  // Cargar procesos de cada modelo
  useEffect(() => {
    const loadModelProcesses = async () => {
      const processes = {};
      for (const model of models) {
        try {
          const snap = await getDocs(collection(db, 'models', model.id, 'processes'));
          processes[model.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
          console.error(`Error cargando procesos de modelo ${model.id}:`, error);
          processes[model.id] = [];
        }
      }
      setModelProcesses(processes);
    };
    
    if (models.length > 0) {
      loadModelProcesses();
    }
  }, [models]);

  // Calcular rango de fechas según filtro
  const dateRange = useMemo(() => {
    const now = new Date();
    
    if (dateFilter === 'all') return null;
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start, end };
    }
    if (dateFilter === 'week') {
      const end = now;
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return { start, end };
    }
    if (dateFilter === 'month') {
      const end = now;
      const start = subMonths(now, 1);
      return { start, end };
    }
    if (dateFilter === 'custom' && customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59);
      return { start, end };
    }
    
    return null;
  }, [dateFilter, customStart, customEnd]);

  // Filtrar producción por fecha (para pestaña Producción)
  const filteredProduction = useMemo(() => {
    if (dateFilter === 'all') return allProduction;
    if (!dateRange) return allProduction;
    
    return allProduction.filter(r => {
      const recordDate = r.date.toDate();
      return isWithinInterval(recordDate, { 
        start: dateRange.start, 
        end: dateRange.end 
      });
    });
  }, [allProduction, dateRange, dateFilter]);

  // Obtener TODAS las órdenes completadas (histórico global)
  const allCompletedOrders = useMemo(() => {
    return orders.filter(o => o.status === 'terminada');
  }, [orders]);

  // IDs de todas las órdenes completadas (histórico global)
  const allCompletedOrderIds = useMemo(() => {
    return new Set(allCompletedOrders.map(o => o.id));
  }, [allCompletedOrders]);

  // ============ CÁLCULOS PARA PESTAÑA PRODUCCIÓN ============
  const productionStats = useMemo(() => {
    const totalProcesses = filteredProduction.reduce((sum, r) => sum + r.quantity, 0);
    const totalEarnings = filteredProduction.reduce((sum, r) => sum + r.total, 0);
    
    // Por operario
    const byWorker = {};
    filteredProduction.forEach(r => {
      if (!byWorker[r.userId]) {
        byWorker[r.userId] = {
          userId: r.userId,
          userName: r.userName,
          processes: 0,
          earnings: 0,
          records: 0
        };
      }
      byWorker[r.userId].processes += r.quantity;
      byWorker[r.userId].earnings += r.total;
      byWorker[r.userId].records += 1;
    });
    
    const topWorkers = Object.values(byWorker).sort((a, b) => b.earnings - a.earnings);
    
    // ✅ POR MODELO - Calcular unidades COMPLETADAS (no procesos)
    const byModel = {};
    
    // Agrupar producción por modelo y proceso
    const productionByModelAndProcess = {};
    filteredProduction.forEach(r => {
      if (!productionByModelAndProcess[r.modelId]) {
        productionByModelAndProcess[r.modelId] = {};
      }
      if (!productionByModelAndProcess[r.modelId][r.processId]) {
        productionByModelAndProcess[r.modelId][r.processId] = 0;
      }
      productionByModelAndProcess[r.modelId][r.processId] += r.quantity;
    });
    
    // Calcular unidades completadas por modelo (mínimo entre todos los procesos)
    Object.keys(productionByModelAndProcess).forEach(modelId => {
      const processQuantities = Object.values(productionByModelAndProcess[modelId]);
      const completedUnits = processQuantities.length > 0 
        ? Math.min(...processQuantities) 
        : 0;
      
      const model = filteredProduction.find(r => r.modelId === modelId);
      
      byModel[modelId] = {
        modelId: modelId,
        modelName: model?.modelName || 'Desconocido',
        completedUnits: completedUnits,
        earnings: filteredProduction
          .filter(r => r.modelId === modelId)
          .reduce((sum, r) => sum + r.total, 0)
      };
    });
    
    const topModels = Object.values(byModel).sort((a, b) => b.completedUnits - a.completedUnits);
    
    return { totalProcesses, totalEarnings, topWorkers, topModels };
  }, [filteredProduction]);

  // ============ CÁLCULOS PARA PESTAÑA PAGOS (TOTALES GLOBALES) ============
  const paymentStats = useMemo(() => {
    const operarios = users.filter(u => u.role === 'operario' && u.status === 'approved');
    
    const workerStats = operarios.map(worker => {
      // Toda la producción del operario (histórico completo)
      const allWorkerProduction = allProduction.filter(r => r.userId === worker.id);
      
      // Producción del operario SOLO en órdenes completadas (histórico global)
      const workerProductionInCompleted = allWorkerProduction.filter(r => 
        allCompletedOrderIds.has(r.orderId)
      );
      
      // Total ganado GLOBAL (todas las órdenes completadas)
      const totalEarned = workerProductionInCompleted.reduce((sum, r) => sum + r.total, 0);
      
      // Pagos registrados (histórico completo)
      const workerPayments = payments.filter(p => p.userId === worker.id);
      const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
      
      // Órdenes completadas donde trabajó este operario (histórico global)
      const workerCompletedOrders = allCompletedOrders.filter(o => 
        allWorkerProduction.some(r => r.orderId === o.id)
      );
      
      // Órdenes en proceso donde trabajó este operario
      const workerInProgressOrders = orders.filter(o => {
        if (o.status === 'terminada') return false;
        return allWorkerProduction.some(r => r.orderId === o.id);
      });
      
      return {
        ...worker,
        totalEarned,
        totalPaid,
        pending: totalEarned - totalPaid,
        processes: workerProductionInCompleted.reduce((sum, r) => sum + r.quantity, 0),
        completedOrders: workerCompletedOrders,
        inProgressOrders: workerInProgressOrders,
        allWorkerProduction
      };
    });
    
    const totalEarned = workerStats.reduce((sum, w) => sum + w.totalEarned, 0);
    const totalPaid = workerStats.reduce((sum, w) => sum + w.totalPaid, 0);
    const totalPending = workerStats.reduce((sum, w) => sum + w.pending, 0);
    
    return { workerStats, totalEarned, totalPaid, totalPending };
  }, [users, allProduction, payments, allCompletedOrders, allCompletedOrderIds, orders]);

  // ============ CÁLCULOS PARA PESTAÑA ÓRDENES ============
  const orderStats = useMemo(() => {
    const activeOrders = orders.filter(o => o.status === 'activa');
    const completedOrders = orders.filter(o => o.status === 'terminada');
    
    const ordersWithProgress = activeOrders.map(order => {
      const model = models.find(m => m.id === order.modelId);
      if (!model) {
        return {
          ...order,
          totalProduced: 0,
          totalProcesses: 0,
          completedProcesses: 0,
          percentage: 0,
          totalExpected: 0
        };
      }
      
      const modelProcs = modelProcesses[model.id] || [];
      const totalProcesses = modelProcs.length;
      
      const orderProduction = allProduction.filter(p => p.orderId === order.id);
      const totalProduced = orderProduction.reduce((sum, p) => sum + p.quantity, 0);
      const totalExpected = order.quantity * totalProcesses;
      
      const percentage = totalExpected > 0 
        ? Math.min(Math.round((totalProduced / totalExpected) * 100), 100) 
        : 0;
      
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
      
      return {
        ...order,
        totalProduced,
        totalProcesses,
        completedProcesses,
        percentage,
        totalExpected
      };
    });
    
    return { activeOrders: ordersWithProgress, completedOrders };
  }, [orders, allProduction, models, modelProcesses]);

  // ============ CÁLCULOS PARA PESTAÑA OPERARIOS ============
  const workerRanking = useMemo(() => {
    const operarios = users.filter(u => u.role === 'operario' && u.status === 'approved');
    
    const ranking = operarios.map(worker => {
      const workerProduction = filteredProduction.filter(r => r.userId === worker.id);
      const totalEarned = workerProduction.reduce((sum, r) => sum + r.total, 0);
      const totalProcesses = workerProduction.reduce((sum, r) => sum + r.quantity, 0);
      
      return {
        ...worker,
        totalEarned,
        totalProcesses,
        records: workerProduction.length
      };
    }).sort((a, b) => b.totalEarned - a.totalEarned);
    
    return ranking;
  }, [users, filteredProduction]);

  // Función para registrar pago
  const handlePayment = async (worker, amount) => {
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    
    if (amount > worker.pending) {
      toast.error(`El monto excede el pendiente ($${worker.pending.toFixed(2)})`);
      return;
    }
    
    try {
      await addDoc(collection(db, 'payments'), {
        userId: worker.id,
        userName: worker.name,
        amount: parseFloat(amount),
        date: new Date(),
        notes: ''
      });
      
      toast.success(`Pago de $${parseFloat(amount).toFixed(2)} registrado`);
    } catch {
      toast.error('Error al registrar pago');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const getMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'produccion', label: 'Producción', icon: BarChart3 },
    { id: 'pagos', label: 'Pagos', icon: CreditCard },
    { id: 'ordenes', label: 'Órdenes', icon: Package },
    { id: 'operarios', label: 'Operarios', icon: Users }
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="text-center py-12 text-gray-400">Cargando reportes...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reportes</h2>
            <p className="text-gray-500 text-sm">Estadísticas y control del taller</p>
          </div>
          {activeTab === 'pagos' && (
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 print:hidden">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.id 
                ? 'bg-pink-600 text-white shadow' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filtros de fecha */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Período:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todo' },
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Última semana' },
              { id: 'month', label: 'Último mes' },
              { id: 'custom', label: 'Personalizado' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  dateFilter === f.id 
                    ? 'bg-pink-100 text-pink-700 font-medium' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-500">a</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* ============ PESTAÑA PRODUCCIÓN ============ */}
      {activeTab === 'produccion' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Total Producido</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(productionStats.totalEarnings)}</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Procesos Realizados</p>
              </div>
              <p className="text-3xl font-bold">{productionStats.totalProcesses}</p>
            </div>
            
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Registros</p>
              </div>
              <p className="text-3xl font-bold">{filteredProduction.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-pink-600" />
              Top Operarios
            </h3>
            {productionStats.topWorkers.length === 0 ? (
              <p className="text-center text-gray-400 py-6">Sin datos en este período</p>
            ) : (
              <div className="space-y-2">
                {productionStats.topWorkers.slice(0, 5).map((worker, idx) => (
                  <div key={worker.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getMedal(idx)}</span>
                      <div>
                        <p className="font-semibold text-gray-900">{worker.userName}</p>
                        <p className="text-xs text-gray-500">{worker.records} registros</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(worker.earnings)}</p>
                      <p className="text-xs text-gray-500">{worker.processes} procesos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Top Modelos Producidos
            </h3>
            {productionStats.topModels.length === 0 ? (
              <p className="text-center text-gray-400 py-6">Sin datos en este período</p>
            ) : (
              <div className="space-y-2">
                {productionStats.topModels.slice(0, 5).map((model, idx) => (
                  <div key={model.modelId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 w-6">{idx + 1}</span>
                      <p className="font-semibold text-gray-900">{model.modelName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{model.completedUnits} unid. completas</p>
                      <p className="text-xs text-gray-500">{formatCurrency(model.earnings)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ PESTAÑA PAGOS ============ */}
      {activeTab === 'pagos' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Total Ganado</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(paymentStats.totalEarned)}</p>
              <p className="text-xs opacity-80 mt-1">Histórico global</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Total Pagado</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(paymentStats.totalPaid)}</p>
              <p className="text-xs opacity-80 mt-1">Histórico global</p>
            </div>
            
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Total Pendiente</p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(paymentStats.totalPending)}</p>
              <p className="text-xs opacity-80 mt-1">Saldo real</p>
            </div>
          </div>

          {/* Info del período */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <strong>ℹ️ Información:</strong> Los totales (Ganado, Pagado, Pendiente) son globales e históricos. 
            El filtro de período solo afecta la visualización de órdenes completadas.
            <br />
            <span className="text-xs opacity-75">Las órdenes en proceso no se incluyen hasta que se terminen.</span>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-600" />
              Estado de Pagos por Operario
            </h3>
            
            {paymentStats.workerStats.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No hay operarios registrados</p>
            ) : (
              <div className="space-y-3">
                {paymentStats.workerStats.map(worker => (
                  <WorkerPaymentCard 
                    key={worker.id} 
                    worker={worker} 
                    onPayment={handlePayment}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Historial de Pagos
            </h3>
            
            {payments.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No hay pagos registrados</p>
            ) : (
              <div className="space-y-2">
                {payments.slice(0, 10).map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">{payment.userName}</p>
                      <p className="text-xs text-gray-500">
                        {format(payment.date.toDate(), "dd/MM/yyyy - hh:mm a", { locale: es })}
                      </p>
                    </div>
                    <p className="font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ PESTAÑA ÓRDENES ============ */}
      {activeTab === 'ordenes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Órdenes Activas</p>
              </div>
              <p className="text-3xl font-bold">{orderStats.activeOrders.length}</p>
            </div>
            
            <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl p-5 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 opacity-80" />
                <p className="text-sm opacity-90">Órdenes Terminadas</p>
              </div>
              <p className="text-3xl font-bold">{orderStats.completedOrders.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              Órdenes Activas - Progreso
            </h3>
            
            {orderStats.activeOrders.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No hay órdenes activas</p>
            ) : (
              <div className="space-y-3">
                {orderStats.activeOrders.map(order => (
                  <div key={order.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs text-gray-500">Orden #{order.orderNumber}</p>
                        <h4 className="font-bold text-gray-900">{order.modelName}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Cantidad: {order.quantity} | Entrega: {format(order.deliveryDate.toDate(), 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-pink-600">{order.percentage}%</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{order.totalProduced}/{order.totalExpected} procesos</span>
                      <span>{order.completedProcesses}/{order.totalProcesses} procesos</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          order.percentage === 100 
                            ? 'bg-gradient-to-r from-green-500 to-green-600' 
                            : order.percentage >= 50
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                            : 'bg-gradient-to-r from-orange-500 to-orange-600'
                        }`}
                        style={{ width: `${order.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ PESTAÑA OPERARIOS ============ */}
      {activeTab === 'operarios' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-pink-600" />
              Ranking de Operarios
            </h3>
            
            {workerRanking.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No hay operarios registrados</p>
            ) : (
              <div className="space-y-2">
                {workerRanking.map((worker, idx) => (
                  <div key={worker.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getMedal(idx)}</span>
                      <div>
                        <p className="font-bold text-gray-900">{worker.name}</p>
                        <p className="text-xs text-gray-500">{worker.records} registros</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">{formatCurrency(worker.totalEarned)}</p>
                      <p className="text-xs text-gray-500">{worker.totalProcesses} procesos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ COMPONENTE: Tarjeta de pago por operario ============

function WorkerPaymentCard({ worker, onPayment, formatCurrency }) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [showInProgress, setShowInProgress] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onPayment(worker, amount);
    setAmount('');
    setShowPaymentForm(false);
  };

  const getOrderEarnings = (orderId) => {
    return worker.allWorkerProduction
      .filter(r => r.orderId === orderId)
      .reduce((sum, r) => sum + r.total, 0);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {worker.photoUrl ? (
            <img 
              src={worker.photoUrl} 
              alt={worker.name} 
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
              {worker.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold text-gray-900">{worker.name}</p>
            <p className="text-xs text-gray-500">
              {worker.completedOrders.length} órdenes completadas
            </p>
          </div>
        </div>
      </div>

      {worker.completedOrders.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Órdenes completadas ({worker.completedOrders.length})
          </p>
          <div className="space-y-1">
            {worker.completedOrders.map(order => (
              <div key={order.id} className="bg-white rounded p-2 text-sm flex justify-between items-center">
                <span className="text-gray-700">
                  #{order.orderNumber} {order.modelName}
                </span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(getOrderEarnings(order.id))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {worker.inProgressOrders.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowInProgress(!showInProgress)}
            className="w-full flex items-center justify-between text-xs font-semibold text-orange-700 mb-2 hover:text-orange-800"
          >
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              En proceso ({worker.inProgressOrders.length})
            </span>
            {showInProgress ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          {showInProgress && (
            <div className="space-y-1">
              {worker.inProgressOrders.map(order => (
                <div key={order.id} className="bg-white rounded p-2 text-sm flex justify-between items-center opacity-75">
                  <span className="text-gray-700">
                    #{order.orderNumber} {order.modelName}
                  </span>
                  <span className="text-xs text-orange-600 font-medium">
                    En proceso
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {worker.completedOrders.length === 0 && worker.inProgressOrders.length === 0 && (
        <div className="mb-3 text-center py-3 text-xs text-gray-400">
          Sin producción registrada
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white rounded p-2 text-center">
          <p className="text-xs text-gray-500">Ganado</p>
          <p className="font-bold text-green-600 text-sm">{formatCurrency(worker.totalEarned)}</p>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <p className="text-xs text-gray-500">Pagado</p>
          <p className="font-bold text-blue-600 text-sm">{formatCurrency(worker.totalPaid)}</p>
        </div>
        <div className="bg-white rounded p-2 text-center">
          <p className="text-xs text-gray-500">Pendiente</p>
          <p className={`font-bold text-sm ${worker.pending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {formatCurrency(worker.pending)}
          </p>
        </div>
      </div>

      {worker.pending > 0 && (
        <>
          {!showPaymentForm ? (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Registrar Pago
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Máx: ${worker.pending.toFixed(2)}`}
                max={worker.pending}
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                autoFocus
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Pagar
              </button>
              <button
                type="button"
                onClick={() => { setShowPaymentForm(false); setAmount(''); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm"
              >
                ✕
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}