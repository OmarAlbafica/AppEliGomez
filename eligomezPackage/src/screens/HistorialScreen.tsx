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
  Image,
} from 'react-native';
import { Picker as RNPicker } from '@react-native-picker/picker';
import pedidosService from '../services/pedidosService';
import { Pedido } from '../services/pedidosService';
import productosService, { Producto } from '../services/productosService';
import { BackButton } from '../components/BackButton';
import { styles } from '../styles/styles';
import { useAppTheme } from '../context/ThemeContext';
import { formatDate12Hours, formatDateOnly } from '../utils/dateUtils';

const Picker = RNPicker as any;

interface HistorialScreenProps {
  onNavigate?: (screen: string) => void;
}

const estadoColors: { [key: string]: string } = {
  pendiente: '#FFC107',
  en_transito: '#2196F3',
  entregado: '#4CAF50',
  cancelado: '#F44336',
  enviado: '#9C27B0',
  retirado: '#00BCD4',
  'no-retirado': '#FF9800',
  remunero: '#4CAF50',
};

const estadoLabels: { [key: string]: string } = {
  pendiente: '⏳ Pendiente',
  procesando: '🚚 Procesando',
  entregado: '✅ Entregado',
  cancelado: '❌ Cancelado',
  enviado: '📮 Enviado',
  retirado: '✓ Retirado',
  'no-retirado': '✗ No Retirado',
  remunero: '💰 Remunerado',
};


