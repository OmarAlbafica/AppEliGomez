import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from './dashboard.service';

@NgModule({
  declarations: [DashboardComponent],
  imports: [CommonModule],
  providers: [DashboardService],
  exports: [DashboardComponent]
})
export class DashboardModule {}
