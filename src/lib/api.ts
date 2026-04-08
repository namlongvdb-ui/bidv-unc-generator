/**
 * API Client - Kết nối Frontend với Backend Node.js
 * Server: http://10.24.16.77:3000
 */

// Tự động detect server URL: nếu chạy trên cùng server thì dùng relative path
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname.startsWith('10.')
  ? '' // Cùng server, dùng relative URL
  : 'http://10.24.16.77:3000';

function getToken(): string | null {
  return localStorage.getItem('unc_token');
}

function setToken(token: string) {
  localStorage.setItem('unc_token', token);
}

function clearToken() {
  localStorage.removeItem('unc_token');
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Phiên đăng nhập hết hạn');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Lỗi ${res.status}`);
  }

  return res.json();
}

// ======================== AUTH ========================

export async function login(username: string, password: string) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data.user;
}

export function logout() {
  clearToken();
  window.location.reload();
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export async function getCurrentUser() {
  return apiRequest('/api/auth/me');
}

// ======================== BENEFICIARIES ========================

export async function getBeneficiaries() {
  return apiRequest('/api/beneficiaries');
}

export async function addBeneficiary(data: {
  name: string; account: string; bank: string;
  address?: string; cccd?: string; cccd_date?: string; cccd_place?: string;
}) {
  return apiRequest('/api/beneficiaries', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteBeneficiary(id: string | number) {
  return apiRequest(`/api/beneficiaries/${id}`, { method: 'DELETE' });
}

// ======================== TRANSACTIONS ========================

export async function getTransactions() {
  return apiRequest('/api/transactions');
}

export async function saveTransaction(formData: Record<string, unknown>) {
  return apiRequest('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({ form_data: formData }),
  });
}

export async function deleteTransaction(id: string | number) {
  return apiRequest(`/api/transactions/${id}`, { method: 'DELETE' });
}

// ======================== ADMIN ========================

export async function getUsers() {
  return apiRequest('/api/admin/users');
}

export async function createUser(data: {
  username: string; password: string; full_name: string; role: string; branch: string;
}) {
  return apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteUser(id: string | number) {
  return apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
}

// ======================== HEALTH ========================

export async function checkHealth() {
  return apiRequest('/api/health');
}
