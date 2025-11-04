// This interface is for the SIGNUP form, matching your backend UserForm.java
export interface UserForm {
  email: string;
  password: string;
}

// This interface is for the LOGIN form, matching your backend LoginForm.java
export interface LoginForm {
  email: string;
  password: string;
}

// This interface is for the response from the /api/session/login endpoint
export interface LoginResponse {
  email: string;
  role: string; // This will be 'SUPERVISOR' or 'OPERATOR' as a string
  token: string;
}
