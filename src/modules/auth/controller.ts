import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../infra/prisma.js';
import { verifyPassword } from './password.js';
import { generateToken } from './csrf.js';

const loginSchema = z.object({
  email: z.string().email('Ingrese un correo electrónico válido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});

export class AuthController {
  showLogin(req: Request, res: Response): void {
    if (req.session?.user) {
      return res.redirect('/');
    }
    const token = generateToken(req, res);
    res.render('auth/login.njk', {
      title: 'Iniciar sesión — SGEC',
      csrfToken: token,
      error: null,
    });
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isHtml = req.accepts('html') && !req.xhr && !req.path.startsWith('/api');
      const validation = loginSchema.safeParse(req.body);

      if (!validation.success) {
        if (isHtml) {
          const token = generateToken(req, res);
          res.status(400).render('auth/login.njk', {
            title: 'Iniciar sesión — SGEC',
            csrfToken: token,
            error: 'Por favor complete todos los campos requeridos correctamente',
            email: req.body?.email ?? '',
          });
          return;
        }
        res.status(400).json({ error: 'Credenciales inválidas', details: validation.error.format() });
        return;
      }

      const { email, password } = validation.data;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.active) {
        if (isHtml) {
          const token = generateToken(req, res);
          res.status(401).render('auth/login.njk', {
            title: 'Iniciar sesión — SGEC',
            csrfToken: token,
            error: 'Credenciales incorrectas o usuario inactivo',
            email,
          });
          return;
        }
        res.status(401).json({ error: 'Credenciales incorrectas o usuario inactivo' });
        return;
      }

      const passwordOk = await verifyPassword(password, user.passwordHash);
      if (!passwordOk) {
        if (isHtml) {
          const token = generateToken(req, res);
          res.status(401).render('auth/login.njk', {
            title: 'Iniciar sesión — SGEC',
            csrfToken: token,
            error: 'Credenciales incorrectas o usuario inactivo',
            email,
          });
          return;
        }
        res.status(401).json({ error: 'Credenciales incorrectas o usuario inactivo' });
        return;
      }

      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      req.session.save((err) => {
        if (err) {
          return next(err);
        }
        if (isHtml) {
          return res.redirect('/');
        }
        res.status(200).json({
          status: 'ok',
          user: req.session.user,
        });
      });
    } catch (err) {
      next(err);
    }
  }

  logout(req: Request, res: Response, next: NextFunction): void {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('sgec.sid');
      const isHtml = req.accepts('html') && !req.xhr && !req.path.startsWith('/api');
      if (isHtml) {
        return res.redirect('/login');
      }
      res.status(200).json({ status: 'ok', message: 'Sesión finalizada' });
    });
  }
}
