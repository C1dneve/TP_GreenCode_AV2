import bcrypt from "bcryptjs";
import type { PapelUsuario, Prisma } from "../../generated/prisma/client.js";
import { errors, isPrismaCode } from "../../shared/domain-error.js";
import { assertRole } from "../../shared/authorization.js";
import { pageMeta } from "../../shared/pagination.js";
import { requireExpectedVersion } from "../../shared/version.js";
import { UsuariosRepository } from "./usuarios.repository.js";

const roles = new Set(["ADMINISTRADOR", "OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR"]);
export class UsuariosService {
  constructor(private readonly repository: UsuariosRepository) {}
  async list(input: { page?: number; pageSize?: number; busca?: string; papel?: PapelUsuario; ativo?: boolean }, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    const page = Math.max(1, Math.trunc(input.page ?? 1)); const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20)));
    const result = await this.repository.list({ ...input, page, pageSize });
    return { data: result.data, meta: pageMeta(page, pageSize, result.total) };
  }
  async create(input: { usuario: string; nome: string; senha: string; papel: PapelUsuario }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    const usuario = input.usuario.trim().toLocaleLowerCase("pt-BR"); const nome = input.nome.trim();
    if (!usuario || !nome || input.senha.length < 12 || !roles.has(input.papel)) throw errors.badRequest("VALIDATION_ERROR", "Dados do usuário inválidos.");
    try {
      return await this.repository.transaction(async (tx) => {
        const created = await tx.create({ usuario, nome, senhaHash: await bcrypt.hash(input.senha, 12), papel: input.papel });
        const actor = await tx.findActorName(actorId);
        await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "CRIACAO_USUARIO", entidade: "Usuario", entidadeId: created.id, resultado: "SUCESSO", requestId });
        return created;
      });
    } catch (error) { if (isPrismaCode(error, "P2002")) throw errors.conflict("USER_ALREADY_EXISTS", "Já existe um usuário com esse identificador."); throw error; }
  }
  async get(id: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    const user = await this.repository.findPublicById(id);
    if (!user) throw errors.notFound("USER_NOT_FOUND", "Usuário não encontrado.");
    return user;
  }
  async update(id: string, input: { versaoEsperada: number; usuario?: string; nome?: string; papel?: PapelUsuario }, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    requireExpectedVersion(input.versaoEsperada);
    if ((input.usuario !== undefined && !input.usuario.trim()) || (input.nome !== undefined && !input.nome.trim()) || (input.usuario === undefined && input.nome === undefined && input.papel === undefined) || (input.papel !== undefined && !roles.has(input.papel))) throw errors.badRequest("VALIDATION_ERROR", "Informe campos válidos para atualização.");
    try {
      return await this.repository.transaction(async (tx) => {
        const current = await tx.findById(id);
        if (!current) throw errors.notFound("USER_NOT_FOUND", "Usuário não encontrado.");
        if (current.versao !== input.versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
        if (current.ativo && current.papel === "ADMINISTRADOR" && input.papel !== undefined && input.papel !== "ADMINISTRADOR" && await tx.countActiveAdmins() <= 1) throw errors.conflict("LAST_ADMINISTRATOR", "Não é permitido remover o último Administrador ativo.");
        const data: Prisma.UsuarioUpdateManyMutationInput = { versao: { increment: 1 } };
        if (input.usuario !== undefined) data.usuario = input.usuario.trim().toLocaleLowerCase("pt-BR");
        if (input.nome !== undefined) data.nome = input.nome.trim();
        if (input.papel !== undefined) data.papel = input.papel;
        const updated = await tx.updateByVersion(id, input.versaoEsperada, data);
        if (!updated) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
        const actor = await tx.findActorName(actorId);
        await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "ATUALIZACAO_USUARIO", entidade: "Usuario", entidadeId: id, resultado: "SUCESSO", requestId });
        return updated;
      }, true);
    } catch (error) {
      if (isPrismaCode(error, "P2002")) throw errors.conflict("USER_ALREADY_EXISTS", "Já existe um usuário com esse identificador.");
      if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "A operação conflitou com outra alteração concorrente.");
      throw error;
    }
  }
  async deactivate(id: string, versaoEsperada: number, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    requireExpectedVersion(versaoEsperada);
    if (id === actorId) throw errors.conflict("SELF_DEACTIVATION_FORBIDDEN", "Não é permitido desativar a própria conta.");
    try {
      await this.repository.transaction(async (tx) => {
        const target = await tx.findById(id);
        if (!target) throw errors.notFound("USER_NOT_FOUND", "Usuário não encontrado.");
        if (target.versao !== versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
        if (!target.ativo) throw errors.conflict("USER_ALREADY_INACTIVE", "O usuário já está desativado.");
        if (target.papel === "ADMINISTRADOR" && await tx.countActiveAdmins() <= 1) throw errors.conflict("LAST_ADMINISTRATOR", "Não é permitido desativar o último Administrador ativo.");
        if (!await tx.deactivate(id, versaoEsperada)) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
        const actor = await tx.findActorName(actorId);
        await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "DESATIVACAO_USUARIO", entidade: "Usuario", entidadeId: id, resultado: "SUCESSO", requestId });
      }, true);
    } catch (error) { if (isPrismaCode(error, "P2034")) throw errors.conflict("CONCURRENT_MODIFICATION", "A operação conflitou com outra alteração concorrente."); throw error; }
  }
  async reactivate(id: string, versaoEsperada: number, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    requireExpectedVersion(versaoEsperada);
    await this.repository.transaction(async (tx) => {
      const target = await tx.findById(id);
      if (!target) throw errors.notFound("USER_NOT_FOUND", "Usuário não encontrado.");
      if (target.versao !== versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
      if (target.ativo) throw errors.conflict("USER_ALREADY_ACTIVE", "O usuário já está ativo.");
      if (!await tx.reactivate(id, versaoEsperada)) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
      const actor = await tx.findActorName(actorId);
      await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "REATIVACAO_USUARIO", entidade: "Usuario", entidadeId: id, resultado: "SUCESSO", requestId });
    });
  }
  async resetPassword(id: string, novaSenha: string, versaoEsperada: number, actorId: string, requestId: string, actorRole: string) {
    assertRole(actorRole, ["ADMINISTRADOR"]);
    requireExpectedVersion(versaoEsperada);
    if (novaSenha.length < 12) throw errors.badRequest("PASSWORD_POLICY_VIOLATION", "A nova senha deve ter pelo menos 12 caracteres.");
    const target = await this.repository.findById(id);
    if (!target) throw errors.notFound("USER_NOT_FOUND", "Usuário não encontrado.");
    if (target.versao !== versaoEsperada) throw errors.conflict("VERSION_CONFLICT", "O usuário foi alterado por outra operação.");
    const senhaHash = await bcrypt.hash(novaSenha, 12);
    await this.repository.transaction(async (tx) => {
      const updated = await tx.resetPassword(id, versaoEsperada, target.authVersion, senhaHash);
      if (!updated) throw errors.conflict("CONCURRENT_MODIFICATION", "A senha foi alterada por outra operação.");
      const actor = await tx.findActorName(actorId);
      await tx.recordAudit({ atorUsuarioId: actorId, atorNomeSnapshot: actor?.nome, acao: "REDEFINICAO_SENHA", entidade: "Usuario", entidadeId: id, resultado: "SUCESSO", requestId });
    });
  }
}
