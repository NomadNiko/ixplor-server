import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { MailData } from './interfaces/mail-data.interface';
import { MaybeType } from '../utils/types/maybe.type';
import { MailerService } from '../mailer/mailer.service';
import path from 'path';
import { AllConfigType } from '../config/config.type';
import { TicketEmailData } from './interfaces/ticket-email-data.interface';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async userSignUp(mailData: MailData<{ hash: string }>): Promise<void> {
    const i18n = I18nContext.current();
    const emailConfirmTitle = await i18n?.translate('common.confirmEmail') || 'Confirm email';
    const text1 = await i18n?.translate('confirm-email.text1') || 'Hey!';
    const text2 = await i18n?.translate('confirm-email.text2') || "You're almost ready to start enjoying";
    const text3 = await i18n?.translate('confirm-email.text3') || 'Simply click the big blue button below to verify your email address.';

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/confirm-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url.toString()} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'activation.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async forgotPassword(
    mailData: MailData<{ hash: string; tokenExpires: number }>,
  ): Promise<void> {
    const i18n = I18nContext.current();
    const resetPasswordTitle = await i18n?.translate('common.resetPassword') || 'Reset password';
    const text1 = await i18n?.translate('reset-password.text1') || 'Forgot it again?';
    const text2 = await i18n?.translate('reset-password.text2') || 'We got you Fam.';
    const text3 = await i18n?.translate('reset-password.text3') || 'Just press the button below and follow the instructions.';
    const text4 = await i18n?.translate('reset-password.text4') || 'We’ll have you up and running in no time.';
    const text5 = await i18n?.translate('reset-password.text5') || 'If you did not make this request then please ignore this email.';

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/password-change',
    );
    url.searchParams.set('hash', mailData.data.hash);
    url.searchParams.set('expires', mailData.data.tokenExpires.toString());

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: resetPasswordTitle,
      text: `${url.toString()} ${resetPasswordTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'reset-password.hbs',
      ),
      context: {
        title: resetPasswordTitle,
        url: url.toString(),
        actionTitle: resetPasswordTitle,
        app_name: this.configService.get('app.name', {
          infer: true,
        }),
        text1,
        text2,
        text3,
        text4,
        text5
      },
    });
  }

  async sendSupportTicketEmail(
    mailData: MailData<TicketEmailData>,
  ): Promise<void> {
    const i18n = I18nContext.current();
    
    // Default texts
    let headingText = 'Support Ticket Update';
    let subjectText = 'Update to Your Support Ticket';
    let mainMessage = 'There has been an update to your support ticket.';
    let latestUpdateText = 'Latest Update';
    let ticketInfoText = 'Ticket Information';
    let actionButtonText = 'View Ticket';
    
    // Set appropriate texts based on event type
    switch (mailData.data.eventType) {
      case 'created':
        headingText = await i18n?.translate('support-ticket.created.heading') || 'Support Ticket Created';
        subjectText = await i18n?.translate('support-ticket.created.subject', { 
          args: { ticketId: mailData.data.ticketId } 
        }) || `New Support Ticket Created: ${mailData.data.ticketId}`;
        mainMessage = await i18n?.translate('support-ticket.created.message') || 
          'Your support ticket has been created successfully.';
        break;
        
      case 'updated':
        headingText = await i18n?.translate('support-ticket.updated.heading') || 'Support Ticket Updated';
        subjectText = await i18n?.translate('support-ticket.updated.subject', { 
          args: { ticketId: mailData.data.ticketId } 
        }) || `Update to Your Support Ticket: ${mailData.data.ticketId}`;
        mainMessage = await i18n?.translate('support-ticket.updated.message') || 
          'Your support ticket has been updated.';
        break;
        
      case 'assigned':
        headingText = await i18n?.translate('support-ticket.assigned.heading') || 'Support Ticket Assigned';
        subjectText = await i18n?.translate('support-ticket.assigned.subject', { 
          args: { ticketId: mailData.data.ticketId } 
        }) || `Your Support Ticket Has Been Assigned: ${mailData.data.ticketId}`;
        mainMessage = await i18n?.translate('support-ticket.assigned.message', { 
          args: { assigneeName: mailData.data.assignedToName } 
        }) || `Your support ticket has been assigned to ${mailData.data.assignedToName}.`;
        break;
        
      case 'resolved':
        headingText = await i18n?.translate('support-ticket.resolved.heading') || 'Support Ticket Resolved';
        subjectText = await i18n?.translate('support-ticket.resolved.subject', { 
          args: { ticketId: mailData.data.ticketId } 
        }) || `Your Support Ticket Has Been Resolved: ${mailData.data.ticketId}`;
        mainMessage = await i18n?.translate('support-ticket.resolved.message') || 
          'Your support ticket has been resolved.';
        break;
    }
    
    // Additional translations
    latestUpdateText = await i18n?.translate('support-ticket.latestUpdate') || 'Latest Update';
    ticketInfoText = await i18n?.translate('support-ticket.ticketInfo') || 'Ticket Information';
    actionButtonText = await i18n?.translate('support-ticket.viewTicket') || 'View Your Ticket';
    
    await this.mailerService.sendMail({
      to: mailData.to,
      subject: subjectText,
      text: `${subjectText} - ${mailData.data.ticketUrl}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'support-ticket.hbs',
      ),
      context: {
        ...mailData.data,
        headingText,
        mainMessage,
        latestUpdateText,
        ticketInfoText,
        actionButtonText,
        currentYear: new Date().getFullYear(),
        app_name: this.configService.get('app.name', { infer: true }),
      },
    });
  }

  async confirmNewEmail(mailData: MailData<{ hash: string }>): Promise<void> {
    const i18n = I18nContext.current();
    const emailConfirmTitle = await i18n?.translate('common.confirmEmail') || 'Confirm email';
    const text1 = await i18n?.translate('confirm-new-email.text1') || 'Hey!';
    const text2 = await i18n?.translate('confirm-new-email.text2') || 'Confirm your new email address.';
    const text3 = await i18n?.translate('confirm-new-email.text3') || 'Simply click the big blue button below to verify your email address.';

    const url = new URL(
      this.configService.getOrThrow('app.frontendDomain', {
        infer: true,
      }) + '/confirm-new-email',
    );
    url.searchParams.set('hash', mailData.data.hash);

    await this.mailerService.sendMail({
      to: mailData.to,
      subject: emailConfirmTitle,
      text: `${url.toString()} ${emailConfirmTitle}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'confirm-new-email.hbs',
      ),
      context: {
        title: emailConfirmTitle,
        url: url.toString(),
        actionTitle: emailConfirmTitle,
        app_name: this.configService.get('app.name', { infer: true }),
        text1,
        text2,
        text3,
      },
    });
  }

  async sendTransactionReceipt(mailData: MailData<{
    userName: string;
    transactionId: string;
    amount: number;
    purchaseDate: string;
    productItems: Array<{
      productName: string;
      quantity: number;
      price: number;
      date?: string;
      time?: string;
    }>;
    stripeReceiptUrl?: string;
  }>): Promise<void> {
    const i18n = I18nContext.current();
    const receiptTitle = await i18n?.translate('common.transactionReceipt') || 'Your Purchase Receipt';
    const text1 = await i18n?.translate('transaction-receipt.text1') || 'Thank you for your purchase!';
    const text2 = await i18n?.translate('transaction-receipt.text2') || 'Here are the details of your order:';
    const text3 = await i18n?.translate('transaction-receipt.text3') || 'You can view your tickets in your account dashboard.';
  
    await this.mailerService.sendMail({
      to: mailData.to,
      subject: `${receiptTitle} #${mailData.data.transactionId.slice(-6)}`,
      text: `${receiptTitle} for Transaction #${mailData.data.transactionId.slice(-6)}`,
      templatePath: path.join(
        this.configService.getOrThrow('app.workingDirectory', {
          infer: true,
        }),
        'src',
        'mail',
        'mail-templates',
        'transaction-receipt.hbs',
      ),
      context: {
        title: receiptTitle,
        userName: mailData.data.userName,
        transactionId: mailData.data.transactionId,
        formattedTransactionId: mailData.data.transactionId.slice(-6),
        amount: (mailData.data.amount / 100).toFixed(2),
        purchaseDate: mailData.data.purchaseDate,
        productItems: mailData.data.productItems.map(item => ({
          ...item,
          formattedPrice: (item.price).toFixed(2),
          formattedTotal: (item.price * item.quantity).toFixed(2)
        })),
        appName: this.configService.get('app.name', { infer: true }),
        stripeReceiptUrl: mailData.data.stripeReceiptUrl,
        ixplorDashUrl: "https://ixplor.app/dashboard/",
        text1,
        text2,
        text3,
        currentYear: new Date().getFullYear() // Add this to fix the template error
      },
    });
  }
}