export const HistorialScreen: React.FC<HistorialScreenProps> = ({ onNavigate }) => {
  const theme = useAppTheme();
  const scale = (size: number) => theme.scale(size);
  const detailStyles = createDetailStyles(scale, theme);
  
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [modalImagen, setModalImagen] = useState(false);
  const [imagenSeleccionada, setImagenSeleccionada] = useState<string>('');
  const [qrGenerado, setQrGenerado] = useState<string>('');

  const loadHistorial = async (pageNumber: number = 0) => {
    try {
      if (pageNumber === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const resultado = await pedidosService.obtenerHistorialPedidos(pageNumber);
      const total = await pedidosService.obtenerTotalPedidosPendientes();
      
      if (pageNumber === 0) {
        setPedidos(resultado);
      } else {
        setPedidos(prev => [...prev, ...resultado]);
      }
      
      setTotalPedidos(total);
      setCurrentPage(pageNumber);
    } catch (error) {
      console.error('Error cargando historial:', error);
      Alert.alert('Error', 'No se pudo cargar el historial de pedidos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const cargarProductos = async () => {
    try {
      const prods = await productosService.cargarProductos();
      setProductos(prods);
      console.log('✅ Productos cargados:', prods.length);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  // Obtiene los productos de un pedido
  const obtenerProductosDePedido = (pedido: Pedido): Producto[] => {
    if (!pedido.productos_id || pedido.productos_id.length === 0) {
      return [];
    }
    return productos.filter(p => pedido.productos_id!.includes(p.id));
  };

  const handleCargarMas = () => {
    loadHistorial(currentPage + 1);
  };

  const estados = ['pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'cancelado'];

  // Función para convertir hora 24h a 12h
  const convertir24A12Horas = (hora: string): string => {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    const hours = parseInt(h, 10);
    const minutes = m || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const horas12 = hours % 12 || 12;
    return `${horas12}:${minutes} ${ampm}`;
  };

  // Función para generar QR usando API online
  const generarQR = (texto: string) => {
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(texto)}`;
      setQrGenerado(qrUrl);
      console.log('✅ QR generado:', qrUrl);
    } catch (error) {
      console.error('Error generando QR:', error);
    }
  };

  useEffect(() => {
    loadHistorial();
    cargarProductos();
  }, []);

  // Ordenar: 1) Por empacar primero, 2) Enviados por fecha próxima
  const pedidosFiltrados = (() => {
    let lista = filtroEstado ? pedidos.filter((p) => p.estado === filtroEstado) : pedidos;
    
    // Si NO hay filtro, ordenar especialmente
    if (!filtroEstado) {
      // Separar en grupos
      const porEmpacar: Pedido[] = [];
      const enviados: Pedido[] = [];
      const otros: Pedido[] = [];

      lista.forEach(pedido => {
        if (pedidosService.debeSerEmpacado(pedido)) {
          porEmpacar.push(pedido);
        } else if (pedido.estado === 'enviado') {
          enviados.push(pedido);
        } else {
          otros.push(pedido);
        }
      });

      // Ordenar enviados por fecha de entrega más próxima
      enviados.sort((a, b) => {
        const fechaA = a.fecha_entrega_programada?.getTime() || Infinity;
        const fechaB = b.fecha_entrega_programada?.getTime() || Infinity;
        return fechaA - fechaB;
      });

      // Ordenar otros por fecha de creación descendente
      otros.sort((a, b) => {
        const fechaB = b.fecha_creacion?.getTime() || 0;
        const fechaA = a.fecha_creacion?.getTime() || 0;
        return fechaB - fechaA;
      });

      // Combinar: por empacar primero, luego enviados, luego otros
      lista = [...porEmpacar, ...enviados, ...otros];
    }

    return lista;
  })();

  const handleAbrirDetalle = (pedido: Pedido) => {
    console.log('🔍 Abriendo detalle del pedido:');
    console.log('  ID:', pedido.id);
    console.log('  Código:', pedido.codigo_pedido);
    console.log('  Foto Paquete:', pedido.foto_paquete);
    console.log('  Productos Códigos:', pedido.productos_codigos);
    setPedidoSeleccionado(pedido);
    setModalDetalle(true);
    // Generar QR con el código del pedido
    generarQR(pedido.codigo_pedido);
  };

  const handleCambiarEstado = async (nuevoEstado: 'pendiente' | 'procesando' | 'entregado' | 'cancelado' | 'enviado' | 'retirado' | 'no-retirado' | 'remunero') => {
    if (!pedidoSeleccionado) return;

    try {
      await pedidosService.cambiarEstado(pedidoSeleccionado.id!, nuevoEstado);
      setModalDetalle(false);
      await loadHistorial();
      Alert.alert('Éxito', 'Estado actualizado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  const handleEliminarPedido = async (id: string) => {
    Alert.alert('Confirmar', '¿Estás seguro de que deseas eliminar este pedido?', [
      { text: 'Cancelar' },
      {
        text: 'Eliminar',
        onPress: async () => {
          try {
            await pedidosService.deletePedido(id);
            await loadHistorial();
            Alert.alert('Éxito', 'Pedido eliminado');
          } catch (error) {
            Alert.alert('Error', 'No se pudo eliminar el pedido');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.colors.background }] }>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }


  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header con botón < */}
      <View style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: scale(16), paddingTop: scale(8), backgroundColor: theme.colors.surface }, { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }]}>
        <BackButton onPress={() => onNavigate?.('home')} />
        <Text style={[styles.title, { color: theme.colors.text, fontSize: scale(20) }]}>📋 Historial de Pedidos</Text>
      </View>

      {/* Info sobre Empaques */}
      <View style={{ 
        backgroundColor: theme.colors.warning + '20',
        padding: scale(12), 
        marginHorizontal: scale(16), 
        borderRadius: scale(8), 
        marginBottom: scale(16),
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.warning
      }}>
        <Text style={{ fontSize: scale(12), color: theme.colors.text, fontWeight: '500' }}>
          📦 Los pedidos con badge <Text style={{ fontWeight: '700' }}>⚠️ Empacar mañana</Text> deben ser empacados hoy para el envío de mañana.
        </Text>
        <Text style={{ fontSize: scale(11), color: theme.colors.text, marginTop: scale(4) }}>
          💡 Mañana saldrán los siguientes pedidos que irán siendo enviados el miércoles.
        </Text>
      </View>

      {/* Filtro */}
      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: scale(14) }]}>Filtrar por Estado</Text>
        <Picker selectedValue={filtroEstado} onValueChange={setFiltroEstado} style={[styles.picker, { color: theme.colors.text }]}>
          <Picker.Item label="Todos los estados" value="" />
          {estados
            .filter((e) => e !== '')
            .map((estado) => (
              <Picker.Item key={estado} label={estadoLabels[estado]} value={estado} />
            ))}
        </Picker>
      </View>

      {/* Contador */}
      <View style={[styles.alertBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.alertBoxText, { color: theme.colors.text, fontSize: scale(13) }]}>
          Total: {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
        </Text>
      </View>

      {pedidosFiltrados.length === 0 ? (
        <View style={[styles.emptyStateContainer, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>📭</Text>
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>No hay pedidos con este estado</Text>
        </View>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={pedidosFiltrados}
          keyExtractor={(item) => item.id!}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: scale(12),
                marginHorizontal: scale(16),
                marginBottom: scale(12),
                paddingHorizontal: scale(16),
                paddingVertical: scale(14),
                borderLeftWidth: 5,
                borderLeftColor: estadoColors[item.estado] || theme.colors.border,
                elevation: 3,
              }}
              onPress={() => handleAbrirDetalle(item)}
              activeOpacity={0.7}
            >
              {/* Encabezado: Código y Estado */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(12) }}>
                <View>
                  <Text style={{ fontSize: scale(16), fontWeight: '700', color: theme.colors.text }}>
                    {item.codigo_pedido}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: estadoColors[item.estado] || theme.colors.border,
                    paddingVertical: scale(5),
                    paddingHorizontal: scale(10),
                    borderRadius: scale(6),
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: scale(11), fontWeight: '600' }}>
                    {estadoLabels[item.estado]}
                  </Text>
                </View>
              </View>

              {/* Información principal */}
              <View style={{ marginBottom: scale(12) }}>
                <Text style={{ fontSize: scale(13), color: theme.colors.textSecondary, marginBottom: scale(2) }}>Cliente</Text>
                <Text style={{ fontSize: scale(15), fontWeight: '600', color: theme.colors.text }}>
                  {item.cliente_nombre || 'Sin nombre'}
                </Text>
              </View>

              {/* Grid de 2 columnas - Encomendista y Tienda */}
              <View style={{ flexDirection: 'row', gap: scale(12), marginBottom: scale(10) }}>
                {/* Encomendista */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: scale(2) }}>Encomendista</Text>
                  <Text style={{ fontSize: scale(13), fontWeight: '600', color: theme.colors.text }}>
                    {item.encomendista_nombre || 'Sin asignar'}
                  </Text>
                </View>

                {/* Tienda */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: scale(2) }}>Tienda</Text>
                  <Text style={{ fontSize: scale(13), fontWeight: '600', color: theme.colors.text }}>
                    {item.nombre_tienda || 'Sin tienda'}
                  </Text>
                </View>
              </View>

              {/* Grid de 2 columnas - Perfil de Reserva y Destino */}
              <View style={{ flexDirection: 'row', gap: scale(12), marginBottom: scale(10) }}>
                {/* Perfil de Reserva */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: scale(2) }}>Perfil de Reserva</Text>
                  <Text style={{ fontSize: scale(13), fontWeight: '600', color: theme.colors.text }}>
                    {item.nombre_perfil || 'Sin perfil'}
                  </Text>
                </View>

                {/* Destino */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: scale(2) }}>Destino</Text>
                  <Text style={{ fontSize: scale(13), fontWeight: '600', color: theme.colors.text }}>
                    {item.destino_nombre && item.destino_nombre.trim() ? item.destino_nombre : 'No especificado'}
                  </Text>
                  {item.direccion_personalizada && (
                    <Text style={{ fontSize: scale(11), color: theme.colors.textSecondary, marginTop: scale(4) }} numberOfLines={1}>
                      📍 {item.direccion_personalizada.substring(0, 40)}...
                    </Text>
                  )}
                </View>
              </View>

              {/* Fecha de Entrega */}
              <View style={{ marginBottom: scale(10) }}>
                <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: scale(2) }}>Entrega</Text>
                <Text style={{ fontSize: scale(13), fontWeight: '600', color: theme.colors.text }}>
                  {formatDateOnly(item.fecha_entrega_programada)}
                </Text>
              </View>

              {/* Monto */}
              {item.total && (
                <View style={{ marginBottom: scale(10), paddingTop: scale(10), borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: scale(4) }}>Total</Text>
                  <Text style={{ fontSize: scale(16), fontWeight: '700', color: theme.colors.success }}>
                    ${item.total.toLocaleString('es-ES')}
                  </Text>
                </View>
              )}

              {/* Badge Empacar */}
              {pedidosService.debeSerEmpacado(item) && (
                <View
                  style={{
                    backgroundColor: theme.colors.error,
                    paddingVertical: scale(8),
                    paddingHorizontal: scale(10),
                    borderRadius: scale(6),
                    marginTop: scale(10),
                    borderLeftWidth: 3,
                    borderLeftColor: theme.colors.error,
                  }}
                >
                  <Text style={{ fontSize: scale(12), fontWeight: '600', color: theme.colors.text }}>
                    Debe empacar hoy
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
      {/* Botón Cargar Más */}
      {pedidos.length > 0 && pedidos.length < totalPedidos && (
        <View style={{ padding: 16, paddingBottom: 20 }}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleCargarMas}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={styles.primaryButtonText}>
                📥 Cargar más ({pedidos.length} de {totalPedidos})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Detalle */}
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
                    <Text style={detailStyles.label}>Tienda:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.nombre_tienda || 'Sin tienda'}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Encomendista:</Text>
                    <Text style={detailStyles.value}>{pedidoSeleccionado.encomendista_nombre || 'Sin encomendista'}</Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Destino:</Text>
                    <Text style={detailStyles.value}>
                      {pedidoSeleccionado.destino_nombre && pedidoSeleccionado.destino_nombre.trim() 
                        ? pedidoSeleccionado.destino_nombre 
                        : (pedidoSeleccionado.direccion_personalizada 
                          ? pedidoSeleccionado.direccion_personalizada.substring(0, 50) + '...'
                          : 'Sin destino')}
                    </Text>
                  </View>
                </View>

<View style={styles.section}>
                  <Text style={styles.sectionTitle}>Horario y Fecha</Text>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Horario:</Text>
                    <Text style={detailStyles.value}>
                      {pedidoSeleccionado.hora_inicio && pedidoSeleccionado.hora_fin
                        ? `${convertir24A12Horas(pedidoSeleccionado.hora_inicio)} - ${convertir24A12Horas(pedidoSeleccionado.hora_fin)}`
                        : 'Sin horario'}
                    </Text>
                  </View>
                  <View style={detailStyles.row}>
                    <Text style={detailStyles.label}>Fecha de Creación:</Text>
                    <Text style={detailStyles.value}>
                      {formatDate12Hours(pedidoSeleccionado.fecha_creacion)}
                    </Text>
                  </View>
                  {pedidoSeleccionado.fecha_entrega_programada && (
                    <View style={detailStyles.row}>
                      <Text style={detailStyles.label}>Fecha Programada:</Text>
                      <Text style={detailStyles.value}>
                        {formatDateOnly(pedidoSeleccionado.fecha_entrega_programada)}
                      </Text>
                    </View>
                  )}
                </View>

                {pedidoSeleccionado.total && (
                  <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Monto Total</Text>
                    <Text style={{ fontSize: scale(16), fontWeight: 'bold', color: theme.colors.success }}>
                      ${pedidoSeleccionado.total.toLocaleString()}
                    </Text>
                  </View>
                )}

                {pedidoSeleccionado.notas && (
                  <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Notas</Text>
                    <Text style={{ fontSize: scale(13), color: theme.colors.textSecondary, lineHeight: 20 }}>
                      {pedidoSeleccionado.notas}
                    </Text>
                  </View>
                )}

                {/* Sección de Productos */}
                <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>📦 Productos</Text>
                  <View style={{ marginBottom: 12 }}>
                    <View style={detailStyles.row}>
                      <Text style={detailStyles.label}>Cantidad de Prendas:</Text>
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
                  </View>
                </View>

                {/* QR del Pedido */}
                {pedidoSeleccionado.id && qrGenerado && (
                  <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🔲 QR del Pedido</Text>
                    <View style={{ alignItems: 'center', paddingVertical: 20, backgroundColor: theme.colors.background, borderRadius: 8 }}>
                      <View style={{ 
                        width: 220, 
                        height: 220, 
                        backgroundColor: theme.colors.surface,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: theme.colors.border,
                        padding: 10
                      }}>
                        <Image
                          source={{ uri: qrGenerado }}
                          style={{ width: 200, height: 200 }}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginTop: 12, textAlign: 'center', fontWeight: '600' }}>
                        {pedidoSeleccionado.codigo_pedido}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Fotos del Pedido */}
                {(pedidoSeleccionado.foto_paquete || obtenerProductosDePedido(pedidoSeleccionado).length > 0) && (
                  <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>📸 Imágenes</Text>
                    
                    {/* Foto del paquete */}
                    {pedidoSeleccionado.foto_paquete && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: 8 }}>Foto del Paquete Empacado:</Text>
                        <View style={{ position: 'relative' }}>
                          <Image
                            source={{ uri: pedidoSeleccionado.foto_paquete }}
                            style={{
                              width: '100%',
                              height: 200,
                              borderRadius: 8,
                              backgroundColor: theme.colors.surface,
                            }}
                            resizeMode="cover"
                          />
                          <TouchableOpacity 
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: 'rgba(0, 0, 0, 0.5)',
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                            onPress={() => {
                              setImagenSeleccionada(pedidoSeleccionado.foto_paquete!);
                              setModalImagen(true);
                            }}
                          >
                            <Text style={{ fontSize: scale(20) }}>👁️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Productos del Pedido - Grilla de Thumbnails */}
                    {obtenerProductosDePedido(pedidoSeleccionado).length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: 12 }}>Productos en este Pedido:</Text>
                        <View style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 10,
                          justifyContent: 'flex-start'
                        }}>
                          {obtenerProductosDePedido(pedidoSeleccionado).map((producto, idx) => (
                            <TouchableOpacity
                              key={producto.id}
                              onPress={() => {
                                const imgUrl = producto.url_imagen || producto.imagen_url;
                                if (imgUrl) {
                                  setImagenSeleccionada(imgUrl);
                                  setModalImagen(true);
                                }
                              }}
                              style={{
                                width: '23%',
                                aspectRatio: 1,
                                borderRadius: 8,
                                overflow: 'hidden',
                                backgroundColor: theme.colors.surface,
                                borderWidth: 2,
                                borderColor: theme.colors.border
                              }}
                            >
                              {producto.url_thumbnail || producto.url_imagen || producto.imagen_url ? (
                                <Image
                                  source={{ uri: producto.url_thumbnail || producto.url_imagen || producto.imagen_url }}
                                  style={{ width: '100%', height: '100%' }}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: scale(24) }}>📦</Text>
                                </View>
                              )}
                              <View style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                padding: 4
                              }}>
                                <Text style={{ fontSize: scale(9), color: '#fff', fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
                                  {producto.codigo}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Estado Actual</Text>
                  <View
                    style={{
                      backgroundColor: estadoColors[pedidoSeleccionado.estado],
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: scale(16), fontWeight: '600' }}>
                      {estadoLabels[pedidoSeleccionado.estado]}
                    </Text>
                  </View>

                  <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Cambiar Estado</Text>
                  <Picker
                    selectedValue={pedidoSeleccionado.estado}
                    onValueChange={(nuevoEstado: string) => {
                      if (nuevoEstado !== pedidoSeleccionado.estado) {
                        handleCambiarEstado(nuevoEstado as 'pendiente' | 'procesando' | 'entregado' | 'cancelado' | 'enviado' | 'retirado' | 'no-retirado' | 'remunero');
                      }
                    }}
                    style={styles.picker}
                  >
                    {estados
                      .filter((e) => e !== '')
                      .map((estado) => (
                        <Picker.Item key={estado} label={estadoLabels[estado]} value={estado} />
                      ))}
                  </Picker>
                </View>

                <TouchableOpacity
                  style={[styles.selectButton, { backgroundColor: theme.colors.error }]}
                  onPress={() => {
                    handleEliminarPedido(pedidoSeleccionado.id!);
                    setModalDetalle(false);
                  }}
                >
                  <Text style={[styles.selectButtonText, { color: '#fff' }]}>🗑️ Eliminar Pedido</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal para ver imagen ampliada */}
      <Modal visible={modalImagen} transparent animationType="fade" onRequestClose={() => setModalImagen(false)}>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <TouchableOpacity 
            style={{
              position: 'absolute',
              top: 40,
              right: 20,
              zIndex: 10
            }}
            onPress={() => setModalImagen(false)}
          >
            <Text style={{ fontSize: scale(32), color: '#fff' }}>✕</Text>
          </TouchableOpacity>
          
          {imagenSeleccionada && (
            <Image
              source={{ uri: imagenSeleccionada }}
              style={{
                width: '90%',
                height: '80%',
                borderRadius: 8
              }}
              resizeMode="contain"
            />
          )}
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

const createDetailStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(8),
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
