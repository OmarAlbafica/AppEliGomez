import { Injectable } from '@angular/core';
import { HttpClient,HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  login(user: string, password: string): Observable<any> {
    // Preparar el payload según el formato que espera LoginController
    const loginPayload = {
      User: user,      // Nota: mayúscula porque la API espera "User"
      Password: password // Nota: mayúscula porque la API espera "Password"
    };

    console.log('AuthService: Attempting login for user:', user);
    console.log('AuthService: Calling API:', `${this.apiUrl}Interface/Login/Login`);

    // Llamar al endpoint de login del LoginController que retorna el token encriptado
    return this.http.post<any>(`${this.apiUrl}Interface/Login/Login`, loginPayload).pipe(
      map((response: any) => {
        console.log('🔐 AuthService: Raw API Response:', response);
        console.log('🔐 AuthService: Response type:', typeof response);
        console.log('🔐 AuthService: Response keys:', response ? Object.keys(response) : 'none');
        
        if (response && response.Status === true) {
          // Login exitoso - extraer el token del backend
          console.log('🔐 AuthService: Backend response Status:', response.Status);
          console.log('🔐 AuthService: Backend response Result:', response.Result);
          console.log('🔐 AuthService: Backend response Message:', response.Message);
          
          // El endpoint /Login devuelve un objeto con { token, isadmin }
          if (!response.Result || !response.Result.token) {
            console.log('❌ AuthService: No token found in response');
            return { 
              Status: false, 
              Message: 'No token received from server' 
            };
          }
          
          const backendToken = response.Result.token;
          const isAdmin = response.Result.isadmin === 1 || response.Result.isadmin === true;
          
          console.log('🔐 AuthService: Extracted token:', backendToken.substring(0, 20) + '...');
          console.log('🔐 AuthService: Token length:', backendToken.length);
          console.log('🔐 AuthService: User is admin:', isAdmin);
          
          const loginResponse = {
            Status: true,
            Result: {
              token: backendToken, // Usar el token encriptado real del backend
              isadmin: isAdmin ? 1 : 0, // Usar el valor real del backend
              roles: isAdmin ? ['Admin'] : ['Operador'] // Asignar roles basado en isadmin
            },
            Message: response.Message || 'Login successful'
          };
          
          console.log('🔐 AuthService: Login successful for user:', user);
          console.log('🔐 AuthService: Returning login response with token:', loginResponse.Result.token.substring(0, 20) + '...');
          return loginResponse;
        } else {
          // Login fallido
          console.log('❌ AuthService: Login failed for user:', user, '- Invalid response structure');
          console.log('❌ AuthService: Response.Status:', response?.Status);
          console.log('❌ AuthService: Response.Result:', response?.Result);
          return { 
            Status: false, 
            Message: response?.Message || 'Invalid credentials' 
          };
        }
      }),
      catchError((error: any) => {
        const errorMessage = error.error?.Message || error.message || 'Connection error';
        console.error('AuthService: Login error for user:', user, '- Error:', errorMessage);
        
        return of({
          Status: false,
          Message: errorMessage
        });
      })
    );
  }

  validateToken(token: string): Observable<any> {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get(`${this.apiUrl}/Interface/Login/GetValidToken`, { headers });
  }
}                                                                                                                                                                                                               