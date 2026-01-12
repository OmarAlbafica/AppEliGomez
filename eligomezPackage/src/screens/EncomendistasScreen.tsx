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
import { encomendistasService, Encomendista, DestinoEncomendista } from '../services/encomendistasService';
import { BackButton } from '../components/BackButton';
import { useAppTheme } from '../context/ThemeContext';

interface EncomendistasScreenProps {
  onNavigate?: (screen: string) => void;
}

export const EncomendistasScreen: React.FC<EncomendistasScreenProps> = ({ onNavigate }) => {
  const theme = useAppTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  const [encomendistas, setEncomendistas] = useState<Encomendista[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalDestino, setModalDestino] = useState(false);
  const [modalEditarEncomendista, setModalEditarEncomendista] = useState(false);
  const [modalEditarDestino, setModalEditarDestino] = useState(false);
  const [encomendistaSelecionado, setEncomendistaSelecionado] = useState<Encomendista | null>(null);
  const [destinoEditando, setDestinoEditando] = useState<DestinoEncomendista | null>(null);
  const [destinoEditandoIndex, setDestinoEditandoIndex] = useState(-1);

  // Nuevo encomendista
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');

  // Nuevo destino
  const [nuevoDestinoNombre, setNuevoDestinoNombre] = useState('');
  const [diasSeleccionados, setDiasSeleccionados] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState('09:00 AM');
  const [horaFin, setHoraFin] = useState('05:00 PM');

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  // Convertir de 24h (HH:MM) a 12h (hh:mm AM/PM)
  const convertirHora12 = (hora24: string): string => {
    if (!hora24) return '';
    // Si ya tiene AM/PM, devolverlo tal cual
    if (hora24.includes('AM') || hora24.includes('PM')) return hora24;
    
    console.log('🕐 convertirHora12 - Input:', hora24);
    const [horas, minutos] = hora24.split(':').map(Number);
    const ampm = horas >= 12 ? 'PM' : 'AM';
    let horas12 = horas % 12;
    horas12 = horas12 ? horas12 : 12;
    const resultado = `${String(horas12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${ampm}`;
    console.log('🕐 convertirHora12 - Output:', resultado);
    return resultado;
  };

  // Convertir de 12h (hh:mm AM/PM) a 24h (HH:MM)
  const convertirHora24 = (hora12: string): string => {
    if (!hora12) return '09:00';
    const match = hora12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return hora12; // Si no coincide con el formato, devolver como está
    
    let [, horas, minutos, periodo] = match;
    let horasNum = parseInt(horas);
    
    if (periodo.toUpperCase() === 'PM' && horasNum !== 12) {
      horasNum += 12;
    } else if (periodo.toUpperCase() === 'AM' && horasNum === 12) {
      horasNum = 0;
    }
    
    return `${String(horasNum).padStart(2, '0')}:${minutos}`;
  };

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

  const handleAbrirEdicionEncomendista = (encomendista: Encomendista) => {
    setEncomendistaSelecionado(encomendista);
    setNuevoNombre(encomendista.nombre);
    setNuevoTelefono(encomendista.telefono || '');
    setModalEditarEncomendista(true);
  };

  const handleEditarEncomendista = async () => {
    if (!encomendistaSelecionado || !nuevoNombre.trim() || !nuevoTelefono.trim()) {
      Alert.alert('Error', 'Nombre y teléfono son obligatorios');
      return;
    }

    try {
      setGuardando(true);
      await encomendistasService.actualizarEncomendista(encomendistaSelecionado.id!, {
        nombre: nuevoNombre,
        telefono: nuevoTelefono,
      });
      setNuevoNombre('');
      setNuevoTelefono('');
      setModalEditarEncomendista(false);
      setEncomendistaSelecionado(null);
      await cargarEncomendistas();
      Alert.alert('Éxito', 'Encomendista actualizado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el encomendista');
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirModalDestino = (encomendista: Encomendista) => {
    setEncomendistaSelecionado(encomendista);
    setNuevoDestinoNombre('');
    setDiasSeleccionados([]);
    // Inicializar en formato 12h para la UI
    setHoraInicio('09:00 AM');
    setHoraFin('05:00 PM');
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
      // Convertir de 12h a 24h para guardar
      const nuevoDestino: DestinoEncomendista = {
        nombre: nuevoDestinoNombre,
        horarios: [{ dias: diasSeleccionados, hora_inicio: convertirHora24(horaInicio), hora_fin: convertirHora24(horaFin) }],
      };
      
      // Agregar al array de destinos existentes
      const destinosActualizados = [...(encomendistaSelecionado.destinos || []), nuevoDestino];
      await encomendistasService.actualizarEncomendista(encomendistaSelecionado.id!, {
        destinos: destinosActualizados,
      });
      
      setModalDestino(false);
      await cargarEncomendistas();
      Alert.alert('Éxito', 'Destino agregado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el destino');
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirEdicionDestino = (encomendista: Encomendista, destino: DestinoEncomendista, index: number) => {
    setEncomendistaSelecionado(encomendista);
    setDestinoEditando(destino);
    setDestinoEditandoIndex(index);
    setNuevoDestinoNombre(destino.nombre);
    if (destino.horarios && destino.horarios.length > 0) {
      setDiasSeleccionados(destino.horarios[0].dias || []);
      // Convertir de 24h a 12h para mostrar
      const horaInicioValor = destino.horarios[0].hora_inicio || '09:00';
      const horaFinValor = destino.horarios[0].hora_fin || '17:00';
      setHoraInicio(convertirHora12(horaInicioValor));
      setHoraFin(convertirHora12(horaFinValor));
    } else {
      // Si no hay horarios, usar valores por defecto en 12h
      setDiasSeleccionados([]);
      setHoraInicio('09:00 AM');
      setHoraFin('05:00 PM');
    }
    setModalEditarDestino(true);
  };

  const handleEditarDestino = async () => {
    if (!encomendistaSelecionado || !destinoEditando) return;
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
      // Convertir de 12h a 24h para guardar
      const destinoActualizado: DestinoEncomendista = {
        nombre: nuevoDestinoNombre,
        horarios: [{ dias: diasSeleccionados, hora_inicio: convertirHora24(horaInicio), hora_fin: convertirHora24(horaFin) }],
      };
      
      // Solo agregar 'local' si tiene un valor válido
      if (destinoEditando.local) {
        destinoActualizado.local = destinoEditando.local;
      }
      
      const destinosActualizados = [...(encomendistaSelecionado.destinos || [])];
      destinosActualizados[destinoEditandoIndex] = destinoActualizado;
      
      await encomendistasService.actualizarEncomendista(encomendistaSelecionado.id!, {
        destinos: destinosActualizados,
      });
      
      
      setModalEditarDestino(false);
      setDestinoEditando(null);
      setDestinoEditandoIndex(-1);
      await cargarEncomendistas();
      Alert.alert('Éxito', 'Destino actualizado correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el destino');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarDestino = async (encomendista: Encomendista, index: number) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este destino?', [
      { text: 'Cancelar', onPress: () => {} },
      {
        text: 'Eliminar',
        onPress: async () => {
          try {
            setGuardando(true);
            const destinosActualizados = [...(encomendista.destinos || [])];
            destinosActualizados.splice(index, 1);
            
            await encomendistasService.actualizarEncomendista(encomendista.id!, {
              destinos: destinosActualizados,
            });
            
            await cargarEncomendistas();
            Alert.alert('Éxito', 'Destino eliminado');
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el destino');
          } finally {
            setGuardando(false);
          }
        },
      },
    ]);
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
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header con botón < */}
      <View style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 8, backgroundColor: theme.colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={[styles.title, { color: theme.colors.text, fontSize: scale(20) }]}>🚚 Encomendistas</Text>
        <TouchableOpacity style={[styles.selectButton, { marginLeft: 'auto', backgroundColor: theme.colors.primary }]} onPress={() => setModalNuevo(true)}>
          <Text style={[styles.selectButtonText, { color: '#fff' }]}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {encomendistas.length === 0 ? (
        <View style={[styles.emptyStateContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>📭</Text>
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No hay encomendistas creados</Text>
        </View>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={encomendistas}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.primary }]}>
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.nombre}</Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📞 {item.telefono}</Text>
              </View>

              {item.destinos && item.destinos.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[{ fontSize: scale(12), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 }]}>Destinos:</Text>
                  {item.destinos.map((destino, idx) => (
                    <View key={`${destino.nombre}-${idx}`} style={[{ backgroundColor: theme.colors.background, padding: 8, borderRadius: 4, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: theme.colors.primary }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[{ fontSize: scale(12), fontWeight: '600', color: theme.colors.text }]}>📍 {destino.nombre}</Text>
                          {destino.horarios && destino.horarios.length > 0 && (
                            <Text style={[{ fontSize: scale(11), color: theme.colors.textSecondary, marginTop: 4 }]}>
                              ⏰ {convertirHora12(destino.horarios[0].hora_inicio)} - {convertirHora12(destino.horarios[0].hora_fin)}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            style={[{ backgroundColor: theme.colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }]}
                            onPress={() => handleAbrirEdicionDestino(item, destino, idx)}
                          >
                            <Text style={[{ fontSize: scale(10), color: '#fff' }]}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[{ backgroundColor: theme.colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }]}
                            onPress={() => handleEliminarDestino(item, idx)}
                          >
                            <Text style={[{ fontSize: scale(10), color: '#fff' }]}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, backgroundColor: theme.colors.primary }]}
                  onPress={() => handleAbrirModalDestino(item)}
                >
                  <Text style={[styles.selectButtonText, { color: '#fff' }]}>+ Destino</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, backgroundColor: theme.colors.warning || '#f59e0b' }]}
                  onPress={() => handleAbrirEdicionEncomendista(item)}
                >
                  <Text style={[styles.selectButtonText, { color: '#fff' }]}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, backgroundColor: theme.colors.error }]}
                  onPress={() => handleEliminarEncomendista(item.id!)}
                >
                  <Text style={[styles.selectButtonText, { color: '#fff' }]}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal Nuevo Encomendista */}
      <Modal visible={modalNuevo} animationType="slide" onRequestClose={() => setModalNuevo(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setModalNuevo(false)}>
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Crear Encomendista</Text>
            <View />
          </View>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Nombre del encomendista"
              placeholderTextColor={theme.colors.textSecondary}
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Teléfono *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Teléfono"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
              value={nuevoTelefono}
              onChangeText={setNuevoTelefono}
            />

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleCrearEncomendista}
              disabled={guardando}
            >
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Crear Encomendista</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Nuevo Destino */}
      <Modal visible={modalDestino} animationType="slide" onRequestClose={() => setModalDestino(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setModalDestino(false)}>
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Agregar Destino</Text>
            <View />
          </View>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre del Destino *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Ej: Centro Comercial, Parque, etc."
              placeholderTextColor={theme.colors.textSecondary}
              value={nuevoDestinoNombre}
              onChangeText={setNuevoDestinoNombre}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Horario</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Inicio</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={horaInicio}
                  onChangeText={setHoraInicio}
                  placeholder="09:00 AM"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Fin</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={horaFin}
                  onChangeText={setHoraFin}
                  placeholder="05:00 PM"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Días Disponibles *</Text>
            {diasSemana.map((dia) => (
              <TouchableOpacity
                key={dia}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
                onPress={() => toggleDia(dia)}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: theme.colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                    backgroundColor: diasSeleccionados.includes(dia) ? theme.colors.primary : theme.colors.surface,
                  }}
                >
                  {diasSeleccionados.includes(dia) && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={[styles.label, { color: theme.colors.text }]}>{dia}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleAgregarDestino}
              disabled={guardando}
            >
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Agregar Destino</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Editar Encomendista */}
      <Modal visible={modalEditarEncomendista} animationType="slide" onRequestClose={() => setModalEditarEncomendista(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setModalEditarEncomendista(false)}>
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Editar Encomendista</Text>
            <View />
          </View>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Nombre del encomendista"
              placeholderTextColor={theme.colors.textSecondary}
              value={nuevoNombre}
              onChangeText={setNuevoNombre}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Teléfono *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Teléfono"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
              value={nuevoTelefono}
              onChangeText={setNuevoTelefono}
            />

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleEditarEncomendista}
              disabled={guardando}
            >
              <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Guardar Cambios</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Editar Destino */}
      <Modal visible={modalEditarDestino} animationType="slide" onRequestClose={() => setModalEditarDestino(false)}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setModalEditarDestino(false)}>
              <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕ Cerrar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Editar Destino</Text>
            <View />
          </View>
          <ScrollView style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre del Destino *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              placeholder="Ej: Centro Comercial, Parque, etc."
              placeholderTextColor={theme.colors.textSecondary}
              value={nuevoDestinoNombre}
              onChangeText={setNuevoDestinoNombre}
            />

            <Text style={[styles.label, { color: theme.colors.text }]}>Horario</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Inicio</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={horaInicio}
                  onChangeText={setHoraInicio}
                  placeholder="09:00 AM"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Fin</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                  value={horaFin}
                  onChangeText={setHoraFin}
                  placeholder="05:00 PM"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: theme.colors.text }]}>Días Disponibles *</Text>
            {diasSemana.map((dia) => (
              <TouchableOpacity
                key={dia}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
                onPress={() => toggleDia(dia)}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: theme.colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                    backgroundColor: diasSeleccionados.includes(dia) ? theme.colors.primary : theme.colors.surface,
                  }}
                >
                  {diasSeleccionados.includes(dia) && <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={[styles.label, { color: theme.colors.text }]}>{dia}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.disabledButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleEditarDestino}
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

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: scale(24),
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 8,
  },
  card: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: scale(13),
    marginTop: 4,
  },
  selectButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  selectButtonText: {
    fontWeight: '600',
    fontSize: scale(13),
    textAlign: 'center',
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: scale(16),
    marginTop: 16,
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
  },
  disabledButton: {
    opacity: 0.5,
  },
  label: {
    fontSize: scale(13),
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: scale(14),
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
});
