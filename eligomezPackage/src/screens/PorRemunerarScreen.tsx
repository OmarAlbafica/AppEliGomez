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
  Alert,
  StyleSheet,
  Image,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pedidosServiceOptimizado, PedidoCompleto } from '../services/pedidosServiceOptimizado';
import { BackButton } from '../components/BackButton';
import { useAppTheme, useTheme } from '../context/ThemeContext';
import { formatDate12Hours, formatDateOnly } from '../utils/dateUtils';
import { formatearFecha } from '../utils/pedidoUtils';
import { MoneyIcon, PackageIcon, TruckIcon } from '../components/icons';
import { ImageViewer } from '../components/ImageViewer';

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

  // Formatear fecha completa en español (ej: Jueves 20 de enero 2026)
  const formatearFechaCompleta = (fecha: string | Date | undefined): string => {
    if (!fecha) return 'No programada';
    const date = new Date(fecha);
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const diaSemana = diasSemana[date.getDay()];
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const año = date.getFullYear();
    
    return `${diaSemana} ${dia} de ${mes} ${año}`;
  };

  // Calcular fecha estimada de envío
  // Envíos: Miércoles y Sábados
  // Si la entrega es Miércoles/Jueves/Viernes → se envió el Miércoles anterior
  // Si la entrega es Sábado/Domingo/Lunes/Martes → se envió el Sábado anterior
  const calcularFechaEnvio = (fechaEntrega: string | Date | undefined): string => {
    if (!fechaEntrega) return 'No programada';
    
    const date = new Date(fechaEntrega);
    const diaSemana = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    
    let fechaEnvio = new Date(date);
    
    // Si es Miércoles (3), Jueves (4) o Viernes (5) → envío fue el Miércoles
    if (diaSemana === 3 || diaSemana === 4 || diaSemana === 5) {
      // Retroceder al miércoles anterior
      const diasHastaMiercoles = diaSemana - 3;
      fechaEnvio.setDate(date.getDate() - diasHastaMiercoles);
    }
    // Si es Sábado (6), Domingo (0), Lunes (1) o Martes (2) → envío fue el Sábado
    else {
      if (diaSemana === 6) {
        // Ya es sábado, no retroceder
        fechaEnvio = new Date(date);
      } else if (diaSemana === 0) {
        // Domingo → retroceder 1 día al sábado
        fechaEnvio.setDate(date.getDate() - 1);
      } else if (diaSemana === 1) {
        // Lunes → retroceder 2 días al sábado
        fechaEnvio.setDate(date.getDate() - 2);
      } else if (diaSemana === 2) {
        // Martes → retroceder 3 días al sábado
        fechaEnvio.setDate(date.getDate() - 3);
      }
    }
    
    return formatearFechaCompleta(fechaEnvio);
  };

  const [pedidos, setPedidos] = useState<PedidoCompleto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoCompleto | null>(null);
  
  // Visor de imágenes con zoom
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imageTitle, setImageTitle] = useState('');
  
  // Vista compacta - Se carga desde AsyncStorage
  const [vistaCompacta, setVistaCompacta] = useState(true);
  
  // Pedidos encontrados (guardados localmente)
  const [pedidosEncontrados, setPedidosEncontrados] = useState<Set<string>>(new Set());

  // Pedidos marcados como "No Retiro" (guardados localmente)
  const [pedidosNoRetiro, setPedidosNoRetiro] = useState<Set<string>>(new Set());

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
        
        // Snap rápido: si scroll > 50px minimizar, si no expandir
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

  // Agrupar por encomendista
  const [agrupadosPorEncomendista, setAgrupadosPorEncomendista] = useState<
    { encomendista: string; pedidos: PedidoCompleto[] }[]
  >([]);
  const [agrupadosFiltrados, setAgrupadosFiltrados] = useState<
    { encomendista: string; pedidos: PedidoCompleto[] }[]
  >([]);

  useEffect(() => {
    cargarPedidos();
    cargarEncontrados();
    cargarNoRetiro();
    cargarVistaCompactaPreferencia();
  }, []);

  const cargarEncontrados = async () => {
    try {
      const encontradosJson = await AsyncStorage.getItem('pedidosEncontrados_PorRemunerar');
      if (encontradosJson) {
        const encontrados = JSON.parse(encontradosJson);
        setPedidosEncontrados(new Set(encontrados));
      }
    } catch (error) {
      console.error('Error cargando encontrados:', error);
    }
  };

  const guardarEncontrados = async (nuevosEncontrados: Set<string>) => {
    try {
      const encontradosArray = Array.from(nuevosEncontrados);
      await AsyncStorage.setItem('pedidosEncontrados_PorRemunerar', JSON.stringify(encontradosArray));
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
      // Limpiar No Retiro cuando se marca como encontrado (remunerado)
      const nuevosNoRetiro = new Set(pedidosNoRetiro);
      if (nuevosNoRetiro.has(pedidoId)) {
        nuevosNoRetiro.delete(pedidoId);
        setPedidosNoRetiro(nuevosNoRetiro);
        await guardarNoRetiro(nuevosNoRetiro);
      }
    }
    setPedidosEncontrados(nuevosEncontrados);
    await guardarEncontrados(nuevosEncontrados);
  };

  const guardarNoRetiro = async (nuevosNoRetiro: Set<string>) => {
    try {
      const noRetiroArray = Array.from(nuevosNoRetiro);
      await AsyncStorage.setItem('pedidosNoRetiro_PorRemunerar', JSON.stringify(noRetiroArray));
    } catch (error) {
      console.error('Error guardando no retiro:', error);
    }
  };

  const cargarNoRetiro = async () => {
    try {
      const noRetiroJson = await AsyncStorage.getItem('pedidosNoRetiro_PorRemunerar');
      if (noRetiroJson) {
        const noRetiro = JSON.parse(noRetiroJson);
        setPedidosNoRetiro(new Set(noRetiro));
      }
    } catch (error) {
      console.error('Error cargando no retiro:', error);
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

  const marcarComoNoRetiro = async (pedidoId: string) => {
    const nuevosNoRetiro = new Set(pedidosNoRetiro);
    if (nuevosNoRetiro.has(pedidoId)) {
      nuevosNoRetiro.delete(pedidoId);
    } else {
      nuevosNoRetiro.add(pedidoId);
    }
    setPedidosNoRetiro(nuevosNoRetiro);
    await guardarNoRetiro(nuevosNoRetiro);
  };

  const marcarEncomendista = async (encomendista: string, pedidos: PedidoCompleto[]) => {
    const nuevosEncontrados = new Set(pedidosEncontrados);
    const todosMarcados = pedidos.every(p => nuevosEncontrados.has(p.id));
    
    pedidos.forEach(p => {
      if (todosMarcados) {
        nuevosEncontrados.delete(p.id);
      } else {
        nuevosEncontrados.add(p.id);
      }
    });
    
    setPedidosEncontrados(nuevosEncontrados);
    await guardarEncontrados(nuevosEncontrados);
  };

  const cargarPedidos = async () => {
    try {
      setLoading(true);
      // 🔥 UNA SOLA PETICIÓN en lugar de 3 separadas
      const todosLosPedidos = await pedidosServiceOptimizado.obtenerPedidosPorEstados(
        ['enviado', 'no-retirado', 'retirado'],
        300
      );
      
      // 🔴 VALIDACIÓN CORRECTA: Filtrar por fecha_entrega_programada (NO por created_at)
      // Solo mostrar pedidos cuya fecha de entrega YA PASÓ (antes de hoy)
      const hoy = new Date();
      const hoyFecha = hoy.toISOString().split('T')[0];  // Solo fecha: YYYY-MM-DD
      
      const pedidosFiltrados = todosLosPedidos.filter(pedido => {
        if (!pedido.fecha_entrega_programada) return false;
        const fechaEntrega = new Date(pedido.fecha_entrega_programada).toISOString().split('T')[0];  // Solo fecha
        // Mostrar solo si la fecha de entrega PASÓ (antes de hoy)
        return fechaEntrega < hoyFecha;
      });
      
      setPedidos(pedidosFiltrados);

      // Agrupar por encomendista
      const agrupados: { [key: string]: PedidoCompleto[] } = {};
      pedidosFiltrados.forEach((pedido: PedidoCompleto) => {
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
    
    let gruposProcesados = agrupadosPorEncomendista;
    
    if (texto.trim()) {
      const textoLower = texto.toLowerCase();
      gruposProcesados = agrupadosPorEncomendista
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
    }

    // Ordenar: encontrados al final
    const gruposOrdenados = gruposProcesados.map((grupo) => ({
      encomendista: grupo.encomendista,
      pedidos: [
        ...grupo.pedidos.filter((p) => !pedidosEncontrados.has(p.id)),
        ...grupo.pedidos.filter((p) => pedidosEncontrados.has(p.id)),
      ],
    }));

    setAgrupadosFiltrados(gruposOrdenados);
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
      case 'enviado':
        return '#2196F3'; // Azul - Enviado
      case 'retirado':
        return '#00BCD4'; // Cyan - Retirado
      case 'no-retirado':
        return '#FF6F00'; // Naranja intenso - No Retirado
      case 'remunero':
        return '#4CAF50'; // Verde - Remunerado
      default:
        return '#999';
    }
  };

  const getEstadoLabel = (estado: string) => {
    const labels: { [key: string]: string } = {
      enviado: '📮 Enviado',
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header animado colapsable */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.primary,
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
            <Text style={{ color: vistaCompacta ? '#000' : '#fff', fontSize: 12, fontWeight: '700' }}>
              {vistaCompacta ? '⊞ Normal' : '⊟ Compacta'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <Animated.View 
          style={[
            styles.headerContent,
            { 
              opacity: headerOpacity,
            }
          ]}
        >
          <View style={styles.iconCircle}>
            <MoneyIcon size={48} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>
            Por Remunerar
          </Text>
          <Text style={styles.headerSubtitle}>
            {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'} • {agrupadosPorEncomendista.length} {agrupadosPorEncomendista.length === 1 ? 'encomendista' : 'encomendistas'}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, {
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            borderColor: theme.colors.border,
          }]}
          placeholder="🔍 Buscar por código, cliente, encomendista..."
          placeholderTextColor={theme.colors.textSecondary}
          value={busqueda}
          onChangeText={filtrarPedidos}
        />
      </View>

      {/* Total Cobrado */}
      {pedidos.some(p => pedidosEncontrados.has(p.id)) && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface }}>
          <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
            💰 Total Cobrado: ${pedidos.reduce((sum, p) => pedidosEncontrados.has(p.id) ? sum + (p.total || 0) : sum, 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          </Text>
        </View>
      )}

      <Animated.ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

      {agrupadosFiltrados.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <MoneyIcon size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
            {busqueda ? 'No se encontraron resultados' : '¡Todos los pedidos han sido remunerados!'}
          </Text>
        </View>
      ) : vistaCompacta ? (
        // VISTA COMPACTA
        agrupadosFiltrados.map((grupo) => {
          const totalGrupo = grupo.pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
          const totalRemunerado = grupo.pedidos.reduce((sum, p) => pedidosEncontrados.has(p.id) ? sum + (p.total || 0) : sum, 0);
          return (
            <View key={grupo.encomendista}>
              {/* Header de encomendista con total */}
              <View style={{ 
                paddingHorizontal: 16, 
                paddingVertical: 12, 
                backgroundColor: theme.colors.primary,
                borderBottomWidth: 2,
                borderBottomColor: theme.colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 }}>
                    🚚 {grupo.encomendista}
                  </Text>
                  <TouchableOpacity
                    onPress={() => marcarEncomendista(grupo.encomendista, grupo.pedidos)}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {grupo.pedidos.every(p => pedidosEncontrados.has(p.id)) ? '✅ Marcar' : '☐ Marcar'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                    {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                  </Text>
                  {grupo.pedidos.some(p => pedidosNoRetiro.has(p.id)) ? (
                    <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '800' }}>
                      No Retirado
                    </Text>
                  ) : (
                    <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800' }}>
                      ${totalGrupo.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </Text>
                  )}
                </View>
                {totalRemunerado > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                      💰 Cobrado:
                    </Text>
                    <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '800' }}>
                      ${totalRemunerado.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Lista compacta de pedidos */}
              <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }}>
                {grupo.pedidos.map((pedido) => {
                  const esEncontrado = pedidosEncontrados.has(pedido.id);
                  const esNoRetiro = pedidosNoRetiro.has(pedido.id);
                  return (
                  <View
                    key={pedido.id}
                    style={{
                      backgroundColor: esNoRetiro ? '#DC2626' : (esEncontrado ? '#D3D3D3' : theme.colors.background),
                      borderRadius: 10,
                      marginBottom: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: esNoRetiro ? '#991B1B' : (esEncontrado ? '#999' : theme.colors.border),
                      borderLeftWidth: 4,
                      borderLeftColor: esNoRetiro ? '#991B1B' : (esEncontrado ? '#999' : getEstadoColor(pedido.estado)),
                      opacity: esEncontrado ? 0.7 : 1,
                    }}
                  >
                    {/* Fila 1: Badge + Código + Cliente + Total */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      {/* Badge estado */}
                      <View style={{
                        backgroundColor: esEncontrado ? '#999' : getEstadoColor(pedido.estado),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        minWidth: 35,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
                          {esEncontrado ? '✓' : (pedido.estado === 'enviado' ? '📮' : pedido.estado === 'retirado' ? '✓' : pedido.estado === 'no-retirado' ? '✗' : '💰')}
                        </Text>
                      </View>

                      {/* Código + Cliente */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: esEncontrado ? '#666' : theme.colors.text, fontWeight: '800', fontSize: 12, textDecorationLine: esEncontrado ? 'line-through' : 'none' }}>
                          {pedido.codigo_pedido}
                        </Text>
                        <Text style={{ color: esEncontrado ? '#999' : theme.colors.textSecondary, fontSize: 10, marginTop: 2 }}>
                          {pedido.cliente_datos?.nombre || 'N/A'}
                        </Text>
                      </View>

                      {/* Total */}
                      {!esNoRetiro && (
                        <Text style={{ color: esEncontrado ? '#999' : theme.colors.success, fontWeight: '800', fontSize: 14 }}>
                          ${(pedido.total || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </Text>
                      )}
                    </View>

                    {/* Fila 2: Botones */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {/* Botón No Retiro - Siempre visible pero con estilos diferentes */}
                      {!esEncontrado && (
                        <TouchableOpacity
                          onPress={() => marcarComoNoRetiro(pedido.id)}
                          style={{
                            flex: 1,
                            backgroundColor: esNoRetiro ? '#991B1B' : 'rgba(220, 38, 38, 0.2)',
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 6,
                            borderWidth: 2,
                            borderColor: '#DC2626',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>
                            ✕
                          </Text>
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                            No Retiro
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Botón Marcar Encontrado - Solo si no está marcado como No Retiro */}
                      {!esNoRetiro && (
                        <TouchableOpacity
                          onPress={() => marcarComoEncontrado(pedido.id)}
                          style={{
                            flex: 1,
                            backgroundColor: esEncontrado ? '#4CAF50' : theme.colors.primary,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            borderWidth: 2,
                            borderColor: esEncontrado ? '#2E7D32' : theme.colors.primary,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                            {esEncontrado ? '✅' : '$'}
                          </Text>
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                            {esEncontrado ? 'Remunerado' : 'Remunerar'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Fila 2: Imagen del paquete */}
                    {!esEncontrado && pedido.foto_paquete && pedido.foto_paquete.trim() && (
                      <View style={{ marginTop: 8 }}>
                        <TouchableOpacity
                          onPress={() => {
                            setCurrentImages([pedido.foto_paquete!]);
                            setImageTitle(`Paquete - ${pedido.codigo_pedido}`);
                            setImageViewerVisible(true);
                          }}
                          style={{
                            borderRadius: 8,
                            overflow: 'hidden',
                            borderWidth: 2,
                            borderColor: theme.colors.primary,
                            width: 70,
                          }}
                        >
                          <Image
                            source={{ uri: pedido.foto_paquete }}
                            style={{
                              width: 70,
                              height: 70,
                              backgroundColor: theme.colors.background,
                            }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  );
                })}
              </View>
            </View>
          );
        })
      ) : (
        // VISTA NORMAL
        agrupadosFiltrados.map((grupo) => (
          <View key={grupo.encomendista} style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] }>
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>🚚 {grupo.encomendista}</Text>
            <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, marginBottom: 12 }}>
              {grupo.pedidos.length} {grupo.pedidos.length === 1 ? 'pedido' : 'pedidos'}
            </Text>

            {grupo.pedidos.map((pedido) => (
              <TouchableOpacity
                key={pedido.id}
                style={[styles.card, { backgroundColor: theme.colors.background, borderLeftColor: getEstadoColor(pedido.estado) }]}
                onPress={() => handleAbrirDetalle(pedido)}
                activeOpacity={0.7}
              >
                {/* Badge de estado arriba */}
                <View
                  style={{
                    backgroundColor: getEstadoColor(pedido.estado),
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    alignSelf: 'flex-start',
                    marginBottom: 12,
                    shadowColor: getEstadoColor(pedido.estado),
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.4,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: scale(11), fontWeight: '700', letterSpacing: 0.5 }}>
                    {getEstadoLabel(pedido.estado)}
                  </Text>
                </View>

                {/* Información del pedido */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text, marginBottom: 8 }]}>📦 Código: {pedido.codigo_pedido}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>👤 Cliente: {pedido.cliente_datos?.nombre || 'N/A'}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>🏪 Tienda: {pedido.nombre_tienda || 'N/A'}</Text>
                  {pedido.nombre_perfil && (
                    <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>📋 Perfil: {pedido.nombre_perfil}</Text>
                  )}
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>🚚 Encomendista: {pedido.encomendista_datos?.nombre || 'Sin asignar'}</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                    📍 Destino: {pedido.modo === 'personalizado' && pedido.direccion_personalizada 
                      ? pedido.direccion_personalizada 
                      : (pedido.destino_id || pedido.destino_datos?.nombre || 'N/A')}
                  </Text>
                  
                  {/* Fecha de entrega programada */}
                  {pedido.fecha_entrega_programada && (
                    <Text style={[styles.cardSubtitle, { color: theme.colors.primary, fontWeight: '700', marginTop: 6, backgroundColor: theme.colors.primary + '20', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 }]}>
                      📅 Fecha de entrega: {formatearFechaCompleta(pedido.fecha_entrega_programada)}
                    </Text>
                  )}
                  
                  {/* Fecha estimada de envío */}
                  {pedido.fecha_entrega_programada && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                      <Text style={[styles.cardSubtitle, { color: theme.colors.primary, fontWeight: '700', marginBottom: 4 }]}>
                        📤 Fecha estimada de envío:
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: theme.colors.primary, fontWeight: '600', fontSize: scale(13) }]}>
                        {calcularFechaEnvio(pedido.fecha_entrega_programada)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Botones de imágenes */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {pedido.foto_paquete && pedido.foto_paquete.trim() && (
                    <TouchableOpacity
                      style={{ 
                        flex: 1,
                        backgroundColor: theme.colors.primary, 
                        borderRadius: 10, 
                        paddingVertical: 10,
                        alignItems: 'center',
                        shadowColor: theme.colors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                      onPress={() => {
                        setCurrentImages([pedido.foto_paquete!]);
                        setImageTitle(`Paquete - ${pedido.codigo_pedido}`);
                        setImageViewerVisible(true);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: scale(12), fontWeight: '700' }}>📦 Paquete</Text>
                    </TouchableOpacity>
                  )}

                  {pedido.productos_datos && pedido.productos_datos.length > 0 && pedido.productos_datos[0].url_imagen && (
                    <TouchableOpacity
                      style={{ 
                        flex: 1,
                        backgroundColor: '#FF6F00', 
                        borderRadius: 10, 
                        paddingVertical: 10,
                        alignItems: 'center',
                        shadowColor: '#FF6F00',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                      onPress={() => {
                        const fotos: string[] = [];
                        pedido.productos_datos?.forEach(p => {
                          const foto = p.url_imagen || p.imagen_url;
                          if (foto) {
                            const fotoUrl = foto.startsWith('http') ? foto : `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto${foto}`;
                            if (!fotos.includes(fotoUrl)) fotos.push(fotoUrl);
                          }
                        });
                        setCurrentImages(fotos);
                        setImageTitle(`Productos - ${pedido.codigo_pedido}`);
                        setImageViewerVisible(true);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: scale(12), fontWeight: '700' }}>📸 Producto</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Total */}
                {pedido.total && (
                  <View style={{
                    backgroundColor: theme.colors.success + '15',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderLeftWidth: 4,
                    borderLeftColor: theme.colors.success,
                  }}>
                    <Text style={{ fontSize: scale(16), fontWeight: '800', color: theme.colors.success, letterSpacing: -0.5 }}>
                      💰 ${pedido.total.toLocaleString()}
                    </Text>
                  </View>
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
                            const fotos: string[] = [];
                            pedidoSeleccionado.productos_datos?.forEach(p => {
                              const foto = p.url_imagen || p.imagen_url;
                              if (foto) {
                                const fotoUrl = foto.startsWith('http') ? foto : `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto${foto}`;
                                if (!fotos.includes(fotoUrl)) fotos.push(fotoUrl);
                              }
                            });
                            setCurrentImages(fotos);
                            setImageTitle(`Productos - ${pedidoSeleccionado.codigo_pedido}`);
                            setImageViewerVisible(true);
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

      {/* Visor de Imágenes con Zoom */}
      <ImageViewer
        visible={imageViewerVisible}
        images={currentImages}
        title={imageTitle}
        onClose={() => setImageViewerVisible(false)}
      />

      {/* Botón Regresar */}
      <View style={{ padding: 16, paddingBottom: 20 }}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: theme.colors.textSecondary }]}
          onPress={() => onNavigate?.('home')}
        >
          <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>REGRESAR</Text>
        </TouchableOpacity>
      </View>
      </Animated.ScrollView>
    </View>
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
    fontSize: scale(14),
  },
  title: {
    fontSize: scale(18),
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: 12,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.border + '40',
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderLeftWidth: 6,
    borderLeftColor: theme.colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: theme.colors.border + '30',
  },
  cardTitle: {
    fontSize: scale(15),
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: scale(12),
    color: theme.colors.textSecondary,
    marginTop: 6,
    lineHeight: scale(18),
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
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
