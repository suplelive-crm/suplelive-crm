import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

// Interfaces para as props (sem alteração)
interface Product {
  id: string | number;
  name: string;
  sku?: string;
}

interface ProductAutocompleteProps {
  products: Product[];
  value: Partial<Product> | null;
  onSelect: (product: Product) => void;
  onInputChange: (value: string) => void;
}

export function ProductAutocomplete({ products, value, onSelect, onInputChange }: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const inputValue = value?.name || '';

  // LÓGICA DE FILTRAGEM AVANÇADA
  const filteredProducts = useMemo(() => {
    if (!inputValue) {
      return []; 
    }

    const lowercasedInput = inputValue.toLowerCase().trim();
    // Separa a busca em palavras-chave, removendo espaços vazios
    const searchWords = lowercasedInput.split(' ').filter(word => word.length > 0);

    if (searchWords.length === 0) {
        return [];
    }

    // Passo 1: Pontuar cada produto com base na qualidade da correspondência
    const scoredProducts = products
      .map(product => {
        const productNameLower = product.name?.toLowerCase() || '';
        let score = 0;

        // Prioridade MÁXIMA (Score 2): A frase exata está contida no nome
        if (productNameLower.includes(lowercasedInput)) {
          score = 2;
        } 
        // Prioridade MÉDIA (Score 1): TODAS as palavras da busca estão contidas no nome, em qualquer ordem
        else if (searchWords.every(word => productNameLower.includes(word))) {
          score = 1;
        }

        return { product, score };
      })
      // Passo 2: Filtrar os que não tiveram correspondência e ordenar pelos melhores scores
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Passo 3: Extrair a lista de produtos já ordenada pela relevância da busca
    const initialResults = scoredProducts.map(item => item.product);

    // Passo 4: Manter a lógica de priorização de "sabor" que já existia
    if (initialResults.length === 0) {
      return [];
    }

    const hasFlavorVariantInResults = initialResults.some(p => 
      p.name?.toLowerCase().includes('sabor')
    );

    if (hasFlavorVariantInResults) {
      return initialResults.filter(p => 
        p.name?.toLowerCase().includes('sabor')
      );
    } else {
      return initialResults;
    }

  }, [inputValue, products]);

  // Lógica de abertura/fechamento do Popover (sem alteração)
  useEffect(() => {
    if (inputValue && filteredProducts.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, filteredProducts.length]);


  return (
    // JSX do componente (sem alteração)
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <Input
          type="text"
          placeholder="Digite para buscar um produto..."
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => {
            if (inputValue) setIsOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
          className="w-full"
        />
      </PopoverAnchor>

      <PopoverContent 
        className="w-[--radix-popover-anchor-width] p-0" 
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList className="max-h-[300px] overflow-y-auto">
            {filteredProducts.length === 0 && inputValue && (
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  onSelect={() => {
                    onSelect(product);
                    setIsOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}