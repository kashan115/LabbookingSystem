import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to add Cache-Control headers to GET responses
 * @param maxAge - Cache duration in seconds
 */
export const cacheControl = (maxAge: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
    }
    next();
  };
};

/**
 * Middleware to disable caching (for dynamic/private data)
 */
export const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};
