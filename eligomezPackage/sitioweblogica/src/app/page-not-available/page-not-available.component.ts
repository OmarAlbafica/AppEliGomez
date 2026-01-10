import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-page-not-available',
  templateUrl: './page-not-available.component.html',
  styleUrls: ['./page-not-available.component.css'],
  standalone: true
})
export class PageNotAvailableComponent {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/main']);
  }
}
