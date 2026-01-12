import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../context/ThemeContext';

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

  // Convertir hora de 24h (HH:MM) a 12h (hh:mm AM/PM)
  const convertirHora12 = (hora24: string): string => {
    const [horas, minutos] = hora24.split(':').map(Number);
    const ampm = horas >= 12 ? 'PM' : 'AM';
    let horas12 = horas % 12;
    horas12 = horas12 ? horas12 : 12;
    return `${String(horas12).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${ampm}`;
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
      const hoy = new Date();
      const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

      const pedidosHoy = pedidosEnviados.filter((pedido) => {
        if (!pedido.fecha_entrega_programada) return false;
        const fechaProgramada = new Date(pedido.fecha_entrega_programada);
        const fechaProgramadaFormato = new Date(fechaProgramada.getFullYear(), fechaProgramada.getMonth(), fechaProgramada.getDate());
        return fechaProgramadaFormato.getTime() === fechaHoy.getTime();
      });

      console.log(`📅 Fecha de hoy: ${fechaHoy.toLocaleDateString()}`);
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
          <Text style={styles.indicadorTexto}>🟢 AHORA</Text>
        </View>
      );
    }
    if (grupo.isPastTime) {
      return (
        <View style={[styles.indicador, styles.indicadorPasado]}>
          <Text style={styles.indicadorTexto}>⏰ PASÓ</Text>
        </View>
      );
    }
    return (
      <View style={[styles.indicador, styles.indicadorProximo]}>
        <Text style={styles.indicadorTexto}>⏳ PRÓXIMO</Text>
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
            📦 {pedido.codigo_pedido}
          </Text>
          <Text style={[styles.clienteName, { color: theme.colors.textSecondary }]}>
            👤 {pedido.cliente_datos?.nombre || 'Cliente'}
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
        {/* Tienda */}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>🏪 Tienda:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>{pedido.nombre_tienda}</Text>
        </View>

        {/* Destino */}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>📍 Destino:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>{pedido.destino_id}</Text>
        </View>

        {/* Perfil de Reserva */}
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>👥 Perfil:</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>
            {pedido.encomendista_datos?.nombre || 'N/A'}
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <BackButton onPress={() => onNavigate?.('home')} color={theme.colors.text} />
        <Text style={[styles.headerTitle, { color: theme.colors.text, fontSize: scale(18) }]}>
          📅 Retirados Hoy
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Hora actual */}
      <View style={[styles.horaActualContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.horaActualLabel, { color: theme.colors.textSecondary }]}>Hora actual:</Text>
        <Text style={[styles.horaActualValor, { color: theme.colors.primary, fontSize: scale(24) }]}>
          {convertirHora12(horaActual)}
        </Text>
      </View>

      {/* Contenido */}
      {pedidosAgrupados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.text, fontSize: scale(18) }]}>
            ✅ No hay pedidos retirados hoy
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary, fontSize: scale(14) }]}>
            Vuelve luego para ver los retiros del día
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.contenido} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
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
      backgroundColor: theme.colors.background,
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
    },
    emptyText: {
      fontSize: scale(18),
      fontWeight: 'bold',
      color: theme.colors.text,
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
  });
