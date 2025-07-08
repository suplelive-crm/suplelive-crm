import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

// Interfaces para as props
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

  // LÓGICA DE FILTRAGEM COM PRIORIZAÇÃO DE SABOR
  const filteredProducts = useMemo(() => {
    if (!inputValue) {
      return []; 
    }

    const lowercasedInput = inputValue.toLowerCase();
    
    // Passo 1: Faz a busca inicial e geral com o texto digitado.
    const initialResults = products.filter(p => 
      p.name?.toLowerCase().includes(lowercasedInput)
    );

    // Se a busca inicial não retornou nada, não há mais o que fazer.
    if (initialResults.length === 0) {
      return [];
    }

    // Passo 2: Analisa os resultados iniciais para ver se existem variações com "sabor".
    const hasFlavorVariantInResults = initialResults.some(p => 
      p.name?.toLowerCase().includes('sabor')
    );

    // Passo 3: Aplica a regra de negócio.
    if (hasFlavorVariantInResults) {
      // Se existem opções de sabor nos resultados, filtre novamente para mostrar APENAS elas.
      return initialResults.filter(p => 
        p.name?.toLowerCase().includes('sabor')
      );
    } else {
      // Se não há opções de sabor, retorne os resultados iniciais como estão.
      return initialResults;
    }

  }, [inputValue, products]);

  // Abre a lista quando o input tem foco e texto
  useEffect(() => {
    if (inputValue && filteredProducts.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, filteredProducts.length]);

  return (
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