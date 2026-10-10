import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

/** E-mail transacional (Resend, como no coda). Sem RESEND_API_KEY, só registra no log. */
@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name);
  private readonly resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  private readonly de = process.env.EMAIL_FROM ?? "Gás Individualizado <no-reply@gas.local>";

  async enviarConvite(para: string, nome: string, link: string, contexto: string): Promise<void> {
    const assunto = "Seu convite para acompanhar o consumo de gás";
    const texto = `Olá, ${nome}.\n\nVocê foi convidado para ${contexto}.\nCrie sua senha em: ${link}\n\nO link vale por 7 dias.`;
    if (!this.resend) {
      this.log.log(`[e-mail não enviado: sem RESEND_API_KEY] para=${para} link=${link}`);
      return;
    }
    await this.resend.emails.send({ from: this.de, to: para, subject: assunto, text: texto });
  }
}
