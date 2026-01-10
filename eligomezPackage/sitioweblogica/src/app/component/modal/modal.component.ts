import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css'],
    imports: [ CommonModule],
})
export class ModalComponent {
  @Input() showModal: boolean = false;
  @Input() message: string = '';
  @Input() header: string = 'Error';
  @Output() close = new EventEmitter<void>();

  closeModal() {
    this.close.emit();
  }
}
