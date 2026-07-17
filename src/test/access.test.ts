import { describe, expect, it } from 'vitest';
import { canAccessPath, canManageProducts } from '@/lib/access';

describe('canAccessPath', () => {
  it('permite que admin acesse rotas administrativas', () => {
    expect(canAccessPath('admin', '/financeiro')).toBe(true);
    expect(canAccessPath('admin', '/excluidos')).toBe(true);
  });

  it('bloqueia rotas administrativas para operador', () => {
    expect(canAccessPath('operator', '/financeiro')).toBe(false);
    expect(canAccessPath('operator', '/relatorios')).toBe(false);
    expect(canAccessPath('operator', '/estoque')).toBe(false);
  });

  it('mantem acesso do operador as rotas permitidas', () => {
    expect(canAccessPath('operator', '/')).toBe(true);
    expect(canAccessPath('operator', '/pdv')).toBe(true);
    expect(canAccessPath('operator', '/clientes')).toBe(true);
    expect(canAccessPath('operator', '/produtos')).toBe(true);
    expect(canAccessPath('operator', '/cliente/joao')).toBe(true);
  });

  it('mantem perfil RH fora das rotas do ERP principal', () => {
    expect(canAccessPath('hr', '/')).toBe(false);
    expect(canAccessPath('hr', '/pdv')).toBe(false);
    expect(canAccessPath('hr', '/clientes')).toBe(false);
    expect(canAccessPath('hr', '/financeiro')).toBe(false);
  });

  it('bloqueia gestao de produtos para operador', () => {
    expect(canManageProducts('operator')).toBe(false);
    expect(canManageProducts('admin')).toBe(true);
  });
});
