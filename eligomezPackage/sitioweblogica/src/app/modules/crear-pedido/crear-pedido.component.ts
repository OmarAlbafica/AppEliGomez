import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { EncomendistasService, Encomendista, DestinoEncomendista } from '../../service/encomendistas/encomendistas.service';
import { PedidosService } from '../../service/pedidos/pedidos.service';
import { ProductosService, Producto } from '../../service/productos/productos.service';
import { TiendasService } from '../../service/tiendas/tiendas.service';
import { FavoritosPedidosService, FavoritoPedido } from '../../service/favoritos/favoritos-pedidos.service';
import { OcrService } from '../../service/ocr/ocr.service';
import { AuthService } from '../../service/auth/auth.service';
import { Tienda } from '../../models/tienda.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-crear-pedido',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-pedido.component.html',
  styleUrls: ['./crear-pedido.component.css']
})
export class CrearPedidoComponent implements OnInit, OnDestroy {

  // Datos principales
  clientes: Cliente[] = [];
  encomendistas: Encomendista[] = [];
  productos: Producto[] = [];
  tiendas: Tienda[] = [];
  tienda_id: string = '';
  tienda_seleccionada: Tienda | null = null;

  // Modo de creación
  modo: 'normal' | 'personalizado' = 'normal';

  // Paso 1: Datos del cliente
  cliente_id: string = '';
  nombreClienteBusqueda: string = '';
  clientesBuscados: Cliente[] = [];
  mostrarModalNuevoCliente = false;
  mostrarModalFavoritos = false;
  nuevoCliente = {
    nombre: '',
    telefono: '',
    direccion: ''
  };

  // Favoritos
  favoritosDelCliente: FavoritoPedido[] = [];
  guardarComoFavorito = false;
  descripcionFavorito = '';
  favoritoEnUso: FavoritoPedido | null = null; // Rastrear el favorito actualmente en uso

  // Productos seleccionados para el pedido
  productosSeleccionados: string[] = [];
  mostrarModalProductos = false;

  // Zoom de imágenes
  mostrarZoom = false;
  imagenZoom: string = '';

  // Paso 2: Seleccionar destino
  destino_id: string = '';
  encomendista_id: string = '';
  nombreEncomendistaBusqueda: string = '';
  encomendistaBuscadas: Encomendista[] = [];
  nombreDestinoBusqueda: string = '';
  destinosBuscados: DestinoEncomendista[] = [];
  direccion_personalizada: string = '';
  hora_inicio_personalizada: string = '09:00';
  hora_fin_personalizada: string = '17:00';
  destinosDisponibles: DestinoEncomendista[] = [];
  diasProximos: { dia: string; proximoHorario?: { hora_inicio: string; hora_fin: string } }[] = [];
  
  // Fechas disponibles para el día seleccionado
  fechasDisponibles: { fecha: Date; fechaFormato: string }[] = [];
  fechaSeleccionada: string = '';
  dia_entrega_fecha: Date | null = null;
  fechasOffset: number = 0;

  // Paso 3: Datos del pedido
  cantidad_prendas: number = 0;
  costo_prendas: number = 0;
  monto_envio: number = 0;
  total_pedido: number = 0;
  dia_entrega: string = '';
  notas: string = '';

  // Lista de pedidos a guardar
  pedidos_a_crear: any[] = [];

  // Control de carga para extracción de precios
  extrayendoPrecioImagen: boolean = false;

  // Mensajes
  mensaje: { tipo: 'éxito' | 'error'; texto: string } | null = null;

  // Control de carga
  guardando: boolean = false;

  // Días de la semana
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Modal para agregar destino a encomienda
  mostrarModalAgregarDestino = false;
  nuevoDestinoParaEncomienda = { nombre: '', local: '' };

  // Modal para agregar horario a destino
  mostrarModalAgregarHorario = false;
  nuevoHorarioParaDestino = {
    dias: [] as string[],
    hora_inicio: '09:00',
    hora_fin: '17:00'
  };
  diasSeleccionadosParaHorario: string[] = [];

  // Usuario actual para guardar favoritos con ID correcto
  usuarioActualId: string | null = null;

  private subscriptions: Subscription[] = [];

  private clientesService = inject(ClientesService);
  private encomendistasService = inject(EncomendistasService);
  private pedidosService = inject(PedidosService);
  private productosService = inject(ProductosService);
  private tiendasService = inject(TiendasService);
  private favoritosPedidosService = inject(FavoritosPedidosService);
  private ocrService = inject(OcrService);
  private authService = inject(AuthService);

