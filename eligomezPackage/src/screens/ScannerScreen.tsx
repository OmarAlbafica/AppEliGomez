import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import pedidosService from '../services/pedidosService';
import { Pedido } from '../services/pedidosService';
import { BackButton } from '../components/BackButton';
import { styles } from '../styles/styles';
import { formatDate12Hours } from '../utils/dateUtils';

const Picker = RNPicker as any;

interface ScannerScreenProps {
  onNavigate?: (screen: string) => void;
}

const estadoLabels: { [key: string]: string } = {
  pendiente: '⏳ Pendiente',
  entregado: '✅ Entregado',
  cancelado: '❌ Cancelado',
  enviado: '📮 Enviado',
  retirado: '✓ Retirado',
  'no-retirado': '✗ No Retirado',
  remunero: '💰 Remunerado',
};

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onNavigate }) => {
  const [codigo, setCodigo] = useState('');
  const [pedidoEncontrado, setPedidoEncontrado] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<'pendiente' | 'entregado' | 'cancelado' | 'enviado' | 'retirado' | 'no-retirado' | 'remunero'>('pendiente');
  const [guardando, setGuardando] = useState(false);

  // Convertir hora de 24h (HH:MM) a 12h (hh:mm AM/PM)
  const convertirHora12 = (hora: string | undefined): string => {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    const hours = parseInt(h, 10);
    const minutes = m || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const horas12 = hours % 12 || 12;
    return `${horas12}:${minutes} ${ampm}`;
  };

  const estados = ['pendiente', 'entregado', 'cancelado', 'enviado', 'retirado', 'no-retirado', 'remunero'];

  const handleBuscarPedido = async () => {
    if (!codigo.trim()) {
      Alert.alert('Error', 'Ingresa un código de pedido');
      return;
    }

    try {
      setLoading(true);
      const pedidos = await pedidosService.obtenerPedidos();
      const pedido = pedidos.find((p: Pedido) => p.codigo_pedido === codigo.trim());

      if (!pedido) {
        Alert.alert('No encontrado', 'El pedido no existe');
        return;
      }

      setPedidoEncontrado(pedido);
      setNuevoEstado((pedido.estado as 'pendiente' | 'entregado' | 'cancelado' | 'enviado' | 'retirado' | 'no-retirado' | 'remunero') || 'pendiente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo buscar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarEstado = async () => {
    if (!pedidoEncontrado || !nuevoEstado) {
      Alert.alert('Error', 'Selecciona un nuevo estado');
      return;
    }

    if (nuevoEstado === pedidoEncontrado.estado) {
      Alert.alert('Aviso', 'El estado es el mismo');
      return;
    }

    try {
      setGuardando(true);
      await pedidosService.cambiarEstado(pedidoEncontrado.id!, nuevoEstado);
      Alert.alert('Éxito', 'Estado actualizado correctamente');

      // Limpiar
      setCodigo('');
      setPedidoEncontrado(null);
      setNuevoEstado('pendiente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    } finally {
      setGuardando(false);
    }
  };

  const handleLimpiar = () => {
    setCodigo('');
    setPedidoEncontrado(null);
    setNuevoEstado('pendiente');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header con botón < */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingTop: 8 }}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={styles.title}>📱 Escanear/Buscar Pedido</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingresa el código del pedido</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 20250106001"
          value={codigo}
          onChangeText={setCodigo}
          editable={!pedidoEncontrado}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.primaryButton, (loading || pedidoEncontrado) && styles.disabledButton]}
          onPress={handleBuscarPedido}
          disabled={loading || pedidoEncontrado !== null}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>🔍 Buscar Pedido</Text>
          )}
        </TouchableOpacity>
      </View>

      {pedidoEncontrado && (
        <View>
          {/* Información del Pedido */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Detalles del Pedido</Text>

            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Código:</Text>
              <Text style={detailStyles.value}>{pedidoEncontrado.codigo_pedido}</Text>
            </View>

            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Cliente:</Text>
              <Text style={detailStyles.value}>{pedidoEncontrado.cliente_nombre}</Text>
            </View>

            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Encomendista:</Text>
              <Text style={detailStyles.value}>{pedidoEncontrado.encomendista_nombre}</Text>
            </View>

            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Destino:</Text>
              <Text style={detailStyles.value}>{pedidoEncontrado.destino_nombre}</Text>
            </View>

            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Horario:</Text>
              <Text style={detailStyles.value}>
                {convertirHora12(pedidoEncontrado.hora_inicio)} - {convertirHora12(pedidoEncontrado.hora_fin)}
              </Text>
            </View>

            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Fecha de Creación:</Text>
              <Text style={detailStyles.value}>
                {pedidoEncontrado.fecha_creacion
                  ? formatDate12Hours(pedidoEncontrado.fecha_creacion)
                  : 'N/A'}
              </Text>
            </View>

            {pedidoEncontrado.total && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Monto:</Text>
                <Text style={[detailStyles.value, { color: '#2E7D32', fontWeight: 'bold' }]}>
                  ${pedidoEncontrado.total.toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {/* Estado Actual */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado Actual</Text>
            <View style={scannerStyles.estadoBox}>
              <Text style={scannerStyles.estadoLabel}>{estadoLabels[pedidoEncontrado.estado]}</Text>
            </View>
          </View>

          {/* Cambiar Estado */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cambiar Estado</Text>
            <Picker
              selectedValue={nuevoEstado}
              onValueChange={setNuevoEstado}
              style={styles.picker}
            >              {estados.map((estado) => (
                <Picker.Item key={estado} label={estadoLabels[estado]} value={estado} />
              ))}
            </Picker>

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton]}
              onPress={handleCambiarEstado}
              disabled={guardando || nuevoEstado === pedidoEncontrado.estado}
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>✓ Actualizar Estado</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Botón Limpiar */}
          <TouchableOpacity
            style={[styles.selectButton, { backgroundColor: '#6c757d' }]}
            onPress={handleLimpiar}
          >
            <Text style={styles.selectButtonText}>🔄 Buscar Otro Pedido</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Información Adicional */}
      <View style={[styles.section, { marginTop: 20 }]}>
        <Text style={styles.sectionTitle}>ℹ️ Instrucciones</Text>
        <Text style={{ fontSize: 13, color: '#666', lineHeight: 20 }}>
          1. Ingresa el código del pedido (ej: 20250106001){'\n'}
          2. El sistema buscará el pedido en la base de datos{'\n'}
          3. Selecciona el nuevo estado del pedido{'\n'}
          4. Presiona "Actualizar Estado" para guardar los cambios{'\n'}
          5. Usa "Buscar Otro Pedido" para continuar
        </Text>
      </View>

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
    paddingVertical: 10,
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

const scannerStyles = StyleSheet.create({
  estadoBox: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  estadoLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
