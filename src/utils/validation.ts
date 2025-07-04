import Joi from 'joi';

// Title validation schema
export const titleSchema = Joi.string()
  .min(10)
  .max(100)
  .pattern(/^[a-zA-Z0-9\s\-_.,!]+$/)
  .required()
  .messages({
    'string.min': 'Title must be at least 10 characters long',
    'string.max': 'Title must not exceed 100 characters',
    'string.pattern.base': 'Title can only contain letters, numbers, spaces, and the following characters: - _ . , !',
    'any.required': 'Title is required',
  });

// Description validation schema
export const descriptionSchema = Joi.string()
  .min(10)
  .required()
  .messages({
    'string.min': 'Description must be at least 10 characters long.',
    'any.required': 'Description is required',
  });

export function validateTitle(title: string): { isValid: boolean; error?: string } {
  const result = titleSchema.validate(title);
  
  if (result.error) {
    return { isValid: false, error: result.error.details[0].message };
  }
  
  return { isValid: true };
}

export function validateDescription(description: string): { isValid: boolean; error?: string } {
  const result = descriptionSchema.validate(description);
  
  if (result.error) {
    return { isValid: false, error: result.error.details[0].message };
  }
  
  return { isValid: true };
}

export function sanitizeInput(input: string): string {
  // Remove any control characters and trim whitespace
  return input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

export function parseNameDepartment(input: string): { name: string; department: string } | null {
  const parts = input.split('_');
  
  if (parts.length !== 2) {
    return null;
  }
  
  const [name, department] = parts.map(part => part.trim());
  
  if (!name || !department) {
    return null;
  }
  
  // Validate name and department
  const namePattern = /^[a-zA-Z\s\-']+$/;
  const deptPattern = /^[a-zA-Z\s\-&]+$/;
  
  if (!namePattern.test(name) || !deptPattern.test(department)) {
    return null;
  }
  
  return { name, department };
}