import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import pedidosService from '../services/pedidosService';
import { Pedido } from '../services/pedidosService';
import { BackButton } from '../components/BackButton';
import { styles } from '../styles/styles';

interface PorRemunerarScreenProps {
  onNavigate?: (screen: string) => void;
}

export const PorRemunerarScreen: React.FC<PorRemunerarScreenProps> = ({ onNavigate }) => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);

  // Agrupar por encomendista
  const [agrupadosPorEncomendista, setAgrupadosPorEncomendista] = useState<
    { encomendista: string; pedidos: Pedido[] }[]
  >([]);

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      const data = await pedidosService.obtenerPedidosPorRemunerar();
      setPedidos(data);

      // Agrupar por encomendista
      const agrupados: { [key: string]: Pedido[] } = {};
      data.forEach((pedido: Pedido) => {
        const encomendista = pedido.encomendista_nombre || 'Sin Encomendista';
        if (!agrupados[encomendista]) {
          agrupados[encomendista] = [];
        }
        agrupados[encomendista].push(pedido);
      });

      const resultado = Object.entries(agrupados)
        .map(([encomendista, pedidosList]) => ({
          encomendista,
          pedidos: pedidosList.sort((a, b) => {
            const fechaB = b.fecha_creacion?.getTime() || 0;
            const fechaA = a.fecha_creacion?.getTime() || 0;
            return fechaB - fechaA;
          }),
        }))
        .sort((a, b) => a.encomendista.localeCompare(b.encomendista));

      setAgrupadosPorEncomendista(resultado);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarRemunerado = async () => {
    if (!pedidoSeleccionado) return;

    try {
      setGuardando(true);
      await pedidosService.marcarComoRemunerado(pedidoSeleccionado.id!);
      setModalDetalle(false);
      await cargarPedidos();
      Alert.alert('Éxito', 'Pedido marcado como remunerado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo marcar como remunerado');
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirDetalle = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setModalDetalle(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'retirado':
        return '#00BCD4';
      case 'no-retirado':
        return '#FF9800';
      case 'enviado':
        return '#9C27B0';
      default:
        return '#999';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'retirado':
        return '✓ Retirado';
      case 'no-retirado':
        return '✗ No Retirado';
      case 'enviado':
        return '📮 Enviado';
      default:
        return estado;
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header con botón < */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingTop: 8 }}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={styles.title}>💰 Pedidos por Remunerar</Text>
      </View>

      {/* Resumen */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
          Total de pedidos: <Text style={{ fontWeight: 'bold', color: '#000' }}>{pedidos.length}</Text>
        </Text>
        <Text style={{ fontSize: 13, color: '#666' }}>
          Encomendistas: <Text style={{ fontWeight: 'bold', color: '#000' }}>{agrupadosPorEncomendista.length}</Text>
        </Text>
      </View>

      {agrupadosPorEncomendista.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.title}>✅</Text>
          <Text style={styles.emptyStateText}>¡Todos los pedidos han sido remunerados!</Text>
        </View>
      ) : (
        agrupadosPorEncomendista.map((grupo) => (
          <View key={grupo.encomendista} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#667eea' }]}>🚚 {grupo.encomendista}</Text>
            <Text style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
              {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </Text>

            {grupo.pedidos.map((pedido) => (
              <TouchableOpacity
                key={pedido.id}
                style={styles.card}
                onPress={() => handleAbrirDetalle(pedido)}
                activeOpacity={0.7}
              >
                <View style={{ marginBottom: 10 }}>
                  <Text style={styles.cardTitle}>📦 {pedido.codigo_pedido}</Text>
                  <Text style={styles.cardSubtitle}>👤 {pedido.cliente_nombre}</Text>
                </View>

                <View style={{ marginBottom: 10 }}>
                  <View
                    style={{
                      backgroundColor: getEstadoColor(pedido.estado),
                      paddingVertical: 4,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      alignSelf: 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                      {getEstadoLabel(pedido.estado)}
                    </Text>
                  </View>
                  <Text style={styles.cardSubtitle}>🚚 {pedido.encomendista_nombre || 'Sin asignar'}</Text>
                  <Text style={styles.cardSubtitle}>📍 {pedido.destino_nombre || pedido.nombre_tienda}</Text>
                  <Text style={styles.cardSubtitle}>📅 {pedido.fecha_creacion?.toLocaleDateString()}</Text>
                </View>

                {pedido.total && (
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#2E7D32' }}>
                    💰 ${pedido.total.toLocaleString()}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}

      {/* Modal Detalle y Remunerar */}
      <Modal visible={modalDetalle} animationType="slide" onRequestClose={() => setModalDetalle(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalDetalle(false)}>
              <Text style={styles.closeButton}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Detalles del Pedido</Text>
            <View />
          </View>

          <ScrollView style={styles.modalContent}>
            {pedidoSeleccionado && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Información General</Text>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Código:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.codigo_pedido}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Cliente:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.cliente_nombre}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Teléfono:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.telefono_cliente || '-'}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Encomendista:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.encomendista_nombre || '-'}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Tienda:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.nombre_tienda}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Detalles del Envío</Text>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Destino:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.destino_nombre || pedidoSeleccionado.nombre_tienda}</Text>
                  </View>
                  {pedidoSeleccionado.modo === 'personalizado' && pedidoSeleccionado.direccion_personalizada && (
                    <View style={detailStyles.row}>
                      <Text style={detailStyles.label}>Dirección:</Text>
                      <Text style={detailStyles.value}>{pedidoSeleccionado.direccion_personalizada}</Text>
                    </View>
                  )}
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Horario:</Text>
                    <Text style={detailStyles.value}>
                      {pedidoSeleccionado.hora_inicio} - {pedidoSeleccionado.hora_fin}
                    </Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Día de Entrega:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.dia_entrega}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Valores</Text>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Prendas:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.cantidad_prendas}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Costo Prendas:</Text>
                    <Text style={detailStyles.value}>${pedidoSeleccionado.costo_prendas.toLocaleString()}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Monto Envío:</Text>
                    <Text style={detailStyles.value}>${pedidoSeleccionado.monto_envio.toLocaleString()}</Text>
                  </View>
                  <View style={[detailStyles.row, { backgroundColor: '#f0f0f0', paddingVertical: 12 }]}>
                    <Text style={[detailStyles.label, { fontWeight: 'bold' }]}>Total:</Text>
                    <Text style={[detailStyles.value, { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' }]}>
                      ${pedidoSeleccionado.total.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Estado Actual</Text>
                  <View
                    style={{
                      backgroundColor: getEstadoColor(pedidoSeleccionado.estado),
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                      {getEstadoLabel(pedidoSeleccionado.estado)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, guardando && styles.disabledButton]}
                  onPress={handleMarcarRemunerado}
                  disabled={guardando}
                >
                  <Text style={styles.primaryButtonText}>💰 Marcar como Remunerado</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Botón Regresar */}
      <View style={{ padding: 16, paddingBottom: 20 }}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#6c757d' }]}
          onPress={() => onNavigate?.('home')}
        >
          <Text style={styles.primaryButtonText}>REGRESAR</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  value: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
});
