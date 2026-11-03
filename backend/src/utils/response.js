export function success(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
    requestId: res.req?.id,
  });
}

export function error(res, message, status = 400, extra = {}) {
  return res.status(status).json({
    success: false,
    message,
    requestId: res.req?.id,
    ...extra,
  });
}

export function validationError(res, errors) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors,
    requestId: res.req?.id,
  });
}
