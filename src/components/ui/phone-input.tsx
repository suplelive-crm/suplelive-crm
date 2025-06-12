import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Country {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  mask: string;
  validation: RegExp;
}

const countries: Country[] = [
  {
    code: 'BR',
    name: 'Brasil',
    flag: '🇧🇷',
    dialCode: '+55',
    mask: '(##) #####-####',
    validation: /^\(\d{2}\) \d{5}-\d{4}$/
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    flag: '🇺🇸',
    dialCode: '+1',
    mask: '(###) ###-####',
    validation: /^\(\d{3}\) \d{3}-\d{4}$/
  },
  {
    code: 'AR',
    name: 'Argentina',
    flag: '🇦🇷',
    dialCode: '+54',
    mask: '## ####-####',
    validation: /^\d{2} \d{4}-\d{4}$/
  },
  {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    dialCode: '+351',
    mask: '### ### ###',
    validation: /^\d{3} \d{3} \d{3}$/
  },
  {
    code: 'ES',
    name: 'Espanha',
    flag: '🇪🇸',
    dialCode: '+34',
    mask: '### ### ###',
    validation: /^\d{3} \d{3} \d{3}$/
  }
];

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string, isValid: boolean) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  error?: string;
}

export function PhoneInput({
  value = '',
  onChange,
  placeholder = 'Digite o número',
  className,
  label = 'Telefone',
  required = false,
  error
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]); // Brasil por padrão
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Parse initial value
  useEffect(() => {
    if (value) {
      // Try to parse existing value
      const country = countries.find(c => value.startsWith(c.dialCode));
      if (country) {
        setSelectedCountry(country);
        const number = value.replace(country.dialCode, '').trim();
        setPhoneNumber(applyMask(number, country.mask));
      } else {
        setPhoneNumber(value);
      }
    }
  }, [value]);

  const applyMask = (input: string, mask: string): string => {
    const numbers = input.replace(/\D/g, '');
    let masked = '';
    let numberIndex = 0;

    for (let i = 0; i < mask.length && numberIndex < numbers.length; i++) {
      if (mask[i] === '#') {
        masked += numbers[numberIndex];
        numberIndex++;
      } else {
        masked += mask[i];
      }
    }

    return masked;
  };

  const handlePhoneChange = (input: string) => {
    const maskedValue = applyMask(input, selectedCountry.mask);
    setPhoneNumber(maskedValue);
    
    const valid = selectedCountry.validation.test(maskedValue);
    setIsValid(valid);
    
    const fullNumber = valid ? `${selectedCountry.dialCode} ${maskedValue}` : '';
    onChange?.(fullNumber, valid);
  };

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
      setPhoneNumber('');
      setIsValid(false);
      onChange?.('', false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor="phone-input">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      
      <div className="flex space-x-2">
        {/* Country Selector */}
        <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-32">
            <SelectValue>
              <div className="flex items-center space-x-2">
                <span>{selectedCountry.flag}</span>
                <span className="text-sm">{selectedCountry.dialCode}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center space-x-2">
                  <span>{country.flag}</span>
                  <span>{country.dialCode}</span>
                  <span className="text-sm text-gray-600">{country.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Phone Number Input */}
        <div className="flex-1">
          <Input
            id="phone-input"
            type="tel"
            value={phoneNumber}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={selectedCountry.mask.replace(/#/g, '0')}
            className={cn(
              'transition-colors',
              phoneNumber && !isValid && 'border-red-500 focus:border-red-500',
              phoneNumber && isValid && 'border-green-500 focus:border-green-500'
            )}
          />
        </div>
      </div>

      {/* Validation Messages */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {phoneNumber && !isValid && !error && (
        <p className="text-sm text-red-600">
          Formato inválido. Use: {selectedCountry.mask.replace(/#/g, '0')}
        </p>
      )}
      
      {phoneNumber && isValid && (
        <p className="text-sm text-green-600 flex items-center">
          <span className="mr-1">✓</span>
          Número válido: {selectedCountry.dialCode} {phoneNumber}
        </p>
      )}

      {/* Format Helper */}
      <p className="text-xs text-gray-500">
        Formato esperado: {selectedCountry.dialCode} {selectedCountry.mask.replace(/#/g, '0')}
      </p>
    </div>
  );
}