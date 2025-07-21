import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type PrismaModelName = keyof typeof Prisma.ModelName;

@ValidatorConstraint({ async: true })
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    const [model, field] = args.constraints as [PrismaModelName, string];

    try {
      const modelClient = prisma[model] as {
        findFirst: (args: {
          where: { [key: string]: unknown };
        }) => Promise<unknown>;
      };

      const record = await modelClient.findFirst({
        where: {
          [field]: value,
        },
      });

      return !record;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be unique`;
  }
}

export function IsUnique(
  model: PrismaModelName,
  field: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [model, field],
      validator: IsUniqueConstraint,
    });
  };
}
