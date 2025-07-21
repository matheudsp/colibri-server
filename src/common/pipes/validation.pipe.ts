import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Logger } from '@nestjs/common';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(ValidationPipe.name);

  async transform(
    value: unknown,
    { metatype, type }: ArgumentMetadata,
  ): Promise<any> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    this.logger.debug(`Validating ${type} ${metatype.name}`);

    const object = plainToInstance(
      metatype as new () => Record<string, any>,
      value,
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      },
    );

    const errors = await validate(object, {
      skipMissingProperties: false,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: {
        target: false,
        value: false,
      },
    });

    if (errors.length > 0) {
      this.logger.warn(`Validation failed for ${metatype.name}`, errors);
      throw new BadRequestException(this.formatErrors(errors));
    }

    return object;
  }

  private toValidate(metatype: new (...args: any[]) => unknown): boolean {
    const types: (new (...args: any[]) => any)[] = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): Record<string, unknown>[] {
    return errors.map((error) => {
      return {
        property: error.property,
        constraints: error.constraints,
        children: error.children?.length
          ? this.formatErrors(error.children)
          : undefined,
      };
    });
  }
}
