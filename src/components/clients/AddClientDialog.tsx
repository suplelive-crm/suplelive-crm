import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PhoneInput } from '@/components/ui/phone-input';
import { Plus, User, Mail, Phone } from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { ErrorHandler } from '@/lib/error-handler';

export function AddClientDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [phoneValid, setPhoneValid] = useState(false);
  const [emailValid, setEmailValid] = useState(true);
  const [loading, setLoading] = useState(false);
  const { createClient } = useCrmStore();

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, email });
    setEmailValid(validateEmail(email));
  };

  const handlePhoneChange = (phone: string, isValid: boolean) => {
    setFormData({ ...formData, phone });
    setPhoneValid(isValid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.name.trim()) {
      ErrorHandler.showError(
        ErrorHandler.createError(
          'Campo Obrigatório',
          'O nome é obrigatório para criar um cliente.'
        )
      );
      return;
    }

    if (formData.phone && !phoneValid) {
      ErrorHandler.showError(
        ErrorHandler.createError(
          'Telefone Inválido',
          'O número de telefone informado não é válido.'
        )
      );
      return;
    }

    if (formData.email && !emailValid) {
      ErrorHandler.showError(
        ErrorHandler.createError(
          'Email Inválido',
          'O email informado não é válido.'
        )
      );
      return;
    }

    setLoading(true);

    try {
      await createClient(formData);
      setOpen(false);
      setFormData({ name: '', phone: '', email: '' });
      setPhoneValid(false);
      setEmailValid(true);
    } catch (error: any) {
      // Error is already handled by createClient method
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.name.trim() && 
                     (!formData.phone || phoneValid) && 
                     (!formData.email || emailValid);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Novo Cliente</DialogTitle>
          <DialogDescription>
            Crie um novo registro de cliente para seu CRM.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo do cliente"
                required
                className={!formData.name.trim() && formData.name !== '' ? 'border-destructive' : ''}
              />
              {!formData.name.trim() && formData.name !== '' && (
                <p className="text-sm text-destructive">Nome é obrigatório</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefone
              </Label>
              <PhoneInput
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="Digite o número"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="email@exemplo.com"
                className={formData.email && !emailValid ? 'border-destructive' : ''}
              />
              {formData.email && !emailValid && (
                <p className="text-sm text-destructive">Email inválido</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !isFormValid}
              className="min-w-[120px]"
            >
              {loading ? 'Criando...' : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}