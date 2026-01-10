import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from '../../service/user/user.service';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';
import { Observable, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, HttpClientModule, CommonModule, ConfirmModalComponent, FormsModule],
})
export class UserListComponent implements OnInit {
  users: any[] = [];
  filteredUsers: any[] = [];
  searchText: string = '';
  private searchSubject = new Subject<string>();
  showModal: boolean = false;
  selectedUser: any = null;
  sortField: string = '';
  sortDirection: boolean = true; // true = ascendente, false = descendente

  constructor(public userService: UserService, public router: Router) {}

  ngOnInit() {
    this.getUsers();

    this.searchSubject.pipe(
      debounceTime(2000),
      switchMap(searchText => this.userService.getUsers(searchText))
    ).subscribe(response => {
      if (response.Status) {
        this.filteredUsers = response.Result;
      } else {
        this.filteredUsers = [];
        console.error(response.Message);
      }
    }, error => {
      this.filteredUsers = [];
      console.error('Error al realizar la búsqueda:', error);
    });
  }

  getUsers() {
    this.userService.getUsers().subscribe(
      response => {
        if (response.Status) {
          this.users = response.Result;
          this.filteredUsers = response.Result;
          console.log('Usuarios recibidos:', this.users); // Verifica la estructura de los datos aquí
        } else {
          console.error(response.Message);
        }
      },
      error => {
        console.error('Error al obtener los usuarios:', error);
      }
    );
  }

  onSearchChange(searchText: string): void {
    this.searchSubject.next(searchText);
  }

  confirmDeleteUser(user: any) {
    console.log('Usuario seleccionado para eliminar:', user); // Verifica el usuario seleccionado
    this.selectedUser = user;
    this.showModal = true;
  }

  deleteUser() {
    if (this.selectedUser) {
      console.log('Eliminando usuario con ID:', this.selectedUser.Id); // Verifica el ID del usuario antes de eliminar
      this.userService.deleteUser(this.selectedUser.Id).subscribe(
        response => {
          if (response.Status) {
            this.getUsers(); // Actualiza la lista de usuarios después de eliminar
            console.log('Usuario eliminado:', response);
          } else {
            console.error(response.Message);
          }
          this.showModal = false;
          this.selectedUser = null;
        },
        error => {
          console.error('Error al eliminar el usuario:', error);
          this.showModal = false;
          this.selectedUser = null;
        }
      );
    }
  }

  cancelDelete() {
    this.showModal = false;
    this.selectedUser = null;
  }

  editUser(user: any) {
  this.router.navigate(['/main/create-user', user.Id]);
  }

  toggleSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = !this.sortDirection;
    } else {
      this.sortField = field;
      this.sortDirection = true;
    }
    this.filteredUsers.sort((a, b) => {
      const valueA = a[field];
      const valueB = b[field];
      if (valueA < valueB) return this.sortDirection ? -1 : 1;
      if (valueA > valueB) return this.sortDirection ? 1 : -1;
      return 0;
    });
  }
}