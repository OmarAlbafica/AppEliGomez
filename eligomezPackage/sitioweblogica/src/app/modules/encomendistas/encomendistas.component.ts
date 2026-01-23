import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EncomendistasService, Encomendista, DestinoEncomendista } from '../../service/encomendistas/encomendistas.service';
import { OcrService, TextoExtraido } from '../../service/ocr/ocr.service';
import { ModalConfirmacionService } from '../../service/modal-confirmacion/modal-confirmacion.service';
import { ResponsiveService } from '../../service/responsive/responsive.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-encomendistas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './encomendistas.component.html',
  styleUrls: ['./encomendistas.component.css']
})
export class EncomendistasComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  encomendistas: Encomendista[] = [];
  encomendistasLista: Encomendista[] = [];
  busqueda: string = '';
  nombreBusqueda: string = '';
  filtroNombreEncomendista: string = '';
  
  // Ordenamiento
  ordenarPor = 'nombre';
  ordenAscendente = true;
  
  // Controles de formulario
  mostrarFormulario = false;
  mostrarFormularioDestino = false;
  
  // Modal crear/editar encomendista
  mostrarModalEncomendista = false;
  editandoEncomendista: Encomendista | null = null;
  nuevoEncomendista = {
    nombre: '',
    telefono: '',
    local: ''
  };

  // Modal agregar destino
  mostrarModalDestino = false;
  encomendistaSelecionado: Encomendista | null = null;
  nuevoDestino = {
    nombre: '',
    horarios: [] as Array<{ dias: string[], hora_inicio: string, hora_fin: string }>,
    local: ''
  };
  diasDisponibles = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  horarioActual = { // Para agregar horarios nuevos
    diasSeleccionados: [] as string[],
    hora_inicio: '09:00',
    hora_fin: '17:00',
    hora_inicio_12h_display: '9:00 AM',
    hora_fin_12h_display: '5:00 PM'
  };
  
  // OCR para destinos
  archivosDestino: File[] = [];
  procesandoOCR = false;
  progresoOCR = 0;
  
  // Modal Carga Masiva (separado)
  mostrarModalCargaMasiva = false;
  
  // Destinos extraídos de OCR (editable)
  destinosExtraidos: Array<{
    nombre: string;
    dia: string;
    hora_inicio: string;
    hora_fin: string;
    local: string;
    seleccionado?: boolean;
  }> = [];
  mostrarModalDestinosExtraidos = false;
  
  // Mensajes
  mensaje: { tipo: 'éxito' | 'error'; texto: string } | null = null;

  // Carga masiva
  mostrarCargaMasiva = false;

  // Modal editar destino existente
  mostrarModalEditarDestino = false;
  destinoEditando: DestinoEncomendista | null = null;
  destinoEditandoIndex: number = -1;
  encomendistaPropietarioDestino: Encomendista | null = null;
  destinoEditandoCopy: any = {};
  horarioEditandoArray: Array<{ dias: string[], hora_inicio: string, hora_fin: string }> = [];
  horarioEditandoNuevo = { diasSeleccionados: [] as string[], hora_inicio: '09:00', hora_fin: '17:00' };

  // Ver destinos
  mostrarDestinos = false;
  encomendistaMostrandoDestinos: Encomendista | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private encomendistasService: EncomendistasService,
    private ocrService: OcrService,
    private modalService: ModalConfirmacionService,
    private responsiveService: ResponsiveService
  ) {}

  ngOnInit() {
    this.isMobile = this.responsiveService.getIsMobile();
    this.responsiveService.isMobile$.subscribe(val => this.isMobile = val);
    this.cargarEncomendistas();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Normaliza texto removiendo acentos para búsqueda insensible a diacríticos
   */
  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Filtra encomendistas por búsqueda
   */
  filtrarEncomendistas() {
    if (!this.busqueda.trim()) {
      this.encomendistasLista = [...this.encomendistas];
      return;
    }

    const busquedaNormalizada = this.normalizarTexto(this.busqueda);
    this.encomendistasLista = this.encomendistas.filter(enc => {
      const nombreNormalizado = this.normalizarTexto(enc.nombre);
      const telefonoNormalizado = this.normalizarTexto(enc.telefono || '');
      
      return (
        nombreNormalizado.includes(busquedaNormalizada) ||
        telefonoNormalizado.includes(busquedaNormalizada)
      );
    });
  }

  /**
   * Carga todos los encomendistas desde Firestore
   */
  cargarEncomendistas() {
    const sub = this.encomendistasService.cargarEncomendistas().subscribe(
      (encomendistas: Encomendista[]) => {
        this.encomendistas = encomendistas;
        this.filtrarEncomendistas();
      }
    );
    this.subscriptions.push(sub);
  }

  /**
   * Abre el modal para crear nuevo encomendista
   */
  abrirModalCrearEncomendista() {
    this.editandoEncomendista = null;
    this.nuevoEncomendista = { nombre: '', telefono: '', local: '' };
    this.mostrarModalEncomendista = true;
  }

  /**
   * Muestra los destinos de un encomendista
   */
  verDestinos(encomendista: Encomendista) {
    this.encomendistaMostrandoDestinos = encomendista;
    this.mostrarDestinos = true;
  }

  /**
   * Cierra la vista de destinos
   */
  cerrarDestinos() {
    this.mostrarDestinos = false;
    this.mostrarModalDestino = false;
    this.encomendistaMostrandoDestinos = null;
    this.encomendistaSelecionado = null;
  }

  /**
   * Abre el modal para editar un encomendista
   */
  editEncomendista(encomendista: Encomendista) {
    this.editandoEncomendista = encomendista;
    this.nuevoEncomendista = {
      nombre: encomendista.nombre,
      telefono: encomendista.telefono || '',
      local: encomendista.local || ''
    };
    this.mostrarModalEncomendista = true;
  }

  /**
   * Guarda o actualiza un encomendista
   */
  guardarEncomendista() {
    if (!this.nuevoEncomendista.nombre.trim()) {
      this.mostrarMensaje('error', 'El nombre es obligatorio');
      return;
    }

    if (this.editandoEncomendista) {
      // Actualizar existente
      const updated: Encomendista = {
        ...this.editandoEncomendista,
        nombre: this.nuevoEncomendista.nombre,
        telefono: this.nuevoEncomendista.telefono || undefined,
        local: this.nuevoEncomendista.local || undefined
      };
      
      this.encomendistasService.actualizarEncomendista(updated).then(() => {
        this.mostrarMensaje('éxito', 'Encomendista actualizado');
        this.mostrarModalEncomendista = false;
        this.editandoEncomendista = null;
        this.cargarEncomendistas();
      }).catch(error => {
        this.mostrarMensaje('error', 'Error actualizando encomendista');
      });
    } else {
      // Crear nuevo
      this.encomendistasService.crearEncomendista(
        this.nuevoEncomendista.nombre,
        [],
        this.nuevoEncomendista.telefono || undefined,
        this.nuevoEncomendista.local || undefined
      ).then(id => {
        this.mostrarMensaje('éxito', 'Encomendista creado exitosamente');
        this.mostrarModalEncomendista = false;
        this.cargarEncomendistas();
      }).catch(error => {
        this.mostrarMensaje('error', 'Error creando encomendista');
      });
    }
  }

  /**
   * Elimina un encomendista
   */
  async deleteEncomendista(encomendista: Encomendista) {
    const confirmado = await this.modalService.confirmar({
      titulo: '⚠️ Eliminar Encomendista',
      mensaje: `¿Estás seguro de que deseas eliminar a ${encomendista.nombre}? Esta acción no se puede deshacer.`,
      textoBtnSi: 'Sí, eliminar',
      textoBtnNo: 'No, cancelar'
    });

    if (!confirmado) return;

    this.encomendistasService.eliminarEncomendista(encomendista.id).then(() => {
      this.mostrarMensaje('éxito', 'Encomendista eliminado');
      this.cargarEncomendistas();
    }).catch(error => {
      this.mostrarMensaje('error', 'Error eliminando encomendista');
    });
  }

  /**   * Abre el modal de carga masiva (solo imágenes + OCR)
   */
  abrirModalCargaMasiva(encomendista: Encomendista) {
    this.encomendistaSelecionado = encomendista;
    this.archivosDestino = [];
    this.destinosExtraidos = [];
    this.mostrarModalCargaMasiva = true;
  }

  /**
   * Cierra el modal de carga masiva
   */
  cerrarModalCargaMasiva() {
    this.mostrarModalCargaMasiva = false;
    this.encomendistaSelecionado = null;
    this.archivosDestino = [];
    this.destinosExtraidos = [];
  }

  /**   * Abre el modal para agregar un destino a un encomendista
   */
  abrirModalAgregarDestino(encomendista: Encomendista) {
    this.encomendistaSelecionado = encomendista;
    this.nuevoDestino = { nombre: '', horarios: [], local: '' };
    this.horarioActual = { diasSeleccionados: [], hora_inicio: '09:00', hora_fin: '17:00', hora_inicio_12h_display: '9:00 AM', hora_fin_12h_display: '5:00 PM' };
    this.archivosDestino = [];
    this.mostrarModalDestino = true;
  }

  /**
   * Selecciona archivos para extraer destino con OCR
   */
  seleccionarArchivosDestino(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.archivosDestino = Array.from(input.files);
    }
  }

  /**
   * Selecciona archivos para carga masiva
   */
  seleccionarArchivosCargaMasiva(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.archivosDestino = Array.from(input.files);
    }
  }

  /**
   * Procesa las imágenes con OCR para extraer información de destinos
   */
  async procesarOCRDestino() {
    if (this.archivosDestino.length === 0) {
      this.mostrarMensaje('error', 'Selecciona al menos una imagen');
      return;
    }

    this.procesandoOCR = true;
    this.progresoOCR = 0;
    this.destinosExtraidos = [];

    try {
      console.log('Iniciando procesamiento de', this.archivosDestino.length, 'imagen(es)');
      
      for (let i = 0; i < this.archivosDestino.length; i++) {
        try {
          const archivo = this.archivosDestino[i];
          console.log(`Procesando imagen ${i + 1}/${this.archivosDestino.length}: ${archivo.name}`);
          
          const texto = await this.ocrService.extraerTexto(archivo);
          console.log('Texto OCR obtenido, extrayendo destinos...');
          
          // Extraer destinos del texto
          const destinos = this.extraerDestinosDelTexto(texto);
          console.log('Destinos extraídos:', destinos.length);
          
          if (destinos.length > 0) {
            this.destinosExtraidos.push(...destinos);
          }
          
          this.progresoOCR = Math.round(((i + 1) / this.archivosDestino.length) * 100);
        } catch (error) {
          console.error(`Error procesando imagen ${i + 1}:`, error);
          this.mostrarMensaje('error', `Error procesando imagen ${i + 1}: ${error}`);
        }
      }
      
      this.procesandoOCR = false;
      
      // Eliminar duplicados
      const destinosSinDuplicados = this.destinosExtraidos.filter((d, i, arr) => 
        arr.findIndex(x => x.nombre.toLowerCase() === d.nombre.toLowerCase()) === i
      );
      this.destinosExtraidos = destinosSinDuplicados;
      
      if (this.destinosExtraidos.length > 0) {
        console.log('Total destinos extraídos:', this.destinosExtraidos.length);
        this.mostrarModalDestinosExtraidos = true;
      } else {
        this.mostrarMensaje('error', 'No se pudieron extraer destinos de las imágenes. Intenta con imágenes de mejor calidad.');
      }
    } catch (error) {
      this.procesandoOCR = false;
      console.error('Error general en OCR:', error);
      this.mostrarMensaje('error', 'Error procesando imágenes: ' + error);
    }
  }

  /**
   * Extrae destinos del texto OCR - Detecta tablas y formato libre
   */
  private extraerDestinosDelTexto(texto: string): any[] {
    try {
      const destinos: any[] = [];
      
      if (!texto || texto.trim().length === 0) {
        console.log('Texto vacío');
        return [];
      }

      const textoOriginal = texto.trim();
      // Limpiar líneas: filtrar ruido OCR
      let lineas = textoOriginal.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .filter(l => this.esLineaValida(l)); // Filtro de ruido

      console.log('=== ANÁLISIS OCR ===');
      console.log('Total líneas (después filtro):', lineas.length);
      console.log('Líneas válidas:');
      lineas.slice(0, 20).forEach((l, i) => console.log(`${i + 1}: ${l}`));

      // PASO 1: Intentar detectar tabla (líneas con patrones repetitivos)
      const destinosTabla = this.extraerDestinosDeTabla(lineas);
      
      if (destinosTabla.length > 0) {
        console.log('✓ Se detectó tabla con', destinosTabla.length, 'destinos');
        return destinosTabla;
      }

      console.log('No se detectó tabla, intentando parseo libre...');

      // PASO 2: Parseo libre para estructura no tabular
      const destinosLibres = this.extraerDestinosFormato(lineas);
      
      return destinosLibres;
    } catch (error) {
      console.error('Error extrayendo destinos:', error);
      return [];
    }
  }

  /**
   * Valida si una línea es texto real o ruido OCR
   */
  private esLineaValida(linea: string): boolean {
    // Descartar líneas que sean solo caracteres especiales
    if (/^[|→\-–—=*·]+$/.test(linea)) return false;
    
    // Descartar líneas muy cortas que sean probablemente ruido
    if (linea.length < 3) return false;
    
    // Descartar líneas que sean principalmente caracteres especiales (más de 50%)
    const caracteresEspeciales = (linea.match(/[^a-záéíóúñ\d\s().\-]/gi) || []).length;
    if (caracteresEspeciales / linea.length > 0.5) return false;
    
    // Descartar líneas que NO tengan al menos una letra o número
    if (!/[a-záéíóúñ\d]/i.test(linea)) return false;
    
    // Descartar palabras comunes no relevantes
    const palabrasIgnorar = ['imagen', 'tipo', 'ilustrativa', 'publicamos', 'llegadas', 'facebook',
      'por favor', 'llevar', 'foto', 'del paquete', 'no auto', 'se atiende', 'búscar'];
    if (palabrasIgnorar.some(p => linea.toLowerCase().includes(p))) return false;
    
    return true;
  }

  /**
   * Extrae destinos de formato tabular
   */
  private extraerDestinosDeTabla(lineas: string[]): any[] {
    const destinos: any[] = [];
    const patronDia = /\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|lunes\s+a\s+(viernes|sábado|sabado)|martes\s+y\s+viernes|miércoles\s+y\s+domingo|lunes\s+y\s+(martes|jueves|viernes))\b/i;
    const patronHora = /(\d{1,2}):(\d{2})\s*(am|pm|a\.m|p\.m)?/i;

    // Saltar encabezados de tabla
    let inicioTabla = 0;
    for (let i = 0; i < lineas.length; i++) {
      if (/destino|día|horario|lugar|entrega/i.test(lineas[i])) {
        inicioTabla = i + 1;
        break;
      }
    }

    console.log('Inicio tabla detectado en línea:', inicioTabla);

    // Procesar filas de tabla
    for (let i = inicioTabla; i < lineas.length; i++) {
      const linea = lineas[i];
      
      // Saltar líneas separadoras
      if (/^[\s\-|]+$/.test(linea) || linea.length < 5) continue;
      
      // IMPORTANTE: Solo procesar si tiene un día (es una fila válida)
      const matchDia = linea.match(patronDia);
      if (matchDia) {
        const destino = this.parsearFilaTabla(linea, patronDia, patronHora);
        
        // Validar que el nombre sea real (no ruido)
        if (destino && destino.nombre && 
            destino.nombre.length > 2 && 
            /[a-záéíóúñ]/i.test(destino.nombre)) {
          
          console.log('✓ Destino válido encontrado:', destino);
          destinos.push(destino);
        } else {
          console.log('✗ Destino rechazado (ruido):', destino);
        }
      }
    }

    // Eliminar duplicados
    return destinos.filter((d, i, arr) => 
      arr.findIndex(x => x.nombre.toLowerCase() === d.nombre.toLowerCase()) === i
    );
  }

  /**
   * Parsea una fila individual de tabla
   */
  private parsearFilaTabla(linea: string, patronDia: RegExp, patronHora: RegExp): any {
    const destino: any = {
      nombre: '',
      dia: 'Lunes',
      hora_inicio: '08:00',
      hora_fin: '18:00',
      local: '',
      seleccionado: true
    };

    // Buscar día
    const matchDia = linea.match(patronDia);
    if (matchDia) {
      let dia = matchDia[0].toLowerCase();
      // Normalizar día
      if (dia.includes('lunes') && dia.includes('viernes')) dia = 'Lunes a Viernes';
      else if (dia.includes('lunes') && dia.includes('sábado')) dia = 'Lunes a Sábado';
      else if (dia.includes('martes') && dia.includes('viernes')) dia = 'Martes y Viernes';
      else if (dia.includes('miércoles') && dia.includes('domingo')) dia = 'Miércoles y Domingo';
      else if (dia.includes('lunes') && (dia.includes('jueves') || dia.includes('martes'))) dia = 'Lunes y Jueves';
      else dia = dia.charAt(0).toUpperCase() + dia.slice(1);
      
      destino.dia = dia;
    }

    // Buscar horas
    const horasMatches = linea.match(new RegExp(patronHora.source, 'gi'));
    if (horasMatches && horasMatches.length >= 1) {
      destino.hora_inicio = horasMatches[0];
      if (horasMatches.length >= 2) {
        destino.hora_fin = horasMatches[1];
      }
    }

    // Extraer nombre: TODO lo antes del día, limpio de caracteres especiales
    const posicionDia = linea.toLowerCase().search(patronDia.source.toLowerCase());
    if (posicionDia > 0) {
      let nombre = linea.substring(0, posicionDia).trim();
      
      // Limpiar AGRESIVAMENTE caracteres especiales y símbolos extraños
      nombre = nombre
        .replace(/[|→\-–—=/()\\*·]+/g, ' ')  // Reemplazar símbolos con espacio
        .replace(/\d+/g, '')                   // Eliminar números
        .replace(/\s+/g, ' ')                  // Normalizar espacios
        .trim();
      
      // Solo mantener si tiene letras válidas
      if (nombre.length > 2 && /[a-záéíóúñ]/i.test(nombre)) {
        destino.nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
      }
    }

    // Extraer local: después del horario
    const posicionHora = linea.search(patronHora);
    if (posicionHora > -1) {
      let local = linea.substring(posicionHora);
      // Buscar palabras clave de ubicación
      const palabrasUbicacion = ['parque', 'calle', 'avenida', 'iglesia', 'plaza', 'frente', 'esquina', 'local'];
      
      for (const palabra of palabrasUbicacion) {
        const idx = local.toLowerCase().indexOf(palabra);
        if (idx >= 0) {
          local = local.substring(idx);
          break;
        }
      }

      if (local.length > 3 && local.length < 150) {
        destino.local = local.replace(/[|→]/g, '').trim();
      }
    }

    return destino;
  }

  /**
   * Extrae destinos en formato libre (no tabular)
   */
  private extraerDestinosFormato(lineas: string[]): any[] {
    const destinos: any[] = [];
    const patronDia = /\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|lunes\s+a\s+(viernes|sábado|sabado)|martes\s+y\s+viernes|miércoles\s+y\s+domingo)\b/i;
    const patronHora = /(\d{1,2}):(\d{2})\s*(am|pm|a\.m|p\.m)?/i;
    const patronUbicacion = /\b(parque|calle|avenida|iglesia|plaza|local|dirección|frente|esquina|al lado|sobre|entre)\b/i;

    let destinoActual: any = null;

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      const lineaLower = linea.toLowerCase();

      if (linea.length < 2) continue;

      // Detectar día
      const matchDia = linea.match(patronDia);
      if (matchDia) {
        if (destinoActual && destinoActual.nombre) {
          destinos.push(destinoActual);
        }

        let dia = matchDia[0].toLowerCase();
        if (dia.includes('lunes') && dia.includes('viernes')) dia = 'Lunes a Viernes';
        else if (dia.includes('lunes') && dia.includes('sábado')) dia = 'Lunes a Sábado';
        else dia = dia.charAt(0).toUpperCase() + dia.slice(1);

        destinoActual = {
          nombre: '',
          dia: dia,
          hora_inicio: '08:00',
          hora_fin: '18:00',
          local: '',
          seleccionado: true
        };

        // Extraer horas de la misma línea
        const horasMatches = linea.match(new RegExp(patronHora.source, 'gi'));
        if (horasMatches && horasMatches.length >= 1) {
          destinoActual.hora_inicio = horasMatches[0];
          if (horasMatches.length >= 2) {
            destinoActual.hora_fin = horasMatches[1];
          }
        }
      } 
      // Detectar ubicación
      else if (patronUbicacion.test(linea)) {
        if (destinoActual) {
          destinoActual.local = linea.charAt(0).toUpperCase() + linea.slice(1);
        }
      }
      // Detectar nombre (línea que parece destino)
      else if (linea.length > 3 && linea.length < 60) {
        const palabrasExcluidas = ['desde', 'hasta', 'se atiende', 'buscar', 'personas', 'entregando',
          'paquetes', 'uniforme', 'camiseta', 'no auto', 'contar', 'cambio', 'antes', 'retirarse'];
        
        const esExcluida = palabrasExcluidas.some(p => lineaLower.includes(p));
        
        if (!esExcluida) {
          if (destinoActual && !destinoActual.nombre) {
            destinoActual.nombre = linea.charAt(0).toUpperCase() + linea.slice(1);
          } else if (destinoActual && destinoActual.nombre) {
            destinos.push(destinoActual);
            destinoActual = {
              nombre: linea.charAt(0).toUpperCase() + linea.slice(1),
              dia: 'Lunes',
              hora_inicio: '08:00',
              hora_fin: '18:00',
              local: '',
              seleccionado: true
            };
          }
        }
      }
    }

    if (destinoActual && destinoActual.nombre) {
      destinos.push(destinoActual);
    }

    return destinos.filter((d, i, arr) => 
      arr.findIndex(x => x.nombre.toLowerCase() === d.nombre.toLowerCase()) === i
    );
  }

  /**
   * Agrega los destinos seleccionados del OCR
   */
  agregarDestinosExtraidos() {
    const destinosSeleccionados = this.destinosExtraidos.filter(d => d.seleccionado);
    
    if (destinosSeleccionados.length === 0) {
      this.mostrarMensaje('error', 'Selecciona al menos un destino');
      return;
    }

    if (!this.encomendistaSelecionado) {
      this.mostrarMensaje('error', 'No hay encomendista seleccionado');
      return;
    }

    const agregarTodos = async () => {
      let exitosos = 0;
      for (const destino of destinosSeleccionados) {
        try {
          await this.encomendistasService.agregarDestinoEncomendista(
            this.encomendistaSelecionado!.id,
            {
              nombre: destino.nombre,
              dia: destino.dia,
              hora_inicio: destino.hora_inicio,
              hora_fin: destino.hora_fin,
              local: destino.local || undefined
            }
          );
          exitosos++;
        } catch (error) {
          console.error('Error agregando destino:', error);
        }
      }
      
      this.mostrarMensaje('éxito', `${exitosos} destino(s) agregado(s) exitosamente`);
      this.mostrarModalDestinosExtraidos = false;
      this.destinosExtraidos = [];
      this.archivosDestino = [];
      this.cargarEncomendistas();
    };

    agregarTodos();
  }

  /**
   * Cierra modal de destinos extraídos
   */
  cerrarModalDestinosExtraidos() {
    this.mostrarModalDestinosExtraidos = false;
    this.destinosExtraidos = [];
    this.archivosDestino = [];
    this.procesandoOCR = false;
    this.progresoOCR = 0;
  }

  /**
   * Selecciona/deselecciona todos los destinos
   */
  toggleTodosDestinos(seleccionar: boolean) {
    this.destinosExtraidos.forEach(d => d.seleccionado = seleccionar);
  }

  /**
   * Verifica si todos los destinos están seleccionados
   */
  todosSeleccionados(): boolean {
    return this.destinosExtraidos.length > 0 && this.destinosExtraidos.every(d => d.seleccionado);
  }

  /**
   * Cuenta cuántos destinos están seleccionados
   */
  contarSeleccionados(): number {
    return this.destinosExtraidos.filter(d => d.seleccionado).length;
  }

  /**
   * Agrega un nuevo destino al encomendista (manual, sin OCR)
   * Ahora soporta múltiples horarios
   */
  agregarDestino() {
    if (!this.encomendistaSelecionado) return;
    if (!this.nuevoDestino.nombre.trim()) {
      this.mostrarMensaje('error', 'El nombre del destino es obligatorio');
      return;
    }
    
    if (this.nuevoDestino.horarios.length === 0) {
      this.mostrarMensaje('error', 'Agrega al menos un horario');
      return;
    }

    const destino: DestinoEncomendista = {
      nombre: this.nuevoDestino.nombre.trim(),
      horarios: this.nuevoDestino.horarios,
      local: this.nuevoDestino.local?.trim() ? this.nuevoDestino.local.trim() : null
    };

    this.encomendistasService.agregarDestinoEncomendista(
      this.encomendistaSelecionado.id,
      destino
    ).then(() => {
      this.mostrarMensaje('éxito', 'Destino agregado con múltiples horarios');
      this.mostrarModalDestino = false;
      this.nuevoDestino = { nombre: '', horarios: [], local: '' };
      this.horarioActual = { diasSeleccionados: [], hora_inicio: '09:00', hora_fin: '17:00', hora_inicio_12h_display: '9:00 AM', hora_fin_12h_display: '5:00 PM' };
      this.cargarEncomendistas();
    }).catch((error: any) => {
      console.error('Error:', error);
      this.mostrarMensaje('error', 'Error agregando destino: ' + error);
    });
  }

  /**
   * Toggle para seleccionar/deseleccionar un día al agregar horario
   */
  toggleDia(dia: string) {
    const index = this.horarioActual.diasSeleccionados.indexOf(dia);
    if (index >= 0) {
      this.horarioActual.diasSeleccionados.splice(index, 1);
    } else {
      this.horarioActual.diasSeleccionados.push(dia);
    }
  }

  /**
   * Verifica si un día está seleccionado
   */
  diaMarcado(dia: string): boolean {
    return this.horarioActual.diasSeleccionados.includes(dia);
  }

  /**
   * Agrega un horario al destino
   */
  agregarHorario() {
    if (this.horarioActual.diasSeleccionados.length === 0) {
      this.mostrarMensaje('error', 'Selecciona al menos un día');
      return;
    }

    if (!this.horarioActual.hora_inicio || !this.horarioActual.hora_fin) {
      this.mostrarMensaje('error', 'Completa los horarios (inicio y fin)');
      return;
    }

    this.nuevoDestino.horarios.push({
      dias: [...this.horarioActual.diasSeleccionados],
      hora_inicio: this.horarioActual.hora_inicio,
      hora_fin: this.horarioActual.hora_fin
    });

    // Limpiar para agregar otro horario
    this.horarioActual = { diasSeleccionados: [], hora_inicio: '09:00', hora_fin: '17:00', hora_inicio_12h_display: '9:00 AM', hora_fin_12h_display: '5:00 PM' };
    this.mostrarMensaje('éxito', 'Horario agregado');
  }

  /**
   * Convierte formato 12h a 24h
   */
  actualizarHora24h(tipo: 'inicio' | 'fin') {
    const display = tipo === 'inicio' ? this.horarioActual.hora_inicio_12h_display : this.horarioActual.hora_fin_12h_display;
    const hora24h = this.parsearFormatoHora12h(display);
    
    if (tipo === 'inicio') {
      this.horarioActual.hora_inicio = hora24h;
    } else {
      this.horarioActual.hora_fin = hora24h;
    }
  }

  /**
   * Parsea formato "9:00 AM" o "5:00 PM" a "09:00" o "17:00"
   */
  private parsearFormatoHora12h(entrada: string): string {
    if (!entrada) return '09:00';
    
    const regex = /(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
    const match = entrada.match(regex);
    
    if (!match) return '09:00';
    
    let hora = parseInt(match[1], 10);
    const minutos = match[2] ? match[2] : '00';
    const periodo = match[3].toLowerCase();
    
    // Convertir a 24h
    if (periodo === 'pm' && hora !== 12) {
      hora += 12;
    } else if (periodo === 'am' && hora === 12) {
      hora = 0;
    }
    
    return `${hora.toString().padStart(2, '0')}:${minutos}`;
  }

  /**
   * Elimina un horario del destino
   */
  eliminarHorario(index: number) {
    this.nuevoDestino.horarios.splice(index, 1);
  }

  /**
   * Abre el modal de carga masiva
   */
  abrirCargaMasiva(encomendista: Encomendista) {
    this.encomendistaSelecionado = encomendista;
    this.mostrarCargaMasiva = true;
  }

  /**
   * Cierra el modal de carga masiva
   */
  cerrarCargaMasiva() {
    this.mostrarCargaMasiva = false;
    this.encomendistaSelecionado = null;
    this.archivosDestino = [];
    this.destinosExtraidos = [];
    this.procesandoOCR = false;
    this.progresoOCR = 0;
  }

  /**
   * Muestra un mensaje temporal
   */
  private mostrarMensaje(tipo: 'éxito' | 'error', texto: string) {
    this.mensaje = { tipo, texto };
    setTimeout(() => (this.mensaje = null), 4000);
  }

  /**
   * Obtiene el conteo de destinos
   */
  contarDestinos(encomendista: Encomendista): number {
    return encomendista.destinos?.length || 0;
  }

  /**
   * Abre el modal para editar un destino existente
   */
  abrirModalEditarDestino(encomendista: Encomendista, destino: DestinoEncomendista, index: number) {
    this.encomendistaPropietarioDestino = encomendista;
    this.destinoEditando = destino;
    this.destinoEditandoIndex = index;
    this.destinoEditandoCopy = { ...destino };
    
    // Convertir horarios si existen
    if (destino.horarios && destino.horarios.length > 0) {
      this.horarioEditandoArray = destino.horarios.map(h => ({ ...h }));
    } else {
      // Legacy: convertir dia/hora_inicio/hora_fin a horarios
      this.horarioEditandoArray = [];
      if (destino.dia && destino.hora_inicio && destino.hora_fin) {
        const dias = destino.dia.split(',').map(d => d.trim()).filter(d => d.length > 0);
        this.horarioEditandoArray.push({
          dias: dias,
          hora_inicio: destino.hora_inicio,
          hora_fin: destino.hora_fin
        });
      }
    }
    
    this.horarioEditandoNuevo = { diasSeleccionados: [], hora_inicio: '09:00', hora_fin: '17:00' };
    this.mostrarModalEditarDestino = true;
  }

  /**
   * Guarda los cambios de un destino editado
   */
  guardarDestinoEditado() {
    if (!this.encomendistaPropietarioDestino || !this.destinoEditando) return;
    
    if (!this.destinoEditandoCopy.nombre.trim()) {
      this.mostrarMensaje('error', 'El nombre del destino es obligatorio');
      return;
    }

    if (this.horarioEditandoArray.length === 0) {
      this.mostrarMensaje('error', 'Agrega al menos un horario');
      return;
    }

    // Actualizar el destino en el array con los nuevos valores
    if (this.destinoEditandoIndex >= 0 && this.encomendistaPropietarioDestino.destinos) {
      this.encomendistaPropietarioDestino.destinos[this.destinoEditandoIndex] = {
        nombre: this.destinoEditandoCopy.nombre.trim(),
        horarios: this.horarioEditandoArray,
        local: this.destinoEditandoCopy.local?.trim() ? this.destinoEditandoCopy.local.trim() : null
      };
    }

    // Guardar en Firestore
    this.encomendistasService.actualizarEncomendista(this.encomendistaPropietarioDestino).then(() => {
      this.mostrarMensaje('éxito', 'Destino actualizado exitosamente');
      this.mostrarModalEditarDestino = false;
      this.cargarEncomendistas();
    }).catch((error: any) => {
      console.error('Error:', error);
      this.mostrarMensaje('error', 'Error actualizando destino: ' + error);
    });
  }

  /**
   * Elimina un destino
   */
  eliminarDestino(encomendista: Encomendista, index: number) {
    if (!confirm('¿Estás seguro de que deseas eliminar este destino?')) {
      return;
    }

    if (encomendista.destinos) {
      encomendista.destinos.splice(index, 1);
      this.encomendistasService.actualizarEncomendista(encomendista).then(() => {
        this.mensaje = { tipo: 'éxito', texto: 'Destino eliminado correctamente' };
        this.cargarEncomendistas();
      }).catch(error => {
        this.mensaje = { tipo: 'error', texto: 'Error al eliminar el destino: ' + error };
      });
    }
  }

  /**
   * Cierra el modal de edición de destino
   */
  cerrarModalEditarDestino() {
    this.mostrarModalEditarDestino = false;
    this.destinoEditando = null;
    this.destinoEditandoIndex = -1;
    this.encomendistaPropietarioDestino = null;
    this.destinoEditandoCopy = {};
    this.horarioEditandoArray = [];
    this.horarioEditandoNuevo = { diasSeleccionados: [], hora_inicio: '09:00', hora_fin: '17:00' };
  }

  /**
   * Toggle para seleccionar/deseleccionar un día en edición
   */
  toggleDiaEdicion(dia: string) {
    const index = this.horarioEditandoNuevo.diasSeleccionados.indexOf(dia);
    if (index >= 0) {
      this.horarioEditandoNuevo.diasSeleccionados.splice(index, 1);
    } else {
      this.horarioEditandoNuevo.diasSeleccionados.push(dia);
    }
  }

  /**
   * Verifica si un día está seleccionado en edición
   */
  diaEdicionMarcado(dia: string): boolean {
    return this.horarioEditandoNuevo.diasSeleccionados.includes(dia);
  }

  /**
   * Agrega un horario nuevo en edición
   */
  agregarHorarioEdicion() {
    if (this.horarioEditandoNuevo.diasSeleccionados.length === 0) {
      this.mostrarMensaje('error', 'Selecciona al menos un día');
      return;
    }

    this.horarioEditandoArray.push({
      dias: [...this.horarioEditandoNuevo.diasSeleccionados],
      hora_inicio: this.horarioEditandoNuevo.hora_inicio,
      hora_fin: this.horarioEditandoNuevo.hora_fin
    });

    this.horarioEditandoNuevo = { diasSeleccionados: [], hora_inicio: '09:00', hora_fin: '17:00' };
    this.mostrarMensaje('éxito', 'Horario agregado');
  }

  /**
   * Elimina un horario en edición
   */
  eliminarHorarioEdicion(index: number) {
    this.horarioEditandoArray.splice(index, 1);
  }

  toggleOrdenamiento() {
    this.ordenAscendente = !this.ordenAscendente;
  }

  getEncomendistasOrdenadas(): Encomendista[] {
    let filtered = [...this.encomendistas];
    
    // Aplicar filtro de búsqueda
    if (this.filtroNombreEncomendista.trim()) {
      const busqueda = this.filtroNombreEncomendista.toLowerCase();
      filtered = filtered.filter(e => 
        e.nombre.toLowerCase().includes(busqueda) ||
        (e.telefono && e.telefono.toLowerCase().includes(busqueda))
      );
    }
    
    // Ordenar
    filtered.sort((a, b) => {
      const valorA = a.nombre.toLowerCase();
      const valorB = b.nombre.toLowerCase();
      
      if (this.ordenAscendente) {
        return valorA.localeCompare(valorB);
      } else {
        return valorB.localeCompare(valorA);
      }
    });
    return filtered;
  }

  /**
   * Ordena alfabéticamente los destinos de una encomendista
   */
  public getDestinosOrdenados(encomendista: Encomendista | null): any[] {
    if (!encomendista || !encomendista.destinos) {
      return [];
    }
    
    const destinos = [...encomendista.destinos];
    destinos.sort((a, b) => {
      const nombreA = a.nombre.toLowerCase();
      const nombreB = b.nombre.toLowerCase();
      return nombreA.localeCompare(nombreB);
    });
    
    return destinos;
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
   * Abre el detalle de un encomiendista
   */
  abrirEncomendista(encomendista: any) {
    this.encomendistaSelecionado = encomendista;
    this.mostrarFormulario = false;
    this.mostrarFormularioDestino = false;
  }

  /**
   * Abre modal para agregar destino
   */
  abrirModalDestino(encomendista_id: string) {
    this.mostrarModalDestino = true;
    this.mostrarFormularioDestino = true;
    this.nuevoDestino = {
      nombre: '',
      horarios: [],
      local: ''
    };
    this.horarioActual = {
      diasSeleccionados: [],
      hora_inicio: '09:00',
      hora_fin: '17:00',
      hora_inicio_12h_display: '9:00 AM',
      hora_fin_12h_display: '5:00 PM'
    };
  }

  /**
   * Abre modal para agregar horario
   */
  abrirModalAgregarHorario(encomendista_id: string, destino_index: number) {
    this.horarioEditandoNuevo = {
      diasSeleccionados: [],
      hora_inicio: '09:00',
      hora_fin: '17:00'
    };
  }


  /**
   * Elimina un encomiendista
   */
  eliminarEncomendista(encomendista_id: string) {
    if (confirm('¿Estás seguro de que deseas eliminar este encomiendista?')) {
      this.encomendistasService.eliminarEncomendista(encomendista_id).then(() => {
        this.mensaje = { tipo: 'éxito', texto: 'Encomiendista eliminado correctamente' };
        this.cargarEncomendistas();
      }).catch(error => {
        this.mensaje = { tipo: 'error', texto: 'Error al eliminar el encomiendista: ' + error };
      });
    }
  }
}

