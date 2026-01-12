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
  Image,
} from 'react-native';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useAppTheme, useTheme } from '../context/ThemeContext';
import { formatDate12Hours, formatDateOnly } from '../utils/dateUtils';
import { formatearFecha } from '../utils/pedidoUtils';

interface PorRemunerarScreenProps {
  onNavigate?: (screen: string) => void;
}

export const PorRemunerarScreen: React.FC<PorRemunerarScreenProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);
  const detailStyles = createDetailStyles(scale, theme);

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

  const [pedidos, setPedidos] = useState<PedidoCompleto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoCompleto | null>(null);
  const [modalImagen, setModalImagen] = useState(false);
  const [imagenSeleccionada, setImagenSeleccionada] = useState<string>('');

  // Agrupar por encomendista
  const [agrupadosPorEncomendista, setAgrupadosPorEncomendista] = useState<
    { encomendista: string; pedidos: PedidoCompleto[] }[]
  >([]);
  const [agrupadosFiltrados, setAgrupadosFiltrados] = useState<
    { encomendista: string; pedidos: PedidoCompleto[] }[]
  >([]);

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      // Cargar pedidos con estado "retirado" (pendientes de remunerar)
      const data = await pedidosServiceOptimizado.obtenerPedidosPorEstado('retirado', 100);
      setPedidos(data);

      // Agrupar por encomendista
      const agrupados: { [key: string]: PedidoCompleto[] } = {};
      data.forEach((pedido: PedidoCompleto) => {
        const encomendista = pedido.encomendista_datos?.nombre || 'Sin Encomendista';
        if (!agrupados[encomendista]) {
          agrupados[encomendista] = [];
        }
        agrupados[encomendista].push(pedido);
      });

      const resultado = Object.entries(agrupados)
        .map(([encomendista, pedidosList]) => ({
          encomendista,
          pedidos: pedidosList.sort((a, b) => {
            const fechaB = new Date(b.fecha_creacion || '').getTime() || 0;
            const fechaA = new Date(a.fecha_creacion || '').getTime() || 0;
            return fechaB - fechaA;
          }),
        }))
        .sort((a, b) => a.encomendista.localeCompare(b.encomendista));

      setAgrupadosPorEncomendista(resultado);
      setAgrupadosFiltrados(resultado);
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  const filtrarPedidos = (texto: string) => {
    setBusqueda(texto);
    if (!texto.trim()) {
      setAgrupadosFiltrados(agrupadosPorEncomendista);
      return;
    }

    const textoLower = texto.toLowerCase();
    const filtrados = agrupadosPorEncomendista
      .map((grupo) => ({
        encomendista: grupo.encomendista,
        pedidos: grupo.pedidos.filter(
          (p) =>
            p.codigo_pedido?.toLowerCase().includes(textoLower) ||
            p.cliente_datos?.nombre?.toLowerCase().includes(textoLower) ||
            p.encomendista_datos?.nombre?.toLowerCase().includes(textoLower) ||
            p.destino_datos?.nombre?.toLowerCase().includes(textoLower)
        ),
      }))
      .filter((grupo) => grupo.pedidos.length > 0);

    setAgrupadosFiltrados(filtrados);
  };

  const handleMarcarRemunerado = async () => {
    if (!pedidoSeleccionado) return;

    try {
      setGuardando(true);
      // Cambiar estado de "retirado" a "remunero"
      const exito = await pedidosServiceOptimizado.cambiarEstadoPedido(
        pedidoSeleccionado.id,
        'remunero',
        undefined,
        'Marcado como remunerado'
      );

      if (exito) {
        setModalDetalle(false);
        await cargarPedidos();
        Alert.alert('Éxito', 'Pedido marcado como remunerado');
      } else {
        Alert.alert('Error', 'No se pudo marcar como remunerado');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo marcar como remunerado');
    } finally {
      setGuardando(false);
    }
  };

  const handleAbrirDetalle = (pedido: PedidoCompleto) => {
    setPedidoSeleccionado(pedido);
    setModalDetalle(true);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'retirado':
        return '#00BCD4';
      case 'no-retirado':
        return '#FF9800';
      case 'remunero':
        return '#4CAF50';
      default:
        return '#999';
    }
  };

  const getEstadoLabel = (estado: string) => {
    const labels: { [key: string]: string } = {
      retirado: '✓ Retirado',
      'no-retirado': '✗ No Retirado',
      remunero: '💰 Remunerado',
    };
    return labels[estado] || estado;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }] }>
      {/* Header con botón < */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingTop: 8 }}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={[styles.title, { color: theme.colors.text }]}>💰 Pedidos por Remunerar</Text>
      </View>

      {/* Buscador */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <TextInput
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 8,
            padding: 12,
            fontSize: scale(14),
            color: theme.colors.text,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
          placeholder="🔍 Buscar por código, cliente, encomendista o destino..."
          placeholderTextColor={theme.colors.textSecondary}
          value={busqueda}
          onChangeText={filtrarPedidos}
        />
      </View>

      {/* Resumen */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Resumen</Text>
        <Text style={{ fontSize: scale(13), color: theme.colors.textSecondary, marginBottom: 6 }}>
          Total de pedidos: <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>{pedidos.length}</Text>
        </Text>
        <Text style={{ fontSize: scale(13), color: theme.colors.textSecondary }}>
          Encomendistas: <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>{agrupadosPorEncomendista.length}</Text>
        </Text>
      </View>

      {agrupadosFiltrados.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.title}>✅</Text>
          <Text style={styles.emptyStateText}>
            {busqueda ? 'No se encontraron resultados' : '¡Todos los pedidos han sido remunerados!'}
          </Text>
        </View>
      ) : (
        agrupadosFiltrados.map((grupo) => (
          <View key={grupo.encomendista} style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>🚚 {grupo.encomendista}</Text>
            <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: 12 }}>
              {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </Text>

            {grupo.pedidos.map((pedido) => (
              <TouchableOpacity
                key={pedido.id}
                style={[styles.card, { backgroundColor: theme.colors.background, borderLeftColor: theme.colors.primary }]}
                onPress={() => handleAbrirDetalle(pedido)}
                activeOpacity={0.7}
              >
                <View style={{ marginBottom: 10 }}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>📦 Pedido: {pedido.codigo_pedido}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>👤 Cliente: {pedido.cliente_datos?.nombre || 'Cliente'}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📅 Retirado: {formatearFecha(new Date(pedido.updated_at || pedido.fecha_creacion || new Date()))}</Text>
                </View>

                {/* Botón ver foto del paquete */}
                {pedido.foto_paquete && pedido.foto_paquete.trim() && (
                  <TouchableOpacity
                    style={{ 
                      marginBottom: 10,
                      backgroundColor: theme.colors.primary, 
                      borderRadius: 6, 
                      paddingHorizontal: 12, 
                      paddingVertical: 8, 
                      alignItems: 'center' 
                    }}
                    onPress={() => {
                      setImagenSeleccionada(pedido.foto_paquete!);
                      setModalImagen(true);
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: scale(12), fontWeight: 'bold' }}>📦 Ver foto del paquete</Text>
                  </TouchableOpacity>
                )}

                {/* Botón ver foto del producto */}
                {pedido.productos_datos && pedido.productos_datos.length > 0 && pedido.productos_datos[0].url_imagen && (
                  <TouchableOpacity
                    style={{ 
                      marginBottom: 10,
                      backgroundColor: '#FF6F00', 
                      borderRadius: 6, 
                      paddingHorizontal: 12, 
                      paddingVertical: 8, 
                      alignItems: 'center' 
                    }}
                    onPress={() => {
                      setImagenSeleccionada(pedido.productos_datos![0].url_imagen!);
                      setModalImagen(true);
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: scale(12), fontWeight: 'bold' }}>📸 Ver foto del producto</Text>
                  </TouchableOpacity>
                )}

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
                    <Text style={{ color: '#fff', fontSize: scale(11), fontWeight: '600' }}>
                      {getEstadoLabel(pedido.estado)}
                    </Text>
                  </View>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>🚚 Encomendista: {pedido.encomendista_datos?.nombre || 'Sin asignar'}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📍 Destino: {pedido.destino_id || pedido.nombre_tienda}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📅 Creado: {formatDate12Hours(pedido.fecha_creacion)}</Text>
                </View>

                {pedido.total && (
                  <Text style={{ fontSize: scale(14), fontWeight: 'bold', color: theme.colors.success }}>
                    💰 Total: ${pedido.total.toLocaleString()}
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
                    <Text style={detailStyles.value}>{pedidoSeleccionado.cliente_datos?.nombre || '-'}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Teléfono:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.telefono_cliente || pedidoSeleccionado.cliente_datos?.telefono || '-'}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Encomendista:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.encomendista_datos?.nombre || '-'}</Text>
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
                    <Text style={detailStyles.value}>{pedidoSeleccionado.destino_id || pedidoSeleccionado.nombre_tienda}</Text>
                  </View>
                  {pedidoSeleccionado.direccion_personalizada && (
                    <View style={detailStyles.row}>
                      <Text style={detailStyles.label}>Dirección:</Text>
                      <Text style={detailStyles.value}>{pedidoSeleccionado.direccion_personalizada}</Text>
                    </View>
                  )}
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Horario:</Text>
                    <Text style={detailStyles.value}>
                      {convertirHora12(pedidoSeleccionado.hora_inicio)} - {convertirHora12(pedidoSeleccionado.hora_fin)}
                    </Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Día de Entrega:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.dia_entrega}</Text>
                  </View>
                </View>

                {/* IMÁGENES DE PRODUCTOS */}
                {pedidoSeleccionado.productos_datos && pedidoSeleccionado.productos_datos.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📦 Productos ({pedidoSeleccionado.cantidad_prendas})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginVertical: 8 }}>
                      {pedidoSeleccionado.productos_datos.map((producto, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={styles.productoDetailCard}
                          onPress={() => {
                            setImagenSeleccionada(producto.url_imagen || '');
                            setModalImagen(true);
                          }}
                        >
                          {producto.url_imagen && (
                            <Image
                              source={{ uri: producto.url_imagen }}
                              style={styles.productoDetailImage}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {pedidoSeleccionado.productos_datos.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        {pedidoSeleccionado.productos_datos.map((producto, idx) => (
                          <View key={idx} style={{ marginBottom: 8 }}>
                            <Text style={styles.productoDetailCodigo}>Código: {producto.codigo}</Text>
                            <Text style={styles.productoDetailAlbum}>Álbum: {producto.album}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

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
                    <Text style={detailStyles.value}>${(pedidoSeleccionado.monto_envio || 0).toLocaleString()}</Text>
                  </View>
                  <View style={[detailStyles.row, { backgroundColor: '#f0f0f0', paddingVertical: 12 }]}>
                    <Text style={[detailStyles.label, { fontWeight: 'bold' }]}>Total:</Text>
                    <Text style={[detailStyles.value, { fontSize: scale(16), fontWeight: 'bold', color: '#2E7D32' }]}>
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
                    <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: '600' }}>
                      {getEstadoLabel(pedidoSeleccionado.estado)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, guardando && styles.disabledButton]}
                  onPress={handleMarcarRemunerado}
                  disabled={guardando}
                >
                  <Text style={styles.primaryButtonText}>
                    {guardando ? '⏳ Guardando...' : '💰 Marcar como Remunerado'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de imagen */}
      <Modal
        visible={modalImagen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalImagen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          {/* Encabezado */}
          <View style={{
            backgroundColor: theme.colors.surface,
            paddingTop: 16,
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}>
            <Text style={{ color: theme.colors.text, fontSize: scale(16), fontWeight: 'bold' }}>🖼️ Imagen</Text>
            <TouchableOpacity
              onPress={() => setModalImagen(false)}
              style={{ padding: 8 }}
            >
              <Text style={{ color: theme.colors.text, fontSize: scale(28), fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Imagen fullscreen */}
          {imagenSeleccionada ? (
            <Image
              source={{ uri: imagenSeleccionada }}
              style={{ flex: 1, resizeMode: 'contain', backgroundColor: theme.colors.background }}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: theme.colors.textSecondary }}>Sin imagen</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Botón Regresar */}
      <View style={{ padding: 16, paddingBottom: 20 }}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.colors.textSecondary }]}
          onPress={() => onNavigate?.('home')}
        >
          <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>REGRESAR</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createDetailStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    fontSize: scale(13),
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  value: {
    fontSize: scale(13),
    color: theme.colors.text,
    fontWeight: '500',
  },
});

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: 12,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    elevation: 1,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  cardTitle: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  cardSubtitle: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  miniImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
  },
  miniImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: theme.colors.background,
  },
  emptyStateText: {
    fontSize: scale(16),
    color: theme.colors.textSecondary,
    marginTop: 16,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  closeButton: {
    fontSize: scale(16),
    fontWeight: '600',
    color: theme.colors.primary,
  },
  modalTitle: {
    fontSize: scale(16),
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  productoDetailCard: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  productoDetailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productoInfo: {
    padding: 10,
  },
  productoDetailCodigo: {
    fontSize: scale(13),
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  productoDetailAlbum: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
  },
  imageModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: scale(14),
    fontWeight: '600',
  },
});
