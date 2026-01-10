import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-destinos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './destinos.component.html',
  styleUrls: ['./destinos.component.css']
})
export class DestinosComponent implements OnInit {
  destinos = [
    { id: 1, nombre: 'Santiago', dia: 'Lunes', hora: '10:00', costo: 3000, encomendista: 'Carlos Flores', activo: true },
    { id: 2, nombre: 'Providencia', dia: 'Miércoles', hora: '15:00', costo: 3500, encomendista: 'María García', activo: true },
    { id: 3, nombre: 'Ñuñoa', dia: 'Viernes', hora: '14:00', costo: 3200, encomendista: 'Pedro Soto', activo: true }
  ];
  
  // Ordenamiento
  ordenarPor = 'nombre';
  ordenAscendente = true;

  ngOnInit() {
    console.log('Cargando destinos...');
    // Ordenar destinos alfabéticamente al iniciar
    this.destinos = this.destinos.sort((a, b) => 
      a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
    );
  }

  editDestino(destino: any) {
    console.log('Editar destino:', destino);
  }

  deleteDestino(destino: any) {
    if (confirm(`¿Eliminar ruta ${destino.nombre}?`)) {
      this.destinos = this.destinos.filter(d => d.id !== destino.id);
    }
  }

  toggleOrdenamiento() {
    this.ordenAscendente = !this.ordenAscendente;
  }

  getDestinosOrdenados(): any[] {
    const sorted = [...this.destinos];
    sorted.sort((a, b) => {
      const valorA = a.nombre.toLowerCase();
      const valorB = b.nombre.toLowerCase();
      
      if (this.ordenAscendente) {
        return valorA.localeCompare(valorB);
      } else {
        return valorB.localeCompare(valorA);
      }
    });
    return sorted;
  }
}
