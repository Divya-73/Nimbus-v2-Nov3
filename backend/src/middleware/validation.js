import { validationError } from '../utils/response.js';
import { validateLoginInput, validateRefreshInput } from '../utils/validator.js';

// Validate login request
export function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const validation = validateLoginInput(email, password);
  
  if (!validation.isValid) {
    return validationError(res, validation.errors);
  }
  
  next();
}

// Validate refresh token request
export function validateRefresh(req, res, next) {
  const { refreshToken } = req.body;
  const validation = validateRefreshInput(refreshToken);
  
  if (!validation.isValid) {
    return validationError(res, validation.errors);
  }
  
  next();
}