import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

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

  const filteredProducts = useMemo(() => {
    if (!inputValue) {
      return [];
    }

    const lowercasedInput = inputValue.toLowerCase().trim();
    const searchWords = lowercasedInput.split(' ').filter(word => word.length > 0);

    if (searchWords.length === 0) {
        return [];
    }

    const scoredProducts = products
      .map(product => {
        const productNameLower = product.name?.toLowerCase() || '';
        let score = 0;

        if (productNameLower.includes(lowercasedInput)) {
          score = 2;
        }
        else if (searchWords.every(word => productNameLower.includes(word))) {
          score = 1;
        }

        return { product, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const initialResults = scoredProducts.map(item => item.product);

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

  useEffect(() => {
    if (inputValue && filteredProducts.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, filteredProducts.length]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setIsOpen(false);
  };

  const handleInputChange = (value: string) => {
    onInputChange(value);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
      <PopoverAnchor asChild>
        <Input
          type="text"
          placeholder="Digite para buscar um produto..."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full"
        />
      </PopoverAnchor>

      <PopoverContent
        className="w-[--radix-popover-anchor-width] p-0 z-[9999]"
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
                  onSelect={() => handleSelect(product)}
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

