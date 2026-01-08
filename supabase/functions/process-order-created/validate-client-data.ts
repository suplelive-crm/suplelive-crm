// Módulo: Validação de Dados do Cliente
// Implementa busca no GhostAPI e validação de telefones via WhatsApp

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface GhostAPIPhone {
  numero: string;
  tipo?: string; // "CELULAR", "FIXO", etc
  whatsapp?: boolean;
}

interface GhostAPIResponse {
  success: boolean;
  data?: {
    telefones?: GhostAPIPhone[];
    nome?: string;
    cpf?: string;
  };
}

interface WhatsAppValidation {
  exists: boolean;
  name?: string;
  phone: string;
  verified: boolean;
  nameSimilarity?: number; // 0-100 (percentual de similaridade)
}

/**
 * Calcula similaridade entre dois nomes usando Levenshtein Distance
 * Retorna percentual de 0-100
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  // Normalizar nomes (lowercase, sem acentos, trim)
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  };

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Se forem iguais
  if (n1 === n2) return 100;

  // Levenshtein Distance
  const matrix: number[][] = [];
  const len1 = n1.length;
  const len2 = n2.length;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (n1.charAt(i - 1) === n2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // remoção
        );
      }
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * Busca telefones do cliente no GhostAPI usando CPF
 */
async function searchPhonesByGhostAPI(
  cpf: string,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<GhostAPIPhone[]> {
  try {
    // Buscar configuração GhostAPI do workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    const ghostConfig = workspace?.settings?.ghost_api;

    if (!ghostConfig?.api_key || !ghostConfig?.base_url) {
      console.log('GhostAPI não configurado para este workspace');
      return [];
    }

    // Limpar CPF (apenas números)
    const cleanCPF = cpf.replace(/\D/g, '');

    if (cleanCPF.length !== 11) {
      console.log('CPF inválido:', cpf);
      return [];
    }

    // Fazer requisição ao GhostAPI
    const ghostUrl = `${ghostConfig.base_url}/consulta/cpf`;

    console.log('Consultando GhostAPI para CPF:', cleanCPF);

    const response = await fetch(ghostUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ghostConfig.api_key}`,
      },
      body: JSON.stringify({ cpf: cleanCPF })
    });

    if (!response.ok) {
      console.error('GhostAPI error:', response.status, await response.text());
      return [];
    }

    const result: GhostAPIResponse = await response.json();

    if (!result.success || !result.data?.telefones) {
      console.log('GhostAPI não retornou telefones');
      return [];
    }

    console.log(`GhostAPI retornou ${result.data.telefones.length} telefone(s)`);

    return result.data.telefones;

  } catch (error) {
    console.error('Erro ao buscar telefones no GhostAPI:', error);
    return [];
  }
}

/**
 * Valida telefone no WhatsApp via Evolution API
 */
async function validateWhatsAppNumber(
  phone: string,
  instanceId: string,
  expectedName: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<WhatsAppValidation> {
  try {
    // Limpar telefone (apenas números)
    const cleanPhone = phone.replace(/\D/g, '');

    // Formato brasileiro: deve ter 12 ou 13 dígitos (55 + DDD + número)
    if (cleanPhone.length < 12 || cleanPhone.length > 13) {
      console.log('Telefone inválido (formato):', phone);
      return {
        exists: false,
        phone: cleanPhone,
        verified: false,
      };
    }

    // Adicionar código do país se não tiver
    const phoneWithCountry = cleanPhone.startsWith('55')
      ? cleanPhone
      : `55${cleanPhone}`;

    console.log('Validando telefone no WhatsApp:', phoneWithCountry);

    // Chamar Edge Function de validação
    const functionUrl = `${supabaseUrl}/functions/v1/validate-whatsapp-number`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        phone: phoneWithCountry,
        instanceId: instanceId,
      })
    });

    if (!response.ok) {
      console.error('Erro ao validar WhatsApp:', await response.text());
      return {
        exists: false,
        phone: phoneWithCountry,
        verified: false,
      };
    }

    const validation: WhatsAppValidation = await response.json();

    // Calcular similaridade de nome se WhatsApp retornou nome
    if (validation.exists && validation.name) {
      validation.nameSimilarity = calculateNameSimilarity(
        expectedName,
        validation.name
      );

      console.log(`Similaridade de nome: ${validation.nameSimilarity}% (WhatsApp: "${validation.name}" vs Pedido: "${expectedName}")`);
    }

    return validation;

  } catch (error) {
    console.error('Erro ao validar telefone:', error);
    return {
      exists: false,
      phone: phone,
      verified: false,
    };
  }
}

/**
 * Função principal: Valida e retorna o melhor telefone encontrado
 *
 * Lógica:
 * 1. Busca telefones no GhostAPI usando CPF
 * 2. Valida cada telefone no WhatsApp (Evolution API)
 * 3. Calcula similaridade entre nome do WhatsApp e nome do pedido
 * 4. Retorna telefone com maior score (existe no WhatsApp + nome similar)
 * 5. Se nenhum telefone válido, retorna null
 */
export async function validateAndFindBestPhone(
  cpf: string,
  customerName: string,
  workspaceId: string,
  whatsappInstanceId: string,
  supabase: SupabaseClient
): Promise<string | null> {

  console.log(`\n=== Iniciando validação de telefone ===`);
  console.log(`CPF: ${cpf}`);
  console.log(`Nome esperado: ${customerName}`);

  // Passo 1: Buscar telefones no GhostAPI
  const ghostPhones = await searchPhonesByGhostAPI(cpf, workspaceId, supabase);

  if (ghostPhones.length === 0) {
    console.log('GhostAPI não retornou telefones');
    return null;
  }

  // Passo 2: Validar cada telefone no WhatsApp
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const validations: WhatsAppValidation[] = [];

  for (const ghostPhone of ghostPhones) {
    const validation = await validateWhatsAppNumber(
      ghostPhone.numero,
      whatsappInstanceId,
      customerName,
      supabaseUrl,
      supabaseKey
    );

    if (validation.verified) {
      validations.push(validation);
    }
  }

  if (validations.length === 0) {
    console.log('Nenhum telefone válido encontrado no WhatsApp');
    return null;
  }

  // Passo 3: Escolher melhor telefone baseado em score
  // Score = existe no WhatsApp (50 pontos) + similaridade de nome (50 pontos)
  const scoredPhones = validations.map(v => ({
    phone: v.phone,
    name: v.name,
    score: 50 + (v.nameSimilarity || 0) / 2, // 50 (WhatsApp) + até 50 (nome similar)
    nameSimilarity: v.nameSimilarity || 0,
  }));

  // Ordenar por score (maior primeiro)
  scoredPhones.sort((a, b) => b.score - a.score);

  const bestPhone = scoredPhones[0];

  console.log(`\n=== Resultado da validação ===`);
  console.log(`Telefones encontrados: ${ghostPhones.length}`);
  console.log(`Telefones válidos no WhatsApp: ${validations.length}`);
  console.log(`Melhor telefone: ${bestPhone.phone}`);
  console.log(`Nome do WhatsApp: ${bestPhone.name}`);
  console.log(`Similaridade de nome: ${bestPhone.nameSimilarity}%`);
  console.log(`Score final: ${bestPhone.score}`);

  // Critério de aceitação: Score mínimo de 60 (WhatsApp válido + nome com pelo menos 20% de similaridade)
  if (bestPhone.score >= 60) {
    console.log(`✅ Telefone aceito (score >= 60)`);
    return bestPhone.phone;
  } else {
    console.log(`❌ Telefone rejeitado (score < 60 - nome muito diferente)`);
    return null;
  }
}