  ngOnInit() {
    // Obtener usuario actual para guardar favoritos con ID correcto
    const subUsuario = this.authService.usuarioActual$.subscribe(usuario => {
      this.usuarioActualId = usuario?.uid || null;
      console.log('👤 Usuario actual ID:', this.usuarioActualId);
    });
    this.subscriptions.push(subUsuario);

    // Migrar favoritos de localStorage a Firebase (sin duplicar)
    this.favoritosPedidosService.migrarFavoritosLocalStorageAFirebase().then(resultado => {
      console.log('📊 Resultado migración:', resultado);
    });

    this.cargarClientes();
    this.cargarEncomendistas();
    this.cargarProductos();
    this.cargarTiendas();
    
    // Seleccionar la primera tienda automáticamente cuando se carguen
    setTimeout(() => {
      if (this.tiendas.length > 0 && this.tiendas[0].id) {
        this.tienda_id = this.tiendas[0].id;
        this.seleccionarTienda();
      }
    }, 500);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga clientes del usuario
   */
  cargarClientes() {
    const sub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
    });
    this.subscriptions.push(sub);
  }

  /**
   * Carga encomendistas ordenadas alfabéticamente
   */
  cargarEncomendistas() {
    const sub = this.encomendistasService.cargarEncomendistas().subscribe((encomendistas: Encomendista[]) => {
      // Ordenar alfabéticamente por nombre
      this.encomendistas = encomendistas.sort((a, b) => 
        a.nombre.localeCompare(b.nombre)
      );
    });
    this.subscriptions.push(sub);
  }

  /**
   * Carga productos del usuario
   */
  cargarProductos() {
    const sub = this.productosService.cargarProductos().subscribe((productos: Producto[]) => {
      this.productos = productos;
    });
    this.subscriptions.push(sub);
  }

  /**
   * Carga tiendas del usuario actual
   */
  cargarTiendas() {
    const sub = this.tiendasService.cargarTiendas().subscribe((tiendas: Tienda[]) => {
      this.tiendas = tiendas;
      console.log('Tiendas cargadas:', tiendas.length);
    });
    this.subscriptions.push(sub);
  }

  /**
   * Normaliza texto removiendo acentos y tildes para búsqueda insensible a diacríticos
   * Ejemplo: "Lopèz" → "lopez"
   */
  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remueve diacríticos (acentos, tildes)
      .toLowerCase();
  }

  /**
   * Convierte hora formato 24h ("09:00") a formato 12h ("9am")
   */
  convertirHora12(hora24: string | undefined): string {
    if (!hora24) return '';
    
    try {
      const [horas, minutos] = hora24.split(':');
      const h = parseInt(horas, 10);
      const periodo = h >= 12 ? 'pm' : 'am';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return minutos && minutos !== '00' ? `${h12}:${minutos}${periodo}` : `${h12}${periodo}`;
    } catch {
      return hora24;
    }
  }

  /**
   * Selecciona una tienda y guarda su referencia
   */
  seleccionarTienda() {
    this.tienda_seleccionada = this.tiendas.find(t => t.id === this.tienda_id) || null;
    if (this.tienda_seleccionada) {
      console.log('✅ Tienda seleccionada:', this.tienda_seleccionada.nombre_pagina);
    }
  }

  /**
   * Busca clientes por nombre (insensible a acentos y tildes)
   */
  buscarClientes(nombre: string) {
    this.nombreClienteBusqueda = nombre;
    if (nombre.trim().length === 0) {
      this.clientesBuscados = [];
      return;
    }

    // Normalizar el texto de búsqueda
    const textoBuscadoNormalizado = this.normalizarTexto(nombre);

    // Filtrar clientes que coincidan con el nombre normalizado
    const clientesFiltrarados = this.clientes.filter(cliente =>
      this.normalizarTexto(cliente.nombre).includes(textoBuscadoNormalizado)
    );

    // Ordenar alfabéticamente
    this.clientesBuscados = clientesFiltrarados.sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  /**
   * Busca encomendistas por nombre con ordenamiento alfabético (insensible a acentos)
   */
  buscarEncomendistas(nombre: string) {
    this.nombreEncomendistaBusqueda = nombre;
    if (nombre.trim().length === 0) {
      this.encomendistaBuscadas = [];
      return;
    }

    // Normalizar el texto de búsqueda
    const textoBuscadoNormalizado = this.normalizarTexto(nombre);

    // Filtrar encomendistas que coincidan con el nombre normalizado
    const filtradas = this.encomendistas.filter(e =>
      this.normalizarTexto(e.nombre).includes(textoBuscadoNormalizado) && e.activo
    );

    // Ordenar alfabéticamente por nombre
    this.encomendistaBuscadas = filtradas.sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  /**
   * Selecciona una encomendista
   */
  seleccionarEncomendistaBuscada(encomendista: Encomendista) {
    this.encomendista_id = encomendista.id;
    this.nombreEncomendistaBusqueda = encomendista.nombre;
    this.encomendistaBuscadas = [];
    
    // Cerrar modal de favoritos para permitir continuar
    this.mostrarModalFavoritos = false;
    
    // Cargar destinos de la encomendista
    this.seleccionarEncomendista();
  }

  /**
   * Selecciona un cliente existente
   */
  async seleccionarCliente(cliente: Cliente) {
    this.cliente_id = cliente.id;
    this.nombreClienteBusqueda = cliente.nombre;
    this.clientesBuscados = [];
    
    // Cargar favoritos del cliente
    await this.cargarFavoritosPorCliente(cliente.id);
    
    // Mostrar modal de favoritos
    this.mostrarModalFavoritos = true;
  }

  /**
   * Carga TODOS los favoritos (no filtrados por cliente) para que sean accesibles a todos
   */
  async cargarFavoritosPorCliente(clienteId: string) {
    try {
      // Usar obtenerTodosFavoritos() para que todos puedan ver todos los favoritos
const favoritos = await this.favoritosPedidosService.obtenerFavoritosPorCliente(clienteId);

      this.favoritosDelCliente = favoritos;
    } catch (error) {
      console.error('Error cargando favoritos:', error);
      this.favoritosDelCliente = [];
    }
  }

  /**
   * Usa un favorito para rellenar el formulario
   */
  usarFavorito(favorito: FavoritoPedido) {
    // Registrar cuál favorito se está usando
    this.favoritoEnUso = favorito;
    
    // Establecer modo
    this.modo = favorito.modo;
    
    // Establecer encomendista y destino según el modo
    if (favorito.modo === 'normal') {
      this.encomendista_id = favorito.encomendista_id;
      this.destino_id = favorito.destino_id || '';
      this.direccion_personalizada = '';
    } else {
      this.direccion_personalizada = favorito.direccion_personalizada || '';
      this.encomendista_id = favorito.encomendista_id;
      this.destino_id = '';
    }
    
    // Cerrar modal
    this.mostrarModalFavoritos = false;
    
    // Cargar destinos del encomendista
    this.seleccionarEncomendista();
    
    // Cargar horarios y días disponibles
    if (favorito.modo === 'normal') {
      setTimeout(() => {
        this.seleccionarDestino();
      }, 50);
    }
    
    // Cargar fechas disponibles si ya hay día seleccionado
    if (favorito.dia_maximo) {
      setTimeout(() => {
        this.seleccionarDia(favorito.dia_maximo || '');
      }, 150);
    }
  }

  /**
   * Crea un nuevo pedido sin usar favorito
   */
  crearNuevo() {
    this.favoritoEnUso = null; // Limpiar favorito en uso
    this.mostrarModalFavoritos = false;
    // El formulario queda listo para que el usuario continúe
  }

  /**
   * Cierra el modal de favoritos
   */
  cerrarModalFavoritos() {
    this.mostrarModalFavoritos = false;
  }

  /**
   * Abre modal para crear nuevo cliente
   */
  abrirModalNuevoCliente() {
    this.mostrarModalNuevoCliente = true;
  }

  /**
   * Crea nuevo cliente
   */
  crearCliente() {
    if (!this.nuevoCliente.nombre.trim()) {
      this.mostrarMensaje('error', 'El nombre del cliente es obligatorio');
      return;
    }

    this.clientesService
      .crearCliente(
        this.nuevoCliente.nombre,
        this.nuevoCliente.telefono,
        this.nuevoCliente.direccion
      )
      .then((id) => {
        this.cliente_id = id;
        this.nombreClienteBusqueda = this.nuevoCliente.nombre;
        this.mostrarModalNuevoCliente = false;
        this.nuevoCliente = { nombre: '', telefono: '', direccion: '' };
        this.mostrarMensaje('éxito', 'Cliente creado exitosamente');
        this.cargarClientes();
      })
      .catch(() => {
        this.mostrarMensaje('error', 'Error creando cliente');
      });
  }

  /**
   * Extrae el valor de un evento de cambio (para selectores)
   */
  onSelectChange(event: Event, handler: (value: string) => void) {
    const value = (event.target as HTMLSelectElement).value;
    handler(value);
  }

  /**
   * Cambia el modo de pedido vía evento
   */
  cambiarModoEvent(event: Event) {
    const modo = (event.target as HTMLSelectElement).value as 'normal' | 'personalizado';
    this.cambiarModo(modo);
  }

  /**
   * Cambia el modo de pedido y limpia los datos relacionados
   */
  cambiarModo(nuevoModo: 'normal' | 'personalizado') {
    this.modo = nuevoModo;
    // Limpiar datos de paso 2 (menos encomendista, que se usa en ambos modos)
    this.dia_entrega = '';
    this.dia_entrega_fecha = null;
    this.fechaSeleccionada = '';
    this.fechasDisponibles = [];
    this.fechasOffset = 0;
    this.destino_id = '';
    this.destinosDisponibles = [];
    this.diasProximos = [];
    this.direccion_personalizada = '';
  }

  /**
   * Selecciona encomendista y carga sus destinos ordenados alfabéticamente
   */
  seleccionarEncomendista() {
    if (!this.encomendista_id) {
      this.destinosDisponibles = [];
      this.diasProximos = [];
      return;
    }

    const encomendista = this.encomendistas.find(e => e.id === this.encomendista_id);
    const destinos = encomendista?.destinos || [];
    
    // Ordenar destinos alfabéticamente por nombre
    this.destinosDisponibles = destinos.sort((a, b) => 
      a.nombre.localeCompare(b.nombre)
    );
  }

  /**
   * Busca destinos por nombre (insensible a acentos y tildes)
   */
  buscarDestinos(nombre: string) {
    this.nombreDestinoBusqueda = nombre;
    if (nombre.trim().length === 0) {
      this.destinosBuscados = [];
      return;
    }

    // Normalizar el texto de búsqueda
    const textoBuscadoNormalizado = this.normalizarTexto(nombre);

    // Filtrar destinos que coincidan con el nombre normalizado
    const filtrados = this.destinosDisponibles.filter(d =>
      this.normalizarTexto(d.nombre).includes(textoBuscadoNormalizado)
    );

    // Ordenar alfabéticamente por nombre
    this.destinosBuscados = filtrados.sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  /**
   * Selecciona un destino de la búsqueda
   */
  seleccionarDestinoBuscado(destino: DestinoEncomendista) {
    this.destino_id = destino.nombre;
    this.nombreDestinoBusqueda = destino.nombre;
    this.destinosBuscados = [];
    this.seleccionarDestino();
  }

  /**
   * Selecciona un destino y muestra días disponibles
   */
  seleccionarDestino() {
    if (!this.destino_id || !this.encomendista_id) {
      this.diasProximos = [];
      return;
    }

    const encomendista = this.encomendistas.find(e => e.id === this.encomendista_id);
    const destino = encomendista?.destinos.find(d => d.nombre === this.destino_id);

    if (!destino) {
      this.diasProximos = [];
      return;
    }

    // Calcular días próximos basados en los horarios del destino
    this.diasProximos = [];
    this.dia_entrega = '';
    this.fechasDisponibles = [];
    this.fechaSeleccionada = '';
    this.dia_entrega_fecha = null;

    if (destino.horarios && destino.horarios.length > 0) {
      // Nuevo formato: múltiples horarios
      destino.horarios.forEach(horario => {
        horario.dias.forEach(dia => {
          const existing = this.diasProximos.find(d => d.dia === dia);
          if (!existing) {
            this.diasProximos.push({
              dia: dia,
              proximoHorario: {
                hora_inicio: horario.hora_inicio,
                hora_fin: horario.hora_fin
              }
            });
          }
        });
      });
    } else if (destino.dia) {
      // Formato legacy: un solo día
      this.diasProximos = [{
        dia: destino.dia,
        proximoHorario: {
          hora_inicio: destino.hora_inicio || '09:00',
          hora_fin: destino.hora_fin || '17:00'
        }
      }];
    }
  }

  /**
   * Cuando el usuario selecciona un día vía evento
   */
  seleccionarDiaEvent(event: Event) {
    const dia = (event.target as HTMLSelectElement).value;
    this.seleccionarDia(dia);
  }

  /**
   * Cuando el usuario selecciona un día, mostrar las próximas fechas disponibles
   */
  seleccionarDia(dia: string) {
    this.dia_entrega = dia;
    this.fechasOffset = 0; // Reiniciar offset
    this.fechasDisponibles = this.calcularProximasFechas(dia, 4, this.fechasOffset);
    this.fechaSeleccionada = '';
    this.dia_entrega_fecha = null;
  }

  /**
   * Navega hacia adelante en las fechas
   */
  irAdelante() {
    this.fechasOffset += 4;
    this.fechasDisponibles = this.calcularProximasFechas(this.dia_entrega, 4, this.fechasOffset);
  }

  /**
   * Navega hacia atrás en las fechas
   */
  irAtras() {
    this.fechasOffset -= 4;
    this.fechasDisponibles = this.calcularProximasFechas(this.dia_entrega, 4, this.fechasOffset);
  }

  /**
   * Calcula las próximas N fechas de un día específico con offset
   */
  calcularProximasFechas(nombreDia: string, cantidad: number, offset: number = 0): { fecha: Date; fechaFormato: string }[] {
    const diaIndice = this.diasSemana.indexOf(nombreDia);
    if (diaIndice === -1) return [];

    const fechas: { fecha: Date; fechaFormato: string }[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let fecha = new Date(hoy);
    const diaActual = fecha.getDay(); // 0=Domingo, 1=Lunes, etc.
    
    // Calcular días faltantes hasta el día seleccionado
    let diasAdelante = diaIndice - diaActual;
    
    // Si el resultado es 0 o negativo (día ya pasó esta semana), ir al próximo
    if (diasAdelante <= 0) {
      diasAdelante += 7;
    }
    
    fecha.setDate(fecha.getDate() + diasAdelante);
    
    // Agregar offset de semanas
    fecha.setDate(fecha.getDate() + (offset * 7));

    for (let i = 0; i < cantidad; i++) {
      const fechaFormato = this.formatearFecha(fecha);
      fechas.push({
        fecha: new Date(fecha),
        fechaFormato: fechaFormato
      });
      fecha.setDate(fecha.getDate() + 7); // Sumar 7 días para la próxima ocurrencia
    }

    return fechas;
  }

  /**
   * Formatea una fecha como "Jueves 24 de Diciembre 2025"
   */
  formatearFecha(fecha: Date): string {
    const mesesNombres = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const dia = fecha.getDate();
    const mes = mesesNombres[fecha.getMonth()];
    const año = fecha.getFullYear();
    const diaSemana = this.diasSemana[fecha.getDay()]; // Usa getDay() directamente con el nuevo array

    return `${diaSemana} ${dia} de ${mes} ${año}`;
  }

  /**
   * Selecciona una fecha específica
   */
  seleccionarFecha(fechaObj: { fecha: Date; fechaFormato: string }) {
    this.fechaSeleccionada = fechaObj.fechaFormato;
    this.dia_entrega_fecha = fechaObj.fecha;
  }

  /**
   * Agrega un pedido a la lista - soporta modo normal y personalizado
   */
  async agregarPedido() {
    console.log('%c=== INICIANDO agregarPedido() ===', 'color: blue; font-weight: bold; font-size: 14px');
    console.log('%cModo:', 'color: green; font-weight: bold', this.modo);
    console.log('%cDirección:', 'color: orange; font-weight: bold', this.direccion_personalizada);
    console.log('%cEncomendista ID:', 'color: purple; font-weight: bold', this.encomendista_id);
    console.log('%cCliente ID:', 'color: red; font-weight: bold', this.cliente_id);
    
    if (!this.cliente_id) {
      this.mostrarMensaje('error', 'Debes seleccionar o crear un cliente');
      return;
    }

    // Validaciones comunes
    if (!this.dia_entrega) {
      this.mostrarMensaje('error', 'Debes seleccionar un día de entrega');
      return;
    }

    // En modo normal, la fecha específica es obligatoria. En personalizado es opcional.
    if (this.modo === 'normal' && !this.dia_entrega_fecha) {
      this.mostrarMensaje('error', 'Debes seleccionar una fecha específica');
      return;
    }

    if (this.cantidad_prendas <= 0 && this.modo === 'normal') {
      this.mostrarMensaje('error', 'Debes seleccionar al menos un producto');
      return;
    }

    if (this.costo_prendas < 0 || this.monto_envio < 0) {
      this.mostrarMensaje('error', 'Los costos no pueden ser negativos');
      return;
    }

    // Validaciones por modo
    if (this.modo === 'normal') {
      if (!this.encomendista_id) {
        this.mostrarMensaje('error', 'Debes seleccionar un encomendista');
        return;
      }
      if (!this.destino_id) {
        this.mostrarMensaje('error', 'Debes seleccionar un destino');
        return;
      }
    } else if (this.modo === 'personalizado') {
      if (!this.encomendista_id) {
        this.mostrarMensaje('error', 'Debes seleccionar una encomendista');
        return;
      }
      if (!this.direccion_personalizada.trim()) {
        this.mostrarMensaje('error', 'Debes ingresar una dirección');
        return;
      }
    }

    console.log('Modo:', this.modo, 'Productos seleccionados:', this.productosSeleccionados.length);

    // Obtener horario - en modo normal de dias proximos, en personalizado de inputs
    let hora_inicio = this.hora_inicio_personalizada;
    let hora_fin = this.hora_fin_personalizada;
    
    // Calcular fecha si no está definida (en personalizado, si no selecciona fecha específica)
    let fechaEntrega = this.dia_entrega_fecha;
    if (!fechaEntrega && this.dia_entrega) {
      // Calcular la próxima ocurrencia del día seleccionado
      const proximasFechas = this.calcularProximasFechas(this.dia_entrega, 1);
      if (proximasFechas.length > 0) {
        fechaEntrega = proximasFechas[0].fecha;
      } else {
        // Fallback: usar hoy + offset de días
        fechaEntrega = new Date();
      }
    }
    
    if (this.modo === 'normal') {
      const horarioDelDia = this.diasProximos.find(d => d.dia === this.dia_entrega);
      hora_inicio = horarioDelDia?.proximoHorario?.hora_inicio || '09:00';
      hora_fin = horarioDelDia?.proximoHorario?.hora_fin || '17:00';
    } else if (this.modo === 'personalizado') {
      // En personalizado, no usamos horas específicas (son opcionales)
      hora_inicio = '00:00';
      hora_fin = '23:59';
    }

    // Crear pedido
    const clienteSeleccionado = this.clientes.find(c => c.id === this.cliente_id);
    const nuevoPedido: any = {
      cliente_id: this.cliente_id,
      telefono_cliente: clienteSeleccionado?.telefono || '', // NUEVO: Agregar teléfono del cliente
      tienda_id: this.tienda_id,
      nombre_tienda: this.tienda_seleccionada?.nombre_pagina || '',
      nombre_perfil: this.tienda_seleccionada?.nombre_perfil_reserva || '',
      cantidad_prendas: this.cantidad_prendas,
      costo_prendas: this.costo_prendas,
      monto_envio: this.monto_envio,
      total: this.total_pedido,
      dia_entrega: this.dia_entrega,
      fecha_entrega_programada: fechaEntrega,
      hora_inicio: hora_inicio,
      hora_fin: hora_fin,
      notas: this.notas || null,
      modo: this.modo,
      productos_id: this.productosSeleccionados,
      codigo_pedido: await this.generarCodigoPedido()
    };

    // Agregar campos específicos por modo
    if (this.modo === 'normal') {
      nuevoPedido.encomendista_id = this.encomendista_id;
      nuevoPedido.destino_id = this.destino_id;
      console.log('%c✅ MODO NORMAL - Encomendista:', 'color: green; font-weight: bold', this.encomendista_id);
    } else if (this.modo === 'personalizado') {
      nuevoPedido.encomendista_id = this.encomendista_id;
      nuevoPedido.direccion_personalizada = this.direccion_personalizada;
      console.log('%c✅ MODO PERSONALIZADO', 'color: green; font-weight: bold');
      console.log('%c  📍 Dirección:', 'color: orange; font-weight: bold', this.direccion_personalizada);
      console.log('%c  👤 Encomendista:', 'color: purple; font-weight: bold', this.encomendista_id);
    }

    this.pedidos_a_crear.push(nuevoPedido);

    console.log('%c🔍 PEDIDO AGREGADO A LA LISTA', 'color: blue; font-weight: bold; font-size: 12px');
    console.log('%c📍 Dirección:', 'color: orange; font-weight: bold', nuevoPedido.direccion_personalizada || 'NO DEFINIDA');
    console.log('%c👤 Encomendista:', 'color: purple; font-weight: bold', nuevoPedido.encomendista_id || 'NO DEFINIDO');
    console.log('%c📋 Modo:', 'color: teal; font-weight: bold', nuevoPedido.modo);
    console.log('%cObjeto completo:', 'color: gray', nuevoPedido);

    // Guardar como favorito si está marcado
    if (this.guardarComoFavorito) {
      await this.guardarFavoritoActual(nuevoPedido);
    }

    this.mostrarMensaje('éxito', 'Pedido agregado a la lista');
    this.limpiarFormulario();
  }

  /**
   * Guarda la configuración actual como favorito
   */
  async guardarFavoritoActual(pedido: any) {
    try {
      if (!this.descripcionFavorito.trim()) {
        this.mostrarMensaje('error', 'Ingresa una descripción para el favorito');
        this.guardarComoFavorito = false;
        return;
      }

      // Si ya hay un favorito en uso, actualizar ese en lugar de crear uno nuevo
      if (this.favoritoEnUso && this.favoritoEnUso.id) {
        const actualizacion = {
          descripcion: this.descripcionFavorito,
          dia_maximo: this.dia_entrega
        };
        await this.favoritosPedidosService.actualizarFavorito(this.favoritoEnUso.id, actualizacion);
        console.log('%c⭐ FAVORITO ACTUALIZADO', 'color: gold; font-weight: bold', this.favoritoEnUso.id);
        this.mostrarMensaje('éxito', 'Favorito actualizado');
        this.guardarComoFavorito = false;
        this.descripcionFavorito = '';
        return;
      }

      const clienteSeleccionado = this.clientes.find(c => c.id === this.cliente_id);
      const encomendista = this.encomendistas.find(e => e.id === this.encomendista_id);
      let destino: DestinoEncomendista | undefined = undefined;
      if (this.modo === 'normal' && this.destino_id && encomendista) {
        destino = encomendista.destinos?.find((d: DestinoEncomendista) => d.nombre === this.destino_id);
      }

      const favorito: FavoritoPedido = {
        usuario_id: this.usuarioActualId || 'sin_usuario',
        cliente_id: this.cliente_id,
        cliente_nombre: clienteSeleccionado?.nombre || '',
        encomendista_id: this.encomendista_id,
        encomendista_nombre: encomendista?.nombre || '',
        modo: this.modo,
        descripcion: this.descripcionFavorito,
        destino_id: this.modo === 'normal' ? this.destino_id : undefined,
        destino_nombre: this.modo === 'normal' ? destino?.nombre || '' : undefined,
        direccion_personalizada: this.modo === 'personalizado' ? this.direccion_personalizada : undefined,
        dia_maximo: this.dia_entrega,
        activo: true,
        fecha_creacion: new Date()
      };

      await this.favoritosPedidosService.crearFavorito(favorito);
      console.log('%c⭐ FAVORITO GUARDADO', 'color: gold; font-weight: bold', favorito);
      this.mostrarMensaje('éxito', 'Favorito guardado');
      
      // Limpiar estado de favorito
      this.guardarComoFavorito = false;
      this.descripcionFavorito = '';
    } catch (error) {
      console.error('Error guardando favorito:', error);
      this.mostrarMensaje('error', 'Error al guardar el favorito');
    }
  }

  /**
   * Elimina un pedido de la lista
   */
  eliminarPedido(index: number) {
    this.pedidos_a_crear.splice(index, 1);
  }

  /**
   * Guarda todos los pedidos
   */
  async guardarPedidos() {
    if (this.pedidos_a_crear.length === 0) {
      this.mostrarMensaje('error', 'Agrega al menos un pedido');
      return;
    }

    // Iniciar loading
    this.guardando = true;
    this.mensaje = null;

    try {
      for (const pedido of this.pedidos_a_crear) {
        console.log('%c━━━━ GUARDANDO PEDIDO EN FIRESTORE ━━━━', 'color: red; font-weight: bold; font-size: 14px');
        console.log('%c💾 MODO:', 'color: magenta; font-weight: bold', pedido.modo);
        console.log('%c🏠 DIRECCIÓN PERSONALIZADA:', 'color: orange; font-weight: bold', pedido.direccion_personalizada || 'NO TIENE');
        console.log('%c👤 ENCOMENDISTA ID:', 'color: purple; font-weight: bold', pedido.encomendista_id || 'NO TIENE');
        console.log('%c📦 CANTIDAD PRENDAS:', 'color: blue; font-weight: bold', pedido.cantidad_prendas);
        console.log('%c🏪 TIENDA ID:', 'color: green; font-weight: bold', pedido.tienda_id);
        console.log('%c📅 DÍA ENTREGA:', 'color: cyan; font-weight: bold', pedido.dia_entrega);
        console.log('%cObjeto COMPLETO:', 'color: gray; font-style: italic', pedido);
        await this.pedidosService.crearPedido(pedido);
        console.log('%c✅ PEDIDO GUARDADO EXITOSAMENTE', 'color: green; font-weight: bold; font-size: 14px');
      }

      this.mostrarMensaje('éxito', `${this.pedidos_a_crear.length} pedido(s) guardado(s) exitosamente`);
      setTimeout(() => {
        this.guardando = false;
        this.limpiarTodo();
      }, 2000);
    } catch (error: any) {
      this.guardando = false;
      const errorMsg = error?.message || 'Error desconocido al guardar pedidos';
      this.mostrarMensaje('error', `Error: ${errorMsg}`);
      console.error('Error guardando pedidos:', error);
    }
  }

  /**
   * Limpia el formulario
   */
  limpiarFormulario() {
    this.cantidad_prendas = 0;
    this.costo_prendas = 0;
    this.monto_envio = 0;
    this.total_pedido = 0;
    this.dia_entrega = '';
    this.fechasDisponibles = [];
    this.fechaSeleccionada = '';
    this.dia_entrega_fecha = null;
    this.fechasOffset = 0;
    this.notas = '';
    this.destino_id = '';
    this.direccion_personalizada = '';
    this.hora_inicio_personalizada = '09:00';
    this.hora_fin_personalizada = '17:00';
    this.guardarComoFavorito = false;
    this.descripcionFavorito = '';
  }

  /**
   * Limpia TODO incluyendo cliente y tienda
   */
  limpiarTodo() {
    this.tienda_id = '';
    this.cliente_id = '';
    this.encomendista_id = '';
    this.modo = 'normal';
    this.productosSeleccionados = [];
    this.pedidos_a_crear = [];
    this.nombreClienteBusqueda = '';
    this.nombreEncomendistaBusqueda = '';
    this.clientesBuscados = [];
    this.encomendistaBuscadas = [];
    this.favoritosDelCliente = [];
    this.favoritoEnUso = null;
    this.mostrarModalFavoritos = false;
    this.limpiarFormulario();
  }

  /**
   * Calcula el total del pedido
   */
  calcularTotal(): void {
    this.total_pedido = this.costo_prendas + this.monto_envio;
  }

  /**
   * Limpia el cero inicial cuando el usuario hace focus en inputs de costos
   */
  limpiarCero(tipo: 'prendas' | 'envio'): void {
    if (tipo === 'prendas') {
      if (this.costo_prendas === 0) {
        this.costo_prendas = null as any;
      }
    } else if (tipo === 'envio') {
      if (this.monto_envio === 0) {
        this.monto_envio = null as any;
      }
    }
  }

  /**
   * Obtener nombre de la tienda por ID
   */
  getTiendaNombre(tienda_id: string): string {
    const tienda = this.tiendas.find(t => t.id === tienda_id);
    return tienda?.nombre_tienda || 'No especificada';
  }

  /**
   * Retorna el total formateado
   */
  obtenerTotalDisplay(): string {
    this.calcularTotal();
    return this.total_pedido.toFixed(2);
  }

  /**
   * Abre modal de selección de productos
   */
  abrirModalProductos() {
    // Recargar productos antes de abrir el modal para asegurar que están actualizados
    this.productosService.recargarProductos().then(() => {
      this.productos = this.productosService.obtenerProductosActuales();
      this.mostrarModalProductos = true;
    }).catch(error => {
      console.error('Error al cargar productos:', error);
      this.mostrarMensaje('error', 'Error al cargar productos');
    });
  }

  /**
   * Convierte URL de imagen a File para OCR
   */
  private async urlAFile(url: string, nombreArchivo: string = 'imagen.jpg'): Promise<File> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new File([blob], nombreArchivo, { type: blob.type });
    } catch (error) {
      console.error('Error al convertir URL a File:', error);
      throw error;
    }
  }

  /**
   * Cierra modal de selección de productos e intenta extraer precios de las imágenes
   */
  async cerrarModalProductos() {
    this.mostrarModalProductos = false;

    // Si no hay productos seleccionados, no hacer nada
    if (this.productosSeleccionados.length === 0) {
      return;
    }

    // Iniciar splash de extracción
    this.extrayendoPrecioImagen = true;

    try {
      let totalPrecioExtraido = 0;
      let productosConPrecio = 0;

      // Procesar cada producto seleccionado
      for (const productoId of this.productosSeleccionados) {
        const producto = this.productos.find(p => p.id === productoId);
        
        if (!producto || !producto.url_imagen) {
          continue;
        }

        try {
          // Convertir URL a File
          const archivoImagen = await this.urlAFile(producto.url_imagen, `${producto.codigo}.jpg`);

          // Usar OCR para extraer texto de la imagen
          const textoExtraido = await this.ocrService.extraerTexto(archivoImagen);
          console.log(`Texto extraído de ${producto.codigo}:`, textoExtraido);

          // Buscar números que parecen precios (con $ o dígitos con decimales)
          const precioMatch = textoExtraido.match(/\$?\s*(\d+[\.,]\d{2})/g);
          
          if (precioMatch && precioMatch.length > 0) {
            // Tomar el último precio encontrado (generalmente el más relevante)
            const precioStr = precioMatch[precioMatch.length - 1]
              .replace('$', '')
              .replace(',', '.')
              .trim();
            
            const precio = parseFloat(precioStr);
            
            if (!isNaN(precio)) {
              totalPrecioExtraido += precio;
              productosConPrecio++;
              console.log(`✅ Precio extraído de ${producto.codigo}: $${precio.toFixed(2)}`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ No se pudo procesar imagen de ${producto.codigo}:`, error);
        }
      }

      // Si se extrajeron precios, setear el costo de prendas
      if (productosConPrecio > 0) {
        this.costo_prendas = totalPrecioExtraido;
        this.calcularTotal();
        console.log(`✅ Total de precios extraído: $${totalPrecioExtraido.toFixed(2)} de ${productosConPrecio} producto(s)`);
        this.mostrarMensaje('éxito', `Precios extraídos: $${totalPrecioExtraido.toFixed(2)}`);
      } else {
        console.log('ℹ️ No se extrajeron precios de las imágenes');
      }
    } catch (error) {
      console.error('Error general en extracción de precios:', error);
    } finally {
      // Ocultar splash
      this.extrayendoPrecioImagen = false;
    }
  }

  /**
   * Abre el zoom de una imagen
   */
  abrirZoom(urlImagen: string) {
    this.imagenZoom = urlImagen;
    this.mostrarZoom = true;
  }

  /**
   * Cierra el zoom de imagen
   */
  cerrarZoom() {
    this.mostrarZoom = false;
    this.imagenZoom = '';
  }

  /**
   * Alterna la selección de un producto
   */
  async toggleProducto(productoId: string) {
    const index = this.productosSeleccionados.indexOf(productoId);
    if (index > -1) {
      // Ya está seleccionado, remover
      this.productosSeleccionados.splice(index, 1);
    } else {
      // No está seleccionado, agregar
      this.productosSeleccionados.push(productoId);
    }
    // Actualizar cantidad automáticamente
    this.cantidad_prendas = this.productosSeleccionados.length;
  }

  /**
   * Obtiene productos disponibles (no reservados)
   */
  obtenerProductosDisponibles(): Producto[] {
    return this.productos.filter(p => !p.reservado);
  }

  /**
   * Verifica si un producto está seleccionado
   */
  esProductoSeleccionado(productoId: string): boolean {
    return this.productosSeleccionados.includes(productoId);
  }

  /**
   * Obtiene los productos seleccionados
   */
  obtenerProductosSeleccionados(): Producto[] {
    return this.productos.filter(p => this.productosSeleccionados.includes(p.id));
  }

  /**
   * Obtiene el nombre del cliente
   */
  getNombreCliente(): string {
    const cliente = this.clientes.find(c => c.id === this.cliente_id);
    return cliente?.nombre || 'Sin cliente';
  }

  /**
   * Obtiene el nombre del destino
   */
  getNombreDestino(): string {
    return this.destino_id;
  }

  /**
   * Obtiene el nombre del encomendista
   */
  getNombreEncomendista(): string {
    const encomendista = this.encomendistas.find(e => e.id === this.encomendista_id);
    return encomendista?.nombre || 'Sin encomendista';
  }

  /**
   * Obtiene el nombre de una encomendista por su ID (para uso en listas/iteraciones)
   */
  obtenerNombreEncomendista(id: string): string {
    const encomendista = this.encomendistas.find(e => e.id === id);
    return encomendista?.nombre || 'Desconocida';
  }

  /**
   * Muestra mensaje temporal
   */
  mostrarMensaje(tipo: 'éxito' | 'error', texto: string) {
    this.mensaje = { tipo, texto };
    setTimeout(() => (this.mensaje = null), 4000);
  }

  /**
   * Genera un código único de pedido con formato: YYYYMMDD###
   * Ejemplo: 20250106001, 20250106002, etc.
   * Se reinicia cada día
   */
  async generarCodigoPedido(): Promise<string> {
    // Obtener iniciales de la página (nombre_pagina de la tienda)
    const tienda = this.tiendas.find(t => t.id === this.tienda_id);
    const nombrePagina = tienda?.nombre_pagina || 'XX';
    const iniciales = nombrePagina
      .split(' ')
      .map(palabra => palabra[0])
      .join('')
      .toUpperCase()
      .substring(0, 2); // Tomar máximo 2 caracteres

    // Obtener fecha actual en formato YYYYMMDD
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const prefijo = `${iniciales}${año}${mes}${dia}`;

    // Buscar todos los pedidos de hoy
    try {
      const pedidosHoy = await this.pedidosService.obtenerPedidosDelDia(hoy);
      
      // Contar cuántos pedidos ya tienen el prefijo de hoy (que incluye iniciales)
      const codigosHoy = pedidosHoy
        .filter(p => p.codigo_pedido?.startsWith(prefijo))
        .map(p => parseInt(p.codigo_pedido?.substring(10) || '0', 10))
        .sort((a, b) => b - a);
      
      // El siguiente número es el máximo + 1, o 1 si no hay
      const proximoNumero = (codigosHoy[0] || 0) + 1;
      const codigo = `${prefijo}${String(proximoNumero).padStart(3, '0')}`;
      
      console.log(`✅ Código generado: ${codigo}`);
      return codigo;
    } catch (error) {
      console.error('❌ Error generando código:', error);
      // Fallback: retornar con número 001
      return `${prefijo}001`;
    }
  }

  /**
   * Abre modal para crear nueva encomienda
   */
  abrirModalNuevaEncomienda() {
    alert('Usa el menú de Encomendistas para crear una nueva encomienda');
  }

  /**
   * Abre modal para agregar destino a encomendista seleccionada
   */
  abrirModalAgregarDestinoAEncomienda() {
    if (!this.encomendista_id) {
      this.mostrarMensaje('error', 'Selecciona una encomienda primero');
      return;
    }
    this.mostrarModalAgregarDestino = true;
    this.nuevoDestinoParaEncomienda = { nombre: '', local: '' };
  }

  /**
   * Cierra modal de agregar destino
   */
  cerrarModalAgregarDestino() {
    this.mostrarModalAgregarDestino = false;
  }

  /**
   * Guarda el nuevo destino a la encomienda seleccionada
   */
  async guardarNuevoDestinoAEncomienda() {
    if (!this.nuevoDestinoParaEncomienda.nombre.trim()) {
      this.mostrarMensaje('error', 'Ingresa el nombre del destino');
      return;
    }

    const encomendista = this.encomendistas.find(e => e.id === this.encomendista_id);
    if (!encomendista) {
      this.mostrarMensaje('error', 'Encomienda no encontrada');
      return;
    }

    try {
      // Crear el nuevo destino
      const nuevoDestino: DestinoEncomendista = {
        nombre: this.nuevoDestinoParaEncomienda.nombre,
        local: this.nuevoDestinoParaEncomienda.local || '',
        horarios: []
      };

      // Guardar a Firestore usando el servicio
      await this.encomendistasService.agregarDestinoEncomendista(this.encomendista_id, nuevoDestino);
      
      // Recargar encomendistas después de guardar
      await this.cargarEncomendistas();

      // Actualizar destinos disponibles
      this.seleccionarEncomendista();

      this.mostrarMensaje('éxito', '✅ Destino guardado exitosamente en Firestore');
      this.cerrarModalAgregarDestino();
      
      // Limpiar inputs
      this.nuevoDestinoParaEncomienda = { nombre: '', local: '' };
    } catch (error) {
      console.error('Error guardando destino:', error);
      this.mostrarMensaje('error', 'Error al guardar el destino: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Abre modal para agregar horario a destino seleccionado
   */
  abrirModalAgregarHorarioADestino() {
    if (!this.destino_id || !this.encomendista_id) {
      this.mostrarMensaje('error', 'Selecciona una encomienda y destino primero');
      return;
    }

    const destino = this.destinosDisponibles.find(d => d.nombre === this.destino_id);
    if (!destino) {
      this.mostrarMensaje('error', 'Destino no encontrado');
      return;
    }

    this.mostrarModalAgregarHorario = true;
    this.diasSeleccionadosParaHorario = [];
    this.nuevoHorarioParaDestino = {
      dias: [],
      hora_inicio: '09:00',
      hora_fin: '17:00'
    };
  }

  /**
   * Cierra modal de agregar horario
   */
  cerrarModalAgregarHorario() {
    this.mostrarModalAgregarHorario = false;
  }

  /**
   * Alterna día seleccionado para horario
   */
  toggleDiaHorario(dia: string) {
    const index = this.diasSeleccionadosParaHorario.indexOf(dia);
    if (index > -1) {
      this.diasSeleccionadosParaHorario.splice(index, 1);
    } else {
      this.diasSeleccionadosParaHorario.push(dia);
    }
  }

  /**
   * Verifica si un día está seleccionado
   */
  isDiaSeleccionado(dia: string): boolean {
    return this.diasSeleccionadosParaHorario.includes(dia);
  }

  /**
   * Guarda el nuevo horario al destino seleccionado
   */
  async guardarNuevoHorarioADestino() {
    if (this.diasSeleccionadosParaHorario.length === 0) {
      this.mostrarMensaje('error', 'Selecciona al menos un día');
      return;
    }

    try {
      const encomendista = this.encomendistas.find(e => e.id === this.encomendista_id);
      if (!encomendista || !encomendista.destinos) {
        this.mostrarMensaje('error', 'Encomienda o destinos no encontrados');
        return;
      }

      const destino = encomendista.destinos.find(d => d.nombre === this.destino_id);
      if (!destino) {
        this.mostrarMensaje('error', 'Destino no encontrado');
        return;
      }

      // Agregar el nuevo horario
      if (!destino.horarios) {
        destino.horarios = [];
      }

      destino.horarios.push({
        dias: this.diasSeleccionadosParaHorario,
        hora_inicio: this.nuevoHorarioParaDestino.hora_inicio,
        hora_fin: this.nuevoHorarioParaDestino.hora_fin
      });

      // Guardar a Firestore actualizando toda la encomienda
      await this.encomendistasService.actualizarEncomendista(encomendista);

      // Recargar encomendistas después de guardar
      await this.cargarEncomendistas();

      // Recalcular días disponibles
      this.seleccionarDestino();

      this.mostrarMensaje('éxito', '✅ Horario guardado exitosamente en Firestore');
      this.cerrarModalAgregarHorario();

      // Limpiar inputs
      this.nuevoHorarioParaDestino = {
        dias: [],
        hora_inicio: '09:00',
        hora_fin: '17:00'
      };
      this.diasSeleccionadosParaHorario = [];
    } catch (error) {
      console.error('Error guardando horario:', error);
      this.mostrarMensaje('error', 'Error al guardar el horario: ' + (error instanceof Error ? error.message : String(error)));
    }
  }
}
