import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import {
  Plus,
  Trash2,
  X,
  CheckCircle,
  Clock,
  Calendar,
  Package,
  DollarSign,
  TrendingUp,
  Palette,
  Edit2,
  AlertTriangle,
  History,
} from "lucide-react";
import { db } from "../../services/firebase";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { format } from "date-fns";
import { normalizeText } from "../../utils/text";
import toast from "react-hot-toast";

export default function Orders() {
  const { selectedCompanyId, userData } = useAuth();
  const [orders, setOrders] = useState([]);
  const [models, setModels] = useState([]);
  const [allProduction, setAllProduction] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [modelProcesses, setModelProcesses] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [filter, setFilter] = useState("activa");
  const [form, setForm] = useState({
    modelId: "",
    color: "",
    quantity: "",
    receptionDate: "",
    deliveryDate: "",
  });
  const [editForm, setEditForm] = useState({
    color: "",
    quantity: "",
    receptionDate: "",
    deliveryDate: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);

  // ✅ LISTENER: Órdenes
  useEffect(() => {
    if (!selectedCompanyId) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "orders"),
        where("companyId", "==", selectedCompanyId),
      ),
      (snapshot) => {
        const ordersData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        ordersData.sort((a, b) => b.orderNumber - a.orderNumber);
        setOrders(ordersData);
      },
      (error) => {
        console.error("Error escuchando órdenes:", error);
      },
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // ✅ LISTENER: Modelos
  useEffect(() => {
    if (!selectedCompanyId) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "models"),
        where("companyId", "==", selectedCompanyId),
      ),
      (snapshot) => {
        const modelsData = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        modelsData.sort((a, b) => a.name.localeCompare(b.name));
        setModels(modelsData);
      },
      (error) => {
        console.error("Error escuchando modelos:", error);
      },
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // ✅ LISTENER: Producción
  useEffect(() => {
    if (!selectedCompanyId) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "production"),
        where("companyId", "==", selectedCompanyId),
      ),
      (snapshot) => {
        setAllProduction(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error("Error escuchando producción:", error),
    );
    return () => unsubscribe();
  }, [selectedCompanyId]);

  // ✅ LISTENER: Pagos
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "payments"),
      (snapshot) => {
        setAllPayments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error("Error escuchando pagos:", error),
    );
    return () => unsubscribe();
  }, []);

  // Cargar procesos de cada modelo
  useEffect(() => {
    const loadModelProcesses = async () => {
      const processes = {};
      for (const model of models) {
        try {
          const snap = await getDocs(
            collection(db, "models", model.id, "processes"),
          );
          processes[model.id] = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((p) => p.active !== false);
        } catch (error) {
          console.error(
            `Error cargando procesos de modelo ${model.id}:`,
            error,
          );
          processes[model.id] = [];
        }
      }
      setModelProcesses(processes);
    };

    if (models.length > 0) {
      loadModelProcesses();
    }
  }, [models]);

  // ✅ VERIFICAR AUTOMÁTICAMENTE CUANDO LOS PROCESOS ESTÉN AJUSTADOS
  useEffect(() => {
    if (orders.length === 0) return;

    const checkAdjustments = async () => {
      orders.forEach(async (order) => {
        if (!order.pendingAdjustment) return;

        const orderProduction = allProduction.filter(
          (p) => p.orderId === order.id,
        );

        const processes = order.processesSnapshot || [];
        let allAdjusted = true;

        processes.forEach((proc) => {
          const procProduction = orderProduction.filter(
            (p) => p.processId === (proc.processId || proc.id),
          );
          const totalProduced = procProduction.reduce(
            (sum, p) => sum + p.quantity,
            0,
          );

          if (totalProduced < order.quantity) {
            allAdjusted = false;
          }
        });

        if (allAdjusted && order.pendingAdjustment) {
          try {
            await updateDoc(doc(db, "orders", order.id), {
              pendingAdjustment: false,
              adjustmentNeeded: 0,
              adjustmentCompletedAt: new Date(),
            });

            toast.success(`✓ Orden #${order.orderNumber} - Ajuste completado`);
          } catch (error) {
            console.error("Error actualizando ajuste:", error);
          }
        }
      });
    };

    checkAdjustments();
  }, [allProduction, orders]);

  // ✅ Calcular progreso y costos
  const orderStats = useMemo(() => {
    const stats = {};

    orders.forEach((order) => {
      const processes =
        order.processesSnapshot || modelProcesses[order.modelId] || [];
      const totalProcesses = processes.length;

      const orderProduction = allProduction.filter(
        (p) => p.orderId === order.id,
      );

      const totalProduced = orderProduction.reduce(
        (sum, p) => sum + p.quantity,
        0,
      );

      const totalExpected = order.quantity * totalProcesses;

      const percentage =
        totalExpected > 0
          ? Math.min(Math.round((totalProduced / totalExpected) * 100), 100)
          : 0;

      const processProduction = {};
      orderProduction.forEach((p) => {
        if (!processProduction[p.processId]) {
          processProduction[p.processId] = 0;
        }
        processProduction[p.processId] += p.quantity;
      });

      const completedProcesses = Object.values(processProduction).filter(
        (produced) => produced >= order.quantity,
      ).length;

      let totalOperatorCost = 0;
      let totalFabricaValue = 0;

      processes.forEach((proc) => {
        const procId = proc.processId || proc.id;
        const produced = processProduction[procId] || 0;
        const procPrice = proc.price || 0;
        const procClientPrice = proc.clientPrice || 0;

        totalOperatorCost += produced * procPrice;
        totalFabricaValue += produced * procClientPrice;
      });

      const estimatedProfit = totalFabricaValue - totalOperatorCost;

      const maxOperatorCost =
        order.quantity * processes.reduce((sum, p) => sum + (p.price || 0), 0);
      const maxFabricaValue =
        order.quantity *
        processes.reduce((sum, p) => sum + (p.clientPrice || 0), 0);
      const maxProfit = maxFabricaValue - maxOperatorCost;

      const hasPayments = allPayments.some((pay) => pay.orderId === order.id);

      stats[order.id] = {
        percentage,
        completedProcesses,
        totalProcesses,
        totalProduced,
        totalExpected,
        totalOperatorCost,
        totalFabricaValue,
        estimatedProfit,
        maxOperatorCost,
        maxFabricaValue,
        maxProfit,
        hasPayments,
      };
    });

    return stats;
  }, [orders, allProduction, modelProcesses, allPayments]);

  const getNextOrderNumber = async () => {
    const counterRef = doc(db, "counters", `orders_${selectedCompanyId}`);

    const newNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentNumber = 0;
      if (counterDoc.exists()) {
        currentNumber = counterDoc.data().currentNumber || 0;
      }

      const nextNumber = currentNumber + 1;
      transaction.set(
        counterRef,
        { currentNumber: nextNumber },
        { merge: true },
      );

      return nextNumber;
    });

    return String(newNumber).padStart(3, "0");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.modelId ||
      !form.quantity ||
      !form.receptionDate ||
      !form.deliveryDate
    ) {
      toast.error("Completa todos los campos");
      return;
    }

    const selectedModel = models.find((m) => m.id === form.modelId);
    const processes = modelProcesses[selectedModel.id] || [];

    if (processes.length === 0) {
      toast.error("El modelo no tiene procesos activos");
      return;
    }

    setLoading(true);
    try {
      const orderNumber = await getNextOrderNumber();
      const quantity = parseInt(form.quantity);

      const processesSnapshot = processes.map((p) => ({
        processId: p.id,
        name: p.name,
        price: p.price || 0,
        clientPrice: p.clientPrice || 0,
        observation: p.observation || null,
      }));

      const totalOperatorCost =
        quantity * processes.reduce((sum, p) => sum + (p.price || 0), 0);
      const totalFabricaValue =
        quantity * processes.reduce((sum, p) => sum + (p.clientPrice || 0), 0);
      const estimatedProfit = totalFabricaValue - totalOperatorCost;

      await addDoc(collection(db, "orders"), {
        orderNumber,
        companyId: selectedCompanyId,
        modelId: selectedModel.id,
        modelName: normalizeText(selectedModel.name),
        modelPhoto: selectedModel.photoUrl || null,
        color: form.color.trim() || null,
        quantity,
        receptionDate: new Date(form.receptionDate),
        deliveryDate: new Date(form.deliveryDate),
        status: "activa",
        processesSnapshot,
        totalOperatorCost,
        totalFabricaValue,
        estimatedProfit,
        createdAt: new Date(),
        changeHistory: [],
      });

      toast.success(`Orden #${orderNumber} creada`);
      setShowModal(false);
      setForm({
        modelId: "",
        color: "",
        quantity: "",
        receptionDate: "",
        deliveryDate: "",
      });
    } catch (error) {
      console.error("Error al crear orden:", error);
      toast.error("Error al crear orden");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (order) => {
    const stats = orderStats[order.id];

    if (stats?.hasPayments) {
      toast.error("❌ No se puede editar: esta orden ya tiene pagos asociados");
      return;
    }

    setEditingOrder(order);

    const receptionDate = order.receptionDate.toDate();
    const deliveryDate = order.deliveryDate.toDate();

    setEditForm({
      color: order.color || "",
      quantity: order.quantity.toString(),
      receptionDate: receptionDate.toISOString().split("T")[0],
      deliveryDate: deliveryDate.toISOString().split("T")[0],
      reason: "",
    });

    setShowEditModal(true);
  };

  const handleEditOrder = async (e) => {
    e.preventDefault();

    if (
      !editForm.quantity ||
      !editForm.receptionDate ||
      !editForm.deliveryDate
    ) {
      toast.error("Completa todos los campos");
      return;
    }

    if (!editForm.reason.trim()) {
      toast.error("Debes indicar el motivo de la edición");
      return;
    }

    const newQuantity = parseInt(editForm.quantity);
    const oldQuantity = editingOrder.quantity;
    const orderProduction = allProduction.filter(
      (p) => p.orderId === editingOrder.id,
    );
    const totalProduced = orderProduction.reduce(
      (sum, p) => sum + p.quantity,
      0,
    );

    const quantityChanged = newQuantity !== oldQuantity;
    const hasProduction = totalProduced > 0;
    const needsNotification = quantityChanged && hasProduction;

    setLoading(true);
    try {
      const processes = editingOrder.processesSnapshot || [];

      const totalOperatorCost =
        newQuantity * processes.reduce((sum, p) => sum + (p.price || 0), 0);
      const totalFabricaValue =
        newQuantity *
        processes.reduce((sum, p) => sum + (p.clientPrice || 0), 0);
      const estimatedProfit = totalFabricaValue - totalOperatorCost;

      const newHistoryEntry = {
        date: new Date(),
        oldQuantity,
        newQuantity,
        changedBy: userData?.uid || "unknown",
        changedByName: userData?.name || "Admin",
        reason: editForm.reason.trim(),
        totalProducedAtChange: totalProduced,
      };

      const updatedHistory = [
        ...(editingOrder.changeHistory || []),
        newHistoryEntry,
      ];

      const updateData = {
        color: editForm.color.trim() || null,
        quantity: newQuantity,
        receptionDate: new Date(editForm.receptionDate),
        deliveryDate: new Date(editForm.deliveryDate),
        totalOperatorCost,
        totalFabricaValue,
        estimatedProfit,
        changeHistory: updatedHistory,
        updatedAt: new Date(),
      };

      if (needsNotification) {
        updateData.pendingAdjustment = true;
        updateData.adjustmentNeeded = newQuantity - oldQuantity;
        updateData.adjustmentDate = new Date();
      } else {
        updateData.pendingAdjustment = false;
        updateData.adjustmentNeeded = 0;
      }

      await updateDoc(doc(db, "orders", editingOrder.id), updateData);

      if (needsNotification) {
        try {
          const operariosQuery = query(
            collection(db, "users"),
            where("role", "==", "operario"),
            where("status", "==", "approved"),
          );
          const operariosSnap = await getDocs(operariosQuery);

          const notificationPromises = operariosSnap.docs.map(
            async (operarioDoc) => {
              try {
                await addDoc(collection(db, "notifications"), {
                  orderId: editingOrder.id,
                  orderNumber: editingOrder.orderNumber,
                  modelName: editingOrder.modelName,
                  color: editingOrder.color || null,
                  companyId: selectedCompanyId,
                  type: "order_adjustment",
                  title: `Orden #${editingOrder.orderNumber} actualizada`,
                  message: `Cantidad: ${oldQuantity} → ${newQuantity} unidades (${newQuantity - oldQuantity > 0 ? "+" : ""}${newQuantity - oldQuantity}). Debes ajustar los procesos registrados.`,
                  oldQuantity,
                  newQuantity,
                  difference: newQuantity - oldQuantity,
                  userId: operarioDoc.id,
                  read: false,
                  createdAt: new Date(),
                  createdBy: userData?.uid || "system",
                  createdByName: userData?.name || "Sistema",
                });
              } catch (notifError) {
                console.error(
                  `Error creando notificación para ${operarioDoc.id}:`,
                  notifError,
                );
              }
            },
          );

          await Promise.all(notificationPromises);

          toast.success(
            `✓ Orden actualizada. ${operariosSnap.size} operarios notificados.`,
          );
        } catch (notifError) {
          console.error("Error en notificaciones:", notifError);
          toast.success("✓ Orden actualizada (error al notificar operarios)");
        }
      } else {
        toast.success(`Orden #${editingOrder.orderNumber} actualizada`);
      }

      setShowEditModal(false);
      setEditingOrder(null);
    } catch (error) {
      console.error("Error al actualizar orden:", error);
      toast.error(`Error al actualizar orden: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openHistoryModal = (order) => {
    setHistoryOrder(order);
    setShowHistoryModal(true);
  };

  const toggleStatus = async (order) => {
    const newStatus = order.status === "activa" ? "terminada" : "activa";
    try {
      const updateData = { status: newStatus };

      if (newStatus === "terminada") {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }

      await updateDoc(doc(db, "orders", order.id), updateData);
      toast.success(`Orden #${order.orderNumber} ${newStatus}`);
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (order) => {
    if (
      !confirm(
        `¿Eliminar orden #${order.orderNumber}?\n\nEsto también eliminará todos los registros de producción asociados.`,
      )
    )
      return;
    try {
      const productionQuery = query(
        collection(db, "production"),
        where("orderId", "==", order.id),
      );
      const productionSnap = await getDocs(productionQuery);

      if (!productionSnap.empty) {
        const deletePromises = productionSnap.docs.map((doc) =>
          deleteDoc(doc.ref),
        );
        await Promise.all(deletePromises);
      }

      await deleteDoc(doc(db, "orders", order.id));
      toast.success(`Orden #${order.orderNumber} eliminada`);
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const filteredOrders = orders.filter((o) => o.status === filter);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value || 0);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Órdenes</h2>
          <p className="text-gray-500 text-sm">
            {filteredOrders.length} órdenes{" "}
            {filter === "activa" ? "activas" : "terminadas"}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setFilter("activa")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            filter === "activa" ? "bg-white shadow" : "text-gray-600"
          }`}
        >
          Activas
        </button>
        <button
          onClick={() => setFilter("terminada")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            filter === "terminada" ? "bg-white shadow" : "text-gray-600"
          }`}
        >
          Terminadas
        </button>
      </div>

      {/* Lista de órdenes */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">
            No hay órdenes {filter === "activa" ? "activas" : "terminadas"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const stats = orderStats[order.id] || {
              percentage: 0,
              completedProcesses: 0,
              totalProcesses: 0,
              totalProduced: 0,
              totalExpected: 0,
              totalOperatorCost: 0,
              totalFabricaValue: 0,
              estimatedProfit: 0,
              maxOperatorCost: 0,
              maxFabricaValue: 0,
              maxProfit: 0,
              hasPayments: false,
            };

            const canEdit = !stats.hasPayments;
            const hasHistory = (order.changeHistory || []).length > 0;
            const isPendingAdjustment = order.pendingAdjustment === true;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border-2 p-4 ${
                  isPendingAdjustment
                    ? "border-amber-400 shadow-amber-100 shadow-md"
                    : "border-gray-200"
                }`}
              >
                <div className="flex gap-4">
                  <div className="w-20 h-24 bg-gradient-to-br from-primary-50 to-accent-50 rounded-lg flex items-center justify-center flex-shrink-0 relative">
                    <Package className="w-8 h-8 text-primary-500" />
                    {isPendingAdjustment && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-xs text-gray-500">
                          Orden #{order.orderNumber}
                        </p>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          {order.modelName}
                          {order.color && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              <Palette className="w-3 h-3" />
                              {order.color}
                            </span>
                          )}
                          {isPendingAdjustment && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Pendiente ajuste (
                              {order.adjustmentNeeded > 0 ? "+" : ""}
                              {order.adjustmentNeeded})
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Cantidad:{" "}
                          <span className="font-semibold">
                            {order.quantity}
                          </span>
                          {hasHistory && (
                            <span className="text-xs text-gray-400 ml-2">
                              (editada)
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === "activa"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    {stats.hasPayments && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-xs text-red-700">
                          Esta orden tiene pagos asociados. No se puede editar.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                      <div>
                        <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Fábrica/unidad
                        </p>
                        <p className="text-sm font-bold text-amber-800">
                          {formatCurrency(
                            stats.maxFabricaValue / order.quantity,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Operario/unidad
                        </p>
                        <p className="text-sm font-bold text-amber-800">
                          {formatCurrency(
                            stats.maxOperatorCost / order.quantity,
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Ganancia/unidad
                        </p>
                        <p className="text-sm font-bold text-amber-800">
                          {formatCurrency(stats.maxProfit / order.quantity)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Fábrica
                        </p>
                        <p className="text-sm font-bold text-green-700">
                          {formatCurrency(stats.totalFabricaValue)}
                        </p>
                        <p className="text-xs text-gray-400">
                          / {formatCurrency(stats.maxFabricaValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          Operario
                        </p>
                        <p className="text-sm font-bold text-blue-700">
                          {formatCurrency(stats.totalOperatorCost)}
                        </p>
                        <p className="text-xs text-gray-400">
                          / {formatCurrency(stats.maxOperatorCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Ganancia
                        </p>
                        <p className="text-sm font-bold text-purple-700">
                          {formatCurrency(stats.estimatedProfit)}
                        </p>
                        <p className="text-xs text-gray-400">
                          / {formatCurrency(stats.maxProfit)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 font-medium">
                          Progreso: {stats.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stats.percentage === 100
                              ? "bg-gradient-to-r from-green-500 to-green-600"
                              : stats.percentage >= 50
                                ? "bg-gradient-to-r from-blue-500 to-blue-600"
                                : "bg-gradient-to-r from-orange-500 to-orange-600"
                          }`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {stats.completedProcesses}/{stats.totalProcesses}{" "}
                        procesos completados
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Recibe:{" "}
                        {format(order.receptionDate.toDate(), "dd/MM/yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Entrega:{" "}
                        {format(order.deliveryDate.toDate(), "dd/MM/yyyy")}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditModal(order)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                      )}
                      {hasHistory && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openHistoryModal(order)}
                        >
                          <History className="w-4 h-4 mr-1" />
                          Historial ({(order.changeHistory || []).length})
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleStatus(order)}
                      >
                        {order.status === "activa" ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Terminar
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-1" />
                            Reactivar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(order)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva Orden */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl p-5 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl md:text-2xl font-bold">Nueva Orden</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Modelo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.modelId}
                    onChange={(e) =>
                      setForm({ ...form, modelId: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Color <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    placeholder="Ej: Rojo, Azul, Negro..."
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cantidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  required
                  min="1"
                  placeholder="Ej: 50"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fecha de recepción <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.receptionDate}
                    onChange={(e) =>
                      setForm({ ...form, receptionDate: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fecha de entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={(e) =>
                      setForm({ ...form, deliveryDate: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Creando..." : "Crear Orden"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Orden */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl p-5 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl md:text-2xl font-bold">Editar Orden</h3>
                <p className="text-sm text-gray-500">
                  Orden #{editingOrder.orderNumber} - {editingOrder.modelName}
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              const orderProduction = allProduction.filter(
                (p) => p.orderId === editingOrder.id,
              );
              const totalProduced = orderProduction.reduce(
                (sum, p) => sum + p.quantity,
                0,
              );

              if (totalProduced > 0) {
                const newQty = parseInt(editForm.quantity) || 0;
                const difference = newQty - editingOrder.quantity;

                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 flex-1">
                        <p className="font-semibold mb-2">
                          Esta orden tiene producción registrada
                        </p>
                        <p className="mb-3">
                          Se han realizado <strong>{totalProduced}</strong>{" "}
                          procesos en total.
                        </p>
                        {difference !== 0 && (
                          <div className="bg-white rounded p-3 border border-amber-300">
                            <p className="font-semibold mb-2">
                              {difference > 0 ? "📈 Aumento" : " Reducción"}{" "}
                              de cantidad:
                            </p>
                            <p>
                              {editingOrder.quantity} → {newQty} unidades
                            </p>
                            <p className="mt-1">
                              Diferencia:{" "}
                              <strong>
                                {difference > 0 ? "+" : ""}
                                {difference}
                              </strong>{" "}
                              unidades
                            </p>
                            <p className="mt-2 text-amber-700">
                              🔔 Los operarios serán notificados automáticamente
                              para ajustar sus registros.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <form onSubmit={handleEditOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Color <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.color}
                    onChange={(e) =>
                      setEditForm({ ...editForm, color: e.target.value })
                    }
                    placeholder="Ej: Rojo, Azul, Negro..."
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Cantidad <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) =>
                      setEditForm({ ...editForm, quantity: e.target.value })
                    }
                    required
                    min="1"
                    placeholder="Ej: 50"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cantidad actual: {editingOrder.quantity}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fecha de recepción <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.receptionDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, receptionDate: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Fecha de entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.deliveryDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, deliveryDate: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motivo de edición <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) =>
                    setEditForm({ ...editForm, reason: e.target.value })
                  }
                  placeholder="Ej: Error en cantidad original, cliente pidió más unidades, etc."
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este motivo quedará registrado en el historial de la orden
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial de Cambios */}
      {showHistoryModal && historyOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-3xl rounded-t-2xl md:rounded-2xl p-5 md:p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                  <History className="w-6 h-6 text-primary-600" />
                  Historial de Cambios
                </h3>
                <p className="text-sm text-gray-500">
                  Orden #{historyOrder.orderNumber} - {historyOrder.modelName}
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            {(historyOrder.changeHistory || []).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay cambios registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(historyOrder.changeHistory || [])
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-primary-700">
                              #{(historyOrder.changeHistory || []).length - idx}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              {format(entry.date.toDate(), "dd/MM/yyyy HH:mm")}
                            </p>
                            <p className="text-xs font-medium text-gray-700">
                              Por: {entry.changedByName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="ml-10 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">Cantidad:</span>
                          <span className="text-red-600 line-through">
                            {entry.oldQuantity}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 font-bold">
                            {entry.newQuantity}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              entry.newQuantity > entry.oldQuantity
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {entry.newQuantity > entry.oldQuantity ? "+" : ""}
                            {entry.newQuantity - entry.oldQuantity}
                          </span>
                        </div>

                        <div className="bg-white rounded p-2 border border-gray-200">
                          <p className="text-xs text-gray-500 mb-1">Motivo:</p>
                          <p className="text-sm text-gray-800">
                            {entry.reason}
                          </p>
                        </div>

                        <div className="text-xs text-gray-500">
                          Procesos registrados al momento del cambio:{" "}
                          <strong>{entry.totalProducedAtChange}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex gap-2 pt-4 mt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowHistoryModal(false)}
                className="flex-1"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}