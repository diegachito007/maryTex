import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, Package, Calendar, DollarSign, ChevronDown, ChevronUp, ClipboardList, Trophy, Filter, Edit2, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, isWithinInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function MyProduction() {
  const { userData, selectedCompanyId } = useAuth();
  const [allRecords, setAllRecords] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [loading, setLoading] = useState(!selectedCompanyId);
  
  // Filtros
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Estados para edición
  const [editingRecord, setEditingRecord] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [saving, setSaving] = useState(false);

  // LISTENER: Producción
  useEffect(() => {
    if (!selectedCompanyId) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'production'),
        where('companyId', '==', selectedCompanyId),
        where('userId', '==', userData.uid)
      ),
      (snapshot) => {
        const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllRecords(records);
        setLoading(false);
      },
      (error) => {
        console.error('Error escuchando producción:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedCompanyId, userData.uid]);

  // LISTENER: Órdenes
  useEffect(() => {
    if (!selectedCompanyId) return;
    
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'orders'),
        where('companyId', '==', selectedCompanyId)
      ),
      (snapshot) => {
        const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllOrders(ordersData);
      }
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

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

  // Filtrar registros por fecha
  const recordsByDate = useMemo(() => {
    if (!dateRange) return allRecords;
    
    return allRecords.filter(r => {
      const recordDate = r.date.toDate();
      return isWithinInterval(recordDate, { 
        start: dateRange.start, 
        end: dateRange.end 
      });
    });
  }, [allRecords, dateRange]);

  // Filtrar registros por estado
  const filteredRecords = useMemo(() => {
    if (statusFilter === 'all') return recordsByDate;
    
    const orderMap = new Map(allOrders.map(o => [o.id, o]));
    
    return recordsByDate.filter(r => {
      const order = orderMap.get(r.orderId);
      if (!order) return false;
      
      if (statusFilter === 'completed') {
        return order.status === 'terminada';
      }
      if (statusFilter === 'inProgress') {
        return order.status === 'activa';
      }
      return true;
    });
  }, [recordsByDate, statusFilter, allOrders]);

  // TOTALES
  const totals = useMemo(() => {
    const totalUnits = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);
    const totalEarnings = filteredRecords.reduce((sum, r) => sum + r.total, 0);
    return { 
      units: totalUnits, 
      earnings: totalEarnings
    };
  }, [filteredRecords]);

  // Agrupar registros por orden
  const ordersGrouped = useMemo(() => {
    const grouped = {};
    const orderMap = new Map(allOrders.map(o => [o.id, o]));
    
    filteredRecords.forEach(record => {
      if (!grouped[record.orderId]) {
        const order = orderMap.get(record.orderId);
        grouped[record.orderId] = {
          orderId: record.orderId,
          orderNumber: record.orderNumber,
          modelName: record.modelName,
          color: order?.color || null,
          status: order?.status || 'activa',
          orderQuantity: order?.quantity || 0, // ✅ NUEVO: Cantidad total de la orden
          hasPayments: order?.hasPayments || false, // ✅ NUEVO: Si tiene pagos
          records: [],
          totalUnits: 0,
          totalEarnings: 0,
          firstDate: record.date,
          lastDate: record.date
        };
      }
      
      grouped[record.orderId].records.push(record);
      grouped[record.orderId].totalUnits += record.quantity;
      grouped[record.orderId].totalEarnings += record.total;
      
      if (record.date.toDate() < grouped[record.orderId].firstDate.toDate()) {
        grouped[record.orderId].firstDate = record.date;
      }
      if (record.date.toDate() > grouped[record.orderId].lastDate.toDate()) {
        grouped[record.orderId].lastDate = record.date;
      }
    });
    
    return Object.values(grouped).sort((a, b) => 
      b.lastDate.toDate() - a.lastDate.toDate()
    );
  }, [filteredRecords, allOrders]);

  // 📊 Datos para gráfico de barras por mes
  const monthlyData = useMemo(() => {
    const monthly = {};
    
    allRecords.forEach(record => {
      const date = record.date.toDate();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = format(date, 'MMM yyyy', { locale: es });
      
      if (!monthly[key]) {
        monthly[key] = {
          key,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          units: 0,
          earnings: 0,
          orders: new Set()
        };
      }
      
      monthly[key].units += record.quantity;
      monthly[key].earnings += record.total;
      monthly[key].orders.add(record.orderId);
    });
    
    return Object.values(monthly)
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 6)
      .map(m => ({
        ...m,
        orders: m.orders.size
      }));
  }, [allRecords]);

  const bestMonth = useMemo(() => {
    if (monthlyData.length === 0) return null;
    return monthlyData.reduce((best, m) => 
      m.units > best.units ? m : best
    , monthlyData[0]);
  }, [monthlyData]);

  const totalOrdersWorked = useMemo(() => {
    const orderIds = new Set(allRecords.map(r => r.orderId));
    return orderIds.size;
  }, [allRecords]);

  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  // ✅ FUNCIÓN: Verificar si se puede editar
  const canEditRecord = (record) => {
    const order = allOrders.find(o => o.id === record.orderId);
    if (!order) return false;
    
    // ❌ No permitir editar si la orden está terminada
    if (order.status === 'terminada') {
      return false;
    }
    
    // ❌ No permitir editar si la orden tiene pagos
    if (order.hasPayments) {
      return false;
    }
    
    return true;
  };

  // ✅ FUNCIÓN: Calcular máximo permitido para edición
  const getMaxQuantityForEdit = (record) => {
    const order = allOrders.find(o => o.id === record.orderId);
    if (!order) return record.quantity;
    
    const totalProducido = allRecords
      .filter(r => r.orderId === record.orderId && r.processId === record.processId)
      .reduce((sum, r) => sum + r.quantity, 0);
    
    const sinEsteRegistro = totalProducido - record.quantity;
    const maximo = order.quantity - sinEsteRegistro;
    
    return Math.max(maximo, 0);
  };

  // ✅ FUNCIÓN: Editar registro (con validación)
  const handleEdit = (record) => {
    // Verificar si se puede editar
    if (!canEditRecord(record)) {
      const order = allOrders.find(o => o.id === record.orderId);
      
      if (order?.status === 'terminada') {
        toast.error('❌ No se puede editar: La orden ya está completada');
      } else if (order?.hasPayments) {
        toast.error('❌ No se puede editar: La orden ya tiene pagos asociados');
      }
      return;
    }
    
    setEditingRecord(record);
    setEditQuantity(record.quantity.toString());
  };

  const handleUpdateRecord = async () => {
    const newQty = parseInt(editQuantity);
    
    if (!newQty || newQty <= 0) {
      toast.error('Ingresa una cantidad válida');
      return;
    }

    const maxQty = getMaxQuantityForEdit(editingRecord);
    if (newQty > maxQty) {
      toast.error(`Máximo permitido: ${maxQty} unidades`);
      return;
    }

    setSaving(true);
    try {
      const unitPrice = editingRecord.unitPrice || 0;
      
      await updateDoc(doc(db, 'production', editingRecord.id), {
        quantity: newQty,
        total: newQty * unitPrice,
        updatedAt: new Date()
      });

      toast.success('✓ Registro actualizado');
      setEditingRecord(null);
      setEditQuantity('');
    } catch (error) {
      console.error('Error al actualizar:', error);
      toast.error('Error al actualizar el registro');
    } finally {
      setSaving(false);
    }
  };

  // ✅ FUNCIÓN: Eliminar registro (con validación)
  const handleDeleteRecord = async (record) => {
    // Verificar si se puede eliminar
    if (!canEditRecord(record)) {
      const order = allOrders.find(o => o.id === record.orderId);
      
      if (order?.status === 'terminada') {
        toast.error('❌ No se puede eliminar: La orden ya está completada');
        return;
      } else if (order?.hasPayments) {
        toast.error('❌ No se puede eliminar: La orden ya tiene pagos asociados');
        return;
      }
    }
    
    if (!confirm(`¿Eliminar este registro de ${record.quantity} unidades de "${record.processName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'production', record.id));
      toast.success('✓ Registro eliminado');
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar el registro');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const maxUnits = monthlyData.length > 0 
    ? Math.max(...monthlyData.map(m => m.units)) 
    : 0;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 opacity-80" />
            <p className="text-xs opacity-90">Ganado</p>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals.earnings)}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 opacity-80" />
            <p className="text-xs opacity-90">Procesos</p>
          </div>
          <p className="text-xl font-bold">{totals.units}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 opacity-80" />
            <p className="text-xs opacity-90">Órdenes</p>
          </div>
          <p className="text-xl font-bold">{totalOrdersWorked}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-5 h-5 opacity-80" />
            <p className="text-xs opacity-90">Mejor mes</p>
          </div>
          <p className="text-sm font-bold truncate">
            {bestMonth ? `${bestMonth.units} proc` : '-'}
          </p>
          {bestMonth && (
            <p className="text-xs opacity-80 truncate">{bestMonth.monthName}</p>
          )}
        </div>
      </div>

      {/* 📊 Gráfico de barras por mes */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            Producción por mes
          </h3>
          <div className="space-y-2">
            {monthlyData.map(month => {
              const percentage = maxUnits > 0 ? (month.units / maxUnits) * 100 : 0;
              const isBest = bestMonth && month.key === bestMonth.key;
              
              return (
                <div key={month.key} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-20 truncate ${
                    isBest ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    {month.monthName}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2 ${
                        isBest 
                          ? 'bg-gradient-to-r from-orange-400 to-orange-500' 
                          : 'bg-gradient-to-r from-primary-400 to-primary-500'
                      }`}
                      style={{ width: `${Math.max(percentage, 8)}%` }}
                    >
                      <span className="text-xs font-bold text-white">
                        {month.units}
                      </span>
                    </div>
                  </div>
                  {isBest && <span className="text-sm">🏆</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🔍 Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-700">Filtros</span>
        </div>
        
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Período:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todo' },
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Semana' },
              { id: 'month', label: 'Mes' },
              { id: 'custom', label: 'Personalizado' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  dateFilter === f.id 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {dateFilter === 'custom' && (
            <div className="flex gap-2 items-center mt-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs flex-1"
              />
              <span className="text-gray-500 text-xs">a</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs flex-1"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Estado:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todas', icon: '📋' },
              { id: 'completed', label: 'Completadas', icon: '✅' },
              { id: 'inProgress', label: 'En proceso', icon: '⏳' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  statusFilter === f.id 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ✅ MODAL DE EDICIÓN */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Editar Registro</h3>
              <button onClick={() => setEditingRecord(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-sm"><strong>Orden:</strong> #{editingRecord.orderNumber}</p>
              <p className="text-sm"><strong>Proceso:</strong> {editingRecord.processName}</p>
              <p className="text-sm"><strong>Cantidad actual:</strong> {editingRecord.quantity}</p>
              <p className="text-sm text-orange-600">
                <strong>Máximo permitido:</strong> {getMaxQuantityForEdit(editingRecord)}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nueva cantidad
              </label>
              <input
                type="number"
                value={editQuantity}
                onChange={e => setEditQuantity(e.target.value)}
                min="1"
                max={getMaxQuantityForEdit(editingRecord)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-lg"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Diferencia: {parseInt(editQuantity || 0) - editingRecord.quantity} procesos
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateRecord}
                disabled={saving || parseInt(editQuantity || 0) === editingRecord.quantity}
                className="flex-1 bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Órdenes trabajadas */}
      <h3 className="text-lg font-semibold text-gray-900 mb-3">
        Órdenes trabajadas ({ordersGrouped.length})
      </h3>
      
      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      ) : ordersGrouped.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            {statusFilter === 'all' && dateFilter === 'all'
              ? 'Aún no has registrado producción'
              : 'No hay resultados con estos filtros'}
          </p>
          {(statusFilter !== 'all' || dateFilter !== 'all') && (
            <button
              onClick={() => { setDateFilter('all'); setStatusFilter('all'); }}
              className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              Limpiar filtros
            </button>
          )}
          {statusFilter === 'all' && dateFilter === 'all' && (
            <Link 
              to="/operario/register" 
              className="inline-block mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Registrar mi primera producción →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ordersGrouped.map(order => (
            <div key={order.orderId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleOrder(order.orderId)}
                className="w-full p-4 text-left hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-xs text-gray-500">Orden #{order.orderNumber}</p>
                        {order.color && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                            {order.color}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          order.status === 'terminada'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {order.status === 'terminada' ? '✓ Completada' : '⏳ En proceso'}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 truncate">{order.modelName}</h4>
                      
                      {/* ✅ NUEVO: Mostrar cantidad total de la orden */}
                      <div className="flex items-center gap-2 mt-1">
                        <Package className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600">
                          Total orden: <strong>{order.orderQuantity}</strong> unidades
                        </span>
                        {order.hasPayments && (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Con pagos
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <div className="flex items-center gap-1 text-green-600 font-semibold">
                          <DollarSign className="w-4 h-4" />
                          {formatCurrency(order.totalEarnings)}
                        </div>
                        <div className="flex items-center gap-1 text-blue-600 font-semibold">
                          <Package className="w-4 h-4" />
                          {order.totalUnits} procesos
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                        <Calendar className="w-3 h-3" />
                        {format(order.lastDate.toDate(), "dd/MM/yyyy", { locale: es })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedOrders.has(order.orderId) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </button>

              {expandedOrders.has(order.orderId) && (
                <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-2 animate-fade-in">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Procesos realizados:</p>
                  {order.records
                    .sort((a, b) => b.date.toDate() - a.date.toDate())
                    .map(record => {
                      const canEdit = canEditRecord(record);
                      
                      return (
                        <div key={record.id} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{record.processName}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {record.quantity} × {formatCurrency(record.unitPrice)}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {format(record.date.toDate(), "dd/MM/yyyy - hh:mm a", { locale: es })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">
                                {formatCurrency(record.total)}
                              </p>
                            </div>
                          </div>
                          
                          {/* ✅ BOTONES DE EDITAR Y ELIMINAR (solo si se puede) */}
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleEdit(record)}
                              disabled={!canEdit}
                              className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition text-xs font-medium ${
                                canEdit
                                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <Edit2 className="w-3 h-3" />
                              {canEdit ? 'Editar' : 'Bloqueado'}
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(record)}
                              disabled={!canEdit}
                              className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition text-xs font-medium ${
                                canEdit
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <Trash2 className="w-3 h-3" />
                              {canEdit ? 'Eliminar' : 'Bloqueado'}
                            </button>
                          </div>
                          
                          {/* ✅ MENSAJE SI ESTÁ BLOQUEADO */}
                          {!canEdit && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                {order.status === 'terminada' ? (
                                  <p>Orden completada - No se puede editar</p>
                                ) : order.hasPayments ? (
                                  <p>Orden con pagos - No se puede editar</p>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}