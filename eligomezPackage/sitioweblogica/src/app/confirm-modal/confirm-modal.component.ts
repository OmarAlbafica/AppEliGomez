import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.css'],
  imports: [CommonModule],
})
export class ConfirmModalComponent {
  @Input() showModal: boolean = false;
  @Input() message: string = '';
  @Input() header: string = 'Confirmación';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  confirmAction() {
    this.confirm.emit();
  }

  cancelAction() {
    this.cancel.emit();
  }
}