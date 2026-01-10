import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../component/modal/modal.component';
import { UserService } from '../../service/user/user.service';

@Component({
  selector: 'app-create-user',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, CommonModule],
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.css'],
})
export class CreateUserComponent implements OnInit {
  // Formulario para crear usuario
  createForm: FormGroup;
  // Formulario para actualizar usuario
  updateForm: FormGroup;
  showPasswordFields = false;
  showPassword = false;
  showModal = false;
  modalMessage = '';
  modalHeader = 'Error';
  isEditMode = false;
  userId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService
  ) {
    // Formulario para crear usuario
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    }, { validator: this.createPasswordMatchValidator });

    // Formulario para actualizar usuario
    this.updateForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: [''],
      confirmPassword: ['']
    }, { validator: this.updatePasswordMatchValidator });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.userId = +params['id'];
        this.loadUserData(this.userId);
        this.showPasswordFields = false;
      } else {
        this.isEditMode = false;
        this.showPasswordFields = true;
      }
    });
  }
  get passwordRequired(): boolean {
    return !this.isEditMode || this.showPasswordFields;
  }

  loadUserData(userId: number) {
    this.userService.getUsers().subscribe(response => {
      if (response.Status) {
        const user = response.Result.find((u: any) => u.Id === userId);
        if (user) {
          this.updateForm.patchValue({
            name: user.Name,
            email: user.Email,
            password: '',
            confirmPassword: ''
          });
        }
      } else {
        console.error(response.Message);
      }
    }, error => {
      console.error('Error al cargar los datos del usuario:', error);
    });
  }

  // Validación para crear usuario
  createPasswordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  // Validación para actualizar usuario
  updatePasswordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    // Solo validar si el usuario está cambiando la contraseña
    if (!password && !confirmPassword) {
      return null;
    }
    return password === confirmPassword ? null : { mismatch: true };
  }

  goBack() {
  this.router.navigate(['/main/users']);
  }

  onSubmit() {
    if (!this.isEditMode) {
      // Crear usuario
      if (this.createForm.valid) {
        const user = {
          Name: this.createForm.get('name')?.value,
          Email: this.createForm.get('email')?.value,
          Password: this.createForm.get('password')?.value
        };
        this.userService.createUser(user).subscribe(response => {
          if (response.Status) {
            this.modalHeader = 'Éxito';
            this.modalMessage = 'Usuario creado correctamente.';
          } else {
            this.modalHeader = 'Error';
            this.modalMessage = response.Message || 'Error desconocido al crear el usuario.';
          }
          this.showModal = true;
        }, error => {
          this.modalHeader = 'Error';
          this.modalMessage = error.error?.Message || 'Error al crear el usuario.';
          this.showModal = true;
        });
      }
    } else {
      // Actualizar usuario
      if (this.updateForm.valid) {
        const user: any = {
          Id: this.userId,
          Name: this.updateForm.get('name')?.value,
          Email: this.updateForm.get('email')?.value
        };
        if (this.showPasswordFields && this.updateForm.get('password')?.value) {
          user.Password = this.updateForm.get('password')?.value;
        }
        this.userService.updateUser(user).subscribe(response => {
          if (response.Status) {
            this.modalHeader = 'Éxito';
            this.modalMessage = 'Usuario actualizado correctamente.';
          } else {
            this.modalHeader = 'Error';
            this.modalMessage = response.Message || 'Error desconocido al actualizar el usuario.';
          }
          this.showModal = true;
        }, error => {
          this.modalHeader = 'Error';
          this.modalMessage = error.error?.Message || 'Error al actualizar el usuario.';
          this.showModal = true;
        });
      }
    }
    if (this.modalHeader === 'Éxito') {
      this.router.navigate(['/main/users']);
    }
  }

    closeModal() {
    this.showModal = false;
    if (this.modalHeader === 'Éxito') {
      this.router.navigate(['/main/users']);
    }
  }
}