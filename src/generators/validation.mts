import type { ColumnDefinition, ModelAttributes } from '../Types.mts';

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateModelAttributes(modelName: string, attributes: ModelAttributes): void {
  const errors: string[] = [];

  for (const [attrName, columnDef] of Object.entries(attributes)) {
    // Skip if no validation rules exist
    if (!columnDef.validate) continue;

    // Validate defaultValue if present
    if (columnDef.defaultValue !== undefined) {
      const result = validateValue(columnDef.defaultValue, columnDef);
      if (!result.valid) {
        errors.push(
          `[${modelName}.${attrName}] Default value validation failed: ${result.errors.join(', ')}`,
        );
      }
    }

    // Special handling for string length validation
    if (
      (columnDef.type === 'STRING' || columnDef.type === 'TEXT') &&
      columnDef.validate.len &&
      Array.isArray(columnDef.validate.len)
    ) {
      const [min, max] = columnDef.validate.len;
      if (
        columnDef.defaultValue &&
        typeof columnDef.defaultValue === 'string' &&
        (columnDef.defaultValue.length < min || columnDef.defaultValue.length > max)
      ) {
        errors.push(
          `[${modelName}.${attrName}] Default value length must be between ${min} and ${max}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Model validation errors:\n- ${errors.join('\n- ')}`);
  }
}

export function validateValue(value: unknown, columnDef: ColumnDefinition): ValidationResult {
  const errors: string[] = [];

  // Handle null values first
  if (value === null || value === undefined) {
    if (columnDef.allowNull === false) {
      return {
        valid: false,
        errors: ['Value cannot be null'],
      };
    }
    return { valid: true, errors: [] };
  }

  // Run all defined validations
  if (columnDef.validate) {
    const { validate } = columnDef;

    // Email validation
    if (validate.isEmail) {
      const isValid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isValid) {
        const msg =
          typeof validate.isEmail === 'object' ? validate.isEmail.msg : 'Must be a valid email';
        errors.push(msg);
      }
    }

    // URL validation
    if (validate.isUrl) {
      const isValid = typeof value === 'string' && /^https?:\/\/[^\s/$.?#].[^\s]*$/.test(value);
      if (!isValid) {
        const msg = typeof validate.isUrl === 'object' ? validate.isUrl.msg : 'Must be a valid URL';
        errors.push(msg);
      }
    }

    // IP validation
    if (validate.isIP) {
      const isValid = typeof value === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
      if (!isValid) {
        const msg =
          typeof validate.isIP === 'object' ? validate.isIP.msg : 'Must be a valid IP address';
        errors.push(msg);
      }
    }

    // Alpha validation
    if (validate.isAlpha) {
      const isValid = typeof value === 'string' && /^[a-zA-Z]+$/.test(value);
      if (!isValid) {
        const msg =
          typeof validate.isAlpha === 'object' ? validate.isAlpha.msg : 'Must contain only letters';
        errors.push(msg);
      }
    }

    // Alphanumeric validation
    if (validate.isAlphanumeric) {
      const isValid = typeof value === 'string' && /^[a-zA-Z0-9]+$/.test(value);
      if (!isValid) {
        const msg =
          typeof validate.isAlphanumeric === 'object'
            ? validate.isAlphanumeric.msg
            : 'Must contain only letters and numbers';
        errors.push(msg);
      }
    }

    // Numeric validation
    if (validate.isNumeric) {
      const isValid = !isNaN(Number(value));
      if (!isValid) {
        const msg =
          typeof validate.isNumeric === 'object' ? validate.isNumeric.msg : 'Must be a number';
        errors.push(msg);
      }
    }

    // Integer validation
    if (validate.isInt) {
      const isValid = Number.isInteger(Number(value));
      if (!isValid) {
        const msg = typeof validate.isInt === 'object' ? validate.isInt.msg : 'Must be an integer';
        errors.push(msg);
      }
    }

    // Float validation
    if (validate.isFloat) {
      const numValue = Number(value);
      const isValid = !isNaN(numValue) && !Number.isInteger(numValue);
      if (!isValid) {
        const msg = typeof validate.isFloat === 'object' ? validate.isFloat.msg : 'Must be a float';
        errors.push(msg);
      }
    }

    // Length validation
    if (validate.len) {
      let min: number, max: number;
      if (Array.isArray(validate.len)) {
        [min, max] = validate.len;
      } else if (validate.len.msg) {
        // Skip length check if only message is provided without range
        min = 0;
        max = Infinity;
      } else {
        min = 0;
        max = Infinity;
      }

      let length: number;
      if (typeof value === 'string') {
        length = value.length;
      } else if (Array.isArray(value)) {
        length = value.length;
      } else {
        length = String(value).length;
      }

      if (length < min || length > max) {
        const msg = Array.isArray(validate.len)
          ? `Length must be between ${min} and ${max}`
          : validate.len.msg || 'Invalid length';
        errors.push(msg);
      }
    }

    // NotIn validation
    if (validate.notIn) {
      const forbiddenValues = Array.isArray(validate.notIn)
        ? validate.notIn
        : validate.notIn.args || [];
      if (forbiddenValues.includes(value)) {
        const msg = Array.isArray(validate.notIn)
          ? 'Value is not allowed'
          : validate.notIn.msg || 'Value is not allowed';
        errors.push(msg);
      }
    }

    // IsIn validation
    if (validate.isIn) {
      const allowedValues = Array.isArray(validate.isIn) ? validate.isIn : validate.isIn.args || [];
      if (!allowedValues.includes(value)) {
        const msg = Array.isArray(validate.isIn)
          ? 'Value is not in allowed list'
          : validate.isIn.msg || 'Value is not in allowed list';
        errors.push(msg);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
