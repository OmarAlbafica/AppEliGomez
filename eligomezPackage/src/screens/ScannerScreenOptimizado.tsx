/**
 * 🔄 EJEMPLO DE MIGRACIÓN - ScannerScreen.tsx (Versión Optimizada)
 * 
 * Este archivo muestra cómo usar pedidosServiceOptimizado para:
 * 1. Obtener un pedido completo
 * 2. Cambiar su estado
 * 3. Subir foto si es estado 'empacada'
 * 
 * TODO en una sola transacción sin race conditions ✅
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';

// 🔑 SERVICIO OPTIMIZADO
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';

interface ScannerScreenOptimizadoProps {
  onNavigate?: (screen: string) => void;
}

const Picker = RNPicker as any;

const estadoLabels: { [key: string]: string } = {
  pendiente: '⏳ Pendiente',
  empacada: '📦 Empacada',
  enviado: '📮 Enviado',
  entregado: '✅ Entregado',
  cancelado: '❌ Cancelado',
  retirado: '✓ Retirado',
  'no-retirado': '✗ No Retirado',
  remunero: '💰 Remunerado',
};

export const ScannerScreenOptimizado: React.FC<ScannerScreenOptimizadoProps> = ({
  onNavigate,
}) => {
  // Estados
  const [codigo, setCodigo] = useState('');
  const [pedidoEncontrado, setPedidoEncontrado] = useState<PedidoCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState('pendiente');
  const [guardando, setGuardando] = useState(false);
  
  // Para foto
  const [foto_base64, setFoto_base64] = useState<string | null>(null);
  const [mostrarFoto, setMostrarFoto] = useState(false);
  
  // Notas
  const [notas, setNotas] = useState('');

  const estados = Object.keys(estadoLabels);

  // ============================================================
  // 🔍 BUSCAR PEDIDO - Usa pedidosServiceOptimizado
  // ============================================================
  const handleBuscarPedido = async () => {
    if (!codigo.trim()) {
      Alert.alert('⚠️', 'Ingresa un código de pedido');
      return;
    }

    try {
      setLoading(true);
      console.log(`[ScannerScreenOptimizado] 🔍 Buscando pedido: ${codigo}`);

      // 🔑 DIFERENCIA CLAVE: En 1 sola llamada obtenemos el pedido COMPLETO
      // con cliente, encomendista, productos, cambios de estado, TODO
      const pedido = await pedidosServiceOptimizado.obtenerPedidoCompleto(codigo);

      if (!pedido) {
        Alert.alert('❌', `Pedido ${codigo} no encontrado`);
        setPedidoEncontrado(null);
        return;
      }

      console.log(`✅ Pedido encontrado:`, pedido);
      setPedidoEncontrado(pedido);
      
      // Preset: el nuevo estado es el actual
      setNuevoEstado(pedido.estado || 'pendiente');
      setFoto_base64(null);
      setNotas('');
      
    } catch (error) {
      console.error('❌ Error buscando pedido:', error);
      Alert.alert('❌', 'Error al buscar el pedido');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 🔄 CAMBIAR ESTADO - Usa pedidosServiceOptimizado
  // ============================================================
  const handleCambiarEstado = async () => {
    if (!pedidoEncontrado) {
      Alert.alert('⚠️', 'Primero debes buscar un pedido');
      return;
    }

    if (nuevoEstado === pedidoEncontrado.estado) {
      Alert.alert('ℹ️', 'El nuevo estado es igual al actual');
      return;
    }

    // Si es empacada y no hay foto, avisar
    if (nuevoEstado === 'empacada' && !foto_base64) {
      Alert.alert('⚠️', 'Es recomendable tomar una foto del paquete empacado');
      return;
    }

    try {
      setGuardando(true);
      console.log(`[ScannerScreenOptimizado] 🔄 Cambiando estado a: ${nuevoEstado}`);

      // 🔑 TODO EN UNA SOLA LLAMADA:
      // 1. Actualiza el estado en 'pedidos'
      // 2. Crea registro en subcolección 'cambios_estado'
      // 3. Guarda la foto si la hay
      // 4. TODO en una transacción sin race conditions
      const exito = await pedidosServiceOptimizado.cambiarEstadoPedido(
        pedidoEncontrado.id!,
        nuevoEstado,
        foto_base64 || undefined,
        notas || undefined
      );

      if (exito) {
        Alert.alert(
          '✅ Éxito',
          `Pedido actualizado a ${nuevoEstado}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Limpiar formulario
                handleLimpiar();
              },
            },
          ]
        );
      } else {
        Alert.alert('❌', 'No se pudo actualizar el pedido');
      }

    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      Alert.alert('❌', 'Error al cambiar el estado');
    } finally {
      setGuardando(false);
    }
  };

  // ============================================================
  // 📸 SIMULACIÓN: Seleccionar foto (en app real usarías ImagePicker)
  // ============================================================
  const handleSeleccionarFoto = async () => {
    // En una app real, aquí usarías:
    // const result = await ImagePicker.launchImageLibraryAsync({ base64: true });
    
    Alert.alert('📸', 'En una app real, aquí abrirías el selector de imágenes o cámara');
    
    // Por ahora, simular una foto base64 (en real sería de ImagePicker)
    // setFoto_base64('data:image/jpeg;base64,/9j/4AAQSkZJRg...');
  };

  // ============================================================
  // 🗑️ LIMPIAR FORMULARIO
  // ============================================================
  const handleLimpiar = () => {
    setCodigo('');
    setPedidoEncontrado(null);
    setNuevoEstado('pendiente');
    setFoto_base64(null);
    setNotas('');
  };

  // ============================================================
  // 🎨 RENDERIZAR DETALLES DEL PEDIDO
  // ============================================================
  const renderDetallePedido = () => {
    if (!pedidoEncontrado) return null;

    const clienteNombre = pedidoEncontrado.cliente_datos?.nombre || 'Desconocido';
    const encomendistaNombre = pedidoEncontrado.encomendista_datos?.nombre || 'Desconocido';
    const destinoNombre = pedidoEncontrado.destino_datos?.nombre || 'Personalizado';

    return (
      <View style={styles.detailsContainer}>
        {/* Encabezado */}
        <View style={styles.detailHeader}>
          <Text style={styles.detailCode}>{pedidoEncontrado.codigo_pedido}</Text>
          <View style={[styles.estadoBox, { backgroundColor: getEstadoColor(pedidoEncontrado.estado) }]}>
            <Text style={styles.estadoText}>{estadoLabels[pedidoEncontrado.estado]}</Text>
          </View>
        </View>

        {/* Cliente */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>👤 Cliente:</Text>
          <Text style={styles.detailValue}>{clienteNombre}</Text>
        </View>

        {/* Teléfono */}
        {pedidoEncontrado.cliente_datos?.telefono && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📞 Teléfono:</Text>
            <Text style={styles.detailValue}>{pedidoEncontrado.cliente_datos.telefono}</Text>
          </View>
        )}

        {/* Encomendista */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>🚚 Encomendista:</Text>
          <Text style={styles.detailValue}>{encomendistaNombre}</Text>
        </View>

        {/* Destino */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📍 Destino:</Text>
          <Text style={styles.detailValue}>{destinoNombre}</Text>
        </View>

        {/* Día entrega */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📅 Día:</Text>
          <Text style={styles.detailValue}>{pedidoEncontrado.dia_entrega}</Text>
        </View>

        {/* Productos */}
        {pedidoEncontrado.productos_datos && pedidoEncontrado.productos_datos.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📦 Productos:</Text>
            <Text style={styles.detailValue}>
              {pedidoEncontrado.productos_datos.map((p) => p.nombre || p.codigo).join(', ')}
            </Text>
          </View>
        )}

        {/* Monto */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>💰 Total:</Text>
          <Text style={[styles.detailValue, { color: '#667eea', fontWeight: 'bold' }]}>
            ${pedidoEncontrado.total}
          </Text>
        </View>

        {/* Cambios de estado anteriores */}
        {pedidoEncontrado.cambios_estado && pedidoEncontrado.cambios_estado.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📊 Cambios:</Text>
            <Text style={styles.detailValue}>
              {pedidoEncontrado.cambios_estado.length} registros
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ============================================================
  // 🎨 RENDERIZAR SELECTOR DE ESTADO
  // ============================================================
  const renderSelectorEstado = () => {
    if (!pedidoEncontrado) return null;

    return (
      <View style={styles.estadoSelectorContainer}>
        <Text style={styles.estadoLabel}>Cambiar a:</Text>
        <Picker
          selectedValue={nuevoEstado}
          onValueChange={setNuevoEstado}
          style={styles.picker}
        >
          {estados.map((estado) => (
            <Picker.Item key={estado} label={estadoLabels[estado]} value={estado} />
          ))}
        </Picker>

        {/* Mostrar si hay foto requerida */}
        {nuevoEstado === 'empacada' && (
          <View style={styles.fotoRequiredWarning}>
            <Text style={styles.warningText}>
              ⚠️ Es recomendable adjuntar foto del paquete
            </Text>
            <TouchableOpacity
              style={[styles.button, !foto_base64 && styles.buttonWarning]}
              onPress={handleSeleccionarFoto}
            >
              <Text style={styles.buttonText}>
                {foto_base64 ? '✅ Foto seleccionada' : '📸 Seleccionar foto'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Campo de notas */}
        <View style={styles.notasContainer}>
          <Text style={styles.notasLabel}>Notas (opcional):</Text>
          <TextInput
            style={styles.notasInput}
            placeholder="Ej: Empacado sin problemas"
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  };

  // ============================================================
  // 🎨 PANTALLA PRINCIPAL
  // ============================================================
  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔍 Scanner de Pedidos</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Búsqueda */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Buscar pedido</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Código de pedido (Ej: EG20260109001)"
              value={codigo}
              onChangeText={setCodigo}
              editable={!loading}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.buttonDisabled]}
              onPress={handleBuscarPedido}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>🔍</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Detalles del pedido */}
        {renderDetallePedido()}

        {/* Cambiar estado */}
        {renderSelectorEstado()}

        {/* Botones de acción */}
        {pedidoEncontrado && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, guardando && styles.buttonDisabled]}
              onPress={handleCambiarEstado}
              disabled={guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>✅ Actualizar estado</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleLimpiar}
              disabled={guardando}
            >
              <Text style={styles.buttonSecondaryText}>🗑️ Limpiar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sin pedido */}
        {!pedidoEncontrado && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>👉 Busca un pedido para comenzar</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ============================================================
// 🛠️ FUNCIONES AUXILIARES
// ============================================================
const getEstadoColor = (estado: string): string => {
  const colors: { [key: string]: string } = {
    pendiente: '#FFC107',
    empacada: '#FF6F00',
    enviado: '#9C27B0',
    entregado: '#4CAF50',
    cancelado: '#F44336',
    retirado: '#00BCD4',
    'no-retirado': '#FF9800',
    remunero: '#4CAF50',
  };
  return colors[estado] || '#999';
};

// ============================================================
// 🎨 ESTILOS
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  searchSection: {
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
  },
  searchButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  detailsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    elevation: 2,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  estadoBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  estadoText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  estadoSelectorContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    elevation: 2,
  },
  estadoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  picker: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 12,
  },
  fotoRequiredWarning: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 8,
    fontWeight: '500',
  },
  notasContainer: {
    marginTop: 12,
  },
  notasLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  notasInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1a1a1a',
  },
  actionButtons: {
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#667eea',
  },
  buttonSecondary: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  buttonSecondaryText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonWarning: {
    backgroundColor: '#FFC107',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
});
