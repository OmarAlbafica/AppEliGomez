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
import { useAppTheme } from '../context/ThemeContext';

interface ClientesScreenProps {
  onNavigate?: (screen: string) => void;
}

export const ClientesScreen: React.FC<ClientesScreenProps> = ({ onNavigate }) => {
  const theme = useAppTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header con botón < */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 8, backgroundColor: theme.colors.background }}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={[styles.title, { color: theme.colors.text }]}>👥 Clientes</Text>
        <TouchableOpacity style={[styles.selectButton, { marginLeft: 'auto' }]} onPress={() => setModalNuevo(true)}>
          <Text style={styles.selectButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {clientes.length === 0 ? (
        <View style={[styles.emptyStateContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>📭</Text>
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No hay clientes creados</Text>
        </View>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={clientes}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.primary }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.nombre}</Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📞 {item.telefono}</Text>
              {item.correo && <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📧 {item.correo}</Text>}
              {item.direccion && <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📍 {item.direccion}</Text>}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1 }]}
                  onPress={() => handleEditarCliente(item)}
                >
                  <Text style={styles.selectButtonText}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, backgroundColor: theme.colors.error }]}
                  onPress={() => handleEliminarCliente(item.id!)}
                >
                  <Text style={[styles.selectButtonText, { color: '#fff' }]}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal Nuevo Cliente */}
      <Modal visible={modalNuevo} animationType="slide" onRequestClose={() => { setModalNuevo(false); limpiarFormulario(); }}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => { setModalNuevo(false); limpiarFormulario(); }}>
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Crear Cliente</Text>
            <View />
          </View>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Nombre del cliente"
              placeholderTextColor={theme.colors.textSecondary}
              value={nombre}
              onChangeText={setNombre}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Teléfono *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Teléfono"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Correo</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Correo (opcional)"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="email-address"
              value={correo}
              onChangeText={setCorreo}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Dirección</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Dirección (opcional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={direccion}
              onChangeText={setDireccion}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }, guardando && styles.disabledButton]}
              onPress={handleCrearCliente}
              disabled={guardando}
            >
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Crear Cliente</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Editar Cliente */}
      <Modal visible={modalEditar} animationType="slide" onRequestClose={() => { setModalEditar(false); limpiarFormulario(); }}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => { setModalEditar(false); limpiarFormulario(); }}>
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Editar Cliente</Text>
            <View />
          </View>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Nombre del cliente"
              placeholderTextColor={theme.colors.textSecondary}
              value={nombre}
              onChangeText={setNombre}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Teléfono *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Teléfono"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
              value={telefono}
              onChangeText={setTelefono}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Correo</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Correo (opcional)"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="email-address"
              value={correo}
              onChangeText={setCorreo}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Dirección</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Dirección (opcional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={direccion}
              onChangeText={setDireccion}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }, guardando && styles.disabledButton]}
              onPress={handleGuardarEdicion}
              disabled={guardando}
            >
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Guardar Cambios</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Botón Regresar */}
      <View style={{ padding: 16, paddingBottom: 20 }}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.colors.textSecondary }]}
          onPress={() => onNavigate?.('home')}
        >
          <Text style={[styles.primaryButtonText, { color: '#fff' }]}>REGRESAR</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => {
  const { StyleSheet } = require('react-native');
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
    },
    title: {
      fontSize: scale(24),
      fontWeight: 'bold',
      marginBottom: 20,
      color: theme.colors.text,
    },
    card: {
      marginBottom: 12,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
      elevation: 2,
    },
    cardTitle: {
      fontSize: scale(16),
      fontWeight: 'bold',
      marginBottom: 4,
      color: theme.colors.text,
    },
    cardSubtitle: {
      fontSize: scale(13),
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    label: {
      fontSize: scale(13),
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 12,
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: scale(14),
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      borderColor: theme.colors.border,
    },
    textArea: {
      paddingVertical: 12,
    },
    selectButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    selectButtonText: {
      fontWeight: '600',
      fontSize: scale(13),
      color: '#fff',
      textAlign: 'center',
    },
    primaryButton: {
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },
    primaryButtonText: {
      fontWeight: 'bold',
      fontSize: scale(14),
      textAlign: 'center',
      color: '#fff',
    },
    emptyStateContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      backgroundColor: theme.colors.background,
    },
    emptyStateText: {
      fontSize: scale(16),
      marginTop: 16,
      color: theme.colors.textSecondary,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    closeButton: {
      fontSize: scale(16),
      color: theme.colors.primary,
      fontWeight: '600',
    },
    modalTitle: {
      fontSize: scale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    modalContent: {
      padding: 16,
      backgroundColor: theme.colors.background,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
};
