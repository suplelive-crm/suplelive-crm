import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string | number;
  name: string;
  sku?: string;
}

interface ProductComboboxProps {
  products: Product[];
  value: Product | null;
  onSelect: (product: Product) => void;
}

// Usando exportação nomeada para consistência
export function ProductCombobox({ products, value, onSelect }: ProductComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left" // Adicionado text-left para nomes longos
        >
          {value?.name ? (
            <span className="truncate">{value.name}</span> // Evita que o nome quebre a linha no botão
          ) : (
            "Selecione um produto..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        {/* REMOVIDO o filter customizado para usar o padrão da biblioteca */}
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          {/* A CommandList agora tem altura máxima e rolagem */}
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  // Garantimos que o value é sempre uma string para o filtro funcionar
                  value={product.name || ''} 
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.name === product.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{product.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}