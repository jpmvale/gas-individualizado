import { BadRequestException, Injectable } from "@nestjs/common";
import { Algorithm, hash, verify } from "@node-rs/argon2";

const PROIBIDAS = new Set(["12345678", "123456789", "password", "senha123", "senha1234", "11111111"]);

/** RN-001: argon2id, mínimo de 8 caracteres e sem senhas óbvias. */
@Injectable()
export class SenhaService {
  validar(senha: string): void {
    if (senha.length < 8) throw new BadRequestException("A senha deve ter ao menos 8 caracteres.");
    if (PROIBIDAS.has(senha.toLowerCase())) throw new BadRequestException("Senha muito comum; escolha outra.");
  }

  hash(senha: string): Promise<string> {
    return hash(senha, { algorithm: Algorithm.Argon2id });
  }

  conferir(senhaHash: string, senha: string): Promise<boolean> {
    return verify(senhaHash, senha);
  }
}
