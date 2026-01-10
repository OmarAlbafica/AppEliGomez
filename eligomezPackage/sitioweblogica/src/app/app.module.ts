import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
// Cartilla components removed — imports omitted to avoid build errors
// Accumulation UI is provided as a standalone component; module import removed

@NgModule({
  declarations: [
    AppComponent,
    // Cartilla components removed
    // ...existing code...
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    // ...existing code...
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
