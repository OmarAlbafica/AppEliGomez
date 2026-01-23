import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';
import { ImageViewer } from '../components/ImageViewer';
import { CustomAlert } from '../components/CustomAlert';

interface EncomendaAgrupada {
  encomendista_nombre: string;
  pedidos: PedidoCompleto[];
  conteo: number;
  total: number;
}

interface EnviosPorEncomendaScreenProps {
  onNavigate?: (screen: string) => void;
}

export const EnviosPorEncomendaScreen: React.FC<EnviosPorEncomendaScreenProps> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  const [encomiendas, setEncomiendas] = useState<EncomendaAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaEnvioHoy, setDiaEnvioHoy] = useState('');
  const [rangoFechas, setRangoFechas] = useState({ inicio: '', fin: '' });
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imageTitle, setImageTitle] = useState('');
  
  // Vista compacta - Se carga desde AsyncStorage
  const [vistaCompacta, setVistaCompacta] = useState(true);

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
    procesarEnvios();
    cargarVistaCompactaPreferencia();
  }, []);

  const calcularProximoDiaEnvio = (): Date => {
    const hoy = new Date();
    const diaHoy = hoy.getDay();
    
    let diasHastaMiercoles = (3 - diaHoy + 7) % 7;
    let diasHastaSabado = (6 - diaHoy + 7) % 7;
    
    if (diasHastaMiercoles === 0) diasHastaMiercoles = 7;
    if (diasHastaSabado === 0) diasHastaSabado = 7;
    
    let diasHasta = Math.min(diasHastaMiercoles, diasHastaSabado);
    
    const proximoEnvio = new Date(hoy);
    proximoEnvio.setDate(hoy.getDate() + diasHasta);
    
    return proximoEnvio;
  };

  const procesarEnvios = async () => {
    try {
      setLoading(true);
      
      // ✅ Usar servicio centralizado (sin hardcodear URL)
      const { pedidos, dia_envio, fecha_inicio, fecha_fin } = await pedidosServiceOptimizado.obtenerPedidosParaEnvios();
      
      // Armar label del día
      setDiaEnvioHoy(`📦 Envíos ${dia_envio}`);
      
      // Establecer rango desde el servicio
      setRangoFechas({
        inicio: fecha_inicio,
        fin: fecha_fin
      });
      
      // Agrupar por encomendista
      if (pedidos && pedidos.length > 0) {
        // Ordenar por fecha_entrega_programada ascendente
        pedidos.sort((a, b) => {
          const fechaA = new Date(a.fecha_entrega_programada || '').getTime();
          const fechaB = new Date(b.fecha_entrega_programada || '').getTime();
          return fechaA - fechaB;
        });
        const grupos = new Map<string, any[]>();
        pedidos.forEach(p => {
          const encomienda = p.encomendista_nombre || 'Sin Encomienda';
          if (!grupos.has(encomienda)) {
            grupos.set(encomienda, []);
          }
          grupos.get(encomienda)!.push(p);
        });
        const resultado = Array.from(grupos.entries()).map(([nombre, pedidosGrupo]) => ({
          encomendista_nombre: nombre,
          pedidos: pedidosGrupo,
          conteo: pedidosGrupo.length,
          total: pedidosGrupo.reduce((sum: any, p: any) => sum + (p.total || 0), 0)
        }));
        resultado.sort((a, b) => a.encomendista_nombre.localeCompare(b.encomendista_nombre));
        setEncomiendas(resultado);
        setTotalPedidos(pedidos.length);
      } else {
        setEncomiendas([]);
        setTotalPedidos(0);
      }
      
      console.log(`📱 [Envios] Cargados ${pedidos?.length || 0} pedidos para envíos`);
      
    } catch (error) {
      console.error('Error cargando envíos:', error);
      setEncomiendas([]);
      setTotalPedidos(0);
    } finally {
      setLoading(false);
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

  const toggleExpand = (nombre: string) => {
    if (expandedIds.includes(nombre)) {
      setExpandedIds(expandedIds.filter(id => id !== nombre));
    } else {
      setExpandedIds([...expandedIds, nombre]);
    }
  };

  const verFotoPaqueteDelPedido = (pedido: PedidoCompleto) => {
    if (pedido.foto_paquete) {
      setCurrentImages([pedido.foto_paquete]);
      setImageTitle('📦 Paquete');
      setImageViewerVisible(true);
    } else {
      showAlert('Sin foto', 'Este pedido no tiene foto de paquete');
    }
  };

  const verFotosProductosDelpedido = (pedido: PedidoCompleto) => {
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
      showAlert('Sin fotos', 'Este pedido no tiene fotos de productos');
    }
  };

  const marcarComoEnviada = (encomienda: EncomendaAgrupada) => {
    showAlert(
      '📮 Marcar como Enviado',
      `¿Marcar ${encomienda.conteo} pedido(s) de ${encomienda.encomendista_nombre} como enviado?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, marcar',
          onPress: async () => {
            try {
              for (const pedido of encomienda.pedidos) {
                await pedidosServiceOptimizado.cambiarEstadoPedido(
                  pedido.id,
                  'enviado',
                  undefined,
                  `Enviado con ${encomienda.encomendista_nombre}`
                );
              }
              showAlert('Éxito', `✅ ${encomienda.conteo} pedido(s) marcados como enviados`);
              // Recargar
              await procesarEnvios();
            } catch (error) {
              showAlert('Error', 'No se pudieron marcar los pedidos');
            }
          }
        }
      ]
    );
  };

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
            backgroundColor: '#7C3AED',
            height: headerHeight,
            overflow: 'hidden',
          }
        ]}
      >
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 48 }}>📦</Text>
          </View>
          <Text style={styles.headerTitle}>Envíos por Encomienda</Text>
          <Text style={styles.headerSubtitle}>{diaEnvioHoy}</Text>
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
        {/* Stats */}
        <View style={[styles.statsBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#7C3AED' }]}>{totalPedidos}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Total Pedidos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{encomiendas.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Encomiendas</Text>
          </View>
        </View>

        {encomiendas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 64 }}>📭</Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No hay pedidos para empacar en este rango de fechas
            </Text>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            {encomiendas.map((encomienda) => {
              const isExpanded = expandedIds.includes(encomienda.encomendista_nombre);
              
              return (
                <View
                  key={encomienda.encomendista_nombre}
                  style={[styles.encomiendaCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                >
                  {/* Header */}
                  <TouchableOpacity
                    style={styles.encomiendaHeader}
                    onPress={() => toggleExpand(encomienda.encomendista_nombre)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.encomiendaTitle, { color: theme.colors.text }]}>
                        🚚 {encomienda.encomendista_nombre}
                      </Text>
                      <Text style={[styles.encomiendaSubtitle, { color: theme.colors.textSecondary }]}>
                        {encomienda.conteo} {encomienda.conteo === 1 ? 'pedido' : 'pedidos'} • ${encomienda.total.toLocaleString()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 24, color: theme.colors.textSecondary }}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                  </TouchableOpacity>

                  {/* Lista de pedidos */}
                  {isExpanded && (
                    <View style={styles.pedidosList}>
                      {encomienda.pedidos.map((pedido, index) => (
                        <View
                          key={pedido.id}
                          style={[
                            styles.pedidoItem,
                            { 
                              backgroundColor: theme.colors.background,
                              borderLeftColor: pedido.estado === 'pendiente' ? '#EAB308' : '#3B82F6'
                            }
                          ]}
                        >
                          <View style={[styles.pedidoBadge, { backgroundColor: pedido.estado === 'pendiente' ? '#EAB308' : '#3B82F6' }]}>
                            <Text style={styles.pedidoBadgeText}>
                              {pedido.estado === 'pendiente' ? 'PENDIENTE' : 'EMPACADA'}
                            </Text>
                          </View>

                          <Text style={[styles.pedidoCodigo, { color: theme.colors.text }]}>
                            📦 {pedido.codigo_pedido}
                          </Text>
                          
                          <Text style={[styles.pedidoDetail, { color: theme.colors.textSecondary }]}>
                            👤 {pedido.cliente_nombre || 'Cliente'}
                          </Text>

                          <Text style={[styles.pedidoDetail, { color: theme.colors.textSecondary }]}>
                            📍 {pedido.destino_id || 'Destino'}
                          </Text>
                          
                          <Text style={[styles.pedidoDetail, { color: theme.colors.textSecondary }]}>
                            📅 {formatearFecha(pedido.fecha_entrega_programada)}
                          </Text>

                          {pedido.total && (
                            <Text style={[styles.pedidoTotal, { color: '#10B981' }]}>
                              💰 ${pedido.total.toLocaleString()}
                            </Text>
                          )}

                          {/* Foto del paquete - Miniatura */}
                          {pedido.foto_paquete && (
                            <TouchableOpacity
                              style={styles.fotoPaqueteContainer}
                              onPress={() => verFotoPaqueteDelPedido(pedido)}
                              activeOpacity={0.7}
                            >
                              <Image
                                source={{ uri: pedido.foto_paquete }}
                                style={styles.fotoPaquete}
                              />
                            </TouchableOpacity>
                          )}

                          {/* Botones de fotos */}
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            {/* Botón Ver Productos */}
                            {pedido.productos_datos && pedido.productos_datos.length > 0 && (
                              <TouchableOpacity
                                style={[styles.photosButton, { backgroundColor: '#3B82F6', flex: 1 }]}
                                onPress={() => verFotosProductosDelpedido(pedido)}
                              >
                                <Text style={styles.photosButtonText}>
                                  📸 Productos ({pedido.productos_datos.length})
                                </Text>
                              </TouchableOpacity>
                            )}
                            
                            {/* Botón ver foto paquete */}
                            {pedido.foto_paquete && (
                              <TouchableOpacity
                                style={[styles.photosButton, { backgroundColor: '#10B981', flex: 1 }]}
                                onPress={() => verFotoPaqueteDelPedido(pedido)}
                              >
                                <Text style={styles.photosButtonText}>📦 Paquete</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))}

                      {/* Botón Marcar como Enviada */}
                      <TouchableOpacity
                        style={[styles.enviarButton, { backgroundColor: '#7C3AED' }]}
                        onPress={() => marcarComoEnviada(encomienda)}
                      >
                        <Text style={styles.enviarButtonText}>
                          ✈️ Marcar como Enviada ({encomienda.conteo})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>

      {/* Visor de imágenes */}
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
  statsBox: {
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
  statItem: {
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
  encomiendaCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  encomiendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  encomiendaTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  encomiendaSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  pedidosList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pedidoItem: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  pedidoBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  pedidoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  pedidoCodigo: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  pedidoDetail: {
    fontSize: 12,
    marginTop: 4,
  },
  pedidoTotal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  enviarButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  enviarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  photosButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photosButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  fotoPaqueteContainer: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    height: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fotoPaquete: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
