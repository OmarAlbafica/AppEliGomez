import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../service/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  registroForm: FormGroup;
  submitted: boolean = false;
  loading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  
  modo: 'login' | 'registro' = 'login'; // Controla si mostrar login o registro
  mensaje: { tipo: 'error' | 'success' | null; texto: string } = { tipo: null, texto: '' };

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.loginForm = this.fb.group({
      identificador: new FormControl('', [Validators.required]),
      contrasena: new FormControl('', [Validators.required, Validators.minLength(6)])
    });

    this.registroForm = this.fb.group({
      nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
      apellido: new FormControl('', [Validators.required, Validators.minLength(2)]),
      correo: new FormControl('', [Validators.required, Validators.email]),
      usuario: new FormControl('', [Validators.required, Validators.minLength(3)]),
      contrasena: new FormControl('', [Validators.required, Validators.minLength(6)]),
      confirmar_contrasena: new FormControl('', [Validators.required])
    }, { validators: this.validarContrasenasIguales() });
  }

  ngOnInit() {
    // Verificar si ya hay usuario autenticado
    this.authService.obtenerUsuarioActual$().subscribe(usuario => {
      if (usuario) {
        this.router.navigate(['/main/dashboard']);
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  cambiarModo(nuevoModo: 'login' | 'registro') {
    this.modo = nuevoModo;
    this.mensaje = { tipo: null, texto: '' };
    this.submitted = false;
  }

  /**
   * Validador personalizado para verificar que las contraseñas coincidan
   */
  private validarContrasenasIguales() {
    return (formGroup: FormGroup) => {
      const contrasena = formGroup.get('contrasena');
      const confirmar = formGroup.get('confirmar_contrasena');

      if (contrasena && confirmar && contrasena.value !== confirmar.value) {
        confirmar.setErrors({ 'contrasenasNoCoinciden': true });
        return { 'contrasenasNoCoinciden': true };
      }
      return null;
    };
  }

  /**
   * Maneja el login de usuario
   */
  async onSubmitLogin() {
    if (this.loginForm.invalid) {
      this.submitted = true;
      return;
    }

    this.loading = true;
    this.mensaje = { tipo: null, texto: '' };

    const { identificador, contrasena } = this.loginForm.value;
    const resultado = await this.authService.loginUsuario(identificador, contrasena);

    this.loading = false;

    if (resultado.success) {
      this.mensaje = { tipo: 'success', texto: 'Sesión iniciada correctamente' };
      setTimeout(() => {
        this.router.navigate(['/main/dashboard']);
      }, 1000);
    } else {
      this.mensaje = { tipo: 'error', texto: resultado.mensaje };
    }
  }

  /**
   * Maneja el registro de nuevo usuario
   */
  async onSubmitRegistro() {
    if (this.registroForm.invalid) {
      this.submitted = true;
      return;
    }

    this.loading = true;
    this.mensaje = { tipo: null, texto: '' };

    const { nombre, apellido, correo, usuario, contrasena } = this.registroForm.value;
    const resultado = await this.authService.registrarUsuario(
      nombre,
      apellido,
      correo,
      usuario,
      contrasena
    );

    this.loading = false;

    if (resultado.success) {
      this.mensaje = { tipo: 'success', texto: 'Registro exitoso. Redirigiendo...' };
      setTimeout(() => {
        this.router.navigate(['/main/dashboard']);
      }, 1500);
    } else {
      this.mensaje = { tipo: 'error', texto: resultado.mensaje };
    }
  }

  // Getters para validación en el template - Login
  get identificador() {
    return this.loginForm.get('identificador');
  }

  get contrasena_login() {
    return this.loginForm.get('contrasena');
  }

  // Getters para validación en el template - Registro
  get nombre() {
    return this.registroForm.get('nombre');
  }

  get apellido() {
    return this.registroForm.get('apellido');
  }

  get correo() {
    return this.registroForm.get('correo');
  }

  get usuario() {
    return this.registroForm.get('usuario');
  }

  get contrasena_registro() {
    return this.registroForm.get('contrasena');
  }

  get confirmar_contrasena() {
    return this.registroForm.get('confirmar_contrasena');
  }
}