import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { EncomendistasService, Encomendista } from '../../service/encomendistas/encomendistas.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  clientesInactivos: Cliente[] = [];
  encomendistasInactivas: Encomendista[] = [];

  clientesTotal = 0;
  encomendistasTotal = 0;

  eliminando = false;
  mensaje: { tipo: 'éxito' | 'error'; texto: string } | null = null;

  // Para progreso
  procesoActual = '';
  progreso = 0;
  totalProceso = 0;
  procesoActualIndex = 0;

  constructor(
    private clientesService: ClientesService,
    private encomendistasService: EncomendistasService
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    try {
      // Cargar clientes
      await this.clientesService.recargarClientes();
      const clientes = this.clientesService.obtenerClientesActuales();
      this.clientesTotal = clientes.length;
      this.clientesInactivos = clientes.filter(c => !c.activo);
      console.log('Clientes inactivos:', this.clientesInactivos.length);

      // Cargar encomendistas - usar el nuevo método que carga todas incluyendo inactivas
      const encomendistas = await this.encomendistasService.cargarTodasLasEncomendistas();
      this.encomendistasTotal = encomendistas.length;
      this.encomendistasInactivas = encomendistas.filter(e => !e.activo);
      console.log('Encomendistas inactivas:', this.encomendistasInactivas.length);
    } catch (error) {
      console.error('Error cargando datos:', error);
      this.mensaje = { tipo: 'error', texto: '❌ Error cargando datos' };
    }
  }

  async eliminarClientesInactivos() {
    const cantidad = this.clientesInactivos.length;
    const confirmar = confirm(
      `¿Eliminar permanentemente ${cantidad} cliente(s) inactivo(s)? Esta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    this.eliminando = true;
    this.totalProceso = cantidad;
    this.procesoActualIndex = 0;
    this.progreso = 0;

    try {
      for (const cliente of this.clientesInactivos) {
        this.procesoActualIndex++;
        this.procesoActual = `Eliminando: ${cliente.nombre} (${this.procesoActualIndex}/${cantidad})`;
        this.progreso = Math.round((this.procesoActualIndex / cantidad) * 100);
        
        console.log(`🗑️ Eliminando cliente: ${cliente.nombre} (${cliente.id})`);
        await this.clientesService.eliminarCliente(cliente.id);
      }
      
      this.mensaje = { tipo: 'éxito', texto: `✅ ${cantidad} cliente(s) eliminado(s) correctamente de la base de datos` };
      this.procesoActual = '';
      this.progreso = 0;
      this.cargarDatos();
    } catch (error) {
      console.error('Error eliminando clientes:', error);
      this.mensaje = { tipo: 'error', texto: '❌ Error al eliminar clientes: ' + (error instanceof Error ? error.message : String(error)) };
    } finally {
      this.eliminando = false;
      setTimeout(() => this.mensaje = null, 4000);
    }
  }

  async eliminarEncomendistasInactivas() {
    const cantidad = this.encomendistasInactivas.length;
    const confirmar = confirm(
      `¿Eliminar permanentemente ${cantidad} encomendista(s) inactiva(s)? Esta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    this.eliminando = true;
    this.totalProceso = cantidad;
    this.procesoActualIndex = 0;
    this.progreso = 0;

    try {
      for (const encomendista of this.encomendistasInactivas) {
        this.procesoActualIndex++;
        this.procesoActual = `Eliminando: ${encomendista.nombre} (${this.procesoActualIndex}/${cantidad})`;
        this.progreso = Math.round((this.procesoActualIndex / cantidad) * 100);
        
        console.log(`🗑️ Eliminando encomendista: ${encomendista.nombre} (${encomendista.id})`);
        await this.encomendistasService.eliminarEncomendista(encomendista.id);
      }
      
      this.mensaje = { tipo: 'éxito', texto: `✅ ${cantidad} encomendista(s) eliminada(s) correctamente de la base de datos` };
      this.procesoActual = '';
      this.progreso = 0;
      this.cargarDatos();
    } catch (error) {
      console.error('Error eliminando encomendistas:', error);
      this.mensaje = { tipo: 'error', texto: '❌ Error al eliminar encomendistas: ' + (error instanceof Error ? error.message : String(error)) };
    } finally {
      this.eliminando = false;
      setTimeout(() => this.mensaje = null, 4000);
    }
  }
}

