import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { clientesService, Cliente } from '../services/clientesService';
import { BackButton } from '../components/BackButton';
import { styles } from '../styles/styles';

interface ClientesScreenProps {
  onNavigate?: (screen: string) => void;
}

export const ClientesScreen: React.FC<ClientesScreenProps> = ({ onNavigate }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await clientesService.obtenerClientes();
      setClientes(data);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setTelefono('');
    setCorreo('');
    setDireccion('');
    setClienteEditando(null);
  };

  const handleCrearCliente = async () => {
    if (!nombre.trim() || !telefono.trim()) {
      Alert.alert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }

    try {
      setGuardando(true);
      await clientesService.crearCliente(nombre, telefono, correo || undefined, direccion || undefined);
      limpiarFormulario();
      setModalNuevo(false);
      await cargarClientes();
      Alert.alert('Éxito', 'Cliente creado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono);
    setCorreo(cliente.correo || '');
    setDireccion(cliente.direccion || '');
    setModalEditar(true);
  };

  const handleGuardarEdicion = async () => {
    if (!nombre.trim() || !telefono.trim()) {
      Alert.alert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }

    try {
      setGuardando(true);
      const clienteActualizado: Cliente = {
        id: clienteEditando!.id,
        nombre,
        telefono,
        correo: correo || undefined,
        direccion: direccion || undefined,
        activo: clienteEditando!.activo,
        fecha_creacion: clienteEditando!.fecha_creacion,
      };
      await clientesService.actualizarCliente(clienteEditando!.id!, clienteActualizado);
      limpiarFormulario();
      setModalEditar(false);
      await cargarClientes();
      Alert.alert('Éxito', 'Cliente actualizado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarCliente = (id: string) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este cliente?', [
      { text: 'Cancelar', onPress: () => {} },
      {
        text: 'Eliminar',
        onPress: async () => {
          try {
            await clientesService.eliminarCliente(id);
            await cargarClientes();
            Alert.alert('Éxito', 'Cliente eliminado');
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el cliente');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header con botón < */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={styles.title}>👥 Clientes</Text>
        <TouchableOpacity style={[styles.selectButton, { marginLeft: 'auto' }]} onPress={() => setModalNuevo(true)}>
          <Text style={styles.selectButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {clientes.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.title}>📭</Text>
          <Text style={styles.emptyStateText}>No hay clientes creados</Text>
        </View>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={clientes}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.nombre}</Text>
              <Text style={styles.cardSubtitle}>📞 {item.telefono}</Text>
              {item.correo && <Text style={styles.cardSubtitle}>📧 {item.correo}</Text>}
              {item.direccion && <Text style={styles.cardSubtitle}>📍 {item.direccion}</Text>}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1 }]}
                  onPress={() => handleEditarCliente(item)}
                >
                  <Text style={styles.selectButtonText}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, backgroundColor: '#dc3545' }]}
                  onPress={() => handleEliminarCliente(item.id!)}
                >
                  <Text style={styles.selectButtonText}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal Nuevo Cliente */}
      <Modal visible={modalNuevo} animationType="slide" onRequestClose={() => { setModalNuevo(false); limpiarFormulario(); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setModalNuevo(false); limpiarFormulario(); }}>
              <Text style={styles.closeButton}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Crear Cliente</Text>
            <View />
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del cliente"
              value={nombre}
              onChangeText={setNombre}
            />

            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />

            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={styles.input}
              placeholder="Correo (opcional)"
              keyboardType="email-address"
              value={correo}
              onChangeText={setCorreo}
            />

            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Dirección (opcional)"
              value={direccion}
              onChangeText={setDireccion}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton]}
              onPress={handleCrearCliente}
              disabled={guardando}
            >
              <Text style={styles.primaryButtonText}>Crear Cliente</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Editar Cliente */}
      <Modal visible={modalEditar} animationType="slide" onRequestClose={() => { setModalEditar(false); limpiarFormulario(); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setModalEditar(false); limpiarFormulario(); }}>
              <Text style={styles.closeButton}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar Cliente</Text>
            <View />
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del cliente"
              value={nombre}
              onChangeText={setNombre}
            />

            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />

            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={styles.input}
              placeholder="Correo (opcional)"
              keyboardType="email-address"
              value={correo}
              onChangeText={setCorreo}
            />

            <Text style={styles.label}>Dirección</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Dirección (opcional)"
              value={direccion}
              onChangeText={setDireccion}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton]}
              onPress={handleGuardarEdicion}
              disabled={guardando}
            >
              <Text style={styles.primaryButtonText}>Guardar Cambios</Text>
            </TouchableOpacity>
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
