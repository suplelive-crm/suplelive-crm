import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { ErrorHandler } from '@/lib/error-handler';

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signUp = useAuthStore(state => state.signUp);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      ErrorHandler.showError(
        ErrorHandler.createError(
          'Senhas Não Coincidem',
          'As senhas digitadas não coincidem. Verifique e tente novamente.'
        )
      );
      return;
    }

    if (password.length < 6) {
      ErrorHandler.showError(
        ErrorHandler.createError(
          'Senha Muito Fraca',
          'A senha deve ter pelo menos 6 caracteres.'
        )
      );
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      // Error is already handled by signUp method
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Digite seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          placeholder="Digite sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar Senha</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirme sua senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Criando conta...' : 'Criar Conta'}
      </Button>
    </form>
  );
}