import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Clipboard,
  Animated,
} from 'react-native';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';
import { PackageIcon, TruckIcon, HistoryIcon } from '../components/icons';

interface Props {
  onNavigate?: (screen: string) => void;
}

interface PedidoAgrupado {
  hora_inicio: string;
  hora_fin: string;
  pedidos: PedidoCompleto[];
  isCurrentTime: boolean;
  isPastTime: boolean;
}

export const RetiredTodayScreen: React.FC<Props> = ({ onNavigate }) => {
  const { theme } = useTheme();
  const scale = (size: number) => theme.scale(size);
  const styles = createStyles(scale, theme);

  const [pedidos, setPedidos] = useState<PedidoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidosAgrupados, setPedidosAgrupados] = useState<PedidoAgrupado[]>([]);
  const [horaActual, setHoraActual] = useState<string>('');
  const [expandedHour, setExpandedHour] = useState<string | null>(null);
  const [modalMensaje, setModalMensaje] = useState(false);
  const [mensajeCopiar, setMensajeCopiar] = useState('');
  const [pedidosGuardando, setPedidosGuardando] = useState<Set<string>>(new Set());

  // Animated header - efecto snap sin interpolación gradual
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
            Animated.timing(headerHeight, {
              toValue: 100,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(headerOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: false,
            }),
          ]).start();
        } else {
          Animated.parallel([
            Animated.timing(headerHeight, {
              toValue: 280,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(headerOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
    }
  );

  // Convertir hora de 24h (HH:MM) a 12h (hh:mm AM/PM)
  const convertirHora12 = (hora24: string): string => {
    const [horas, minutos] = hora24.split(':').map(Number);
    const ampm = horas >= 12 ? 'PM' : 'AM';
    let horas12 = horas % 12;
    horas12 = horas12 ? horas12 : 12;
    return `${String(horas12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${ampm}`;
  };

  // Formatear fecha completa en español (ej: Viernes 23 de enero 2026)
  const formatearFechaCompleta = (fecha: string | Date | undefined): string => {
    if (!fecha) return 'No programada';
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    // Si es un string tipo YYYY-MM-DD, parsear sin conversión de zona horaria
    let date: Date;
    if (typeof fecha === 'string') {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(fecha);
      }
    } else {
      date = new Date(fecha);
    }
    
    const diaSemana = diasSemana[date.getDay()];
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const año = date.getFullYear();
    
    return `${diaSemana} ${dia} de ${mes} ${año}`;
  };

  // Obtener hora actual en formato HH:MM (formato 24h para comparaciones internas)
  const obtenerHoraActual = (): string => {
    const ahora = new Date();
    return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  };

  // Comparar si una hora está en rango
  const estaEnHorario = (horaInicio: string, horaFin: string, horaActual: string): boolean => {
    const [hI, mI] = horaInicio.split(':').map(Number);
    const [hF, mF] = horaFin.split(':').map(Number);
    const [h, m] = horaActual.split(':').map(Number);

    const minutosInicio = hI * 60 + mI;
    const minutosFin = hF * 60 + mF;
    const minutosActuales = h * 60 + m;

    return minutosActuales >= minutosInicio && minutosActuales <= minutosFin;
  };

  // Verificar si el horario ya pasó
  const yaProso = (horaFin: string, horaActual: string): boolean => {
    const [hF, mF] = horaFin.split(':').map(Number);
    const [h, m] = horaActual.split(':').map(Number);

    const minutosFin = hF * 60 + mF;
    const minutosActuales = h * 60 + m;

    return minutosActuales > minutosFin;
  };

  // Generar mensaje personalizado
  const generarMensaje = (horaInicio: string, horaFin: string): string => {
    return `Hola buen día bella ⛅ hoy le entregan su paquete 📦 me confirma cuando retire nena de ante mano gracias, Cualquier duda o consulta estamos ala orden
Recuerde que el horario para retirar su paquete es de ${convertirHora12(horaInicio)} a ${convertirHora12(horaFin)}`;
  };

  // Copiar mensaje al portapapeles
  const copiarAlPortapapeles = (horaInicio: string, horaFin: string) => {
    const mensaje = generarMensaje(horaInicio, horaFin);
    Clipboard.setString(mensaje);
    setMensajeCopiar(mensaje);
    setModalMensaje(true);
  };

  // Marcar pedido como retirado
  const handleMarcarRetirado = async (pedido: PedidoCompleto) => {
    if (pedido.estado === 'retirado') {
      Alert.alert('ℹ️', 'Este pedido ya está marcado como retirado');
      return;
    }

    try {
      setPedidosGuardando((prev) => new Set(prev).add(pedido.id!));
      console.log(`[📦 RetiredToday] Marcando como retirado: ${pedido.codigo_pedido}`);

      const exito = await pedidosServiceOptimizado.cambiarEstadoPedido(
        pedido.id!,
        'retirado',
        undefined, // sin foto
        undefined  // sin notas
      );

      if (exito) {
        Alert.alert('✅ Éxito', `${pedido.codigo_pedido} marcado como retirado`);
        // Recargar pedidos para actualizar la vista
        await cargarPedidos();
      } else {
        Alert.alert('❌', 'No se pudo marcar como retirado');
      }
    } catch (error) {
      console.error('[❌ RetiredToday] Error:', error);
      Alert.alert('❌', 'Error al cambiar el estado');
    } finally {
      setPedidosGuardando((prev) => {
        const newSet = new Set(prev);
        newSet.delete(pedido.id!);
        return newSet;
      });
    }
  };

  // Cargar pedidos de hoy con estado "enviado"
  useEffect(() => {
    cargarPedidos();
    const interval = setInterval(() => {
      setHoraActual(obtenerHoraActual());
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, []);

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      const horaActualNow = obtenerHoraActual();
      setHoraActual(horaActualNow);

      // Obtener todos los pedidos con estado "enviado"
      const pedidosEnviados = await pedidosServiceOptimizado.obtenerPedidosPorEstado('enviado', 1000);

      // Filtrar solo los de hoy usando fecha_entrega_programada
      // Obtener fecha de hoy en formato YYYY-MM-DD (sin timezone issues)
      const hoy = new Date();
      const fechaHoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

      const pedidosHoy = pedidosEnviados.filter((pedido) => {
        if (!pedido.fecha_entrega_programada) return false;
        // Comparar directamente strings de fecha (YYYY-MM-DD) para evitar issues de timezone
        const fechaProgramadaStr = pedido.fecha_entrega_programada.substring(0, 10);
        return fechaProgramadaStr === fechaHoyStr;
      });

      console.log(`📅 Fecha de hoy: ${fechaHoyStr}`);
      console.log(`📦 Pedidos enviados para hoy: ${pedidosHoy.length}`);
      console.log(`📋 Pedidos encontrados:`, pedidosHoy.map(p => ({ codigo: p.codigo_pedido, fecha: p.fecha_entrega_programada })));

      // Agrupar por horario
      const agrupados: { [key: string]: PedidoCompleto[] } = {};

      pedidosHoy.forEach((pedido) => {
        const key = `${pedido.hora_inicio}-${pedido.hora_fin}`;
        if (!agrupados[key]) {
          agrupados[key] = [];
        }
        agrupados[key].push(pedido);
      });

      // Convertir a array y ordenar por hora
      const resultado: PedidoAgrupado[] = Object.entries(agrupados)
        .map(([key, pedidosList]) => {
          const [horaInicio, horaFin] = key.split('-');
          const enHorario = estaEnHorario(horaInicio, horaFin, horaActualNow);
          const pasado = yaProso(horaFin, horaActualNow);

          return {
            hora_inicio: horaInicio,
            hora_fin: horaFin,
            pedidos: pedidosList.sort((a, b) =>
              (a.cliente_datos?.nombre || '').localeCompare(b.cliente_datos?.nombre || '')
            ),
            isCurrentTime: enHorario,
            isPastTime: pasado,
          };
        })
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

      setPedidos(pedidosHoy);
      setPedidosAgrupados(resultado);

      // Si hay horarios actuales, expandir automáticamente
      const hoarioActual = resultado.find((h) => h.isCurrentTime);
      if (hoarioActual) {
        setExpandedHour(`${hoarioActual.hora_inicio}-${hoarioActual.hora_fin}`);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  };

  // Indicador de estado del horario
  const IndicadorHorario = ({ grupo }: { grupo: PedidoAgrupado }) => {
    if (grupo.isCurrentTime) {
      return (
        <View style={[styles.indicador, styles.indicadorActivo]}>
          <Text style={[styles.indicadorTexto, { color: theme.colors.success }]}>🟢 AHORA</Text>
        </View>
      );
    }
    if (grupo.isPastTime) {
      return (
        <View style={[styles.indicador, styles.indicadorPasado]}>
          <Text style={[styles.indicadorTexto, { color: theme.colors.error }]}>⏰ PASÓ</Text>
        </View>
      );
    }
    return (
      <View style={[styles.indicador, styles.indicadorProximo]}>
        <Text style={[styles.indicadorTexto, { color: theme.colors.warning || '#F59E0B' }]}>⏳ PRÓXIMO</Text>
      </View>
    );
  };

  // Tarjeta de pedido
  const TarjetaPedido = ({ pedido }: { pedido: PedidoCompleto }) => (
    <TouchableOpacity
      style={[
        styles.pedidoCard,
        { backgroundColor: theme.colors.surface, borderLeftColor: theme.colors.primary },
      ]}
      activeOpacity={0.7}
    >
      {/* Encabezado con código y cliente */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.codigoPedido, { color: theme.colors.text }]}>
            📦 Código: {pedido.codigo_pedido}
          </Text>
          <Text style={[styles.clienteName, { color: theme.colors.textSecondary }]}>
            👤 Cliente: {pedido.cliente_datos?.nombre || 'N/A'}
          </Text>
        </View>
        <Text style={[styles.monto, { color: theme.colors.success }]}>
          ${pedido.total.toLocaleString()}
        </Text>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      {/* Información */}
      <View style={styles.cardContent}>
        {/* Fecha de Entrega */}
        {pedido.fecha_entrega_programada && (
          <View style={[styles.infoRow, { backgroundColor: theme.colors.primaryLight + '30', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 6, marginBottom: 8 }]}>
            <Text style={[styles.infoLabel, { color: theme.colors.primary, fontWeight: '700' }]}>📅 Fecha:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.primary, fontWeight: '700', fontSize: scale(11) }]}>
              {formatearFechaCompleta(pedido.fecha_entrega_programada)}
            </Text>
          </View>
        )}

        {/* Tienda */}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>🏪 Tienda:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>{pedido.nombre_tienda}</Text>
        </View>

        {/* Perfil de Reserva */}
        {pedido.nombre_perfil && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>📋 Perfil:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
              {pedido.nombre_perfil}
            </Text>
          </View>
        )}

        {/* Encomendista */}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>🚚 Encomendista:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>
            {pedido.encomendista_datos?.nombre || 'N/A'}
          </Text>
        </View>

        {/* Destino */}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>📍 Destino:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]} numberOfLines={2}>
            {pedido.modo === 'personalizado' && pedido.direccion_personalizada
              ? pedido.direccion_personalizada
              : (pedido.destino_id || pedido.destino_datos?.nombre || 'N/A')}
          </Text>
        </View>

        {/* Teléfono */}
        {pedido.telefono_cliente && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>📱 Tel:</Text>
            <Text style={[styles.infoValue, { color: theme.colors.primary }]}>
              {pedido.telefono_cliente}
            </Text>
          </View>
        )}

        {/* Cantidad y productos */}
        <View style={[styles.infoRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>📦 Prendas:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text, fontWeight: 'bold' }]}>
            {pedido.cantidad_prendas}
          </Text>
        </View>

        {/* Botón para marcar como retirado */}
        <TouchableOpacity
          style={[
            styles.botonRetirado,
            {
              backgroundColor: pedido.estado === 'retirado' ? theme.colors.success + '30' : theme.colors.warning,
              opacity: pedidosGuardando.has(pedido.id!) ? 0.6 : 1,
            },
          ]}
          onPress={() => handleMarcarRetirado(pedido)}
          disabled={pedidosGuardando.has(pedido.id!)}
          activeOpacity={0.7}
        >
          {pedidosGuardando.has(pedido.id!) ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.botonRetiradoTexto}>
              {pedido.estado === 'retirado' ? '✅ Retirado' : '📦 Marcar como Retirado'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Encabezado de horario
  const EncabezadoHorario = ({ grupo, isExpanded }: { grupo: PedidoAgrupado; isExpanded: boolean }) => (
    <View>
      <TouchableOpacity
        style={[
          styles.horarioHeader,
          {
            backgroundColor: grupo.isCurrentTime ? theme.colors.primary + '20' : theme.colors.surface,
            borderLeftColor: grupo.isCurrentTime ? theme.colors.primary : theme.colors.border,
          },
        ]}
        onPress={() =>
          setExpandedHour(
            isExpanded ? null : `${grupo.hora_inicio}-${grupo.hora_fin}`
          )
        }
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.horarioText, { color: theme.colors.text }]}>
            🕐 {convertirHora12(grupo.hora_inicio)} - {convertirHora12(grupo.hora_fin)}
          </Text>
          <Text style={[styles.cantidadPedidos, { color: theme.colors.textSecondary }]}>
            {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
          </Text>
        </View>
        <IndicadorHorario grupo={grupo} />
        <Text style={[styles.expandIcon, { color: theme.colors.primary }]}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {/* Botón para copiar mensaje */}
      {isExpanded && (
        <TouchableOpacity
          style={[
            styles.botonCopiarMensaje,
            { backgroundColor: theme.colors.primary, borderColor: theme.colors.text },
          ]}
          onPress={() => copiarAlPortapapeles(grupo.hora_inicio, grupo.hora_fin)}
        >
          <Text style={[styles.botonCopiarTexto, { color: '#fff' }]}>
            📋 Copiar mensaje para clientes
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text, fontSize: scale(14) }]}>
          Cargando pedidos...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header moderno con gradiente */}
      <Animated.View style={[styles.modernHeader, { backgroundColor: theme.colors.primary, height: headerHeight, overflow: 'hidden' }]}>
        <View style={styles.headerTop}>
          <BackButton onPress={() => onNavigate?.('home')} />
        </View>
        
        <Animated.View style={[styles.headerContent, { opacity: headerOpacity }]}>
          <View style={styles.iconCircle}>
            <PackageIcon size={scale(48)} color="#fff" />
          </View>
          <Text style={styles.modernHeaderTitle}>Retirados Hoy</Text>
          <Text style={styles.headerSubtitle}>
            {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'} • {convertirHora12(horaActual)}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Contenido */}
      {pedidosAgrupados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <PackageIcon size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.colors.text, fontSize: scale(18) }]}>
            No hay pedidos retirados hoy
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary, fontSize: scale(14) }]}>
            Vuelve luego para ver los retiros del día
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={styles.contenido}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Resumen */}
          <View style={[styles.resumenBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.resumenLabel, { color: theme.colors.textSecondary }]}>📊 Resumen</Text>
            <View style={{ marginTop: 8 }}>
              <Text style={[styles.resumenValue, { color: theme.colors.text }]}>
                Total de pedidos: <Text style={{ fontWeight: 'bold' }}>{pedidos.length}</Text>
              </Text>
              <Text style={[styles.resumenValue, { color: theme.colors.text, marginTop: 4 }]}>
                Horarios: <Text style={{ fontWeight: 'bold' }}>{pedidosAgrupados.length}</Text>
              </Text>
            </View>
          </View>

          {/* Horarios agrupados */}
          {pedidosAgrupados.map((grupo) => {
            const isExpanded = expandedHour === `${grupo.hora_inicio}-${grupo.hora_fin}`;
            return (
              <View key={`${grupo.hora_inicio}-${grupo.hora_fin}`} style={styles.horarioGroup}>
                <EncabezadoHorario grupo={grupo} isExpanded={isExpanded} />

                {/* Pedidos expandidos */}
                {isExpanded && (
                  <View style={styles.pedidosContainer}>
                    {grupo.pedidos.map((pedido) => (
                      <TarjetaPedido key={pedido.id} pedido={pedido} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {/* Espacio al final */}
          <View style={{ height: 20 }} />
        </Animated.ScrollView>
      )}

      {/* Modal de mensaje copiado */}
      <Modal
        visible={modalMensaje}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalMensaje(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>✅ Mensaje Copiado</Text>

            <ScrollView style={styles.mensajeContainer}>
              <Text style={[styles.mensajeTexto, { color: theme.colors.text }]}>
                {mensajeCopiar}
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setModalMensaje(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (scale: (size: number) => number, theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    modernHeader: {
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
    modernHeaderTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: -0.3,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.text,
    },
    header: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      paddingTop: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      backgroundColor: theme.colors.surface,
    },
    headerTitle: {
      fontSize: scale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'center',
    },
    horaActualContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      backgroundColor: theme.colors.surface,
    },
    horaActualLabel: {
      fontSize: scale(12),
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    horaActualValor: {
      fontSize: scale(24),
      fontWeight: 'bold',
      color: theme.colors.primary,
      fontFamily: 'Courier New',
    },
    contenido: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    resumenBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    resumenLabel: {
      fontSize: scale(12),
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    resumenValue: {
      fontSize: scale(13),
      color: theme.colors.text,
      marginTop: 4,
    },
    horarioGroup: {
      marginBottom: 12,
    },
    horarioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderLeftWidth: 4,
      elevation: 2,
    },
    horarioText: {
      fontSize: scale(16),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    cantidadPedidos: {
      fontSize: scale(12),
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    expandIcon: {
      fontSize: scale(14),
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginLeft: 8,
    },
    indicador: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginHorizontal: 8,
    },
    indicadorActivo: {
      backgroundColor: '#10B98120',
      borderWidth: 1,
      borderColor: theme.colors.success,
    },
    indicadorPasado: {
      backgroundColor: '#EF444420',
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    indicadorProximo: {
      backgroundColor: '#F59E0B20',
      borderWidth: 1,
      borderColor: theme.colors.warning,
    },
    indicadorTexto: {
      fontSize: scale(11),
      fontWeight: '600',
    },
    pedidosContainer: {
      paddingTop: 8,
    },
    pedidoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      marginBottom: 8,
      elevation: 1,
      overflow: 'hidden',
      borderLeftWidth: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.background,
    },
    codigoPedido: {
      fontSize: scale(14),
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    clienteName: {
      fontSize: scale(12),
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    monto: {
      fontSize: scale(16),
      fontWeight: 'bold',
      color: theme.colors.success,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
    },
    cardContent: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: {
      fontSize: scale(12),
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    infoValue: {
      fontSize: scale(12),
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
      textAlign: 'right',
      marginLeft: 8,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 60,
    },
    emptyText: {
      fontSize: scale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: scale(14),
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    botonCopiarMensaje: {
      marginHorizontal: 12,
      marginVertical: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    botonCopiarTexto: {
      fontSize: scale(14),
      fontWeight: 'bold',
      color: '#fff',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
      width: '85%',
      maxHeight: '70%',
      borderRadius: 12,
      padding: 20,
      backgroundColor: theme.colors.surface,
    },
    modalTitle: {
      fontSize: scale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    mensajeContainer: {
      maxHeight: 300,
      marginBottom: 16,
    },
    mensajeTexto: {
      fontSize: scale(14),
      lineHeight: 22,
      color: theme.colors.text,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    modalButtonText: {
      fontSize: scale(14),
      fontWeight: 'bold',
      color: '#fff',
    },
    botonRetirado: {
      marginTop: scale(12),
      paddingVertical: scale(12),
      paddingHorizontal: scale(16),
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    botonRetiradoTexto: {
      fontSize: scale(14),
      fontWeight: '600',
      color: '#fff',
      marginLeft: scale(6),
    },
  });
