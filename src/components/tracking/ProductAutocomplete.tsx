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
  // Nova prop para lidar com a digitação direta
  onInputChange: (value: string) => void;
}

export function ProductAutocomplete({ products, value, onSelect, onInputChange }: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // O valor do input é controlado diretamente pelo estado do formulário principal
  const inputValue = value?.name || '';

  // Filtra os produtos com base no que foi digitado
  const filteredProducts = useMemo(() => {
    if (!inputValue) {
      // Se o campo estiver vazio, podemos optar por não mostrar nada ou mostrar alguns itens recentes.
      // Por enquanto, não mostraremos nada para uma UI mais limpa.
      return []; 
    }
    const lowercasedInput = inputValue.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(lowercasedInput)
    );
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
    // PopoverAnchor faz o PopoverContent se alinhar a este Input
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
            // Pequeno delay para permitir o clique no item da lista antes de fechar
            setTimeout(() => setIsOpen(false), 150);
          }}
          className="w-full"
        />
      </PopoverAnchor>

      <PopoverContent 
        className="w-[--radix-popover-anchor-width] p-0" 
        onOpenAutoFocus={(e) => e.preventDefault()} // Impede que o popover roube o foco do input
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