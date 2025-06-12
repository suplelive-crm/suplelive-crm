import { toast } from 'sonner';

export interface ErrorInfo {
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export class AppError extends Error {
  public readonly title: string;
  public readonly userMessage: string;
  public readonly code?: string;
  public readonly statusCode?: number;

  constructor(
    title: string,
    userMessage: string,
    code?: string,
    statusCode?: number,
    originalError?: Error
  ) {
    super(userMessage);
    this.name = 'AppError';
    this.title = title;
    this.userMessage = userMessage;
    this.code = code;
    this.statusCode = statusCode;

    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export const ErrorHandler = {
  // Tradução de erros comuns
  translateError: (error: any): ErrorInfo => {
    let title = 'Erro';
    let description = 'Ocorreu um erro inesperado';

    // Se é um AppError customizado
    if (error instanceof AppError) {
      return {
        title: error.title,
        description: error.userMessage,
        variant: 'destructive'
      };
    }

    // Erros de autenticação do Supabase
    if (error.message?.includes('Invalid login credentials')) {
      return {
        title: 'Erro de Login',
        description: 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('Email not confirmed')) {
      return {
        title: 'Email Não Confirmado',
        description: 'Verifique sua caixa de entrada e confirme seu email antes de fazer login.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('User already registered')) {
      return {
        title: 'Email Já Cadastrado',
        description: 'Este email já está em uso. Tente fazer login ou use outro email.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('Password should be at least')) {
      return {
        title: 'Senha Muito Fraca',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('Too many requests')) {
      return {
        title: 'Muitas Tentativas',
        description: 'Você fez muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
        variant: 'destructive'
      };
    }

    // Erros de rede
    if (error.message?.includes('Failed to fetch') || error.message?.includes('Network Error')) {
      return {
        title: 'Erro de Conexão',
        description: 'Verifique sua conexão com a internet e tente novamente.',
        variant: 'destructive',
        action: {
          label: 'Tentar Novamente',
          onClick: () => window.location.reload()
        }
      };
    }

    // Erros do Supabase
    if (error.message?.includes('JSON object requested, multiple (or no) rows returned')) {
      return {
        title: 'Dados Não Encontrados',
        description: 'Os dados solicitados não foram encontrados.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('duplicate key value violates unique constraint')) {
      return {
        title: 'Dados Duplicados',
        description: 'Já existe um registro com essas informações.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('permission denied')) {
      return {
        title: 'Acesso Negado',
        description: 'Você não tem permissão para realizar esta ação.',
        variant: 'destructive'
      };
    }

    // Erros de validação
    if (error.message?.includes('validation')) {
      return {
        title: 'Dados Inválidos',
        description: 'Verifique os dados informados e tente novamente.',
        variant: 'destructive'
      };
    }

    // Erros da Evolution API
    if (error.message?.includes('Evolution API')) {
      return {
        title: 'Erro do WhatsApp',
        description: 'Problema na conexão com o WhatsApp. Tente novamente em alguns instantes.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('instance already exists')) {
      return {
        title: 'Instância Já Existe',
        description: 'Uma instância WhatsApp com este nome já existe. Use um nome diferente.',
        variant: 'destructive'
      };
    }

    if (error.message?.includes('Unauthorized')) {
      return {
        title: 'Não Autorizado',
        description: 'Sua sessão expirou. Faça login novamente.',
        variant: 'destructive',
        action: {
          label: 'Fazer Login',
          onClick: () => window.location.href = '/login'
        }
      };
    }

    // Erros HTTP específicos
    if (error.status) {
      switch (error.status) {
        case 400:
          return {
            title: 'Requisição Inválida',
            description: 'Os dados enviados são inválidos. Verifique e tente novamente.',
            variant: 'destructive'
          };
        case 401:
          return {
            title: 'Não Autorizado',
            description: 'Você precisa fazer login para acessar este recurso.',
            variant: 'destructive',
            action: {
              label: 'Fazer Login',
              onClick: () => window.location.href = '/login'
            }
          };
        case 403:
          return {
            title: 'Acesso Proibido',
            description: 'Você não tem permissão para realizar esta ação.',
            variant: 'destructive'
          };
        case 404:
          return {
            title: 'Não Encontrado',
            description: 'O recurso solicitado não foi encontrado.',
            variant: 'destructive'
          };
        case 429:
          return {
            title: 'Muitas Requisições',
            description: 'Você está fazendo muitas requisições. Aguarde um momento.',
            variant: 'destructive'
          };
        case 500:
          return {
            title: 'Erro do Servidor',
            description: 'Ocorreu um erro interno. Nossa equipe foi notificada.',
            variant: 'destructive'
          };
        case 503:
          return {
            title: 'Serviço Indisponível',
            description: 'O serviço está temporariamente indisponível. Tente novamente em alguns minutos.',
            variant: 'destructive'
          };
      }
    }

    // Erro genérico com mensagem personalizada
    if (error.message) {
      // Remove prefixos técnicos
      let cleanMessage = error.message
        .replace('AuthApiError: ', '')
        .replace('PostgrestError: ', '')
        .replace('Error: ', '');

      return {
        title: 'Erro',
        description: cleanMessage,
        variant: 'destructive'
      };
    }

    // Fallback para erros desconhecidos
    return {
      title: 'Erro Inesperado',
      description: 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.',
      variant: 'destructive',
      action: {
        label: 'Recarregar Página',
        onClick: () => window.location.reload()
      }
    };
  },

  // Exibe erro usando sonner toast
  showError: (error: any) => {
    const errorInfo = ErrorHandler.translateError(error);
    
    toast.error(errorInfo.title, {
      description: errorInfo.description,
      action: errorInfo.action ? {
        label: errorInfo.action.label,
        onClick: errorInfo.action.onClick
      } : undefined,
      duration: 6000,
    });

    // Log do erro para debugging (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', error);
    }
  },

  // Exibe sucesso
  showSuccess: (title: string, description?: string) => {
    toast.success(title, {
      description,
      duration: 4000,
    });
  },

  // Wrapper para funções assíncronas
  handleAsync: async <T>(
    asyncFn: () => Promise<T>,
    customErrorHandler?: (error: any) => void
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      if (customErrorHandler) {
        customErrorHandler(error);
      } else {
        ErrorHandler.showError(error);
      }
      return null;
    }
  },

  // Cria erros customizados
  createError: (title: string, message: string, code?: string, statusCode?: number) => {
    return new AppError(title, message, code, statusCode);
  }
};

// Hook para usar o error handler
export const useErrorHandler = () => {
  return {
    showError: ErrorHandler.showError,
    showSuccess: ErrorHandler.showSuccess,
    handleAsync: ErrorHandler.handleAsync,
    createError: ErrorHandler.createError
  };
};