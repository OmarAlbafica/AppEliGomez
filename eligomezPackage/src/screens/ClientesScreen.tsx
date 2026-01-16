import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { clientesService, Cliente } from '../services/clientesService';
import { BackButton } from '../components/BackButton';
import { ListItemCard } from '../components/ListItemCard';
import { PhoneIcon, MailIcon, MapPinIcon, UsersIcon } from '../components/icons';
import { useAppTheme } from '../context/ThemeContext';
import { CustomAlert } from '../components/CustomAlert';

interface ClientesScreenProps {
  onNavigate?: (screen: string) => void;
}

export const ClientesScreen: React.FC<ClientesScreenProps> = ({ onNavigate }) => {
  const theme = useAppTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
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

  // Estados para CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

  // Animated header - efecto snap
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(200)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY > 50) {
          Animated.parallel([
            Animated.timing(headerHeight, { toValue: 60, duration: 200, useNativeDriver: false }),
            Animated.timing(headerOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(headerHeight, { toValue: 200, duration: 200, useNativeDriver: false }),
            Animated.timing(headerOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
          ]).start();
        }
      },
    }
  );

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || [{ text: 'OK', style: 'default' }]);
    setAlertVisible(true);
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const filtrarClientes = (texto: string) => {
    setBusqueda(texto);
    if (!texto.trim()) {
      setClientesFiltrados(clientes);
      return;
    }
    const textoLower = texto.toLowerCase();
    const filtrados = clientes.filter(
      (cliente) =>
        cliente.nombre.toLowerCase().includes(textoLower) ||
        cliente.telefono.includes(texto) ||
        (cliente.correo && cliente.correo.toLowerCase().includes(textoLower)) ||
        (cliente.direccion && cliente.direccion.toLowerCase().includes(textoLower))
    );
    setClientesFiltrados(filtrados);
  };

  const cargarClientes = async () => {
    try {
      setLoading(true);
      const data = await clientesService.obtenerClientes();
      setClientes(data);
      setClientesFiltrados(data);
    } catch (error) {
      console.error('Error:', error);
      showAlert('Error', 'No se pudieron cargar los clientes');
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
      showAlert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }

    try {
      setGuardando(true);
      await clientesService.crearCliente(nombre, telefono, correo || undefined, direccion || undefined);
      limpiarFormulario();
      setModalNuevo(false);
      await cargarClientes();
      showAlert('Éxito', 'Cliente creado correctamente');
    } catch (error) {
      showAlert('Error', 'No se pudo crear el cliente');
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
      showAlert('Error', 'Nombre y teléfono son obligatorios');
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
      showAlert('Éxito', 'Cliente actualizado correctamente');
    } catch (error) {
      showAlert('Error', 'No se pudo actualizar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarCliente = (id: string) => {
    showAlert('Confirmar', '¿Estás seguro de que deseas eliminar este cliente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await clientesService.eliminarCliente(id);
            await cargarClientes();
            showAlert('Éxito', 'Cliente eliminado');
          } catch (error) {
            showAlert('Error', 'No se pudo eliminar el cliente');
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header Animado */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.primary,
            height: headerHeight,
            overflow: 'hidden'
          }
        ]}
      >
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
            onPress={() => setModalNuevo(true)}
          >
            <Text style={styles.addButtonText}>+ Nuevo</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <UsersIcon size={scale(48)} color="#fff" />
          </View>
          <Text style={[styles.headerTitle, { fontSize: scale(28) }]}>Clientes</Text>
          <Text style={[styles.headerSubtitle, { fontSize: scale(14) }]}>
            {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Buscador */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              borderColor: theme.colors.border,
              fontSize: scale(15)
            }]}
            placeholder="🔍 Buscar cliente..."
            placeholderTextColor={theme.colors.textSecondary}
            value={busqueda}
            onChangeText={filtrarClientes}
          />
        </View>

        {clientesFiltrados.length === 0 ? (
          <View style={[styles.emptyStateContainer, { backgroundColor: theme.colors.background }]}>
            <UsersIcon size={scale(64)} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary, fontSize: scale(16) }]}>
              {busqueda ? 'No se encontraron resultados' : 'No hay clientes creados'}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            <FlatList
              scrollEnabled={false}
              data={clientesFiltrados}
              keyExtractor={(item) => item.id!}
              renderItem={({ item }) => {
                const details = [
                  { icon: <PhoneIcon size={16} color={theme.colors.textSecondary} />, text: item.telefono },
                ];
                if (item.correo) {
                  details.push({ icon: <MailIcon size={16} color={theme.colors.textSecondary} />, text: item.correo });
                }
                if (item.direccion) {
                  details.push({ icon: <MapPinIcon size={16} color={theme.colors.textSecondary} />, text: item.direccion });
                }

                return (
                  <ListItemCard
                    title={item.nombre}
                    details={details}
                    leftColor={theme.colors.primary}
                    actions={
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.selectButton, { flex: 1 }]}
                          onPress={() => handleEditarCliente(item)}
                        >
                          <Text style={styles.selectButtonText}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.selectButton, { flex: 1, backgroundColor: theme.colors.error }]}
                          onPress={() => handleEliminarCliente(item.id!)}
                        >
                          <Text style={[styles.selectButtonText, { color: '#fff' }]}>Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    }
                  />
                );
              }}
            />
          </View>
        )}
      </Animated.ScrollView>

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

      {/* Custom Alert */}
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onDismiss={() => setAlertVisible(false)}
      />
    </View>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) => {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingBottom: 24,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 10,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 48,
      marginBottom: 16,
    },
    addButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    headerContent: {
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerTitle: {
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: -0.3,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    searchInput: {
      borderWidth: 2,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
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
      borderWidth: 2,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: scale(15),
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    textArea: {
      paddingVertical: 12,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    selectButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    selectButtonText: {
      fontWeight: '700',
      fontSize: scale(14),
      color: '#fff',
      textAlign: 'center',
    },
    primaryButton: {
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonText: {
      fontWeight: '800',
      fontSize: scale(16),
      textAlign: 'center',
      color: '#fff',
      letterSpacing: 0.5,
    },
    emptyStateContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 80,
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
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    closeButton: {
      fontSize: scale(16),
      color: theme.colors.primary,
      fontWeight: '700',
    },
    modalTitle: {
      fontSize: scale(18),
      fontWeight: '800',
      color: theme.colors.text,
    },
    modalContent: {
      padding: 20,
      backgroundColor: theme.colors.background,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
};
