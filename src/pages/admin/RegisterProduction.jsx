import { useEffect, useState, useMemo, useRef } from 'react';
import { collection, getDocs, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { Package, Settings, Check, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeText } from '../../utils/text';
import toast from 'react-hot-toast';

export default function RegisterProduction() {
  const { userData, selectedCompanyId } = useAuth();
  
  const [step, setStep] = useState(1);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [allProduction, setAllProduction] = useState([]);
  
  const processesListRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // ✅ LISTENER EN TIEMPO REAL: Producción
  useEffect(() => {
    if (!selectedCompanyId) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'production'),
        where('companyId', '==', selectedCompanyId)
      ),
      (snapshot) => {
        setAllProduction(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error('Error escuchando producción:', error)
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // ✅ LISTENER EN TIEMPO REAL: Órdenes activas
  useEffect(() => {
    if (!selectedCompanyId) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'orders'),
        where('companyId', '==', selectedCompanyId),
        where('status', '==', 'activa')
      ),
      (snapshot) => {
        const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        ordersData.sort((a, b) => b.orderNumber.localeCompare(a.orderNumber));
        setOrders(ordersData);
      },
      (error) => console.error('Error escuchando órdenes:', error)
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // ✅ LISTENER EN TIEMPO REAL: Todas las órdenes
  useEffect(() => {
    if (!selectedCompanyId) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'orders'),
        where('companyId', '==', selectedCompanyId)
      ),
      (snapshot) => {
        setAllOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error('Error escuchando todas las órdenes:', error)
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // Cargar procesos del modelo seleccionado
  useEffect(() => {
    if (selectedOrder) {
      const loadProcesses = async () => {
        try {
          const snap = await getDocs(collection(db, 'models', selectedOrder.modelId, 'processes'));
          const allProcs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          const activeProcs = allProcs
            .filter(p => p.active !== false)
            .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
          
          setProcesses(activeProcs);
        } catch {
          toast.error('Error al cargar procesos');
        }
      };
      loadProcesses();
    }
  }, [selectedOrder]);

  // ✅ CALCULAR PENDIENTE
  const pendiente = useMemo(() => {
    if (!selectedOrder || !selectedProcess) return 0;
    const totalProducido = allProduction
      .filter(r => r.orderId === selectedOrder.id && r.processId === selectedProcess.id)
      .reduce((sum, r) => sum + r.quantity, 0);
    return selectedOrder.quantity - totalProducido;
  }, [selectedOrder, selectedProcess, allProduction]);

  // ✅ CALCULAR ESTADO DE CADA PROCESO
  const processesWithStatus = useMemo(() => {
    if (!selectedOrder) return [];
    
    return processes.map(proc => {
      const totalProducido = allProduction
        .filter(r => r.orderId === selectedOrder.id && r.processId === proc.id)
        .reduce((sum, r) => sum + r.quantity, 0);
      
      let status = 'pending';
      let producedQty = 0;
      
      if (totalProducido > 0) {
        producedQty = totalProducido;
        if (totalProducido >= selectedOrder.quantity) {
          status = 'completed';
        } else {
          status = 'in-progress';
        }
      }
      
      return {
        ...proc,
        status,
        producedQty,
        remainingQty: selectedOrder.quantity - totalProducido
      };
    });
  }, [processes, selectedOrder, allProduction]);

  const recentRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingOrderIds = new Set(allOrders.map(o => o.id));
    
    return allProduction
      .filter(r => {
        const recordDate = r.date.toDate();
        const isToday = recordDate >= today;
        const orderExists = existingOrderIds.has(r.orderId);
        return r.userId === userData.uid && isToday && orderExists;
      });
  }, [allProduction, allOrders, userData.uid]);

  const totalHoy = useMemo(() => 
    recentRecords.reduce((sum, r) => sum + r.total, 0), 
    [recentRecords]
  );

  const totalFabricaHoy = useMemo(() => 
    recentRecords.reduce((sum, r) => sum + (r.clientTotal || 0), 0), 
    [recentRecords]
  );

  const unidadesHoy = useMemo(() => 
    recentRecords.reduce((sum, r) => sum + r.quantity, 0), 
    [recentRecords]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    if (qty > pendiente) {
      toast.error(`Solo quedan ${pendiente} unidades pendientes`);
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'production'), {
        companyId: selectedCompanyId,
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        modelId: selectedOrder.modelId,
        modelName: normalizeText(selectedOrder.modelName),
        processId: selectedProcess.id,
        processName: normalizeText(selectedProcess.name),
        userId: userData.uid,
        userName: userData.name,
        quantity: qty,
        unitPrice: selectedProcess.price,
        clientUnitPrice: selectedProcess.clientPrice || 0,
        total: qty * selectedProcess.price,
        clientTotal: qty * (selectedProcess.clientPrice || 0),
        date: new Date()
      });

      setShowSuccess(true);
      toast.success(`✓ Registrado: ${qty} × ${selectedProcess.name}`);
      
      setQuantity('');
      setSelectedProcess(null);
      setStep(2);
      
      setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      toast.error('Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProcess = (proc) => {
    if (processesListRef.current) {
      setScrollPosition(processesListRef.current.scrollTop);
    }
    setSelectedProcess(proc);
    setStep(3);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  useEffect(() => {
    if (step === 2 && processesListRef.current) {
      processesListRef.current.scrollTop = scrollPosition;
    }
  }, [step, scrollPosition]);

  return (
    <div className="p-3 md:p-6 max-w-3xl mx-auto">

      {/* Resumen del día - COMPACTO */}
      {recentRecords.length > 0 ? (
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-3 md:p-4 text-white mb-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm opacity-90 mb-1">Resumen de hoy</p>
              <p className="text-xl md:text-2xl font-bold">{formatCurrency(totalHoy)}</p>
              {totalFabricaHoy > 0 && (
                <p className="text-xs opacity-80 mt-0.5">
                  Fábrica: {formatCurrency(totalFabricaHoy)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs md:text-sm opacity-90 mb-1">Procesos</p>
              <p className="text-xl md:text-2xl font-bold">{unidadesHoy}</p>
            </div>
          </div>
          <Link 
            to="/admin/my-production" 
            className="inline-flex items-center mt-2 text-xs md:text-sm text-white/90 hover:text-white font-medium"
          >
            Ver historial completo →
          </Link>
        </div>
      ) : (
        <div className="mb-4">
          <Link 
            to="/admin/my-production" 
            className="inline-flex items-center text-green-600 hover:text-green-700 text-sm font-medium"
          >
            <Clock className="w-4 h-4 mr-1" />
            Ver mi historial
          </Link>
        </div>
      )}

      {/* Mensaje de éxito - COMPACTO */}
      {showSuccess && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-3 mb-4 flex items-center gap-2 animate-fade-in">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-green-900 text-sm">¡Registrado correctamente!</p>
          </div>
        </div>
      )}

      {/* Paso 1: Seleccionar Orden */}
      {step === 1 && (
        <div className="space-y-2 md:space-y-3">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            Selecciona una orden
          </h3>
          
          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">No hay órdenes activas</p>
            </div>
          ) : (
            orders.map(order => (
              <button
                key={order.id}
                onClick={() => { setSelectedOrder(order); setStep(2); setShowSuccess(false); }}
                className="w-full bg-white rounded-xl border-2 border-gray-200 p-3 md:p-4 text-left hover:border-green-500 hover:shadow-md transition"
              >
                <p className="text-xs text-gray-500">Orden #{order.orderNumber}</p>
                <p className="font-bold text-gray-900">{order.modelName}</p>
                <p className="text-sm text-gray-600 mt-1">Cantidad: {order.quantity}</p>
              </button>
            ))
          )}
        </div>
      )}

      {/* Paso 2: Seleccionar Proceso */}
      {step === 2 && (
        <div className="space-y-2 md:space-y-3">
          <button 
            onClick={() => { setStep(1); setSelectedOrder(null); setShowSuccess(false); }}
            className="text-green-600 hover:text-green-700 text-sm mb-2"
          >
            ← Cambiar orden
          </button>
          
          <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            Proceso
          </h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 md:p-3 mb-2">
            <p className="text-xs md:text-sm text-blue-900">
              <strong>Modelo:</strong> {selectedOrder?.modelName}
            </p>
          </div>
          
          {processesWithStatus.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500">No hay procesos para este modelo</p>
            </div>
          ) : (
            <div 
              ref={processesListRef}
              className="space-y-2 overflow-y-auto pr-2"
              style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
              {processesWithStatus.map(proc => {
                let bgColor = 'bg-white';
                let borderColor = 'border-gray-200';
                let statusIcon = null;
                let statusText = '';
                
                if (proc.status === 'completed') {
                  bgColor = 'bg-green-50';
                  borderColor = 'border-green-300';
                  statusIcon = <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />;
                  statusText = 'Completado';
                } else if (proc.status === 'in-progress') {
                  bgColor = 'bg-amber-50';
                  borderColor = 'border-amber-300';
                  statusIcon = <Clock className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />;
                  statusText = `${proc.producedQty}/${selectedOrder.quantity}`;
                }
                
                return (
                  <button
                    key={proc.id}
                    onClick={() => handleSelectProcess(proc)}
                    className={`w-full rounded-xl border-2 p-3 md:p-4 text-left transition flex justify-between items-center ${
                      bgColor
                    } ${
                      proc.status === 'completed' 
                        ? 'opacity-75' 
                        : 'hover:border-green-500 hover:shadow-md cursor-pointer'
                    } ${
                      proc.status === 'pending' ? borderColor : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm md:text-base truncate ${proc.status === 'completed' ? 'text-green-900' : 'text-gray-900'}`}>
                        {proc.name}
                      </p>
                      {proc.observation && (
                        <p className="text-xs text-gray-500 mt-0.5 md:mt-1 italic truncate">{proc.observation}</p>
                      )}
                      {proc.status !== 'pending' && (
                        <p className="text-xs text-gray-600 mt-0.5 md:mt-1">
                          Producidas: {proc.producedQty} de {selectedOrder.quantity}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-3 ml-2 flex-shrink-0">
                      {/* ✅ PRECIOS - Solo visible en admin */}
                      <div className="text-right hidden sm:block">
                        {proc.clientPrice && (
                          <p className="text-xs text-blue-600 font-medium">
                            Fábrica: {formatCurrency(proc.clientPrice)}
                          </p>
                        )}
                        <p className="text-xs text-green-600 font-medium">
                          Operario: {formatCurrency(proc.price)}
                        </p>
                      </div>
                      
                      {statusIcon && (
                        <div className="flex items-center gap-1 md:gap-2">
                          <span className={`text-xs font-medium hidden md:inline ${
                            proc.status === 'completed' ? 'text-green-700' : 'text-amber-700'
                          }`}>
                            {statusText}
                          </span>
                          {statusIcon}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Paso 3: Ingresar Cantidad */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
          <button 
            onClick={() => { setStep(2); setSelectedProcess(null); }}
            className="text-green-600 hover:text-green-700 text-sm mb-2"
          >
            ← Cambiar proceso
          </button>
          
          <h3 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Check className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            Cantidad
          </h3>
          
          <div className="bg-gray-50 rounded-lg p-3 md:p-4 space-y-1 md:space-y-2">
            <p className="text-xs md:text-sm"><strong>Orden:</strong> #{selectedOrder?.orderNumber} - {selectedOrder?.modelName}</p>
            <p className="text-xs md:text-sm"><strong>Proceso:</strong> {selectedProcess?.name}</p>
            {/* ✅ PRECIOS - Solo visible en admin */}
            <div className="flex gap-3 text-xs md:text-sm">
              {selectedProcess?.clientPrice > 0 && (
                <span className="text-blue-600 font-medium">
                  Fábrica: {formatCurrency(selectedProcess.clientPrice)}
                </span>
              )}
              <span className="text-green-600 font-medium">
                Operario: {formatCurrency(selectedProcess?.price)}
              </span>
            </div>
            <p className="text-xs md:text-sm text-orange-600"><strong>Pendiente:</strong> {pendiente} unidades</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cantidad producida
            </label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              required
              min="1"
              max={pendiente}
              placeholder="Ej: 10"
              className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-base md:text-lg"
              autoFocus
            />
          </div>
          
          {/* ✅ TOTALES - Solo visible en admin */}
          {quantity && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 md:p-4">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm text-green-900 font-medium">
                  Total operario:
                </p>
                <p className="text-sm text-green-900 font-bold">
                  {formatCurrency(parseInt(quantity || 0) * (selectedProcess?.price || 0))}
                </p>
              </div>
              {selectedProcess?.clientPrice > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-green-200">
                  <p className="text-xs text-blue-700">
                    Total fábrica:
                  </p>
                  <p className="text-xs text-blue-700 font-medium">
                    {formatCurrency(parseInt(quantity || 0) * (selectedProcess?.clientPrice || 0))}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm md:text-base"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-3 md:px-4 py-2 md:py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm md:text-base"
            >
              {loading ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}