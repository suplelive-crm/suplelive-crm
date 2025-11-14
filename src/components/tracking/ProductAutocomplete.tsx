import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspaceStore';

// Interface para produtos com estoque dinâmico por warehouse
interface Product {
  id: string | number;
  name: string;
  SKU?: string;
  sku?: string;
  stock_es?: number; // DEPRECATED: Será removido na migração final
  stock_sp?: number; // DEPRECATED: Será removido na migração final
  warehouseID?: string; // ID do warehouse no Baselinker
}

// Interface para estoque por warehouse
interface WarehouseStock {
  warehouse_id: string;
  stock_quantity: number;
}

interface ProductAutocompleteProps {
  products: Product[];
  value: Partial<Product> | null;
  onSelect: (product: Product) => void;
  onInputChange: (value: string) => void;
  selectedWarehouse?: string; // Warehouse selecionado para filtrar exibição
}

export function ProductAutocomplete({
  products,
  value,
  onSelect,
  onInputChange,
  selectedWarehouse
}: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [warehouseStocks, setWarehouseStocks] = useState<Map<string, Map<string, number>>>(new Map());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { currentWorkspace } = useWorkspaceStore();

  const inputValue = value?.name || '';

  // Buscar estoques por warehouse quando produtos ou warehouse mudam
  useEffect(() => {
    fetchWarehouseStocks();
  }, [products, currentWorkspace]);

  const fetchWarehouseStocks = async () => {
    if (!currentWorkspace || products.length === 0) return;

    try {
      // Pegar todos os SKUs dos produtos filtrados
      const skus = products
        .map(p => p.SKU || p.sku)
        .filter(Boolean) as string[];

      if (skus.length === 0) return;

      // Buscar estoques de todos os produtos de uma vez
      const { data, error } = await supabase
        .from('product_stock_by_warehouse')
        .select('sku, warehouse_id, stock_quantity')
        .eq('workspace_id', currentWorkspace.id)
        .in('sku', skus);

      if (error) {
        console.error('Error fetching warehouse stocks:', error);
        return;
      }

      // Organizar em Map<SKU, Map<WarehouseID, Quantity>>
      const stockMap = new Map<string, Map<string, number>>();

      (data || []).forEach((stock: any) => {
        if (!stockMap.has(stock.sku)) {
          stockMap.set(stock.sku, new Map());
        }
        stockMap.get(stock.sku)!.set(stock.warehouse_id, stock.stock_quantity);
      });

      setWarehouseStocks(stockMap);
    } catch (error) {
      console.error('Error in fetchWarehouseStocks:', error);
    }
  };

  // Filtrar e ordenar produtos
  const filteredProducts = useMemo(() => {
    if (!inputValue || inputValue.length < 2) {
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
        } else if (searchWords.every(word => productNameLower.includes(word))) {
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

    // Filtrar por sabor se houver resultados com sabor
    const hasFlavorVariantInResults = initialResults.some(p =>
      p.name?.toLowerCase().includes('sabor')
    );

    if (hasFlavorVariantInResults) {
      return initialResults.filter(p =>
        p.name?.toLowerCase().includes('sabor')
      );
    }

    return initialResults;
  }, [inputValue, products]);

  // Abrir/fechar dropdown baseado no input
  useEffect(() => {
    if (inputValue.length >= 2 && filteredProducts.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [inputValue, filteredProducts.length]);

  // Fechar ao clicar fora - APENAS quando dropdown estiver aberto
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Usar setTimeout para evitar fechar imediatamente após abrir
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]); // Dependência: isOpen

  // Limpar estado quando componente desmontar
  useEffect(() => {
    return () => {
      setIsOpen(false);
    };
  }, []);

  const handleSelect = (product: Product) => {
    const standardizedProduct = {
      ...product,
      SKU: product.SKU || product.sku || '',
    };

    setIsOpen(false);
    onSelect(standardizedProduct);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e.target.value);
  };

  const handleInputBlur = () => {
    // Delay para permitir clique nos itens do dropdown
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  // Função para obter o estoque correto do warehouse dinâmico
  const getStockDisplay = (product: Product): string => {
    const sku = product.SKU || product.sku || '';
    const productStocks = warehouseStocks.get(sku);

    // Se não há estoque na nova tabela, usar fallback das colunas antigas (temporário)
    if (!productStocks || productStocks.size === 0) {
      // Fallback para colunas antigas durante migração
      if (selectedWarehouse) {
        const esStock = product.stock_es ?? 0;
        const spStock = product.stock_sp ?? 0;
        // Tentar identificar se é ES ou SP baseado no warehouse selecionado
        if (selectedWarehouse.toLowerCase().includes('es')) {
          return `Estoque: ${esStock}`;
        } else if (selectedWarehouse.toLowerCase().includes('sp')) {
          return `Estoque: ${spStock}`;
        }
        return `ES: ${esStock} | SP: ${spStock}`;
      }

      const esStock = product.stock_es ?? 0;
      const spStock = product.stock_sp ?? 0;
      return `ES: ${esStock} | SP: ${spStock}`;
    }

    // NOVO SISTEMA: Estoque dinâmico por warehouse
    if (selectedWarehouse) {
      // Mostrar apenas estoque do warehouse selecionado
      const stock = productStocks.get(selectedWarehouse) ?? 0;
      return `Estoque: ${stock}`;
    }

    // Se não há warehouse selecionado, mostrar total de todos os warehouses
    const totalStock = Array.from(productStocks.values()).reduce((sum, qty) => sum + qty, 0);
    const warehouseCount = productStocks.size;

    if (warehouseCount === 1) {
      return `Estoque: ${totalStock}`;
    }

    return `Total: ${totalStock} (${warehouseCount} warehouses)`;
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Digite para buscar um produto (mínimo 2 letras)..."
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (inputValue.length >= 2 && filteredProducts.length > 0) {
            setIsOpen(true);
          }
        }}
        onBlur={handleInputBlur}
        className="w-full"
        autoComplete="off"
      />

      {isOpen && filteredProducts.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          <div className="py-1">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onMouseDown={(e) => {
                  e.preventDefault(); // Previne blur do input
                  handleSelect(product);
                }}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {product.name}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                    {getStockDisplay(product)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
