import { supabase } from './supabase';

/**
 * Cliente para GhostAPIs via Edge Function (resolve CORS)
 */

export interface GhostAPIsResponse {
  'response.NOME'?: string;
  'response.EMAIL'?: string;
  'response.TELEFONES'?: string;
  'response.DATANASCIMENTO'?: string;
  'response.IDADE'?: string;
  'response.SEXO'?: string;
  'response.SIGNO'?: string;
  'response.NOMEMAE'?: string;
  'response.NOMEPAI'?: string;
  [key: string]: any;
}

export interface ClientData {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  dataNascimento?: string | null;
  idade?: string | null;
  sexo?: string | null;
  nomeMae?: string | null;
  nomePai?: string | null;
}

/**
 * Busca dados de cliente por CPF via GhostAPIs
 */
export async function fetchClientDataByCPF(
  cpf: string,
  workspaceId: string
): Promise<ClientData | null> {
  try {
    const cpfLimpo = cpf.replace(/\D/g, '');

    if (!cpfLimpo || cpfLimpo.length !== 11) {
      console.log(`[GHOST API] CPF inválido: ${cpf}`);
      return null;
    }

    console.log(`[GHOST API] Buscando dados do CPF: ${cpfLimpo}`);

    // Chamar Edge Function baselinker-proxy com service: 'ghostapis'
    const { data, error } = await supabase.functions.invoke('baselinker-proxy', {
      body: {
        service: 'ghostapis',
        endpoint: 'cpf',
        params: {
          cpf2: cpfLimpo,
        },
        workspaceId,
      },
    });

    if (error) {
      console.error(`[GHOST API] Erro ao chamar Edge Function:`, error);
      return null;
    }

    if (!data || !data['response.NOME']) {
      console.log(`[GHOST API] Dados não encontrados para CPF: ${cpfLimpo}`);
      return null;
    }

    // Processar telefones (pega o primeiro com 11+ dígitos)
    let telefone = null;
    if (data['response.TELEFONES']) {
      const telefones = data['response.TELEFONES']
        .split(',')
        .map((t: string) => t.trim());
      const telefoneValido = telefones.find(
        (t: string) => t.replace(/\D/g, '').length >= 11
      );

      if (telefoneValido) {
        const telefoneLimpo = telefoneValido.replace(/\D/g, '');
        telefone = `+55${telefoneLimpo}`;
      }
    }

    const result = {
      nome: data['response.NOME'] || null,
      email: data['response.EMAIL'] || null,
      telefone,
      dataNascimento: data['response.DATANASCIMENTO'] || null,
      idade: data['response.IDADE'] || null,
      sexo: data['response.SEXO'] || null,
      nomeMae: data['response.NOMEMAE'] || null,
      nomePai: data['response.NOMEPAI'] || null,
    };

    console.log(`[GHOST API] ✅ Dados encontrados:`, {
      nome: result.nome,
      email: result.email,
      telefone: result.telefone,
    });

    return result;
  } catch (error) {
    console.error(`[GHOST API] Erro ao buscar dados:`, error);
    return null;
  }
}

/**
 * Busca dados de cliente por telefone via GhostAPIs
 */
export async function fetchClientDataByPhone(
  telefone: string,
  workspaceId: string
): Promise<ClientData | null> {
  try {
    const telefoneLimpo = telefone.replace(/\D/g, '');

    if (!telefoneLimpo || telefoneLimpo.length < 10) {
      console.log(`[GHOST API] Telefone inválido: ${telefone}`);
      return null;
    }

    console.log(`[GHOST API] Buscando dados do telefone: ${telefoneLimpo}`);

    // Chamar Edge Function baselinker-proxy com service: 'ghostapis'
    const { data, error } = await supabase.functions.invoke('baselinker-proxy', {
      body: {
        service: 'ghostapis',
        endpoint: 'telefone',
        params: {
          telefone4: telefoneLimpo,
        },
        workspaceId,
      },
    });

    if (error) {
      console.error(`[GHOST API] Erro ao chamar Edge Function:`, error);
      return null;
    }

    if (!data || !data['response.NOME']) {
      console.log(`[GHOST API] Dados não encontrados para telefone: ${telefoneLimpo}`);
      return null;
    }

    const result = {
      nome: data['response.NOME'] || null,
      email: data['response.EMAIL'] || null,
      telefone: telefone,
      dataNascimento: data['response.DATANASCIMENTO'] || null,
      idade: data['response.IDADE'] || null,
      sexo: data['response.SEXO'] || null,
      nomeMae: data['response.NOMEMAE'] || null,
      nomePai: data['response.NOMEPAI'] || null,
    };

    console.log(`[GHOST API] ✅ Dados encontrados:`, {
      nome: result.nome,
      email: result.email,
      telefone: result.telefone,
    });

    return result;
  } catch (error) {
    console.error(`[GHOST API] Erro ao buscar dados:`, error);
    return null;
  }
}

/**
 * Verifica saldo da API GhostAPIs
 */
export async function checkGhostAPIsBalance(
  workspaceId: string
): Promise<{ saldo: number; limite: number } | null> {
  try {
    console.log(`[GHOST API] Verificando saldo...`);

    // Para verificar saldo, usar a URL info.php
    // Mas como nosso proxy usa api.php, vamos retornar null por enquanto
    // TODO: Adicionar endpoint separado para info.php no proxy

    console.warn(`[GHOST API] Verificação de saldo ainda não implementada`);
    return null;
  } catch (error) {
    console.error(`[GHOST API] Erro ao verificar saldo:`, error);
    return null;
  }
}
