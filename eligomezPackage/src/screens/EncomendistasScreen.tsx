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
  StyleSheet,
} from 'react-native';
import { Picker as ReactNativePicker } from '@react-native-picker/picker';
import { encomendistasService, Encomendista, Destino } from '../services/encomendistasService';
import { BackButton } from '../components/BackButton';
import { styles } from '../styles/styles';

interface EncomendistasScreenProps {
  onNavigate?: (screen: string) => void;
}

export const EncomendistasScreen: React.FC<EncomendistasScreenProps> = ({ onNavigate }) => {
  const [encomendistas, setEncomendistas] = useState<Encomendista[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalDestino, setModalDestino] = useState(false);
  const [encomendistaSelecionado, setEncomendistaSelecionado] = useState<Encomendista | null>(null);

  // Nuevo encomendista
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');

  // Nuevo destino
  const [nuevoDestinoNombre, setNuevoDestinoNombre] = useState('');
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('17:00');

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    cargarEncomendistas();
  }, []);

  const cargarEncomendistas = async () => {
    try {
      setLoading(true);
      const data = await encomendistasService.obtenerEncomendistas();
      setEncomendistas(data);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los encomendistas');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearEncomendista = async () => {
    if (!nuevoNombre.trim() || !nuevoTelefono.trim()) {
      Alert.alert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }

    try {
      setGuardando(true);
      await encomendistasService.crearEncomendista(nuevoNombre, nuevoTelefono);
      setNuevoNombre('');
      setNuevoTelefono('');
      setModalNuevo(false);
      await cargarEncomendistas();
      Alert.alert('Éxito', 'Encomendista creado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el encomendista');
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirModalDestino = (encomendista: Encomendista) => {
    setEncomendistaSelecionado(encomendista);
    setNuevoDestinoNombre('');
    setDiasSeleccionados([]);
    setHoraInicio('09:00');
    setHoraFin('17:00');
    setModalDestino(true);
  };

  const toggleDia = (dia: string) => {
    if (diasSeleccionados.includes(dia)) {
      setDiasSeleccionados(diasSeleccionados.filter((d) => d !== dia));
    } else {
      setDiasSeleccionados([...diasSeleccionados, dia]);
    }
  };

  const handleAgregarDestino = async () => {
    if (!encomendistaSelecionado) return;
    if (!nuevoDestinoNombre.trim()) {
      Alert.alert('Error', 'El nombre del destino es obligatorio');
      return;
    }
    if (diasSeleccionados.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un día');
      return;
    }

    try {
      setGuardando(true);
      const nuevoDestino: Destino = {
        id: Date.now().toString(),
        nombre: nuevoDestinoNombre,
        horarios: [{ dias: diasSeleccionados, hora_inicio: horaInicio, hora_fin: horaFin }],
      };
      await encomendistasService.agregarDestino(encomendistaSelecionado.id!, nuevoDestino);
      setModalDestino(false);
      await cargarEncomendistas();
      Alert.alert('Éxito', 'Destino agregado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el destino');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarEncomendista = async (id: string) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este encomendista?', [
      { text: 'Cancelar', onPress: () => {} },
      {
        text: 'Eliminar',
        onPress: async () => {
          try {
            await encomendistasService.eliminarEncomendista(id);
            await cargarEncomendistas();
            Alert.alert('Éxito', 'Encomendista eliminado');
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el encomendista');
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
        <Text style={styles.title}>🚚 Encomendistas</Text>
        <TouchableOpacity style={[styles.selectButton, { marginLeft: 'auto' }]} onPress={() => setModalNuevo(true)}>
          <Text style={styles.selectButtonText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {encomendistas.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.title}>📭</Text>
          <Text style={styles.emptyStateText}>No hay encomendistas creados</Text>
        </View>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={encomendistas}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.cardTitle}>{item.nombre}</Text>
                <Text style={styles.cardSubtitle}>📞 {item.telefono}</Text>
              </View>

              {item.destinos && item.destinos.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>Destinos:</Text>
                  {item.destinos.map((destino) => (
                    <View key={destino.id} style={{ backgroundColor: '#f0f0f0', padding: 8, borderRadius: 4, marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>📍 {destino.nombre}</Text>
                      {destino.horarios && destino.horarios.length > 0 && (
                        <Text style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                          ⏰ {destino.horarios[0].hora_inicio} - {destino.horarios[0].hora_fin}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1 }]}
                  onPress={() => handleAbrirModalDestino(item)}
                >
                  <Text style={styles.selectButtonText}>+ Destino</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, backgroundColor: '#dc3545' }]}
                  onPress={() => handleEliminarEncomendista(item.id!)}
                >
                  <Text style={styles.selectButtonText}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal Nuevo Encomendista */}
      <Modal visible={modalNuevo} animationType="slide" onRequestClose={() => setModalNuevo(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalNuevo(false)}>
              <Text style={styles.closeButton}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Crear Encomendista</Text>
            <View />
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del encomendista"
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
            />

            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              keyboardType="phone-pad"
              value={nuevoTelefono}
              onChangeText={setNuevoTelefono}
            />

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton]}
              onPress={handleCrearEncomendista}
              disabled={guardando}
            >
              <Text style={styles.primaryButtonText}>Crear Encomendista</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Nuevo Destino */}
      <Modal visible={modalDestino} animationType="slide" onRequestClose={() => setModalDestino(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalDestino(false)}>
              <Text style={styles.closeButton}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Agregar Destino</Text>
            <View />
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Nombre del Destino *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Centro Comercial, Parque, etc."
              value={nuevoDestinoNombre}
              onChangeText={setNuevoDestinoNombre}
            />

            <Text style={styles.label}>Horario</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Inicio</Text>
                <TextInput
                  style={styles.input}
                  value={horaInicio}
                  onChangeText={setHoraInicio}
                  placeholder="09:00"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Fin</Text>
                <TextInput
                  style={styles.input}
                  value={horaFin}
                  onChangeText={setHoraFin}
                  placeholder="17:00"
                />
              </View>
            </View>

            <Text style={styles.label}>Días Disponibles *</Text>
            {diasSemana.map((dia) => (
              <TouchableOpacity
                key={dia}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: '#eee',
                }}
                onPress={() => toggleDia(dia)}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: '#667eea',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                    backgroundColor: diasSeleccionados.includes(dia) ? '#667eea' : '#fff',
                  }}
                >
                  {diasSeleccionados.includes(dia) && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={styles.label}>{dia}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton]}
              onPress={handleAgregarDestino}
              disabled={guardando}
            >
              <Text style={styles.primaryButtonText}>Agregar Destino</Text>
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
