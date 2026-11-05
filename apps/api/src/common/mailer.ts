import { Logger } from "@nestjs/common";
import { appendFileSync } from "node:fs";
import nodemailer from "nodemailer";
import type { AppConfig } from "../config";

export const MAILER = Symbol("MAILER");

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Kotak keluar in-memory untuk pengujian. */
export const memoryOutbox: MailMessage[] = [];

class MemoryMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    memoryOutbox.push(message);
  }
}

/** Pengembangan lokal: mencetak email ke konsol (termasuk tautan). Tidak boleh dipakai di produksi. */
class LogMailer implements Mailer {
  private readonly logger = new Logger("Mail");
  async send(message: MailMessage): Promise<void> {
    this.logger.log(`\n--- EMAIL (dev) ---\nKe: ${message.to}\nSubjek: ${message.subject}\n\n${message.text}\n-------------------`);
  }
}

/** Khusus E2E: menulis email sebagai JSON-lines agar test dapat membaca tautan. Produksi menolak transport ini lewat konfigurasi. */
class FileMailer implements Mailer {
  constructor(private readonly file: string) {}
  async send(message: MailMessage): Promise<void> {
    appendFileSync(this.file, `${JSON.stringify(message)}\n`);
  }
}

class SmtpMailer implements Mailer {
  private readonly transport;
  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: message.to, subject: message.subject, text: message.text });
  }
}

export function createMailer(cfg: AppConfig): Mailer {
  switch (cfg.MAIL_TRANSPORT) {
    case "smtp":
      return new SmtpMailer(cfg.SMTP_URL ?? "", cfg.MAIL_FROM);
    case "memory":
      return new MemoryMailer();
    case "file":
      return new FileMailer(cfg.MAIL_OUTBOX_FILE ?? "");
    default:
      return new LogMailer();
  }
}
