import { Component, EventEmitter, Output } from '@angular/core';


@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  @Output() toggleSidebarEvent = new EventEmitter<void>();
  imageUrl = 'assets/images/logocanon.jpg';
  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }
}
