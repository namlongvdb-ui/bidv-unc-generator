import { useState } from 'react';
import { login as apiLogin, isLoggedIn, logout as apiLogout } from '@/lib/api';

interface LoginFormProps {
  onLogin: () => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiLogin(username, password);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm border border-blue-100">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-bidv-blue">UNC BIDV</h1>
          <p className="text-sm text-muted-foreground mt-1">Hệ thống lập Ủy Nhiệm Chi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bidv-blue/30 focus:border-bidv-blue"
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bidv-blue/30 focus:border-bidv-blue"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-xs bg-red-50 p-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-bidv-blue text-white py-2.5 rounded-lg font-bold text-sm hover:bg-opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? 'Đang đăng nhập...' : 'ĐĂNG NHẬP'}
          </button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          Server: 10.24.16.77:3000 • VDB Chi nhánh KV Bắc Đông Bắc
        </p>
      </div>
    </div>
  );
}

export { isLoggedIn, apiLogout as logout };
