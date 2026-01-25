import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';
import { ImageViewer } from '../components/ImageViewer';
import { PackageIcon } from '../components/icons';
import { CustomAlert } from '../components/CustomAlert';

interface UrgentesEmpacarScreenProps {
  onNavigate?: (screen: string) => void;
}

export const UrgentesEmpacarScreen: React.FC<UrgentesEmpacarScreenProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  const [pedidos, setPedidos] = useState<PedidoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [proximoEnvio, setProximoEnvio] = useState<Date>(new Date());
  const [rangoFechas, setRangoFechas] = useState({ inicio: '', fin: '' });
  
  // Visor de imágenes con zoom
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imageTitle, setImageTitle] = useState('');
  
  // Vista compacta - Se carga desde AsyncStorage
  const [vistaCompacta, setVistaCompacta] = useState(true);
  
  // Notas de empaque
  const [notasEmpaque, setNotasEmpaque] = useState<{ [key: string]: string }>({});

  // Pedidos encontrados (guardados localmente)
  const [pedidosEncontrados, setPedidosEncontrados] = useState<Set<string>>(new Set());

  // Estados para CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<any[]>([]);

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || [{ text: 'OK', style: 'default' }]);
    setAlertVisible(true);
  };

  // Animated header
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(280)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        if (offsetY > 50) {
          Animated.parallel([
            Animated.timing(headerHeight, { toValue: 100, duration: 200, useNativeDriver: false }),
            Animated.timing(headerOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(headerHeight, { toValue: 280, duration: 200, useNativeDriver: false }),
            Animated.timing(headerOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
          ]).start();
        }
      },
    }
  );

  useEffect(() => {
    cargarPedidosUrgentes();
    cargarEncontrados();
    cargarVistaCompactaPreferencia();
  }, []);

  const cargarEncontrados = async () => {
    try {
      const encontradosJson = await AsyncStorage.getItem('pedidosEncontrados_Urgentes');
      if (encontradosJson) {
        const encontrados = JSON.parse(encontradosJson);
        setPedidosEncontrados(new Set(encontrados));
      }
    } catch (error) {
      console.error('Error cargando encontrados:', error);
    }
  };

  const cargarVistaCompactaPreferencia = async () => {
    try {
      const vistaGuardada = await AsyncStorage.getItem('vistaCompactaDefecto');
      if (vistaGuardada !== null) {
        setVistaCompacta(vistaGuardada === 'true');
      }
    } catch (error) {
      console.error('Error cargando vista compacta:', error);
    }
  };

  const guardarEncontrados = async (nuevosEncontrados: Set<string>) => {
    try {
      const encontradosArray = Array.from(nuevosEncontrados);
      await AsyncStorage.setItem('pedidosEncontrados_Urgentes', JSON.stringify(encontradosArray));
    } catch (error) {
      console.error('Error guardando encontrados:', error);
    }
  };

  const marcarComoEncontrado = async (pedidoId: string) => {
    const nuevosEncontrados = new Set(pedidosEncontrados);
    if (nuevosEncontrados.has(pedidoId)) {
      nuevosEncontrados.delete(pedidoId);
    } else {
      nuevosEncontrados.add(pedidoId);
    }
    setPedidosEncontrados(nuevosEncontrados);
    await guardarEncontrados(nuevosEncontrados);
  };

  const cargarPedidosUrgentes = async () => {
    try {
      setLoading(true);
      
      // ✅ Usar servicio centralizado (sin hardcodear URL)
      const pedidosUrgentes = await pedidosServiceOptimizado.obtenerPedidosUrgentesEmpacar();
      // Ordenar por fecha_entrega_programada ascendente
      pedidosUrgentes.sort((a, b) => {
        const fechaA = new Date(a.fecha_entrega_programada || '').getTime();
        const fechaB = new Date(b.fecha_entrega_programada || '').getTime();
        return fechaA - fechaB;
      });
      setPedidos(pedidosUrgentes);
      
      // Calcular rango de fechas
      const hoy = new Date();
      const ultimoEnvio = new Date();
      const diaHoy = hoy.getDay();
      
      if (diaHoy === 3 || diaHoy === 6) {
        ultimoEnvio.setDate(hoy.getDate());
      } else {
        let diasAtras = 1;
        while (diasAtras <= 6) {
          const fecha = new Date(hoy);
          fecha.setDate(hoy.getDate() - diasAtras);
          if (fecha.getDay() === 3 || fecha.getDay() === 6) {
            ultimoEnvio.setTime(fecha.getTime());
            break;
          }
          diasAtras++;
        }
      }
      
      const fechaLimite = new Date(ultimoEnvio);
      fechaLimite.setDate(ultimoEnvio.getDate() + 7);
      setProximoEnvio(fechaLimite);
      
      setRangoFechas({
        inicio: hoy.toLocaleDateString('es-ES'),
        fin: fechaLimite.toLocaleDateString('es-ES')
      });
      
      console.log(`📱 [UrgentesEmpacar] Cargados ${pedidosUrgentes.length} pedidos urgentes`);
      
    } catch (error) {
      console.error('Error cargando pedidos urgentes:', error);
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  };

  // Obtener pedidos ordenados (encontrados al final)
  const pedidosOrdenados = React.useMemo(() => {
    return [
      ...pedidos.filter(p => !pedidosEncontrados.has(p.id)),
      ...pedidos.filter(p => pedidosEncontrados.has(p.id)),
    ];
  }, [pedidos, pedidosEncontrados]);

  const formatearFecha = (fecha: string | Date | undefined): string => {
    if (!fecha) return 'Sin fecha';
    
    // Si es un STRING tipo YYYY-MM-DD, no convertir a Date (evita problemas de zona horaria)
    if (typeof fecha === 'string') {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return `${diasSemana[dateObj.getDay()]} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      }
    }
    
    // Si es Date o ISO string, convertir normalmente
    const date = new Date(fecha);
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${diasSemana[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
  };

  const verFotosProductos = (pedido: PedidoCompleto) => {
    const fotos: string[] = [];
    pedido.productos_datos?.forEach((producto: any) => {
      // Preferir url_imagen primero, si no existe usar imagen_url
      const foto = producto.url_imagen || producto.imagen_url;
      if (foto) {
        // Si es una URL relativa, convertir a absoluta
        const fotoUrl = foto.startsWith('http') ? foto : `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto${foto}`;
        if (!fotos.includes(fotoUrl)) {
          fotos.push(fotoUrl);
        }
      }
    });
    
    if (fotos.length > 0) {
      setCurrentImages(fotos);
      setImageTitle('📸 Productos');
      setImageViewerVisible(true);
    } else {
      // Mensaje más informativo
      const mensaje = pedido.productos_datos && pedido.productos_datos.length > 0 
        ? 'Los productos de este pedido no tienen fotos disponibles'
        : `Este pedido tiene ${pedido.productos_id?.length || 0} producto(s) pero no se cargaron las fotos.\n\nCódigo: ${pedido.codigo_pedido}\nProductos ID: ${pedido.productos_codigos?.join(', ') || 'N/A'}`;
      showAlert('Sin fotos de productos', mensaje);
    }
  };

  const verFotoPaquete = (pedido: PedidoCompleto) => {
    if (pedido.foto_paquete) {
      setCurrentImages([pedido.foto_paquete]);
      setImageTitle('📦 Paquete');
      setImageViewerVisible(true);
    } else {
      showAlert('Sin foto', 'Este pedido no tiene foto de paquete');
    }
  };

  const getDiaEnvio = (): string => {
    const dia = proximoEnvio.getDay();
    return dia === 3 ? 'MIÉRCOLES' : 'SÁBADO';
  };

  const abrirNotasEmpaque = (pedido: PedidoCompleto) => {
    const nota = notasEmpaque[pedido.id] || '';
    const buttons = [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Guardar',
        style: 'default',
        onPress: () => {
          // En una app real, aquí guardarías en una BD o AsyncStorage
          showAlert('✅ Guardado', `Notas de empaque guardadas para ${pedido.codigo_pedido}`);
        },
      },
    ];
    
    showAlert(
      `Instrucciones de empaque - ${pedido.codigo_pedido}`,
      nota || 'Sin notas. Toca el botón para agregar instrucciones.',
      buttons
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
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
            backgroundColor: '#DC2626',
            height: headerHeight,
            overflow: 'hidden',
          }
        ]}
      >
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
          <TouchableOpacity
            onPress={async () => {
              const nuevaVista = !vistaCompacta;
              setVistaCompacta(nuevaVista);
              try {
                await AsyncStorage.setItem('vistaCompactaDefecto', nuevaVista.toString());
              } catch (error) {
                console.error('Error guardando vista compacta:', error);
              }
            }}
            style={{
              backgroundColor: vistaCompacta ? '#FCD34D' : 'rgba(255,255,255,0.3)',
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              marginRight: 12,
            }}
          >
            <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>
              {vistaCompacta ? '⊞ Normal' : '⊟ Compacta'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 48 }}>🚨</Text>
          </View>
          <Text style={styles.headerTitle}>Urgentes de Empacar</Text>
          <Text style={styles.headerSubtitle}>
            Próximo envío: {getDiaEnvio()}
          </Text>
          <Text style={[styles.headerSubtitle, { fontSize: scale(12) }]}>
            {rangoFechas.inicio} - {rangoFechas.fin}
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Estadísticas */}
        <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#DC2626' }]}>{pedidos.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Pedidos Urgentes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#EAB308' }]}>{pedidos.filter(p => p.estado === 'pendiente').length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Pendientes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{pedidos.filter(p => p.estado === 'empacada').length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Empacados</Text>
          </View>
        </View>

        {pedidos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 64 }}>✅</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              ¡No hay pedidos urgentes por empacar!
            </Text>
          </View>
        ) : vistaCompacta ? (
          // VISTA COMPACTA
          <View style={{ padding: 12 }}>
            {pedidosOrdenados.map((pedido) => {
              const esEncontrado = pedidosEncontrados.has(pedido.id);
              return (
              <View
                key={pedido.id}
                style={[
                  {
                    backgroundColor: esEncontrado ? '#D3D3D3' : theme.colors.surface,
                    borderRadius: 12,
                    marginBottom: 8,
                    padding: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: esEncontrado ? '#999' : (pedido.estado === 'pendiente' ? '#EAB308' : '#3B82F6'),
                    borderWidth: 1,
                    borderColor: esEncontrado ? '#999' : theme.colors.border,
                    opacity: esEncontrado ? 0.7 : 1,
                  }
                ]}
              >
                {/* Fila 1: Badge, Código, Cliente, Botón Encontrado */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {/* Badge estado */}
                  <View style={{
                    backgroundColor: esEncontrado ? '#999' : (pedido.estado === 'pendiente' ? '#EAB308' : '#3B82F6'),
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    minWidth: 40,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
                      {esEncontrado ? '✓' : (pedido.estado === 'pendiente' ? '🟡' : '📦')}
                    </Text>
                  </View>

                  {/* Código + Cliente */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: esEncontrado ? '#666' : theme.colors.text, fontWeight: '800', fontSize: 13, textDecorationLine: esEncontrado ? 'line-through' : 'none' }}>
                      {pedido.codigo_pedido}
                    </Text>
                    <Text style={{ color: esEncontrado ? '#999' : theme.colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                      {pedido.cliente_nombre || pedido.nombre_tienda || 'Cliente'}
                    </Text>
                  </View>

                  {/* Botón Marcar Encontrado */}
                  <TouchableOpacity
                    onPress={() => marcarComoEncontrado(pedido.id)}
                    style={{
                      backgroundColor: esEncontrado ? '#4CAF50' : theme.colors.primary,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 2,
                      borderColor: esEncontrado ? '#2E7D32' : theme.colors.primary,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                      {esEncontrado ? '✓' : '🔍'}
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {esEncontrado ? 'Encontrado' : 'Marca'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Botón Ver Fotos de Productos - Grande y prominente */}
                {!esEncontrado && (
                  <TouchableOpacity 
                    onPress={() => verFotosProductos(pedido)}
                    style={{ marginBottom: 12, marginTop: 8 }}
                  >
                    <View style={{
                      backgroundColor: '#536DFE',
                      borderRadius: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                    }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                        📸 VER PRODUCTOS {pedido.productos_datos && pedido.productos_datos.length > 0 ? `(${pedido.productos_datos.length})` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Carrusel de miniaturas de productos */}
                {!esEncontrado && pedido.productos_datos && pedido.productos_datos.length > 0 && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 0 }}
                  >
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {pedido.productos_datos.map((producto, idx) => {
                        const foto = producto.url_imagen || producto.imagen_url;
                        const fotoUrl = foto && foto.startsWith('http') 
                          ? foto 
                          : (foto ? `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto${foto}` : null);
                        
                        return fotoUrl ? (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => verFotosProductos(pedido)}
                            style={{
                              borderRadius: 8,
                              overflow: 'hidden',
                              borderWidth: 2,
                              borderColor: theme.colors.primary,
                            }}
                          >
                            <Image
                              source={{ uri: fotoUrl }}
                              style={{
                                width: 70,
                                height: 70,
                                backgroundColor: theme.colors.background,
                              }}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ) : null;
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>
            );
            })}
          </View>
        ) : (
          // VISTA NORMAL
          <View style={{ padding: 16 }}>
            {pedidosOrdenados.map((pedido) => (
              <View
                key={pedido.id}
                style={[
                  styles.card,
                  { 
                    backgroundColor: theme.colors.surface,
                    borderLeftColor: pedido.estado === 'pendiente' ? '#EAB308' : '#3B82F6',
                    borderColor: theme.colors.border
                  }
                ]}
              >
                {/* Badge de estado */}
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: pedido.estado === 'pendiente' ? '#EAB308' : '#3B82F6' }
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {pedido.estado === 'pendiente' ? '🟡 PENDIENTE' : '📦 EMPACADA'}
                  </Text>
                </View>

                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  📦 {pedido.codigo_pedido}
                </Text>
                
                <Text style={[styles.cardDetail, { color: theme.colors.textSecondary }]}>
                  👤 Cliente: {pedido.cliente_nombre || 'N/A'}
                </Text>
                
                <Text style={[styles.cardDetail, { color: theme.colors.textSecondary }]}>
                  🏪 Tienda: {pedido.nombre_tienda || 'N/A'}
                </Text>
                
                {pedido.nombre_perfil && (
                  <Text style={[styles.cardDetail, { color: theme.colors.textSecondary }]}>
                    📋 Perfil: {pedido.nombre_perfil}
                  </Text>
                )}
                
                <Text style={[styles.cardDetail, { color: theme.colors.textSecondary }]}>
                  🚚 Encomendista: {pedido.encomendista_nombre || 'Personalizado'}
                </Text>
                
                <View style={[styles.fechaBox, { backgroundColor: '#DC2626' + '20', borderColor: '#DC2626' }]}>
                  <Text style={[styles.fechaLabel, { color: '#DC2626' }]}>
                    📅 Fecha de entrega:
                  </Text>
                  <Text style={[styles.fechaValue, { color: '#DC2626' }]}>
                    {formatearFecha(pedido.fecha_entrega_programada)}
                  </Text>
                </View>

                {pedido.total && (
                  <View style={[styles.totalBox, { backgroundColor: theme.colors.success + '15', borderColor: theme.colors.success }]}>
                    <Text style={[styles.totalText, { color: theme.colors.success }]}>
                      💰 ${pedido.total.toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Botones de fotos */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  {/* Botón Ver Productos */}
                  {pedido.productos_datos && pedido.productos_datos.length > 0 && (
                    <TouchableOpacity
                      style={[styles.photoButton, { backgroundColor: '#3B82F6', flex: 1 }]}
                      onPress={() => verFotosProductos(pedido)}
                    >
                      <Text style={styles.photoButtonText}>
                        📸 Ver Productos ({pedido.productos_datos.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Botón Ver Foto Paquete */}
                  {pedido.foto_paquete && (
                    <TouchableOpacity
                      style={[styles.photoButton, { backgroundColor: '#7C3AED', flex: 1 }]}
                      onPress={() => verFotoPaquete(pedido)}
                    >
                      <Text style={styles.photoButtonText}>
                        📦 Ver Paquete
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Botón Instrucciones de Empaque */}
                <TouchableOpacity
                  style={{
                    marginTop: 10,
                    backgroundColor: '#F59E0B' + '20',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#F59E0B',
                  }}
                  onPress={() => abrirNotasEmpaque(pedido)}
                >
                  <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
                    📝 Cómo empacarlo (mantén presionado en vista compacta)
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </Animated.ScrollView>
      
      {/* Visor de Imágenes con Zoom */}
      <ImageViewer
        visible={imageViewerVisible}
        images={currentImages}
        title={imageTitle}
        onClose={() => setImageViewerVisible(false)}
      />
      
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

const createStyles = (scale: (size: number) => number, theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  fechaBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  fechaLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  fechaValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  totalBox: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  photoButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
