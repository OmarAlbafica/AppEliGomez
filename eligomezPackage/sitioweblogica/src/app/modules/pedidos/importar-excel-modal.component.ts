import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcelImportadorService } from '../../service/importadores/excel-importador.service';

interface Pedido {
  cliente_nombre: string;
  destino_id: string;
  total?: number;
  cantidad_prendas?: number;
  fecha_entrega_programada: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
}

interface DatosParaImportar {
  clientes: Array<{ nombre: string; telefono?: string | null; direccion?: string }>;
  encomendistas: Array<{ nombre: string; telefono?: string | null; local?: string | null }>;
  destinos: string[];
  pedidos: Pedido[];
}

@Component({
  selector: 'app-importar-excel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './importar-excel-modal.component.html'
})
export class ImportarExcelModalComponent {
  @Input() mostrar = false;
  @Output() cerrarModal = new EventEmitter<void>();
  @Output() importarDatos = new EventEmitter<any>();

  archivoSeleccionado: File | null = null;
  cargando = false;
  errorMensaje = '';
  resumenCargado = false;
  tabActual: 'clientes' | 'encomendistas' | 'destinos' | 'pedidos' = 'clientes';

  datosResumen = {
    clientes: 0,
    encomendistas: 0,
    destinos: 0,
    pedidos: 0
  };

  datosParaImportar: DatosParaImportar | null = null;

  constructor(private excelService: ExcelImportadorService) {}

  cerrar() {
    this.mostrar = false;
    this.cerrarModal.emit();
  }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validar formato
    const extensionesValidas = ['.xlsx', '.xls', '.csv'];
    const nombreArchivo = file.name.toLowerCase();
    const esValido = extensionesValidas.some(ext => nombreArchivo.endsWith(ext));

    if (!esValido) {
      this.errorMensaje = 'Solo se aceptan archivos .xlsx, .xls o .csv';
      return;
    }

    this.archivoSeleccionado = file;
    this.errorMensaje = '';
    this.procesarArchivo(file);
  }

  private procesarArchivo(file: File) {
    this.cargando = true;
    this.errorMensaje = '';

    this.excelService.parsearExcel(file)
      .then(datos => {
        this.datosParaImportar = datos;
        this.datosResumen = {
          clientes: datos.clientes.length,
          encomendistas: datos.encomendistas.length,
          destinos: datos.destinos.length,
          pedidos: datos.pedidos.length
        };
        this.resumenCargado = true;
        this.cargando = false;
        this.tabActual = 'clientes';
      })
      .catch(error => {
        this.errorMensaje = `Error al procesar archivo: ${error.message}`;
        this.cargando = false;
      });
  }

  importarClientes() {
    if (!this.datosParaImportar) {
      this.errorMensaje = 'No hay datos para importar';
      return;
    }

    this.importarDatos.emit({
      tipo: 'clientes',
      clientes: this.datosParaImportar.clientes,
      encomendistas: [],
      destinos: [],
      pedidos: []
    });
    this.cerrar();
  }

  limpiarBaseDatos() {
    const confirm = window.confirm('⚠️ ADVERTENCIA: Esto eliminará TODOS los clientes, encomiendas y pedidos. ¿Estás seguro?');
    if (!confirm) return;

    this.importarDatos.emit({
      tipo: 'limpiar',
      clientes: [],
      encomendistas: [],
      destinos: [],
      pedidos: []
    });
    this.cerrar();
  }

  importarDestinos() {
    if (!this.datosParaImportar) {
      this.errorMensaje = 'No hay datos para importar';
      return;
    }

    this.importarDatos.emit({
      tipo: 'destinos',
      clientes: [],
      encomendistas: this.datosParaImportar.encomendistas,
      destinos: this.datosParaImportar.destinos,
      pedidos: []
    });
    this.cerrar();
  }

  importarPedidos() {
    if (!this.datosParaImportar) {
      this.errorMensaje = 'No hay datos para importar';
      return;
    }

    this.importarDatos.emit({
      tipo: 'pedidos',
      clientes: [],
      encomendistas: [],
      destinos: [],
      pedidos: this.datosParaImportar.pedidos
    });
    this.cerrar();
  }

  formatearFecha(fecha: any): string {
    if (!fecha) return 'N/A';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
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

  getEstadoColor(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'cancelado':
        return 'bg-red-200 text-red-800';
      case 'confirmado':
        return 'bg-green-200 text-green-800';
      case 'pendiente':
        return 'bg-yellow-200 text-yellow-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  }
}
