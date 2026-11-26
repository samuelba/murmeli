const target = process.env['BACKEND_URL'] ?? 'http://localhost:3000';

export default {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
