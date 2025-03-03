import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { VendorModule } from './vendors/vendor.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import fileConfig from './files/config/file.config';
import facebookConfig from './auth-facebook/config/facebook.config';
import googleConfig from './auth-google/config/google.config';
import twitterConfig from './auth-twitter/config/twitter.config';
import appleConfig from './auth-apple/config/apple.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthAppleModule } from './auth-apple/auth-apple.module';
import { AuthFacebookModule } from './auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from './auth-google/auth-google.module';
import { AuthTwitterModule } from './auth-twitter/auth-twitter.module';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { MailerModule } from './mailer/mailer.module';
import { MongooseModule } from '@nestjs/mongoose';
import { MongooseConfigService } from './database/mongoose-config.service';
import { DatabaseConfig } from './database/config/database-config.type';
import { CartModule } from './cart/cart.module';
import { StripeConnectModule } from './stripe-connect/stripe-connect.module';
import { StripeModule } from './stripe/stripe.module';
import { TransactionModule } from './transactions/transaction.module';
import { TicketModule } from './tickets/ticket.module';
import { PayoutModule } from './payout/payout.module';
import { ProductItemModule } from './product-item/product-item.module';
import { ProductTemplateModule } from './product-template/product-template.module';
import { InvoiceModule } from './invoice/invoice.module';
import { SupportTicketModule } from './support-ticket/support-ticket.module';
import { BookingItemModule } from './booking-item/booking-item.module';
import { StaffUserModule } from './staff-user/staff-user.module';
import { BookingAssignmentModule } from './booking-assignment/booking-assignment.module';
import { BookingAvailabilityModule } from './booking-availability/booking-availability.module';
import { StaffRoleModule } from './staff-role/staff-role.module';
import { RoleShiftModule } from './role-shift/role-shift.module';
import { StaffScheduleModule } from './staff-schedule/staff-schedule.module';
import { ScheduleExceptionModule } from './schedule-exception/schedule-exception.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingCalendarModule } from './booking-calendar/booking-calendar.module';

// <database-block>
const infrastructureDatabaseModule = (databaseConfig() as DatabaseConfig)
  .isDocumentDatabase
  ? MongooseModule.forRootAsync({
      useClass: MongooseConfigService,
    })
  : TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    });
// </database-block>

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        facebookConfig,
        googleConfig,
        twitterConfig,
        appleConfig,
      ],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    CartModule,
    VendorModule,
    FilesModule,
    AuthModule,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthTwitterModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    TicketModule,
    StripeConnectModule,
    StripeModule,
    PayoutModule,
    ProductItemModule,
    ProductTemplateModule,
    TransactionModule,
    InvoiceModule,
    SupportTicketModule,
    BookingItemModule,
    StaffUserModule,
    BookingAssignmentModule,
    BookingAvailabilityModule,
    StaffRoleModule,
    RoleShiftModule,
    StaffScheduleModule,
    ScheduleExceptionModule,
    AvailabilityModule,
    BookingCalendarModule,
  ],
})
export class AppModule {}