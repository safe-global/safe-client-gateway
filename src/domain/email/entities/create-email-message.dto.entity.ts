export class CreateEmailMessageDto {
  to: string[];
  template: string;
  subject: string;
  substitutions: Record<string, string> | null;
}
